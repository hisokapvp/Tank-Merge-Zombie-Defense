(function (global) {
  'use strict';

  var WEAPON_ICON_ROT_DEG = -90;

  function setOverlayOpen(overlay, open, a11yOpen, a11yClose, options) {
    if (!overlay) return;
    var nextOpen = !!open;
    overlay.classList.toggle('hidden', !nextOpen);
    overlay.setAttribute('aria-hidden', (!nextOpen).toString());
    if (nextOpen) {
      if (typeof a11yOpen === 'function') a11yOpen(overlay, options || {});
      return;
    }
    if (typeof a11yClose === 'function') a11yClose(overlay);
  }

  function createController(options) {
    var opts = options || {};
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    if (!documentObj) return null;

    var rootOverlay = documentObj.getElementById('supercomputerMenuOverlay');
    var hangarOverlay = documentObj.getElementById('modsHangarOverlay');
    var tankWallOverlay = documentObj.getElementById('modsTankWallOverlay');

    if (!rootOverlay || !hangarOverlay || !tankWallOverlay) return null;

    var a11yOpen = opts.a11yOpen;
    var a11yClose = opts.a11yClose;
    var onPauseLockChange = typeof opts.onPauseLockChange === 'function' ? opts.onPauseLockChange : function () {};
    var openTalents = typeof opts.openTalents === 'function' ? opts.openTalents : null;
    var closeTalents = typeof opts.closeTalents === 'function' ? opts.closeTalents : null;
    var getDamagePoints = typeof opts.getDamagePoints === 'function' ? opts.getDamagePoints : function () { return 0; };
    var getAppliedCannonUpgradeLevel = typeof opts.getAppliedCannonUpgradeLevel === 'function'
      ? opts.getAppliedCannonUpgradeLevel
      : function () { return 0; };
    var getCannonUpgradeStepCost = typeof opts.getCannonUpgradeStepCost === 'function'
      ? opts.getCannonUpgradeStepCost
      : function (_level, _appliedIndex) { return 0; };
    var getCannonUpgradeIconFrames = typeof opts.getCannonUpgradeIconFrames === 'function'
      ? opts.getCannonUpgradeIconFrames
      : function () { return 1; };
    var getCannonUpgradeIconFps = typeof opts.getCannonUpgradeIconFps === 'function'
      ? opts.getCannonUpgradeIconFps
      : function () { return 8; };
    var getCannonUpgradeConfig = typeof opts.getCannonUpgradeConfig === 'function'
      ? opts.getCannonUpgradeConfig
      : function () { return []; };
    var applyCannonUpgrade = typeof opts.applyCannonUpgrade === 'function'
      ? opts.applyCannonUpgrade
      : function () { return { ok: false }; };
    var getFenceStats = typeof opts.getFenceStats === 'function' ? opts.getFenceStats : function () {
      return {
        level: 1,
        segmentMaxHp: 0,
        armorFlat: 0,
        hasNextLevel: false,
        canUpgrade: false,
        upgradeCostDamagePoints: null,
      };
    };
    var getFenceLevels = typeof opts.getFenceLevels === 'function' ? opts.getFenceLevels : function () { return []; };
    var getFenceConfig = typeof opts.getFenceConfig === 'function' ? opts.getFenceConfig : function () { return {}; };
    var getFenceStatsForLevel = typeof opts.getFenceStatsForLevel === 'function' ? opts.getFenceStatsForLevel : function () { return { baseHp: 0, baseArmor: 0, currentHp: 0, currentArmor: 0 }; };
    var getAppliedFenceUpgradeLevel = typeof opts.getAppliedFenceUpgradeLevel === 'function' ? opts.getAppliedFenceUpgradeLevel : function () { return 0; };
    var applyFenceUpgrade = typeof opts.applyFenceUpgrade === 'function' ? opts.applyFenceUpgrade : function () { return { ok: false }; };
    var upgradeFence = typeof opts.upgradeFence === 'function' ? opts.upgradeFence : function () { return false; };
    var translate = typeof opts.translate === 'function' ? opts.translate : function (_, vars) {
      var key = _ || '';
      if (key === 'modsGunsColType') return 'Cannon';
      if (key === 'modsGunsColLevel') return 'Lvl';
      if (key === 'modsGunsColAttackSpeed') return 'Attack speed';
      if (key === 'modsGunsColDamage') return 'Damage';
      if (key === 'modsGunsColUpgradeLevel') return 'Upgrade level';
      if (key === 'modsGunsColCost') return 'Cost';
      if (key === 'modsGunsColActions') return 'Actions';
      if (key === 'modsGunsUpgrade') return 'Upgrade';
      if (key === 'modsGunsReservedLabel') return 'Reserved points: ' + (vars && vars.count != null ? vars.count : 0);
      if (key === 'modsGunsNotEnoughDamagePoints') return 'Not enough damage points';
      if (key === 'modsGunsNoSprite') return 'No sprite';
      if (key === 'modsTabWalls') return 'Walls';
      if (key === 'modsWallsLevelLabel') return 'Wall level: ' + (vars && vars.level != null ? vars.level : 1);
      if (key === 'modsWallsSegmentHpLabel') return 'Segment HP: ' + (vars && vars.hp != null ? vars.hp : 0);
      if (key === 'modsWallsArmorLabel') return 'Armor: ' + (vars && vars.armor != null ? vars.armor : 0);
      if (key === 'modsWallsUpgradesLabel') return 'Upgrades';
      if (key === 'modsWallsCostLabel') return 'Cost';
      if (key === 'modsWallsActionLabel') return 'Action';
      if (key === 'modsWallsUpgradeCost') return 'Upgrade (' + (vars && vars.cost != null ? vars.cost : 0) + ')';
      if (key === 'modsWallsUpgradeMax') return 'Max level';
      if (key === 'modsWallsUpgrade') return 'Upgrade';
      return 'Damage points: ' + (vars && vars.count != null ? vars.count : 0);
    };

    var state = {
      isOpen: false,
      view: 'closed',
      activeTankWallTab: 'weapons',
      pendingUpgradesByLevel: Array(60).fill(0),
      pendingFenceUpgradesByLevel: Array(60).fill(0),
      iconTickerId: null,
    };

    var tankWallTabButtons = {
      weapons: documentObj.getElementById('modsTankWallTabGuns'),
      walls: documentObj.getElementById('modsTankWallTabWalls'),
    };

    var tankWallTabPanels = {
      weapons: documentObj.getElementById('modsTankWallPanelGuns'),
      walls: documentObj.getElementById('modsTankWallPanelWalls'),
    };

    var gunsUi = {
      root: null,
      points: null,
      reserve: null,
      rows: null,
      initialized: false,
    };
    var wallsUi = {
      root: null,
      points: null,
      reserve: null,
      rows: null,
      initialized: false,
    };
    var gunsSpriteImageCache = Object.create(null);

    function setBodyScrollLock(locked) {
      if (!documentObj.body) return;
      if (locked) documentObj.body.classList.add('scmodal-open');
      else documentObj.body.classList.remove('scmodal-open');
    }

    function applyLayoutTuningVars() {
      var lt = (global.Game && global.Game.Config && global.Game.Config.LayoutTuning) || {};
      var rootEl = documentObj.documentElement;
      if (!rootEl || !rootEl.style) return;
      var tileIconSize = Number(lt.supercomputerTileIconSizePx);
      if (Number.isFinite(tileIconSize) && tileIconSize > 0) {
        rootEl.style.setProperty('--scTileIconSizePx', String(Math.round(tileIconSize)) + 'px');
      }
    }

    function applySharedTalentModalClass() {
      var talentOverlay = documentObj.getElementById('talentOverlay');
      if (!talentOverlay) return;
      var panel = talentOverlay.querySelector('.modal');
      if (!panel) return;
      panel.classList.add('scModal');
    }

    function setTankWallTab(nextTab, options) {
      var tab = nextTab === 'walls' ? 'walls' : 'weapons';
      state.activeTankWallTab = tab;

      Object.keys(tankWallTabButtons).forEach(function (key) {
        var button = tankWallTabButtons[key];
        if (!button) return;
        var selected = key === tab;
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
        button.setAttribute('tabindex', selected ? '0' : '-1');
      });

      Object.keys(tankWallTabPanels).forEach(function (key) {
        var panel = tankWallTabPanels[key];
        if (!panel) return;
        panel.hidden = key !== tab;
      });

      if (tab === 'weapons') {
        renderGunsPanel();
        startGunsIconTicker();
      } else if (tab === 'walls') {
        renderWallsPanel();
        startGunsIconTicker();
      }

      var focusButton = options && options.focusButton;
      if (focusButton) {
        tankWallTabButtons[tab]?.focus();
      }
    }

    function updateDamagePointsLabel() {
      var damagePointsEl = documentObj.getElementById('modsTankWallDamagePoints');
      var count = Math.max(0, Math.floor(getDamagePoints()));
      if (damagePointsEl) {
        damagePointsEl.textContent = translate('damagePointsLabel', { count: count });
      }
      if (gunsUi.points) {
        gunsUi.points.textContent = translate('damagePointsLabel', { count: count });
      }
      if (gunsUi.reserve) {
        gunsUi.reserve.textContent = translate('modsGunsReservedLabel', { count: getReservedDamagePoints() });
      }
      if (wallsUi.points) {
        wallsUi.points.textContent = translate('damagePointsLabel', { count: count });
      }
      if (wallsUi.reserve) {
        wallsUi.reserve.textContent = translate('modsGunsReservedLabel', { count: getReservedFenceDamagePoints() });
      }
    }

    function getGunsLevelsCount() {
      var cfg = getCannonUpgradeConfig();
      if (!Array.isArray(cfg) || !cfg.length) return 60;
      return Math.max(1, Math.min(60, cfg.length));
    }

    function ensurePendingLevelsSize() {
      var size = getGunsLevelsCount();
      if (!Array.isArray(state.pendingUpgradesByLevel)) {
        state.pendingUpgradesByLevel = Array(size).fill(0);
        return;
      }
      if (state.pendingUpgradesByLevel.length !== size) {
        var next = Array(size).fill(0);
        for (var i = 0; i < Math.min(size, state.pendingUpgradesByLevel.length); i++) {
          next[i] = toSafeNonNegativeInt(state.pendingUpgradesByLevel[i]);
        }
        state.pendingUpgradesByLevel = next;
      }
    }

    function toSafeNonNegativeInt(value) {
      if (!Number.isFinite(value)) return 0;
      if (value <= 0) return 0;
      if (value >= Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
      return Math.floor(value);
    }

    function getPendingAt(level) {
      ensurePendingLevelsSize();
      var idx = Math.max(1, Math.floor(level || 1)) - 1;
      return toSafeNonNegativeInt(state.pendingUpgradesByLevel[idx]);
    }

    function setPendingAt(level, value) {
      ensurePendingLevelsSize();
      var idx = Math.max(1, Math.floor(level || 1)) - 1;
      state.pendingUpgradesByLevel[idx] = toSafeNonNegativeInt(value);
    }

    function resetPendingUpgrades() {
      ensurePendingLevelsSize();
      for (var i = 0; i < state.pendingUpgradesByLevel.length; i++) {
        state.pendingUpgradesByLevel[i] = 0;
      }
    }

    function getPendingCost(level, pendingCount) {
      var count = toSafeNonNegativeInt(pendingCount);
      if (count <= 0) return 0;
      var applied = toSafeNonNegativeInt(getAppliedCannonUpgradeLevel(level));
      var total = 0;
      for (var i = 0; i < count; i++) {
        total += toSafeNonNegativeInt(getCannonUpgradeStepCost(level, applied + i));
      }
      return toSafeNonNegativeInt(total);
    }

    function getReservedDamagePoints() {
      ensurePendingLevelsSize();
      var total = 0;
      for (var i = 0; i < state.pendingUpgradesByLevel.length; i++) {
        total += getPendingCost(i + 1, state.pendingUpgradesByLevel[i]);
      }
      return toSafeNonNegativeInt(total);
    }

    function getFenceLevelsCount() {
      var levels = getFenceLevels();
      if (!Array.isArray(levels) || !levels.length) return 60;
      return Math.max(1, Math.min(60, levels.length));
    }

    function ensurePendingFenceLevelsSize() {
      var size = getFenceLevelsCount();
      if (!Array.isArray(state.pendingFenceUpgradesByLevel)) {
        state.pendingFenceUpgradesByLevel = Array(size).fill(0);
        return;
      }
      if (state.pendingFenceUpgradesByLevel.length !== size) {
        var next = Array(size).fill(0);
        for (var i = 0; i < Math.min(size, state.pendingFenceUpgradesByLevel.length); i++) {
          next[i] = toSafeNonNegativeInt(state.pendingFenceUpgradesByLevel[i]);
        }
        state.pendingFenceUpgradesByLevel = next;
      }
    }

    function getPendingFenceAt(level) {
      ensurePendingFenceLevelsSize();
      var idx = Math.max(1, Math.floor(level || 1)) - 1;
      return toSafeNonNegativeInt(state.pendingFenceUpgradesByLevel[idx]);
    }

    function setPendingFenceAt(level, value) {
      ensurePendingFenceLevelsSize();
      var idx = Math.max(1, Math.floor(level || 1)) - 1;
      state.pendingFenceUpgradesByLevel[idx] = toSafeNonNegativeInt(value);
    }

    function resetPendingFenceUpgrades() {
      ensurePendingFenceLevelsSize();
      for (var i = 0; i < state.pendingFenceUpgradesByLevel.length; i++) {
        state.pendingFenceUpgradesByLevel[i] = 0;
      }
    }

    function getPendingFenceCost(level, pendingCount) {
      var count = toSafeNonNegativeInt(pendingCount);
      if (count <= 0) return 0;
      var applied = toSafeNonNegativeInt(getAppliedFenceUpgradeLevel(level));
      var total = 0;
      for (var i = 0; i < count; i++) {
        total += toSafeNonNegativeInt(getCannonUpgradeStepCost(level, applied + i));
      }
      return toSafeNonNegativeInt(total);
    }

    function getReservedFenceDamagePoints() {
      ensurePendingFenceLevelsSize();
      var total = 0;
      for (var i = 0; i < state.pendingFenceUpgradesByLevel.length; i++) {
        total += getPendingFenceCost(i + 1, state.pendingFenceUpgradesByLevel[i]);
      }
      return toSafeNonNegativeInt(total);
    }

    function getTotalSpentForFenceLevel(level, applied) {
      var levels = getFenceLevels();
      var row = levels[Math.max(0, Math.floor(level) - 1)] || { upgradeCostDamagePoints: 0 };
      var costBase = toSafeNonNegativeInt(Number(row.upgradeCostDamagePoints));
      var u = toSafeNonNegativeInt(applied);
      if (u <= 0) return 0;
      var total = 0;
      for (var i = 0; i < u; i++) {
        total += toSafeNonNegativeInt(getCannonUpgradeStepCost(level, i));
      }
      return toSafeNonNegativeInt(total);
    }

    function formatCompact(value) {
      var num = toSafeNonNegativeInt(value);
      var nf = global.Game && global.Game.NumberFormat ? global.Game.NumberFormat : null;
      if (nf && typeof nf.formatCompactRu === 'function') return nf.formatCompactRu(num);
      return String(num);
    }

    function getTotalSpentForLevel(level, applied) {
      var row = getCannonUpgradeConfig()[Math.max(0, Math.floor(level) - 1)] || [level, 0, 0, 0, 0, 1];
      var costBase = toSafeNonNegativeInt(Number(row[1]));
      var costStep = toSafeNonNegativeInt(Number(row[2]));
      var u = toSafeNonNegativeInt(applied);
      if (u <= 0) return 0;
      var baseSum = u * costBase;
      var progressive = costStep * u * (u - 1) / 2;
      return toSafeNonNegativeInt(baseSum + progressive);
    }

    function isElementVerticallyVisible(element, viewport) {
      if (!element || !viewport) return false;
      var rowTop = element.offsetTop;
      var rowBottom = rowTop + element.offsetHeight;
      var viewTop = viewport.scrollTop;
      var viewBottom = viewTop + viewport.clientHeight;
      return rowBottom >= viewTop && rowTop <= viewBottom;
    }

    function getSpriteImageForSrc(src, onReady) {
      if (!src || typeof src !== 'string') return null;
      var cached = gunsSpriteImageCache[src] || null;
      if (cached && cached.complete) return cached;
      if (!cached) {
        cached = new global.Image();
        cached.decoding = 'async';
        cached.src = src;
        gunsSpriteImageCache[src] = cached;
      }
      if (typeof onReady === 'function') {
        var once = function () {
          cached.removeEventListener('load', once);
          onReady(cached);
        };
        cached.addEventListener('load', once);
      }
      return cached;
    }

    function drawGunsSpriteCanvas(node, frameIndex) {
      if (!node) return;
      var src = node.getAttribute('data-sprite-src') || '';
      var frameW = toSafeNonNegativeInt(Number(node.getAttribute('data-frame-w')));
      var frameH = toSafeNonNegativeInt(Number(node.getAttribute('data-frame-h')));
      var baseX = Number(node.getAttribute('data-frame-x'));
      var baseY = Number(node.getAttribute('data-frame-y'));
      var frames = toSafeNonNegativeInt(Number(node.getAttribute('data-anim-frames')));
      if (!src || frameW <= 0 || frameH <= 0 || !Number.isFinite(baseX) || !Number.isFinite(baseY)) return;
      if (frames <= 0) frames = 1;
      var img = getSpriteImageForSrc(src, function () {
        drawGunsSpriteCanvas(node, frameIndex);
      });
      if (!img || !img.complete) return;

      var lt = (global.Game && global.Game.Config && global.Game.Config.LayoutTuning) || {};
      var iconW = Number.isFinite(lt.weaponIconW) && lt.weaponIconW > 0 ? lt.weaponIconW : 60;
      var iconH = Number.isFinite(lt.weaponIconH) && lt.weaponIconH > 0 ? lt.weaponIconH : 45;

      if (node.width !== iconW) node.width = iconW;
      if (node.height !== iconH) node.height = iconH;

      var ctx = node.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, iconW, iconH);
      var safeFrame = Math.max(0, toSafeNonNegativeInt(frameIndex) % frames);
      var spriteX = Math.floor(baseX + frameW * safeFrame);
      var drawScale = Math.min(iconW / frameW, iconH / frameH);
      var drawW = frameW * drawScale;
      var drawH = frameH * drawScale;
      var cx = Math.round(iconW * 0.5);
      var cy = Math.round(iconH * 0.5);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(WEAPON_ICON_ROT_DEG * Math.PI / 180);
      ctx.drawImage(img, spriteX, Math.floor(baseY), frameW, frameH, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
      ctx.restore();
    }

    function tickGunsIconSprites() {
      if (state.view !== 'tankWall') return;
      var nowMs = Date.now();
      var ALWAYS_VISIBLE_ICON_ROWS = 4;

      if (state.activeTankWallTab === 'weapons' && gunsUi.rows) {
        var animatedNodes = gunsUi.rows.querySelectorAll('.scGunsTable__spriteCanvas[data-anim-frames]');
        if (animatedNodes && animatedNodes.length) {
          for (var i = 0; i < animatedNodes.length; i++) {
            var node = animatedNodes[i];
            var frames = toSafeNonNegativeInt(Number(node.getAttribute('data-anim-frames')));
            var fps = Number(node.getAttribute('data-anim-fps'));
            var rowNode = node.closest('.scGunsTable__row');
            var rowLevel = Number(rowNode && rowNode.getAttribute ? rowNode.getAttribute('data-level') : 0);
            var forceVisible = Number.isFinite(rowLevel) && rowLevel >= 1 && rowLevel <= ALWAYS_VISIBLE_ICON_ROWS;
            if (!forceVisible && rowNode && !isElementVerticallyVisible(rowNode, gunsUi.rows)) continue;
            var frameIndex = 0;
            if (frames > 1 && Number.isFinite(fps) && fps > 0) {
              frameIndex = Math.floor(nowMs * (fps / 1000)) % frames;
            }
            drawGunsSpriteCanvas(node, frameIndex);
          }
        }
      } else if (state.activeTankWallTab === 'walls' && wallsUi.rows) {
        var wallNodes = wallsUi.rows.querySelectorAll('.scGunsTable__spriteCanvas');
        if (wallNodes && wallNodes.length) {
          for (var j = 0; j < wallNodes.length; j++) {
            var wNode = wallNodes[j];
            var wRowNode = wNode.closest('.scGunsTable__row');
            var wRowLevel = Number(wRowNode && wRowNode.getAttribute ? wRowNode.getAttribute('data-level') : 0);
            var wForceVisible = Number.isFinite(wRowLevel) && wRowLevel >= 1 && wRowLevel <= ALWAYS_VISIBLE_ICON_ROWS;
            if (!wForceVisible && wRowNode && !isElementVerticallyVisible(wRowNode, wallsUi.rows)) continue;
            drawGunsSpriteCanvas(wNode, 0);
          }
        }
      }
    }

    function startGunsIconTicker() {
      if (state.iconTickerId != null) return;
      state.iconTickerId = global.setInterval(tickGunsIconSprites, 50);
    }

    function stopGunsIconTicker() {
      if (state.iconTickerId == null) return;
      global.clearInterval(state.iconTickerId);
      state.iconTickerId = null;
    }

    function formatNumber(value) {
      var num = Number(value);
      if (!Number.isFinite(num)) return '—';
      if (Math.abs(num) >= 100) return String(Math.round(num));
      var fixed = num.toFixed(2);
      return fixed
        .replace(/\.00$/, '')
        .replace(/(\.\d)0$/, '$1');
    }

    function normalizeRootTilesSize() {
      var tilesWrap = documentObj.querySelector('#supercomputerMenuOverlay .scRootTiles');
      if (!tilesWrap) return;
      var tiles = tilesWrap.querySelectorAll('.scRootTile');
      if (!tiles || !tiles.length) return;
      for (var i = 0; i < tiles.length; i++) {
        tiles[i].style.setProperty('--scRootTileUniformHeight', 'auto');
      }
      var maxHeight = 0;
      for (var j = 0; j < tiles.length; j++) {
        maxHeight = Math.max(maxHeight, Math.ceil(tiles[j].getBoundingClientRect().height));
      }
      if (maxHeight <= 0) return;
      for (var k = 0; k < tiles.length; k++) {
        tiles[k].style.setProperty('--scRootTileUniformHeight', String(maxHeight) + 'px');
      }
    }

    function getTankLevelViewData(level) {
      var tankCfg = global.TankSprites && typeof global.TankSprites.getTank === 'function'
        ? global.TankSprites.getTank(level)
        : null;
      var cannonSprite = global.TankSprites && typeof global.TankSprites.pickCannon === 'function'
        ? global.TankSprites.pickCannon(level)
        : null;
      var stats = tankCfg && tankCfg.stats ? tankCfg.stats : null;
      var baseAttackSpeed = Number(stats && stats.attackSpeed);
      var baseDamage = Number(stats && stats.baseDamage);
      return {
        tankCfg: tankCfg,
        cannonSprite: cannonSprite,
        baseAttackSpeed: Number.isFinite(baseAttackSpeed) ? baseAttackSpeed : null,
        baseDamage: Number.isFinite(baseDamage) ? baseDamage : null,
      };
    }

    function ensureGunsPanelUI() {
      if (gunsUi.initialized) return;
      var panel = tankWallTabPanels.weapons;
      if (!panel) return;

      panel.innerHTML = '';

      var pointsLine = documentObj.createElement('div');
      pointsLine.className = 'levelModal__line';
      pointsLine.id = 'modsTankWallGunsDamagePoints';

      var reserveLine = documentObj.createElement('div');
      reserveLine.className = 'levelModal__line';
      reserveLine.id = 'modsTankWallGunsReserved';

      var tableWrap = documentObj.createElement('div');
      tableWrap.className = 'scGunsTable scGunsTable_weapons';

      var tableHead = documentObj.createElement('div');
      tableHead.className = 'scGunsTable__head';
      tableHead.innerHTML = '' +
        '<div class="scGunsTable__cell scGunsTable__cell_sprite">' + translate('modsGunsColType') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_level">' + translate('modsGunsColLevel') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_stat">' + translate('modsGunsColAttackSpeed') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_stat">' + translate('modsGunsColDamage') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_upgrade">' + translate('modsGunsColUpgradeLevel') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_cost">' + translate('modsGunsColCost') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_actions">' + translate('modsGunsColActions') + '</div>';

      var tableRows = documentObj.createElement('div');
      tableRows.className = 'scGunsTable__rows';

      tableWrap.appendChild(tableHead);
      tableWrap.appendChild(tableRows);

      panel.appendChild(pointsLine);
      panel.appendChild(reserveLine);
      panel.appendChild(tableWrap);

      panel.addEventListener('click', function (evt) {
        var target = evt.target;
        if (!target || typeof target.closest !== 'function') return;
        var actionBtn = target.closest('[data-guns-action]');
        if (!actionBtn) return;
        var level = Number(actionBtn.getAttribute('data-level'));
        if (!Number.isFinite(level) || level < 1 || level > getGunsLevelsCount()) return;
        var action = actionBtn.getAttribute('data-guns-action');
        if (action === 'plus') {
          var applied = toSafeNonNegativeInt(getAppliedCannonUpgradeLevel(level));
          var pending = getPendingAt(level);
          var nextCost = toSafeNonNegativeInt(getCannonUpgradeStepCost(level, applied + pending));
          if (nextCost <= 0 || nextCost >= Number.MAX_SAFE_INTEGER) return;
          var available = toSafeNonNegativeInt(getDamagePoints());
          var reserved = getReservedDamagePoints();
          if (available - reserved < nextCost) {
            if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
              global.Game.Toast.show(translate('modsGunsNotEnoughDamagePoints'), 1200);
            }
            return;
          }
          setPendingAt(level, pending + 1);
          renderGunsPanel();
          return;
        }
        if (action === 'minus') {
          var currentPending = getPendingAt(level);
          if (currentPending <= 0) return;
          setPendingAt(level, currentPending - 1);
          renderGunsPanel();
          return;
        }
        if (action === 'apply') {
          var applyPending = getPendingAt(level);
          if (applyPending <= 0) return;
          var totalCost = getPendingCost(level, applyPending);
          var pointsAvailable = toSafeNonNegativeInt(getDamagePoints());
          if (pointsAvailable < totalCost) {
            if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
              global.Game.Toast.show(translate('modsGunsNotEnoughDamagePoints'), 1200);
            }
            return;
          }
          var result = applyCannonUpgrade(level, applyPending);
          if (!result || !result.ok) return;
          setPendingAt(level, 0);
          renderGunsPanel();
        }
      });

      gunsUi.root = panel;
      gunsUi.points = pointsLine;
      gunsUi.reserve = reserveLine;
      gunsUi.rows = tableRows;
      gunsUi.initialized = true;
    }

    function renderGunsPanel() {
      ensureGunsPanelUI();
      if (!gunsUi.initialized || !gunsUi.rows) return;
      ensurePendingLevelsSize();
      updateDamagePointsLabel();

      var cfg = getCannonUpgradeConfig();
      var levelsCount = getGunsLevelsCount();
      var rowsHtml = '';
      var availablePoints = toSafeNonNegativeInt(getDamagePoints());
      var reservedPoints = getReservedDamagePoints();

      for (var i = 0; i < levelsCount; i++) {
        var level = i + 1;
        var rowCfg = cfg[i] || [level, 0, 0, 0, 0];
        var damageMulPer = Number(rowCfg[3]) || 0;
        var speedMulPer = Number(rowCfg[4]) || 0;
        var applied = toSafeNonNegativeInt(getAppliedCannonUpgradeLevel(level));
        var pending = getPendingAt(level);
        var viewData = getTankLevelViewData(level);
        var baseAttackSpeed = viewData.baseAttackSpeed;
        var baseDamage = viewData.baseDamage;
        var currentAttackSpeed = Number.isFinite(baseAttackSpeed)
          ? baseAttackSpeed * (1 + applied * speedMulPer)
          : null;
        var currentDamage = Number.isFinite(baseDamage)
          ? baseDamage * (1 + applied * damageMulPer)
          : null;
        var nextStepCost = toSafeNonNegativeInt(getCannonUpgradeStepCost(level, applied + pending));
        var canAdd = nextStepCost > 0 && nextStepCost < Number.MAX_SAFE_INTEGER && (availablePoints - reservedPoints) >= nextStepCost;
        var canMinus = pending > 0;
        var totalPendingCost = getPendingCost(level, pending);
        var upgradeText = pending > 0
          ? String(applied) + ' (+' + String(pending) + ')'
          : String(applied);
        var canApply = pending > 0 && availablePoints >= totalPendingCost;
        var spriteHtml = '';
        if (viewData.cannonSprite && viewData.cannonSprite.img && viewData.cannonSprite.cfg) {
          var src = viewData.cannonSprite.img.currentSrc || viewData.cannonSprite.img.src || '';
          var frame = viewData.cannonSprite.cfg.frame || { x: 0, y: 0, w: 64, h: 64 };
          var frameX = Number.isFinite(frame.x) ? Math.floor(frame.x) : 0;
          var frameY = Number.isFinite(frame.y) ? Math.floor(frame.y) : 0;
          var lt = (global.Game && global.Game.Config && global.Game.Config.LayoutTuning) || {};
          var tunedFrameW = Number(lt.weaponIconSpriteFrameW);
          var tunedFrameH = Number(lt.weaponIconSpriteFrameH);
          var frameW = Number.isFinite(tunedFrameW) && tunedFrameW > 0
            ? Math.floor(tunedFrameW)
            : 128;
          var frameH = Number.isFinite(tunedFrameH) && tunedFrameH > 0
            ? Math.floor(tunedFrameH)
            : 128;
          var spriteFrames = Number.isFinite(viewData.cannonSprite.cfg.frames) && viewData.cannonSprite.cfg.frames >= 1
            ? Math.floor(viewData.cannonSprite.cfg.frames)
            : 1;
          var balanceFrames = toSafeNonNegativeInt(getCannonUpgradeIconFrames(level));
          if (balanceFrames <= 0) balanceFrames = 1;
          var animFrames = Math.max(1, Math.min(spriteFrames, balanceFrames));
          var animFps = Number(getCannonUpgradeIconFps(level));
          if (!Number.isFinite(animFps) || animFps <= 0) animFps = 8;
          var iconW = Number.isFinite(lt.weaponIconW) && lt.weaponIconW > 0 ? lt.weaponIconW : 60;
          var iconH = Number.isFinite(lt.weaponIconH) && lt.weaponIconH > 0 ? lt.weaponIconH : 45;
          spriteHtml = '' +
            '<span class="scGunsTable__spriteBox" style="width:' + String(iconW) + 'px;height:' + String(iconH) + 'px">' +
              '<canvas class="scGunsTable__spriteCanvas"' +
                ' width="' + String(iconW) + '"' +
                ' height="' + String(iconH) + '"' +
                ' style="width:' + String(iconW) + 'px;height:' + String(iconH) + 'px"' +
                ' data-anim-frames="' + String(animFrames) + '"' +
                ' data-anim-fps="' + String(animFps) + '"' +
                ' data-sprite-src="' + src + '"' +
                ' data-frame-x="' + String(frameX) + '"' +
                ' data-frame-y="' + String(frameY) + '"' +
                ' data-frame-w="' + String(frameW) + '"' +
                ' data-frame-h="' + String(frameH) + '"' +
              '></canvas>' +
            '</span>';
        } else {
          spriteHtml = '<span class="scGunsTable__spriteFallback">' + translate('modsGunsNoSprite') + '</span>';
        }
        rowsHtml += '' +
          '<div class="scGunsTable__row" data-level="' + String(level) + '">' +
            '<div class="scGunsTable__cell scGunsTable__cell_sprite">' + spriteHtml + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_level">' + String(level) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_stat">' + formatNumber(baseAttackSpeed) + ' / ' + formatNumber(currentAttackSpeed) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_stat">' + formatNumber(baseDamage) + ' / ' + formatNumber(currentDamage) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_upgrade">' + upgradeText + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_cost">' + formatCompact(nextStepCost) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_actions">' +
              '<span class="scGunsActionStepper">' +
                '<button type="button" class="btn btnSecondary uiButtonBehavior scGunsActionBtn" data-guns-action="plus" data-level="' + String(level) + '"' + (canAdd ? '' : ' disabled') + '>+</button>' +
                '<button type="button" class="btn btnSecondary uiButtonBehavior scGunsActionBtn" data-guns-action="minus" data-level="' + String(level) + '"' + (canMinus ? '' : ' disabled') + '>-</button>' +
              '</span>' +
              '<button type="button" class="btn btnPrimary uiButtonBehavior scGunsActionBtn" data-guns-action="apply" data-level="' + String(level) + '"' + (canApply ? '' : ' disabled') + '>' + translate('modsGunsUpgrade') + '</button>' +
            '</div>' +
          '</div>';
      }

      gunsUi.rows.innerHTML = rowsHtml;
      tickGunsIconSprites();
    }

    function ensureWallsPanelUI() {
      if (wallsUi.initialized) return;
      var panel = tankWallTabPanels.walls;
      if (!panel) return;

      panel.innerHTML = '';

      var pointsLine = documentObj.createElement('div');
      pointsLine.className = 'levelModal__line';
      pointsLine.id = 'modsTankWallWallsDamagePoints';

      var reserveLine = documentObj.createElement('div');
      reserveLine.className = 'levelModal__line';
      reserveLine.id = 'modsTankWallWallsReserved';

      var tableWrap = documentObj.createElement('div');
      tableWrap.className = 'scGunsTable';

      var tableHead = documentObj.createElement('div');
      tableHead.className = 'scGunsTable__head';
      tableHead.innerHTML = '' +
        '<div class="scGunsTable__cell scGunsTable__cell_sprite">' + translate('modsTabWalls') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_level">' + translate('modsGunsColLevel') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_stat">' + translate('modsWallsSegmentHpLabel', {hp:''}).replace(':', '').trim() + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_stat">' + translate('modsWallsArmorLabel', {armor:''}).replace(':', '').trim() + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_upgrade">' + translate('modsGunsColUpgradeLevel') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_cost">' + translate('modsGunsColCost') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_actions">' + translate('modsGunsColActions') + '</div>';

      var tableRows = documentObj.createElement('div');
      tableRows.className = 'scGunsTable__rows';

      tableWrap.appendChild(tableHead);
      tableWrap.appendChild(tableRows);

      panel.appendChild(pointsLine);
      panel.appendChild(reserveLine);
      panel.appendChild(tableWrap);

      panel.addEventListener('click', function (evt) {
        var target = evt.target;
        if (!target || typeof target.closest !== 'function') return;
        var actionBtn = target.closest('[data-walls-action]');
        if (!actionBtn) return;
        var level = Number(actionBtn.getAttribute('data-level'));
        if (!Number.isFinite(level) || level < 1 || level > getFenceLevelsCount()) return;
        var action = actionBtn.getAttribute('data-walls-action');
        if (action === 'plus') {
          var applied = toSafeNonNegativeInt(getAppliedFenceUpgradeLevel(level));
          var pending = getPendingFenceAt(level);
          var nextCost = toSafeNonNegativeInt(getCannonUpgradeStepCost(level, applied + pending));
          if (nextCost <= 0 || nextCost >= Number.MAX_SAFE_INTEGER) return;
          var available = toSafeNonNegativeInt(getDamagePoints());
          var reserved = getReservedFenceDamagePoints();
          if (available - reserved < nextCost) {
            if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
              global.Game.Toast.show(translate('modsGunsNotEnoughDamagePoints'), 1200);
            }
            return;
          }
          setPendingFenceAt(level, pending + 1);
          renderWallsPanel();
          return;
        }
        if (action === 'minus') {
          var currentPending = getPendingFenceAt(level);
          if (currentPending <= 0) return;
          setPendingFenceAt(level, currentPending - 1);
          renderWallsPanel();
          return;
        }
        if (action === 'apply') {
          var applyPending = getPendingFenceAt(level);
          if (applyPending <= 0) return;
          var totalCost = getPendingFenceCost(level, applyPending);
          var pointsAvailable = toSafeNonNegativeInt(getDamagePoints());
          if (pointsAvailable < totalCost) {
            if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
              global.Game.Toast.show(translate('modsGunsNotEnoughDamagePoints'), 1200);
            }
            return;
          }
          var result = applyFenceUpgrade(level, applyPending);
          if (!result || !result.ok) return;
          setPendingFenceAt(level, 0);
          renderWallsPanel();
        }
      });

      wallsUi.root = panel;
      wallsUi.points = pointsLine;
      wallsUi.reserve = reserveLine;
      wallsUi.rows = tableRows;
      wallsUi.initialized = true;
    }

    function renderWallsPanel() {
      ensureWallsPanelUI();
      if (!wallsUi.initialized || !wallsUi.rows) return;
      ensurePendingFenceLevelsSize();
      updateDamagePointsLabel();

      var levels = getFenceLevels();
      var cfg = getFenceConfig();
      var levelsCount = getFenceLevelsCount();
      var rowsHtml = '';
      var availablePoints = toSafeNonNegativeInt(getDamagePoints());
      var reservedPoints = getReservedFenceDamagePoints();

      var frames = Array.isArray(cfg.frames) ? cfg.frames : [];
      var frameById = Object.create(null);
      for (var j = 0; j < frames.length; j++) {
        var frameCfg = frames[j];
        if (!frameCfg || typeof frameCfg.id !== 'string' || !frameCfg.id) continue;
        frameById[frameCfg.id] = frameCfg;
      }

      function findFrameById(frameId) {
        if (!frameId || typeof frameId !== 'string') return null;
        return frameById[frameId] || null;
      }

      function readInlineFrame(frameCfg) {
        if (!frameCfg || typeof frameCfg !== 'object') return null;
        var x = Number(frameCfg.x);
        var y = Number(frameCfg.y);
        var w = Number(frameCfg.w);
        var h = Number(frameCfg.h);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
        return {
          x: Math.floor(x),
          y: Math.floor(y),
          w: Math.floor(w),
          h: Math.floor(h),
        };
      }

      for (var i = 0; i < levelsCount; i++) {
        var level = i + 1;
        var rowCfg = levels[i] || { segmentMaxHp: 0, armorFlat: 0, upgradeCostDamagePoints: 0 };
        var applied = toSafeNonNegativeInt(getAppliedFenceUpgradeLevel(level));
        var pending = getPendingFenceAt(level);

        var stats = getFenceStatsForLevel(level, applied);
        var baseHp = stats.baseHp;
        var baseArmor = stats.baseArmor;
        var currentHp = stats.currentHp;
        var currentArmor = stats.currentArmor;

        var nextStepCost = toSafeNonNegativeInt(getCannonUpgradeStepCost(level, applied + pending));
        var canAdd = nextStepCost > 0 && nextStepCost < Number.MAX_SAFE_INTEGER && (availablePoints - reservedPoints) >= nextStepCost;
        var canMinus = pending > 0;
        var totalPendingCost = getPendingFenceCost(level, pending);
        var upgradeText = pending > 0
          ? String(applied) + ' (+' + String(pending) + ')'
          : String(applied);
        var canApply = pending > 0 && availablePoints >= totalPendingCost;

        var spriteHtml = '';
        var uiIcon = rowCfg && rowCfg.uiIcon && typeof rowCfg.uiIcon === 'object' ? rowCfg.uiIcon : null;
        var uiIconFrame = uiIcon && uiIcon.frame && typeof uiIcon.frame === 'object' ? uiIcon.frame : null;
        var inlineFrame = null;
        if (uiIconFrame) {
          var iconFrameId = (typeof uiIconFrame.id === 'string' && uiIconFrame.id) ? uiIconFrame.id : null;
          if (iconFrameId) {
            inlineFrame = findFrameById(iconFrameId);
          }
          if (!inlineFrame) {
            inlineFrame = readInlineFrame(uiIconFrame);
          }
        }
        if (!inlineFrame && rowCfg && rowCfg.uiFrame && typeof rowCfg.uiFrame === 'object') {
          inlineFrame = readInlineFrame(rowCfg.uiFrame);
        }
        var frameId = (uiIcon && typeof uiIcon.frameId === 'string' && uiIcon.frameId)
          ? uiIcon.frameId
          : ((rowCfg && typeof rowCfg.uiFrameId === 'string' && rowCfg.uiFrameId)
            ? rowCfg.uiFrameId
            : 'sideTop');
        var uiFrame = inlineFrame || findFrameById(frameId);
        if (!uiFrame && !inlineFrame) uiFrame = findFrameById('sideTop');

        if (uiFrame) {
          var atlasName = (uiIcon && typeof uiIcon.atlas === 'string' && uiIcon.atlas)
            ? uiIcon.atlas
            : ((rowCfg && typeof rowCfg.uiAtlas === 'string' && rowCfg.uiAtlas)
              ? rowCfg.uiAtlas
              : (rowCfg.atlas || cfg.atlas || 'fence_atlas.png'));
          var src = 'assets/' + atlasName;
          var frameX = Number.isFinite(uiFrame.x) ? Math.floor(uiFrame.x) : 0;
          var frameY = Number.isFinite(uiFrame.y) ? Math.floor(uiFrame.y) : 0;
          var frameW = Number.isFinite(uiFrame.w) && uiFrame.w > 0 ? Math.floor(uiFrame.w) : 64;
          var frameH = Number.isFinite(uiFrame.h) && uiFrame.h > 0 ? Math.floor(uiFrame.h) : 64;

          var lt = (global.Game && global.Game.Config && global.Game.Config.LayoutTuning) || {};
          var iconW = Number.isFinite(lt.weaponIconW) && lt.weaponIconW > 0 ? lt.weaponIconW : 60;
          var iconH = Number.isFinite(lt.weaponIconH) && lt.weaponIconH > 0 ? lt.weaponIconH : 45;
          spriteHtml = '' +
            '<span class="scGunsTable__spriteBox" style="width:' + String(iconW) + 'px;height:' + String(iconH) + 'px">' +
              '<canvas class="scGunsTable__spriteCanvas"' +
                ' width="' + String(iconW) + '"' +
                ' height="' + String(iconH) + '"' +
                ' style="width:' + String(iconW) + 'px;height:' + String(iconH) + 'px"' +
                ' data-anim-frames="1"' +
                ' data-sprite-src="' + src + '"' +
                ' data-frame-x="' + String(frameX) + '"' +
                ' data-frame-y="' + String(frameY) + '"' +
                ' data-frame-w="' + String(frameW) + '"' +
                ' data-frame-h="' + String(frameH) + '"' +
              '></canvas>' +
            '</span>';
        } else {
          spriteHtml = '<span class="scGunsTable__spriteFallback">' + translate('modsGunsNoSprite') + '</span>';
        }

        rowsHtml += '' +
          '<div class="scGunsTable__row" data-level="' + String(level) + '">' +
            '<div class="scGunsTable__cell scGunsTable__cell_sprite">' + spriteHtml + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_level">' + String(level) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_stat">' + formatNumber(baseHp) + ' / ' + formatNumber(currentHp) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_stat">' + formatNumber(baseArmor) + ' / ' + formatNumber(currentArmor) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_upgrade">' + upgradeText + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_cost">' + formatCompact(nextStepCost) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_actions">' +
              '<span class="scGunsActionStepper">' +
                '<button type="button" class="btn btnSecondary uiButtonBehavior scGunsActionBtn" data-walls-action="plus" data-level="' + String(level) + '"' + (canAdd ? '' : ' disabled') + '>+</button>' +
                '<button type="button" class="btn btnSecondary uiButtonBehavior scGunsActionBtn" data-walls-action="minus" data-level="' + String(level) + '"' + (canMinus ? '' : ' disabled') + '>-</button>' +
              '</span>' +
              '<button type="button" class="btn btnPrimary uiButtonBehavior scGunsActionBtn" data-walls-action="apply" data-level="' + String(level) + '"' + (canApply ? '' : ' disabled') + '>' + translate('modsWallsUpgrade') + '</button>' +
            '</div>' +
          '</div>';
      }

      wallsUi.rows.innerHTML = rowsHtml;
      tickGunsIconSprites();
    }

    function updateFenceStatsUI() {
      // Deprecated, replaced by renderWallsPanel
    }

    function openRoot() {
      applyLayoutTuningVars();
      if (!state.isOpen) {
        resetPendingUpgrades();
        resetPendingFenceUpgrades();
      }
      stopGunsIconTicker();
      if (state.view === 'talents' && closeTalents) closeTalents();
      setOverlayOpen(hangarOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(tankWallOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(rootOverlay, true, a11yOpen, a11yClose, {
        initialFocus: documentObj.getElementById('supercomputerOpenHangarMods'),
        onClose: closeAll,
      });
      state.isOpen = true;
      state.view = 'root';
      normalizeRootTilesSize();
      setBodyScrollLock(true);
      onPauseLockChange(true);
    }

    function showHangarMods() {
      setOverlayOpen(rootOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(hangarOverlay, true, a11yOpen, a11yClose, {
        initialFocus: documentObj.getElementById('modsHangarBack'),
        onClose: backFromChild,
      });
      state.view = 'hangar';
      setBodyScrollLock(true);
    }

    function showTankWallMods() {
      setTankWallTab('weapons');
      ensurePendingLevelsSize();
      ensurePendingFenceLevelsSize();
      updateDamagePointsLabel();
      renderGunsPanel();
      renderWallsPanel();
      updateFenceStatsUI();

      setOverlayOpen(rootOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(tankWallOverlay, true, a11yOpen, a11yClose, {
        initialFocus: documentObj.getElementById('modsTankWallTabGuns'),
        onClose: backFromChild,
      });
      state.view = 'tankWall';
      startGunsIconTicker();
      setBodyScrollLock(true);
    }

    function showTalents() {
      if (!openTalents) return;
      setOverlayOpen(rootOverlay, false, a11yOpen, a11yClose);
      state.view = 'talents';
      openTalents({ onClose: backFromChild });
      applySharedTalentModalClass();
      setBodyScrollLock(true);
    }

    function backFromChild() {
      if (!state.isOpen) return;
      if (state.view === 'talents' && closeTalents) closeTalents();
      openRoot();
    }

    function closeAll() {
      if (!state.isOpen) return;
      if (state.view === 'talents' && closeTalents) closeTalents();
      stopGunsIconTicker();
      setOverlayOpen(rootOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(hangarOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(tankWallOverlay, false, a11yOpen, a11yClose);
      resetPendingUpgrades();
      resetPendingFenceUpgrades();
      state.isOpen = false;
      state.view = 'closed';
      setBodyScrollLock(false);
      onPauseLockChange(false);
    }

    documentObj.getElementById('supercomputerOpenHangarMods')?.addEventListener('click', showHangarMods);
    documentObj.getElementById('supercomputerOpenTankWallMods')?.addEventListener('click', showTankWallMods);
    documentObj.getElementById('supercomputerOpenTalents')?.addEventListener('click', showTalents);

    documentObj.getElementById('supercomputerMenuClose')?.addEventListener('click', closeAll);
    rootOverlay.addEventListener('click', function (evt) {
      if (evt.target && evt.target.dataset && evt.target.dataset.supercomputerRootClose === 'true') closeAll();
    });

    documentObj.getElementById('modsHangarClose')?.addEventListener('click', backFromChild);
    documentObj.getElementById('modsHangarBack')?.addEventListener('click', backFromChild);
    hangarOverlay.addEventListener('click', function (evt) {
      if (evt.target && evt.target.dataset && evt.target.dataset.modsHangarClose === 'true') backFromChild();
    });

    documentObj.getElementById('modsTankWallClose')?.addEventListener('click', backFromChild);
    documentObj.getElementById('modsTankWallBack')?.addEventListener('click', backFromChild);
    tankWallTabButtons.weapons?.addEventListener('click', function () { setTankWallTab('weapons', { focusButton: true }); });
    tankWallTabButtons.walls?.addEventListener('click', function () { setTankWallTab('walls', { focusButton: true }); });
    documentObj.getElementById('modsTankWallFenceUpgrade')?.addEventListener('click', function () {
      if (!upgradeFence()) return;
      updateDamagePointsLabel();
      updateFenceStatsUI();
    });
    tankWallOverlay.addEventListener('click', function (evt) {
      if (evt.target && evt.target.dataset && evt.target.dataset.modsTankWallClose === 'true') backFromChild();
    });

    return {
      openRoot: openRoot,
      closeAll: closeAll,
      isOpen: function () { return !!state.isOpen; },
      getView: function () { return state.view; },
      refreshDamagePointsIfVisible: function () {
        if (!state.isOpen || state.view !== 'tankWall') return;
        updateDamagePointsLabel();
        renderGunsPanel();
        renderWallsPanel();
        updateFenceStatsUI();
      },
      refreshTankWallIfVisible: function () {
        if (!state.isOpen || state.view !== 'tankWall') return;
        updateDamagePointsLabel();
        renderGunsPanel();
        renderWallsPanel();
        updateFenceStatsUI();
      },
    };
  }

  global.Game = global.Game || {};
  global.Game.SupercomputerMenu = {
    createController: createController,
  };
})(typeof window !== 'undefined' ? window : this);
