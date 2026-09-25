/**
 * Обёртка над локальным хранилищем: load/save состояния и метаданных (lastSeenAt, версия).
 */
(function (global) {
  'use strict';

  var SAVE_KEY = 'progress';
  var SAVE_VERSION = 2;
  var SAVE_SLOTS_META_KEY = 'saveSlotsMeta_v1';
  var SAVE_SLOT_KEY_PREFIX = 'saveSlot_v1_';
  // 10 manual/auto slots (0..8 manual, 9 pre-retry auto) + 1 wave autosave slot (10).
  // Backward compatible: legacy `saveSlotsMeta_v1` with 10 entries is padded up by
  // normalizeSaveSlotsMeta(), so no SAVE_VERSION / meta-key migration is needed.
  var SAVE_SLOTS_COUNT = 11;
  var SAVE_SLOT_NAME_MAX_LEN = 20;
  var AUTO_SLOT_INDEX = 9;
  var AUTO_SLOT_NAME = 'Auto';
  // Отдельная ячейка автосейва «после завершения волны атаки». Не переиспользует
  // pre-retry auto slot (index 9): restart-simulation path читает именно его, и
  // перезапись сломала бы «Перезапустить симуляцию».
  var WAVE_AUTO_SLOT_INDEX = 10;
  var WAVE_AUTO_SLOT_NAME = 'AutoWave';

  function normalizeTotalDamageDealtRaw(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
  }

  function normalizeDamagePointsSpent(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
  }

  function normalizeSafeCounter(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)));
  }

  function safeParse(raw, fallback) {
    try {
      if (raw == null || raw === '') return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function getDefaultSlotName(index) {
    if (index === AUTO_SLOT_INDEX) return AUTO_SLOT_NAME;
    if (index === WAVE_AUTO_SLOT_INDEX) return WAVE_AUTO_SLOT_NAME;
    return 'Слот ' + (index + 1);
  }

  function getSlotName(slotMeta, index) {
    var name = slotMeta && typeof slotMeta === 'object' ? slotMeta.name : '';
    return sanitizeSlotName(index, name);
  }

  function sanitizeSlotName(index, name) {
    if (index === AUTO_SLOT_INDEX) return AUTO_SLOT_NAME;
    if (index === WAVE_AUTO_SLOT_INDEX) return WAVE_AUTO_SLOT_NAME;
    var text = typeof name === 'string' ? name : '';
    text = text.trim();
    if (text.length > SAVE_SLOT_NAME_MAX_LEN) {
      text = text.slice(0, SAVE_SLOT_NAME_MAX_LEN);
    }
    if (!text.length) return getDefaultSlotName(index);
    return text;
  }

  function sanitizeLastSavedAt(value) {
    var num = Number(value);
    if (!Number.isFinite(num)) return null;
    var ts = Math.floor(num);
    if (ts <= 0) return null;
    return ts;
  }

  function createDefaultSaveSlotsMeta() {
    var slots = [];
    for (var i = 0; i < SAVE_SLOTS_COUNT; i++) {
      slots.push({ name: getDefaultSlotName(i), lastSavedAt: null });
    }
    return { slots: slots };
  }

  function normalizeSaveSlotsMeta(payload) {
    var normalized = createDefaultSaveSlotsMeta();
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.slots)) return normalized;
    for (var i = 0; i < SAVE_SLOTS_COUNT; i++) {
      var src = payload.slots[i];
      var name = src && typeof src === 'object' ? src.name : '';
      var lastSavedAt = src && typeof src === 'object' ? src.lastSavedAt : null;
      normalized.slots[i].name = sanitizeSlotName(i, name);
      normalized.slots[i].lastSavedAt = sanitizeLastSavedAt(lastSavedAt);
    }
    return normalized;
  }

  function saveSaveSlotsMeta(meta) {
    if (!global.localStorage) return false;
    global.localStorage.setItem(SAVE_SLOTS_META_KEY, JSON.stringify(meta));
    return true;
  }

  function reportStorageError(scope, error) {
    try {
      var details = error && error.message ? error.message : String(error || 'unknown');
      if (global.console && typeof global.console.warn === 'function') {
        global.console.warn('[Storage][' + scope + '] ' + details);
      }
    } catch (_) {}
  }

  function getSlotDataKey(index) {
    return SAVE_SLOT_KEY_PREFIX + String(index);
  }

  function safeGetItem(key) {
    try {
      if (!global.localStorage) return { ok: false, value: null, error: 'no_local_storage' };
      return { ok: true, value: global.localStorage.getItem(key), error: null };
    } catch (e) {
      reportStorageError('getItem:' + key, e);
      return { ok: false, value: null, error: e };
    }
  }

  function safeSetItem(key, value) {
    try {
      if (!global.localStorage) return { ok: false, error: 'no_local_storage' };
      global.localStorage.setItem(key, value);
      return { ok: true, error: null };
    } catch (e) {
      reportStorageError('setItem:' + key, e);
      return { ok: false, error: e };
    }
  }

  function safeRemoveItem(key) {
    try {
      if (!global.localStorage) return { ok: false, error: 'no_local_storage' };
      global.localStorage.removeItem(key);
      return { ok: true, error: null };
    } catch (e) {
      reportStorageError('removeItem:' + key, e);
      return { ok: false, error: e };
    }
  }

  function readMetaRaw() {
    var metaRead = safeGetItem(SAVE_SLOTS_META_KEY);
    if (!metaRead.ok) return { ok: false, meta: createDefaultSaveSlotsMeta(), hadRaw: false, error: metaRead.error };
    var hadRaw = metaRead.value != null && metaRead.value !== '';
    var parsed = safeParse(metaRead.value, null);
    return { ok: true, meta: normalizeSaveSlotsMeta(parsed), hadRaw: hadRaw, error: null };
  }

  function writeMetaSafe(meta) {
    var normalized = normalizeSaveSlotsMeta(meta);
    var res = safeSetItem(SAVE_SLOTS_META_KEY, JSON.stringify(normalized));
    return { ok: !!res.ok, meta: normalized, error: res.error || null };
  }

  function hasAnySlotPayloadRaw() {
    for (var i = 0; i < SAVE_SLOTS_COUNT; i++) {
      var slotRead = safeGetItem(getSlotDataKey(i));
      if (!slotRead.ok) continue;
      if (slotRead.value != null && slotRead.value !== '') return true;
    }
    return false;
  }

  function updateMetaField(index, updates) {
    var slotIndex = Number(index);
    if (!Number.isFinite(slotIndex)) return { ok: false, meta: loadSaveSlotsMeta(), error: 'invalid_index' };
    slotIndex = Math.floor(slotIndex);
    if (slotIndex < 0 || slotIndex >= SAVE_SLOTS_COUNT) return { ok: false, meta: loadSaveSlotsMeta(), error: 'out_of_range' };
    var meta = loadSaveSlotsMeta();
    var slot = meta.slots[slotIndex] || { name: getDefaultSlotName(slotIndex), lastSavedAt: null };
    if (updates && Object.prototype.hasOwnProperty.call(updates, 'name')) {
      slot.name = sanitizeSlotName(slotIndex, updates.name);
    }
    if (updates && Object.prototype.hasOwnProperty.call(updates, 'lastSavedAt')) {
      slot.lastSavedAt = sanitizeLastSavedAt(updates.lastSavedAt);
    }
    meta.slots[slotIndex] = slot;
    var writeMeta = writeMetaSafe(meta);
    if (!writeMeta.ok) {
      return { ok: false, meta: writeMeta.meta, error: writeMeta.error };
    }
    return { ok: true, meta: writeMeta.meta, error: null };
  }

  function migrateLegacyProgressIfNeeded() {
    var metaRead = readMetaRaw();
    var meta = metaRead.meta;
    var hasSlotData = hasAnySlotPayloadRaw();
    if (metaRead.hadRaw || hasSlotData) {
      writeMetaSafe(meta);
      return { ok: true, migrated: false, meta: meta, error: null };
    }

    var legacyRead = safeGetItem(SAVE_KEY);
    if (!legacyRead.ok || !legacyRead.value) {
      writeMetaSafe(meta);
      return { ok: true, migrated: false, meta: meta, error: null };
    }

    var legacyParsed = safeParse(legacyRead.value, null);
    if (!legacyParsed || typeof legacyParsed !== 'object') {
      writeMetaSafe(meta);
      return { ok: true, migrated: false, meta: meta, error: null };
    }

    var slotWrite = safeSetItem(getSlotDataKey(0), JSON.stringify(legacyParsed));
    if (!slotWrite.ok) {
      writeMetaSafe(meta);
      return { ok: false, migrated: false, meta: meta, error: slotWrite.error };
    }

    meta.slots[0].name = sanitizeSlotName(0, meta.slots[0].name);
    meta.slots[0].lastSavedAt = Date.now();
    var metaWrite = writeMetaSafe(meta);
    return { ok: !!metaWrite.ok, migrated: !!metaWrite.ok, meta: metaWrite.meta, error: metaWrite.error || null };
  }

  function loadSlotPayloadRaw(index) {
    var slotIndex = Number(index);
    if (!Number.isFinite(slotIndex)) return { ok: false, payload: null, error: 'invalid_index' };
    slotIndex = Math.floor(slotIndex);
    if (slotIndex < 0 || slotIndex >= SAVE_SLOTS_COUNT) return { ok: false, payload: null, error: 'out_of_range' };
    var read = safeGetItem(getSlotDataKey(slotIndex));
    if (!read.ok) return { ok: false, payload: null, error: read.error };
    if (!read.value) return { ok: true, payload: null, error: null };
    var parsed = safeParse(read.value, null);
    if (!parsed || typeof parsed !== 'object') {
      reportStorageError('loadSlot:parse:' + slotIndex, new Error('Invalid slot JSON'));
      return { ok: false, payload: null, error: 'parse_error' };
    }
    return { ok: true, payload: parsed, error: null };
  }

  var slotStorageBackend = {
    listSlots: function () {
      var migration = migrateLegacyProgressIfNeeded();
      var meta = migration.meta || createDefaultSaveSlotsMeta();
      var slots = [];
      for (var i = 0; i < SAVE_SLOTS_COUNT; i++) {
        var slotPayload = loadSlotPayloadRaw(i);
        var slotMeta = meta.slots[i] || { name: getDefaultSlotName(i), lastSavedAt: null };
        slots.push({
          index: i,
          name: getSlotName(slotMeta, i),
          lastSavedAt: sanitizeLastSavedAt(slotMeta.lastSavedAt),
          hasData: !!slotPayload.payload,
          isAuto: i === AUTO_SLOT_INDEX,
          isWaveAuto: i === WAVE_AUTO_SLOT_INDEX,
        });
      }
      if (!migration.ok) return { ok: false, meta: meta, slots: slots, error: migration.error };
      return { ok: true, meta: meta, slots: slots, error: null };
    },
    saveSlot: function (index, payload) {
      var slotIndex = Number(index);
      if (!Number.isFinite(slotIndex)) return { ok: false, error: 'invalid_index' };
      slotIndex = Math.floor(slotIndex);
      if (slotIndex < 0 || slotIndex >= SAVE_SLOTS_COUNT) return { ok: false, error: 'out_of_range' };

      migrateLegacyProgressIfNeeded();
      var serialized = serializeState(payload || {});
      serialized.version = 1;
      var write = safeSetItem(getSlotDataKey(slotIndex), JSON.stringify(serialized));
      if (!write.ok) return { ok: false, error: write.error };

      var metaRes = updateMetaField(slotIndex, {
        lastSavedAt: Date.now(),
      });
      if (!metaRes.ok) return { ok: false, error: metaRes.error };
      return { ok: true, error: null };
    },
    loadSlot: function (index) {
      migrateLegacyProgressIfNeeded();
      var loaded = loadSlotPayloadRaw(index);
      if (!loaded.ok) return { ok: false, payload: null, error: loaded.error };
      return { ok: true, payload: loaded.payload, error: null };
    },
    deleteSlot: function (index) {
      migrateLegacyProgressIfNeeded();
      if (index == null) {
        var hadError = null;
        for (var i = 0; i < SAVE_SLOTS_COUNT; i++) {
          var remove = safeRemoveItem(getSlotDataKey(i));
          if (!remove.ok && !hadError) hadError = remove.error;
        }
        var resetMeta = writeMetaSafe(createDefaultSaveSlotsMeta());
        if (!resetMeta.ok && !hadError) hadError = resetMeta.error;
        return { ok: !hadError, error: hadError };
      }
      var slotIndex = Number(index);
      if (!Number.isFinite(slotIndex)) return { ok: false, error: 'invalid_index' };
      slotIndex = Math.floor(slotIndex);
      if (slotIndex < 0 || slotIndex >= SAVE_SLOTS_COUNT) return { ok: false, error: 'out_of_range' };
      var removeOne = safeRemoveItem(getSlotDataKey(slotIndex));
      if (!removeOne.ok) return { ok: false, error: removeOne.error };
      var metaRes = updateMetaField(slotIndex, {
        name: getDefaultSlotName(slotIndex),
        lastSavedAt: null,
      });
      if (!metaRes.ok) return { ok: false, error: metaRes.error };
      return { ok: true, error: null };
    },
  };

  var activeSlotsBackend = slotStorageBackend;

  function setSlotsBackend(backend) {
    if (!backend || typeof backend !== 'object') return false;
    if (typeof backend.listSlots !== 'function') return false;
    if (typeof backend.saveSlot !== 'function') return false;
    if (typeof backend.loadSlot !== 'function') return false;
    activeSlotsBackend = backend;
    return true;
  }

  function getSlotsBackend() {
    return activeSlotsBackend;
  }

  function loadSaveSlotsMeta() {
    var list = activeSlotsBackend.listSlots();
    if (list && list.meta) return normalizeSaveSlotsMeta(list.meta);
    return createDefaultSaveSlotsMeta();
  }

  function setSlotName(index, name) {
    var res = updateMetaField(index, { name: name });
    return res && res.meta ? res.meta : loadSaveSlotsMeta();
  }

  function markSlotSaved(index, timestampMs) {
    var res = updateMetaField(index, { lastSavedAt: timestampMs });
    return res && res.meta ? res.meta : loadSaveSlotsMeta();
  }

  function hasAnySaves() {
    var list = activeSlotsBackend.listSlots();
    var slots = Array.isArray(list && list.slots) ? list.slots : [];
    for (var i = 0; i < slots.length; i++) {
      if (slots[i] && slots[i].hasData) return true;
    }
    return false;
  }

  function listSlots() {
    var result = activeSlotsBackend.listSlots();
    if (!result || typeof result !== 'object') {
      return { ok: false, meta: createDefaultSaveSlotsMeta(), slots: [], error: 'backend_invalid_response' };
    }
    return result;
  }

  function saveSlot(index, payload) {
    return activeSlotsBackend.saveSlot(index, payload);
  }

  function loadSlot(index) {
    return activeSlotsBackend.loadSlot(index);
  }

  function deleteSlot(index) {
    if (!activeSlotsBackend.deleteSlot) return { ok: false, error: 'not_supported' };
    return activeSlotsBackend.deleteSlot(index);
  }

  /**
   * Сериализуем только то, что нужно для восстановления и офлайн-расчёта.
   *
   * Canonical payload shape задокументирован в JSDoc-схеме
   * `import('./serializedStateTypes').SerializedState` (см.
   * [src/persistence/serializedStateTypes.js](./serializedStateTypes.js)).
   * Вторая авторитетная поверхность — Payload Contract Map в
   * [docs/ai/SYSTEMS/save.md](../../docs/ai/SYSTEMS/save.md); при добавлении нового поля
   * обязательно синхронизировать ОБЕ (иначе drift виден на review).
   *
   * Текущее значение `version` = `SAVE_VERSION` (2). При bump'е обязана миграция в
   * `loadGame()` / `restoreFullState()`. Неизвестные ключи при deserialize дропаются;
   * `restoreFullState()` подставляет defaults для отсутствующих полей legacy сейвов.
   * В payload НЕ пишется PII / user-identifiable data.
   *
   * @param {object} state
   * @returns {import('./serializedStateTypes').SerializedState}
   */
  /**
   * Нормализовать один slot-объект установленного чипа.
   * Derived-поля (`activeModifiers`, `uiState`) НЕ пишутся — они пересчитываются
   * `Game.HangarChipsUI.setCells()` на load (см. `calculateActiveModifiers`).
   * @param {object} chip
   * @returns {object|null}
   */
  function serializeHangarChipSlot(chip) {
    if (!chip || typeof chip !== 'object') return null;
    return {
      chipId: Number.isFinite(chip.chipId) ? Math.floor(chip.chipId) : -1,
      modIds: Array.isArray(chip.modIds) ? chip.modIds.slice() : [],
      sourceComboKey: typeof chip.sourceComboKey === 'string' ? chip.sourceComboKey : '',
      rotation: Number.isFinite(chip.rotation) ? ((Math.floor(chip.rotation) % 3) + 3) % 3 : 0,
      level: Number.isFinite(chip.level) ? Math.max(1, Math.floor(chip.level)) : 1,
    };
  }

  /**
   * Нормализовать карту slot-key → chip (red: slot1/slot2, yellow: slot1..slot4).
   * @param {object} slots
   * @returns {object}
   */
  function serializeHangarChipSlots(slots) {
    var out = {};
    if (!slots || typeof slots !== 'object') return out;
    var keys = Object.keys(slots);
    for (var i = 0; i < keys.length; i++) {
      out[keys[i]] = serializeHangarChipSlot(slots[keys[i]]);
    }
    return out;
  }

  /**
   * Собрать persisted subset hangar-cell grid (16 ячеек с установленными чипами).
   *
   * Installed chips живут в module-owned grid `src/ui/hangarChipsUI.js`
   * (`Game.HangarChipsUI.getCells()`), а НЕ в `state`. Зеркалим паттерн
   * `playerChips`: читаем live-инвентарь, чтобы каждый save-путь (включая
   * slot-save, который передаёт raw `state`) захватил актуальное содержимое.
   * Fallback — `state.hangarCells` (если UI-модуль ещё не загружен).
   *
   * @param {object} state
   * @returns {Array|null} массив ячеек или null, если grid недоступен
   */
  function serializeHangarCells(state) {
    var live = null;
    try {
      var chipsUi = global.Game && global.Game.HangarChipsUI;
      live = chipsUi && typeof chipsUi.getCells === 'function' ? chipsUi.getCells() : null;
    } catch (_) { live = null; }
    if (!Array.isArray(live)) {
      live = state && Array.isArray(state.hangarCells) ? state.hangarCells : null;
    }
    if (!Array.isArray(live)) return null;
    var cells = [];
    for (var i = 0; i < live.length; i++) {
      var cell = live[i];
      cells.push({
        id: cell && Number.isFinite(cell.id) ? Math.floor(cell.id) : i,
        redSlots: serializeHangarChipSlots(cell && cell.redSlots),
        yellowSlots: serializeHangarChipSlots(cell && cell.yellowSlots),
      });
    }
    return cells;
  }

  /**
   * Собрать инвентарь целых чипов (playerChips) для save payload.
   *
   * Чипы — самый ранний из module-owned ресурсов: документально их canonical
   * owner — `Game.State.getPlayerChips()` / `.setPlayerChips()`, НО этого
   * namespace нет нигде в кодовой базе, поэтому `_canonicalPlayerChipsApi()`
   * в `src/ui/hangarChipsUI.js` всегда возвращает `null` и вся мутация идёт в
   * module-owned `_playerChipsFallback`. Как следствие `state.playerChips`
   * навсегда остаётся `[]` после New Game.
   *
   * Прежний writer брал `state.playerChips` — то есть ПУСТОЕ зеркало — и каждое
   * сохранение писало `playerChips: []`, а restore стирал инвентарь. Зеркалим
   * контракт `serializePlayerFragments` / `serializeSiliconDust` / `serializeHangarCells`:
   * читаем live-инвентарь, fallback — `state.playerChips`.
   *
   * @param {object} state
   * @returns {Array} массив chip-record (никогда не null)
   */
  function serializePlayerChips(state) {
    var live = null;
    try {
      var chipsUi = global.Game && global.Game.HangarChipsUI;
      live = chipsUi && typeof chipsUi.getPlayerChips === 'function' ? chipsUi.getPlayerChips() : null;
    } catch (_) { live = null; }
    if (!Array.isArray(live)) {
      live = state && Array.isArray(state.playerChips) ? state.playerChips : null;
    }
    if (!Array.isArray(live)) return [];
    var chips = [];
    for (var i = 0; i < live.length; i++) {
      var entry = live[i];
      if (!entry || typeof entry !== 'object') continue;
      /* Запись валидна, если её можно резолвить: либо известный chipId, либо
         modIds, из которых `_healPlayerChipEntry` восстановит chipId на restore.
         Все остальные объекты — мусор, который сломал бы slot-lookup. */
      var hasId = Number.isFinite(entry.chipId) && entry.chipId > 0;
      var hasMods = Array.isArray(entry.modIds) && entry.modIds.length > 0;
      if (!hasId && !hasMods) continue;
      chips.push(entry);
    }
    return chips;
  }

  /**
   * Собрать chip-shard inventory (фрагменты чипов) для save payload.
   *
   * Фрагменты живут в module-owned состоянии `src/ui/hangarChipsUI.js`
   * (`Game.HangarChipsUI.getPlayerFragments()`), а НЕ в `state`. Зеркалим
   * паттерн `serializeHangarCells`: читаем live-инвентарь, чтобы каждый
   * save-путь (включая slot-save, который передаёт raw `state`) захватил
   * актуальное содержимое. Fallback — `state.playerFragments`.
   *
   * Без этой записи фрагменты исчезали после загрузки сейва: reader
   * (`restoreFullState` / `applySavedProgress`) поле читал, а writer его не
   * клал в payload.
   *
   * @param {object} state
   * @returns {Array} массив `{ fragmentId, count }` (никогда не null)
   */
  function serializePlayerFragments(state) {
    var live = null;
    try {
      var chipsUi = global.Game && global.Game.HangarChipsUI;
      live = chipsUi && typeof chipsUi.getPlayerFragments === 'function' ? chipsUi.getPlayerFragments() : null;
    } catch (_) { live = null; }
    if (!Array.isArray(live)) {
      live = state && Array.isArray(state.playerFragments) ? state.playerFragments : null;
    }
    if (!Array.isArray(live)) return [];
    var fragments = [];
    for (var i = 0; i < live.length; i++) {
      var entry = live[i];
      if (!entry || typeof entry !== 'object') continue;
      var fragmentId = Number.isFinite(entry.fragmentId)
        ? Math.floor(entry.fragmentId)
        : (Number.isFinite(entry.modId) ? Math.floor(entry.modId) : 0);
      var count = Number.isFinite(entry.count) ? Math.max(0, Math.floor(entry.count)) : 0;
      if (fragmentId <= 0 || count <= 0) continue;
      fragments.push({ fragmentId: fragmentId, count: count });
    }
    return fragments;
  }

  /**
   * Собрать silicon-dust balance для save payload.
   *
   * «Кремниевая пыль» живёт в module-owned состоянии `src/ui/hangarChipsUI.js`
   * (`Game.HangarChipsUI.getSiliconDust()`), а НЕ в `state`. Зеркалим контракт
   * `serializePlayerFragments` / `serializeHangarCells`: читаем live-баланс,
   * чтобы каждый save-путь (включая slot-save с raw `state`) захватил актуальное
   * значение. Fallback — `state.siliconDust`.
   *
   * Без этой записи пыль исчезала после загрузки сейва: restore-пути поле
   * читали, а writer его не клал в payload (тот же класс дефекта, что и у
   * `playerFragments`).
   *
   * @param {object} state
   * @returns {number} неотрицательное целое (никогда не null/NaN)
   */
  function serializeSiliconDust(state) {
    var live = null;
    try {
      var chipsUi = global.Game && global.Game.HangarChipsUI;
      live = chipsUi && typeof chipsUi.getSiliconDust === 'function' ? chipsUi.getSiliconDust() : null;
    } catch (_) { live = null; }
    if (!Number.isFinite(live)) {
      live = state && Number.isFinite(state.siliconDust) ? state.siliconDust : 0;
    }
    return Number.isFinite(live) ? Math.max(0, Math.floor(live)) : 0;
  }

  /**
   * Собрать in-progress tech study (таймерное изучение технологии) для payload.
   *
   * Источник — module-owned `Game.HangarChipsUI.getTechStudying()` (форма
   * `{ modId, elapsed, duration, acceleratedPct }`), fallback `state.techStudying`.
   * Малаформированный/незавершённый объект нормализуется или схлопывается в
   * `null` (легаси-сейв → процесс изучения не активен).
   *
   * @param {object} state
   * @returns {{modId:number, elapsed:number, duration:number, acceleratedPct:number}|null}
   */
  function serializeTechStudying(state) {
    var live = null;
    try {
      var chipsUi = global.Game && global.Game.HangarChipsUI;
      live = chipsUi && typeof chipsUi.getTechStudying === 'function' ? chipsUi.getTechStudying() : null;
    } catch (_) { live = null; }
    if (!live || typeof live !== 'object') {
      live = state && state.techStudying && typeof state.techStudying === 'object' ? state.techStudying : null;
    }
    if (!live || typeof live !== 'object') return null;
    var modId = Number.isFinite(live.modId) ? Math.floor(live.modId) : null;
    var duration = Number.isFinite(live.duration) && live.duration > 0 ? live.duration : null;
    if (modId == null || modId <= 0 || duration == null) return null;
    var elapsed = Number.isFinite(live.elapsed) ? Math.max(0, Math.min(duration, live.elapsed)) : 0;
    var acceleratedPct = Number.isFinite(live.acceleratedPct) ? Math.max(0, Math.min(100, live.acceleratedPct)) : 0;
    return { modId: modId, elapsed: elapsed, duration: duration, acceleratedPct: acceleratedPct };
  }

  /**
   * Собрать per-tech fed-chip counters (instant-unlock путь) для payload.
   *
   * Источник — module-owned `Game.HangarChipsUI.getTechFeedProgress()`, fallback
   * `state.techFeedProgress`. Ключи — modId, значения — скармливаемые чипы.
   * Невалидные/нулевые/отрицательные записи дропаются, всегда объект.
   *
   * @param {object} state
   * @returns {Object<string, number>}
   */
  function serializeTechFeedProgress(state) {
    var live = null;
    try {
      var chipsUi = global.Game && global.Game.HangarChipsUI;
      live = chipsUi && typeof chipsUi.getTechFeedProgress === 'function' ? chipsUi.getTechFeedProgress() : null;
    } catch (_) { live = null; }
    if (!live || typeof live !== 'object') {
      live = state && state.techFeedProgress && typeof state.techFeedProgress === 'object' ? state.techFeedProgress : null;
    }
    if (!live || typeof live !== 'object') return {};
    var out = {};
    var keys = Object.keys(live);
    for (var i = 0; i < keys.length; i++) {
      var modId = Number(keys[i]);
      var fed = live[keys[i]];
      if (!Number.isFinite(modId) || modId <= 0) continue;
      if (!Number.isFinite(fed) || fed <= 0) continue;
      out[String(Math.floor(modId))] = Math.max(0, Math.floor(fed));
    }
    return out;
  }

  /**
   * Прочитать переносимый остаток таймера подарочного бокса (в sim-секундах).
   *
   * `state.nextCrateAt` — абсолютный timestamp в домене `nowSec()`
   * (`performance.now()/1000` минус pause-offset), который перезапускается с ~0
   * на каждой загрузке страницы. Поэтому в payload кладётся ОТНОСИТЕЛЬНЫЙ
   * остаток; live-first чтение через `Game.getCrateRemainingSec()` с fallback на
   * `state.nextCrateAt` (см. `getCrateRemainingSec()` в game.js).
   *
   * @param {object} state
   * @returns {number|null}
   */
  function serializeCrateRemainingSec(state) {
    var live = null;
    try {
      var reader = global.Game && global.Game.getCrateRemainingSec;
      live = typeof reader === 'function' ? reader() : null;
    } catch (_) { live = null; }
    if (Number.isFinite(live)) return Math.max(0, live);
    return null;
  }

  /**
   * Прочитать переносимые остатки timed-эффектов (в sim-секундах): speed-буст
   * суперкомпьютера и три активки — Шквал (`attackSec`), Купол (`defenseSec`),
   * Золотое время (`economySec`).
   *
   * `state.boostUntil` / `state.activeEffects.*Until` — абсолютные timestamps в
   * домене `nowSec()` (`performance.now()/1000` минус pause-offset), который
   * перезапускается с ~0 на каждой загрузке страницы. Сырое абсолютное значение
   * после reload давало «бафф длится столько, сколько длилась прошлая сессия»
   * (баг «Шквал 1100+ секунд»). Live-first чтение через
   * `Game.getTimedEffectRemainders()` с fallback на relative-пересчёт от
   * `state.activeEffects` (см. `getTimedEffectRemainders()` в game.js).
   *
   * @param {object} state
   * @returns {{boostSec:number, attackSec:number, defenseSec:number, economySec:number}|null}
   */
  function serializeTimedEffectRemainders(state) {
    var live = null;
    try {
      var reader = global.Game && global.Game.getTimedEffectRemainders;
      live = typeof reader === 'function' ? reader() : null;
    } catch (_) { live = null; }
    if (live && typeof live === 'object') {
      return {
        boostSec: Number.isFinite(live.boostSec) ? Math.max(0, live.boostSec) : 0,
        attackSec: Number.isFinite(live.attackSec) ? Math.max(0, live.attackSec) : 0,
        defenseSec: Number.isFinite(live.defenseSec) ? Math.max(0, live.defenseSec) : 0,
        economySec: Number.isFinite(live.economySec) ? Math.max(0, live.economySec) : 0,
      };
    }
    // Без живого seam остаток вычислить нельзя (нужен `nowSec()` из game.js).
    // `null` заставляет reader трактовать legacy-поля как остатки прошлой сессии
    // и отбросить всё, что больше полной длительности эффекта.
    return null;
  }

  /**
   * Прочитать текущий снимок расписания волны атаки из runtime.
   *
   * `worldEventsState.attackStartAt` / `currentAttackStartAt` / `attackEndAt`
   * живут в module-scope `game.js` и являются absolute sim-временем, поэтому
   * в payload кладутся только ОТНОСИТЕЛЬНЫЕ остатки + флаг `active`.
   * Live-first чтение через публичный seam `Game.getAttackWaveSnapshot()`,
   * с fallback на `state.attackWave*` (если runtime уже проставил их).
   *
   * @param {object} state
   * @returns {{remainingSec:number, active:boolean, remainingActiveSec:number}|null}
   */
  function serializeAttackWaveSnapshot(state) {
    var live = null;
    try {
      var reader = global.Game && global.Game.getAttackWaveSnapshot;
      live = typeof reader === 'function' ? reader() : null;
    } catch (_) { live = null; }
    if (!live || typeof live !== 'object') {
      var fallbackRemaining = state && Number.isFinite(state.attackWaveRemainingSec) ? state.attackWaveRemainingSec : null;
      if (!Number.isFinite(fallbackRemaining)) return null;
      live = {
        remainingSec: fallbackRemaining,
        active: !!(state && state.attackWaveActive),
        remainingActiveSec: state && Number.isFinite(state.attackWaveRemainingActiveSec) ? state.attackWaveRemainingActiveSec : 0,
      };
    }
    var remainingSec = Number.isFinite(live.remainingSec) ? Math.max(0, live.remainingSec) : 0;
    var active = live.active === true;
    var remainingActiveSec = active && Number.isFinite(live.remainingActiveSec)
      ? Math.max(0, live.remainingActiveSec)
      : 0;
    return { remainingSec: remainingSec, active: active, remainingActiveSec: remainingActiveSec };
  }

  function serializeState(state) {
    if (!state) return {};
    // Fence damage persistence:
    // Live `state.fenceSegments` is authoritative when present, but it is transiently
    // EMPTY after a resize / fence-tier change (see snapshotFenceHpById + fenceSegments
    // reset in game.js). In that window a save would flatten every wall back to full HP.
    // Fall back to `state.savedFenceState` (the snapshot taken right before the reset),
    // but only when its `segmentsPerSide` matches the current segment grid, otherwise
    // the ids would map onto a different layout.
    var currentSegmentsPerSide = Number.isFinite(state.fenceSegmentsMeta && state.fenceSegmentsMeta.segmentsPerSide)
      ? state.fenceSegmentsMeta.segmentsPerSide
      : null;
    var fenceHpById = {};
    var liveFenceSegmentCount = 0;
    if (Array.isArray(state.fenceSegments)) {
      for (var si = 0; si < state.fenceSegments.length; si++) {
        var seg = state.fenceSegments[si];
        if (!seg || !seg.id || !Number.isFinite(seg.hp)) continue;
        fenceHpById[seg.id] = Math.max(0, seg.hp);
        liveFenceSegmentCount++;
      }
    }
    var savedFenceState = state.savedFenceState && typeof state.savedFenceState === 'object'
      ? state.savedFenceState
      : null;
    var savedSegmentsPerSide = Number.isFinite(savedFenceState && savedFenceState.segmentsPerSide)
      ? Math.max(1, Math.floor(savedFenceState.segmentsPerSide))
      : null;
    var savedSegmentsPerSideMatches =
      !savedFenceState ||
      savedSegmentsPerSide == null ||
      (liveFenceSegmentCount === 0 && currentSegmentsPerSide == null) ||
      savedSegmentsPerSide === currentSegmentsPerSide;
    if (savedFenceState && savedFenceState.hpById && typeof savedFenceState.hpById === 'object' && savedSegmentsPerSideMatches) {
      var savedIds = Object.keys(savedFenceState.hpById);
      for (var ssi = 0; ssi < savedIds.length; ssi++) {
        var savedId = savedIds[ssi];
        var savedHp = savedFenceState.hpById[savedId];
        if (!Number.isFinite(savedHp)) continue;
        if (Object.prototype.hasOwnProperty.call(fenceHpById, savedId)) continue;
        fenceHpById[savedId] = Math.max(0, savedHp);
      }
    }
    var fenceState = {
      segmentsPerSide: currentSegmentsPerSide != null ? currentSegmentsPerSide : savedSegmentsPerSide,
      hpById: fenceHpById,
    };
    var cells = [];
    if (Array.isArray(state.cells)) {
      for (var i = 0; i < state.cells.length; i++) {
        var c = state.cells[i];
        var tank = null;
        if (c.tank) {
          tank = {
            id: c.tank.id,
            level: c.tank.level,
            onTrack: !!c.tank.onTrack,
            powerTier: c.tank.powerTier,
          };
        }
        cells.push({ i: c.i, orbitPhase: c.orbitPhase, tank: tank });
      }
    }
    var crate = null;
    if (state.crate) {
      crate = {
        cellIndex: state.crate.cellIndex,
        rewardLevel: state.crate.rewardLevel,
        // Underground-crate extension: a box that fell into the underground
        // hangar keeps its reward target and visibility state across reloads.
        hangar: state.crate.hangar === 'underground' ? 'underground' : 'main',
        rewardHangarIndex: Number.isFinite(state.crate.rewardHangarIndex) ? state.crate.rewardHangarIndex : -1,
      };
    }
    var mapSeeds = null;
    if (state.mapSeeds && typeof state.mapSeeds === 'object') {
      mapSeeds = {
        stampsSeed: state.mapSeeds.stampsSeed,
        decorSeed: state.mapSeeds.decorSeed,
      };
    }
    var attackWaveSnapshot = serializeAttackWaveSnapshot(state);
    var achievements = state.achievements && typeof state.achievements === 'object' ? state.achievements : {};
    var stats = {
      tanksMergedCount: normalizeSafeCounter(Number.isFinite(state.stats && state.stats.tanksMergedCount) ? state.stats.tanksMergedCount : achievements.totalMerges),
      tanksBoughtCount: normalizeSafeCounter(Number.isFinite(state.stats && state.stats.tanksBoughtCount) ? state.stats.tanksBoughtCount : achievements.totalPurchased),
      manualFenceRepairsCount: normalizeSafeCounter(Number.isFinite(state.stats && state.stats.manualFenceRepairsCount) ? state.stats.manualFenceRepairsCount : achievements.totalManualFenceRepairs),
      modifierTechUnlocksCount: normalizeSafeCounter(Number.isFinite(state.stats && state.stats.modifierTechUnlocksCount) ? state.stats.modifierTechUnlocksCount : achievements.totalModifierTechUnlocks),
      droneAcquisitionsCount: normalizeSafeCounter(Number.isFinite(state.stats && state.stats.droneAcquisitionsCount) ? state.stats.droneAcquisitionsCount : achievements.totalDroneAcquisitions),
      noRepairAttackWaveStreakCount: normalizeSafeCounter(Number.isFinite(state.stats && state.stats.noRepairAttackWaveStreakCount) ? state.stats.noRepairAttackWaveStreakCount : achievements.totalNoRepairAttackWaveStreak),
      // Item — per-run «Текущая волна» counter (no legacy mirror: fresh-start field).
      currentWaveCount: normalizeSafeCounter(Number.isFinite(state.stats && state.stats.currentWaveCount) ? state.stats.currentWaveCount : 0),
    };
    var drones = [];
    if (Array.isArray(state.drones)) {
      for (var di = 0; di < state.drones.length; di++) {
        var d = state.drones[di];
        if (!d || typeof d !== 'object') continue;
        var repair = null;
        if (d.repair && typeof d.repair === 'object') {
          repair = {
            startHp: Number.isFinite(d.repair.startHp) ? Math.max(0, Math.floor(d.repair.startHp)) : 0,
            maxHp: Number.isFinite(d.repair.maxHp) ? Math.max(1, Math.floor(d.repair.maxHp)) : 1,
            totalCostCoins: Number.isFinite(d.repair.totalCostCoins) ? Math.max(0, Math.floor(d.repair.totalCostCoins)) : 0,
            repairDurationSec: Number.isFinite(d.repair.repairDurationSec) ? Math.max(0.01, d.repair.repairDurationSec) : 0.01,
            repairStartTimeSec: Number.isFinite(d.repair.repairStartTimeSec) ? d.repair.repairStartTimeSec : 0,
            coinsSpentPrev: Number.isFinite(d.repair.coinsSpentPrev) ? Math.max(0, Math.floor(d.repair.coinsSpentPrev)) : 0,
          };
        }
        drones.push({
          id: d.id,
          level: Number.isFinite(d.level) ? Math.max(1, Math.floor(d.level)) : 1,
          mode: d.mode,
          substate: d.substate,
          slotIndex: Number.isFinite(d.slotIndex) ? Math.max(0, Math.floor(d.slotIndex)) : null,
          pos: {
            x: Number.isFinite(d.pos && d.pos.x) ? d.pos.x : 0,
            y: Number.isFinite(d.pos && d.pos.y) ? d.pos.y : 0,
          },
          basePos: {
            x: Number.isFinite(d.basePos && d.basePos.x) ? d.basePos.x : 0,
            y: Number.isFinite(d.basePos && d.basePos.y) ? d.basePos.y : 0,
          },
          targetSegmentId: d.targetSegmentId != null ? d.targetSegmentId : null,
          reservedSegmentId: d.reservedSegmentId != null ? d.reservedSegmentId : null,
          repair: repair,
          patrolSeed: Number.isFinite(d.patrolSeed) ? d.patrolSeed : 0,
        });
      }
    }
    return {
      version: SAVE_VERSION,
      coins: state.coins,
      kills: state.kills,
      tutorial: state.tutorial || null,
      totalDamageDealtRaw: normalizeTotalDamageDealtRaw(state.totalDamageDealtRaw),
      zombieWaveAtkMult: Number.isFinite(state.zombieWaveAtkMult) ? Math.max(0, state.zombieWaveAtkMult) : 1,
      damagePointsSpent: normalizeDamagePointsSpent(state.damagePointsSpent),
      fenceLevel: Number.isFinite(state.fenceLevel) ? Math.max(1, Math.floor(state.fenceLevel)) : 1,
      fenceRepairCount: Number.isFinite(state.fenceRepairCount) ? Math.max(0, Math.floor(state.fenceRepairCount)) : 0,
      cells: cells,
      supercomputer: state.supercomputer,
      player: state.player,
      buyCounts: state.buyCounts,
      buyPrices: state.buyPrices,
      crate: crate,
      nextCrateAt: state.nextCrateAt,
      // Переносимый остаток таймера бокса (session-relative). Без него сырой
      // `nextCrateAt` после reload оказывался в будущем домене `nowSec()`.
      crateRemainingSec: serializeCrateRemainingSec(state),
      // Attack-wave schedule: относительные sim-остатки + флаг активной волны.
      // Без `active` загрузка выключала волну и заново отсчитывала полный
      // `attackEverySec` (см. restoreFullState / applyLoadedAttackWaveSnapshot).
      // `null` — расписание неизвестно (attack mode off, debug force-attack,
      // legacy save).
      attackWaveRemainingSec: attackWaveSnapshot ? attackWaveSnapshot.remainingSec : null,
      attackWaveActive: attackWaveSnapshot ? attackWaveSnapshot.active : false,
      attackWaveRemainingActiveSec: attackWaveSnapshot ? attackWaveSnapshot.remainingActiveSec : 0,
      maxTankLevelAchieved: state.maxTankLevelAchieved,
      boostUntil: state.boostUntil,
      activeEffects: state.activeEffects,
      // Переносимые ОСТАТКИ timed-эффектов (session-relative, сек). Без них
      // абсолютные `boostUntil` / `activeEffects.*Until` после reload попадали в
      // чужой clock-домен, и бафф активки (Шквал/Купол/Золотое время) жил
      // столько, сколько длилась прошлая сессия.
      timedEffectsRemainingSec: serializeTimedEffectRemainders(state),
      fenceState: fenceState,
      achievements: state.achievements,
      stats: stats,
      mapSeeds: mapSeeds,
      drones: drones,
      forceFenceRuntimeResetOnLoad: !!state.forceFenceRuntimeResetOnLoad,
      playerChips: serializePlayerChips(state),
      playerFragments: serializePlayerFragments(state),
      // Module-owned hangar progress (НЕ часть `state`): silicon dust, таймерное
      // изучение технологии и per-tech fed-chip counters. Без этих полей
      // соответствующие ресурсы/прогресс молча обнулялись после загрузки сейва.
      siliconDust: serializeSiliconDust(state),
      techStudying: serializeTechStudying(state),
      techFeedProgress: serializeTechFeedProgress(state),
      productionLine: state.productionLine || null,
      hangarCells: serializeHangarCells(state),
    };
  }

  /**
   * Загрузить игру. Безопасный парс; при ошибке — null.
   * Новый формат: объект с .cells, .coins, .player и т.д. Старый: только .level, .xp (progress).
   * @returns {{ state: object | null, meta: { lastSeenAt?: number, version?: number }, legacyProgress?: object } | null}
   */
  function loadGame() {
    try {
      migrateLegacyProgressIfNeeded();
      var raw = global.localStorage && global.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var data = safeParse(raw, null);
      if (!data || typeof data !== 'object') return null;
      if (Array.isArray(data.cells)) {
        data.totalDamageDealtRaw = normalizeTotalDamageDealtRaw(data.totalDamageDealtRaw);
        // Fail-soft schema validation: never block load, only warn in console.
        try {
          var validator = global.Game && global.Game.SaveSchemaValidator;
          var schema = global.Game && global.Game.SaveSchema;
          if (validator && schema && typeof validator.validatePayload === 'function') {
            var res = validator.validatePayload(data, schema);
            if (res && !res.ok && global.console && global.console.warn) {
              global.console.warn('[saveSchema] payload mismatch (load continues):', res.errors);
            }
          }
        } catch (_) { /* fail-soft: ignore validator errors */ }
        return { state: data, meta: { lastSeenAt: data.lastSeenAt, version: data.version } };
      }
      return { state: null, meta: {}, legacyProgress: data };
    } catch (e) {
      return null;
    }
  }

  /**
   * Записать автосейв «после завершения волны атаки» в выделенную ячейку.
   *
   * Отдельная ячейка от pre-retry auto slot: restart-simulation path читает
   * именно `AUTO_SLOT_INDEX`, поэтому переиспользование сломало бы
   * «Перезапустить симуляцию». Payload — живое состояние (как обычный save):
   * `serializeState()` получает тот же `state`, что и manual save, плюс
   * явный `forceFenceRuntimeResetOnLoad = false`, чтобы загрузка продолжила
   * сохранённое расписание волн, а не начинала полный интервал.
   *
   * @param {object} state
   * @param {{ lastSavedAt?: number }} [options]
   * @returns {{ok:boolean, error:?string}}
   */
  function saveWaveAutoSlot(state, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var payload = null;
    try {
      payload = serializeState(state || {});
    } catch (e) {
      reportStorageError('saveWaveAutoSlot', e);
      return { ok: false, error: e && e.message ? e.message : 'serialize_error' };
    }
    payload.version = 1;
    payload.forceFenceRuntimeResetOnLoad = false;
    var write = safeSetItem(getSlotDataKey(WAVE_AUTO_SLOT_INDEX), JSON.stringify(payload));
    if (!write.ok) return { ok: false, error: write.error };
    var metaRes = updateMetaField(WAVE_AUTO_SLOT_INDEX, {
      lastSavedAt: Number.isFinite(opts.lastSavedAt) ? opts.lastSavedAt : Date.now(),
    });
    if (!metaRes.ok) return { ok: false, error: metaRes.error };
    return { ok: true, error: null };
  }

  /**
   * Прочитать payload wave-autosave ячейки.
   * @returns {{ok:boolean, payload:?object, error:?string}}
   */
  function loadWaveAutoSlot() {
    return loadSlotPayloadRaw(WAVE_AUTO_SLOT_INDEX);
  }

  /**
   * Сохранить игру. meta.lastSeenAt обновляется снаружи при visibilitychange.
   * @param {object} state
   * @param {{ lastSeenAt?: number }} meta
   */
  function saveGame(state, meta) {
    try {
      var payload = serializeState(state);
      payload.lastSeenAt = meta && meta.lastSeenAt != null ? meta.lastSeenAt : payload.lastSeenAt;
      payload.version = SAVE_VERSION;
      if (global.localStorage) global.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (e) {
      reportStorageError('saveGame', e);
    }
    // Persist telemetry lifetime together with game save
    if (global.Game && global.Game.Telemetry && global.Game.Telemetry.saveLifetime) {
      try { global.Game.Telemetry.saveLifetime(); } catch (_) {}
    }
  }

  global.Game = global.Game || {};
  global.Game.Storage = {
    SAVE_KEY: SAVE_KEY,
    SAVE_VERSION: SAVE_VERSION,
    SAVE_SLOTS_META_KEY: SAVE_SLOTS_META_KEY,
    SAVE_SLOT_KEY_PREFIX: SAVE_SLOT_KEY_PREFIX,
    SAVE_SLOTS_COUNT: SAVE_SLOTS_COUNT,
    SAVE_SLOT_NAME_MAX_LEN: SAVE_SLOT_NAME_MAX_LEN,
    AUTO_SLOT_INDEX: AUTO_SLOT_INDEX,
    WAVE_AUTO_SLOT_INDEX: WAVE_AUTO_SLOT_INDEX,
    loadGame: loadGame,
    saveGame: saveGame,
    listSlots: listSlots,
    saveSlot: saveSlot,
    loadSlot: loadSlot,
    deleteSlot: deleteSlot,
    saveWaveAutoSlot: saveWaveAutoSlot,
    loadWaveAutoSlot: loadWaveAutoSlot,
    loadSaveSlotsMeta: loadSaveSlotsMeta,
    setSlotName: setSlotName,
    markSlotSaved: markSlotSaved,
    hasAnySaves: hasAnySaves,
    getDefaultSlotName: getDefaultSlotName,
    safeParse: safeParse,
    setSlotsBackend: setSlotsBackend,
    getSlotsBackend: getSlotsBackend,
    reportStorageError: reportStorageError,
  };
})(typeof window !== 'undefined' ? window : this);
