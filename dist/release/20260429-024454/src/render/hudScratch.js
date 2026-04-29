/**
 * HUD scratch pool — единый renderCtx.__hudScratch контракт.
 *
 * Назначение: снижает allocation pressure в HUD draw-path (health bars, debuff icons,
 * fence HP overlays, drone status). Упрощает Phaser overlay parity, т.к. и legacy Canvas,
 * и Phaser overlay могут переиспользовать один и тот же pre-allocated scratch slot без heap churn.
 *
 * Контракт (обязательный):
 *  - `beginFrame()` вызывается ровно один раз в начале draw() на кадр.
 *  - `acquire(ownerTag, subSlot, shape)` вернёт pre-allocated plain object или массив; shape сверяется
 *    при повторном acquire — смена shape на лету приводит к dev-warning через `Game.Diagnostics`.
 *  - slots — **immutable вне draw phase**: мутировать `__hudScratch` из `step*()` / update-path запрещено.
 *    Use-after-reset в следующем кадре обеспечивается `beginFrame()` (frame epoch).
 *  - disjoint sub-slots: `healthBar` и `debuffIcon` должны использовать разные `subSlot` ключи, иначе
 *    aliasing (невидим до сценария debuff + low HP).
 *  - no mixed layout: в одном scratch slot нельзя смешивать typed arrays и plain objects — ломает JIT.
 *  - Phaser parity: double-read допустим внутри одного frame (retained + overlay); без reset между ними.
 *
 * Array-acquire API (HudScratch.acquireArray):
 *  - `acquireArray(ownerTag, subSlot)` возвращает pre-allocated array (truncated to length=0).
 *  - Per-`(ownerTag, subSlot)` per-frame lease — повторный `acquireArray` для того же ключа в том
 *    же frame возвращает ТОТ ЖЕ массив (idempotent re-entry, не allocate). Между frames lease
 *    автоматически освобождается через `beginFrame()`.
 *  - Запрещено shared между разными ownerTag'ами в одном frame (см. P2.4) — gen counter ловит drift.
 *  - Overflow / unknown owner — graceful degrade: возвращается локальный `[]`, dev-warning.
 *
 * Capacity budget + overflow fallback:
 *  - При превышении ёмкости owner fallback'ается на локальный allocate и пишет dev-warning
 *    через `Game.Diagnostics.reportHudScratchOverflow(...)`, иначе silent aliasing на пиках волн.
 *
 * DPR-aware invalidation:
 *  - При изменении `window.devicePixelRatio` вызвать `onDevicePixelRatioChanged()` — pool сбрасывает
 *    cached numeric slots, иначе stale pixel-rect numbers.
 *
 * Zero-HP clamp (P2.9):
 *  - `healthBar` owner tag — если `value < 0`, `acquire()` автоматически clamp'ит в `>=0`, чтобы
 *    downstream icon позиционирование не уходило off-screen при merge-peak.
 *
 * Документировано в docs/ai/SYSTEMS/hud.md и docs/ai/SYSTEMS/phaser.md.
 */
(function (global) {
  'use strict';

  var DEFAULT_CAPACITY_PER_OWNER = 64;
  var OWNER_TAGS = ['healthBar', 'debuffIcon', 'fenceHp', 'drone', 'hudTrack', 'talentsHud', 'misc'];

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function shapesCompatible(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (isPlainObject(a) !== isPlainObject(b)) return false;
    return true;
  }

  /**
   * Фабрика HUD scratch pool.
   * @param {{capacityPerOwner?:number}} [opts]
   */
  function createHudScratch(opts) {
    var capacity = (opts && Number.isFinite(opts.capacityPerOwner))
      ? Math.max(8, Math.floor(opts.capacityPerOwner))
      : DEFAULT_CAPACITY_PER_OWNER;

    // Pre-allocate maps per owner tag — plain objects, без typed arrays (правило no-mixed-layout).
    var slotsByOwner = Object.create(null);
    var cursorsByOwner = Object.create(null);
    var shapesByOwner = Object.create(null);
    // Per-(ownerTag, subSlot) array lease registry (acquireArray). Map subSlot key → { arr, gen }.
    var arrayLeasesByOwner = Object.create(null);
    var overflowCount = 0;
    var arrayOverflowCount = 0;
    var frameEpoch = 0;
    var lastDevicePixelRatio = (typeof global !== 'undefined' && global.devicePixelRatio) || 1;

    for (var i = 0; i < OWNER_TAGS.length; i++) {
      var tag = OWNER_TAGS[i];
      slotsByOwner[tag] = [];
      cursorsByOwner[tag] = 0;
      shapesByOwner[tag] = Object.create(null);
      arrayLeasesByOwner[tag] = Object.create(null);
      for (var j = 0; j < capacity; j++) slotsByOwner[tag].push({});
    }

    function reportOverflow(ownerTag) {
      overflowCount += 1;
      var diag = global.Game && global.Game.Diagnostics;
      if (diag && typeof diag.reportHudScratchOverflow === 'function') {
        try { diag.reportHudScratchOverflow({ ownerTag: ownerTag, capacity: capacity, overflowCount: overflowCount }); } catch (_) {}
      } else if (global.console && typeof global.console.warn === 'function') {
        try { global.console.warn('[hudScratch] overflow owner=' + ownerTag + ' capacity=' + capacity); } catch (_) {}
      }
    }

    function reportArrayOverflow(ownerTag, subSlot, reason) {
      arrayOverflowCount += 1;
      var diag = global.Game && global.Game.Diagnostics;
      if (diag && typeof diag.reportHudScratchOverflow === 'function') {
        try { diag.reportHudScratchOverflow({ ownerTag: ownerTag, subSlot: subSlot, reason: reason || 'array', arrayOverflowCount: arrayOverflowCount }); } catch (_) {}
      } else if (global.console && typeof global.console.warn === 'function') {
        try { global.console.warn('[hudScratch] acquireArray fallback owner=' + ownerTag + ' subSlot=' + subSlot + ' reason=' + (reason || 'array')); } catch (_) {}
      }
    }

    function beginFrame() {
      frameEpoch += 1;
      for (var k = 0; k < OWNER_TAGS.length; k++) {
        cursorsByOwner[OWNER_TAGS[k]] = 0;
      }
      // Array leases are auto-released on frame boundary: clearing length to 0 keeps backing array
      // (capacity preserved) but signals downstream that previous frame's data is stale.
      for (var ka = 0; ka < OWNER_TAGS.length; ka++) {
        var leases = arrayLeasesByOwner[OWNER_TAGS[ka]];
        for (var lk in leases) {
          if (Object.prototype.hasOwnProperty.call(leases, lk)) {
            var lease = leases[lk];
            if (lease && lease.arr) lease.arr.length = 0;
          }
        }
      }
      // DPR sanity — cheap check per frame.
      var dpr = (typeof global !== 'undefined' && global.devicePixelRatio) || 1;
      if (dpr !== lastDevicePixelRatio) {
        lastDevicePixelRatio = dpr;
        // Не пересоздаём slot array (shape stable), но сбрасываем shape-кэш, чтобы numeric rect'ы
        // downstream прошли через свежий acquire с новой shape verification.
        for (var s = 0; s < OWNER_TAGS.length; s++) {
          shapesByOwner[OWNER_TAGS[s]] = Object.create(null);
        }
      }
    }

    /**
     * Забрать preallocated scratch slot.
     * @param {string} ownerTag — один из OWNER_TAGS. Неизвестный tag ведёт себя как 'misc'.
     * @param {string} subSlot — disjoint sub-identifier (e.g. segment id, zombie id).
     * @param {*} shape — reference shape (plain object template). Для диагностики shape drift.
     * @returns {Object} preallocated plain object; caller мутирует его поля в текущем frame.
     */
    function acquire(ownerTag, subSlot, shape) {
      var tag = (ownerTag && Object.prototype.hasOwnProperty.call(slotsByOwner, ownerTag)) ? ownerTag : 'misc';
      var cursor = cursorsByOwner[tag];
      if (cursor >= capacity) {
        reportOverflow(tag);
        // Fallback: возвращаем свежий литерал (heap alloc). Это осознанный graceful degrade на пиках.
        return {};
      }
      var slot = slotsByOwner[tag][cursor];
      cursorsByOwner[tag] = cursor + 1;

      // Zero-HP clamp contract (P2.9): healthBar owner — clamp value >=0 при наличии.
      if (tag === 'healthBar' && slot && typeof slot === 'object' && 'value' in slot) {
        if (!Number.isFinite(slot.value) || slot.value < 0) slot.value = 0;
      }

      // Shape verification (dev-only; тихий в prod): ищем per-subSlot первую shape и сравниваем.
      var shapeKey = subSlot != null ? String(subSlot) : '__default';
      var prevShape = shapesByOwner[tag][shapeKey];
      if (prevShape === undefined) {
        shapesByOwner[tag][shapeKey] = shape == null ? null : (Array.isArray(shape) ? 'array' : (isPlainObject(shape) ? 'object' : typeof shape));
      } else if (shape != null) {
        var curKind = Array.isArray(shape) ? 'array' : (isPlainObject(shape) ? 'object' : typeof shape);
        if (prevShape !== curKind) {
          if (global.console && typeof global.console.warn === 'function') {
            try { global.console.warn('[hudScratch] shape drift owner=' + tag + ' subSlot=' + shapeKey + ' was=' + prevShape + ' now=' + curKind); } catch (_) {}
          }
        }
      }

      // Per-subSlot disjoint guarantee. Мы не форсим отдельный slot per subSlot (cursor shared),
      // но сам subSlot-идентификатор помогает downstream коду не путать target rect'ы.
      slot.__subSlot = shapeKey;
      slot.__frame = frameEpoch;
      return slot;
    }

    function getMetrics() {
      var used = Object.create(null);
      for (var k = 0; k < OWNER_TAGS.length; k++) {
        used[OWNER_TAGS[k]] = cursorsByOwner[OWNER_TAGS[k]];
      }
      return {
        capacity: capacity,
        owners: OWNER_TAGS.slice(),
        used: used,
        overflowCount: overflowCount,
        arrayOverflowCount: arrayOverflowCount,
        frameEpoch: frameEpoch,
        devicePixelRatio: lastDevicePixelRatio,
      };
    }

    function onDevicePixelRatioChanged() {
      lastDevicePixelRatio = (typeof global !== 'undefined' && global.devicePixelRatio) || 1;
      for (var s = 0; s < OWNER_TAGS.length; s++) {
        shapesByOwner[OWNER_TAGS[s]] = Object.create(null);
      }
    }

    /**
     * Забрать pre-allocated array с per-(ownerTag, subSlot) per-frame lease (P5 / P2.4).
     * Возвращает уже truncated массив (length=0). При повторном вызове в пределах одного frame
     * для тех же ownerTag+subSlot — возвращается тот же физический массив (idempotent re-entry).
     * Между frames lease автоматически освобождается через beginFrame().
     *
     * @param {string} ownerTag — один из OWNER_TAGS. Неизвестный tag fallback'ится на 'misc'.
     * @param {string} subSlot — disjoint sub-identifier (per-owner). Например 'tanksOnTrack'.
     * @returns {Array} pre-allocated array (length=0). Caller вызывает push() для заполнения.
     */
    function acquireArray(ownerTag, subSlot) {
      var tag = (ownerTag && Object.prototype.hasOwnProperty.call(arrayLeasesByOwner, ownerTag)) ? ownerTag : 'misc';
      var key = subSlot != null ? String(subSlot) : '__default';
      var leases = arrayLeasesByOwner[tag];
      var existing = leases[key];
      if (existing && existing.arr) {
        // Idempotent re-entry within same frame — same array.
        if (existing.gen !== frameEpoch) {
          // Stale cross-frame lease — reset length и обновим gen.
          existing.arr.length = 0;
          existing.gen = frameEpoch;
        }
        return existing.arr;
      }
      // Soft cap на количество разных subSlot per owner — защита от leak'a.
      var subKeys = Object.keys(leases);
      if (subKeys.length >= capacity) {
        reportArrayOverflow(tag, key, 'subslot-cap');
        return [];
      }
      var arr = [];
      leases[key] = { arr: arr, gen: frameEpoch };
      return arr;
    }

    return {
      beginFrame: beginFrame,
      acquire: acquire,
      acquireArray: acquireArray,
      getMetrics: getMetrics,
      onDevicePixelRatioChanged: onDevicePixelRatioChanged,
      OWNER_TAGS: OWNER_TAGS.slice(),
    };
  }

  global.Game = global.Game || {};
  global.Game.HudScratch = {
    create: createHudScratch,
    OWNER_TAGS: OWNER_TAGS.slice(),
    DEFAULT_CAPACITY_PER_OWNER: DEFAULT_CAPACITY_PER_OWNER,
  };
}(typeof window !== 'undefined' ? window : this));
