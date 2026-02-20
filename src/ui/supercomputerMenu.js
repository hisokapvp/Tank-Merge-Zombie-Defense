(function (global) {
  'use strict';

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
    var upgradeFence = typeof opts.upgradeFence === 'function' ? opts.upgradeFence : function () { return false; };
    var translate = typeof opts.translate === 'function' ? opts.translate : function (_, vars) {
      var key = _ || '';
      if (key === 'modsGunsColType') return 'Cannon';
      if (key === 'modsGunsColLevel') return 'Lvl';
      if (key === 'modsGunsColAttackSpeed') return 'Attack speed';
      if (key === 'modsGunsColDamage') return 'Damage';
      if (key === 'modsGunsColUpgradeLevel') return 'Upgrade level';
      if (key === 'modsGunsColActions') return 'Actions';
      if (key === 'modsGunsUpgrade') return 'Upgrade';
      if (key === 'modsGunsReservedLabel') return 'Reserved points: ' + (vars && vars.count != null ? vars.count : 0);
      if (key === 'modsGunsNotEnoughDamagePoints') return 'Not enough damage points';
      if (key === 'modsGunsNoSprite') return 'No sprite';
      if (key === 'modsWallsLevelLabel') return 'Wall level: ' + (vars && vars.level != null ? vars.level : 1);
      if (key === 'modsWallsSegmentHpLabel') return 'Segment HP: ' + (vars && vars.hp != null ? vars.hp : 0);
      if (key === 'modsWallsArmorLabel') return 'Armor: ' + (vars && vars.armor != null ? vars.armor : 0);
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
    };

    var tankWallTabButtons = {
      weapons: documentObj.getElementById('modsTankWallTabGuns'),
      bases: documentObj.getElementById('modsTankWallTabBases'),
      walls: documentObj.getElementById('modsTankWallTabWalls'),
    };

    var tankWallTabPanels = {
      weapons: documentObj.getElementById('modsTankWallPanelGuns'),
      bases: documentObj.getElementById('modsTankWallPanelBases'),
      walls: documentObj.getElementById('modsTankWallPanelWalls'),
    };

    var gunsUi = {
      root: null,
      points: null,
      reserve: null,
      rows: null,
      initialized: false,
    };

    function applySharedTalentModalClass() {
      var talentOverlay = documentObj.getElementById('talentOverlay');
      if (!talentOverlay) return;
      var panel = talentOverlay.querySelector('.modal');
      if (!panel) return;
      panel.classList.add('scModal');
    }

    function setTankWallTab(nextTab, options) {
      var tab = nextTab === 'walls' || nextTab === 'bases' ? nextTab : 'weapons';
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
          next[i] = Math.max(0, Math.floor(state.pendingUpgradesByLevel[i] || 0));
        }
        state.pendingUpgradesByLevel = next;
      }
    }

    function getPendingAt(level) {
      ensurePendingLevelsSize();
      var idx = Math.max(1, Math.floor(level || 1)) - 1;
      var value = state.pendingUpgradesByLevel[idx];
      if (!Number.isFinite(value)) return 0;
      return Math.max(0, Math.floor(value));
    }

    function setPendingAt(level, value) {
      ensurePendingLevelsSize();
      var idx = Math.max(1, Math.floor(level || 1)) - 1;
      state.pendingUpgradesByLevel[idx] = Math.max(0, Math.floor(value || 0));
    }

    function resetPendingUpgrades() {
      ensurePendingLevelsSize();
      for (var i = 0; i < state.pendingUpgradesByLevel.length; i++) {
        state.pendingUpgradesByLevel[i] = 0;
      }
    }

    function getPendingCost(level, pendingCount) {
      var count = Number.isFinite(pendingCount) ? Math.max(0, Math.floor(pendingCount)) : 0;
      if (count <= 0) return 0;
      var applied = Math.max(0, Math.floor(getAppliedCannonUpgradeLevel(level) || 0));
      var total = 0;
      for (var i = 0; i < count; i++) {
        total += Math.max(0, Math.floor(getCannonUpgradeStepCost(level, applied + i) || 0));
      }
      return total;
    }

    function getReservedDamagePoints() {
      ensurePendingLevelsSize();
      var total = 0;
      for (var i = 0; i < state.pendingUpgradesByLevel.length; i++) {
        total += getPendingCost(i + 1, state.pendingUpgradesByLevel[i]);
      }
      return total;
    }

    function formatNumber(value) {
      var num = Number(value);
      if (!Number.isFinite(num)) return '—';
      if (Math.abs(num) >= 100) return String(Math.round(num));
      return num.toFixed(2);
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
      tableWrap.className = 'scGunsTable';

      var tableHead = documentObj.createElement('div');
      tableHead.className = 'scGunsTable__head';
      tableHead.innerHTML = '' +
        '<div class="scGunsTable__cell scGunsTable__cell_sprite">' + translate('modsGunsColType') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_level">' + translate('modsGunsColLevel') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_stat">' + translate('modsGunsColAttackSpeed') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_stat">' + translate('modsGunsColDamage') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_upgrade">' + translate('modsGunsColUpgradeLevel') + '</div>' +
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
          var applied = Math.max(0, Math.floor(getAppliedCannonUpgradeLevel(level) || 0));
          var pending = getPendingAt(level);
          var nextCost = Math.max(0, Math.floor(getCannonUpgradeStepCost(level, applied + pending) || 0));
          var available = Math.max(0, Math.floor(getDamagePoints()));
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
          var pointsAvailable = Math.max(0, Math.floor(getDamagePoints()));
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
      var availablePoints = Math.max(0, Math.floor(getDamagePoints()));
      var reservedPoints = getReservedDamagePoints();

      for (var i = 0; i < levelsCount; i++) {
        var level = i + 1;
        var rowCfg = cfg[i] || [level, 0, 0, 0, 0];
        var damageMulPer = Number(rowCfg[3]) || 0;
        var speedMulPer = Number(rowCfg[4]) || 0;
        var applied = Math.max(0, Math.floor(getAppliedCannonUpgradeLevel(level) || 0));
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
        var nextStepCost = Math.max(0, Math.floor(getCannonUpgradeStepCost(level, applied + pending) || 0));
        var canAdd = (availablePoints - reservedPoints) >= nextStepCost;
        var canMinus = pending > 0;
        var totalPendingCost = getPendingCost(level, pending);
        var upgradeText = pending > 0
          ? String(applied) + ' (+' + String(pending) + ')'
          : String(applied);
        var canApply = pending > 0 && availablePoints >= totalPendingCost;
        var spriteHtml = '';
        if (viewData.cannonSprite && viewData.cannonSprite.img && viewData.cannonSprite.cfg) {
          var src = viewData.cannonSprite.img.currentSrc || viewData.cannonSprite.img.src || '';
          spriteHtml = '<img class="scGunsTable__sprite" src="' + src + '" alt="" />';
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
            '<div class="scGunsTable__cell scGunsTable__cell_actions">' +
              '<button type="button" class="btn btnSecondary uiButtonBehavior scGunsActionBtn" data-guns-action="plus" data-level="' + String(level) + '"' + (canAdd ? '' : ' disabled') + '>+</button>' +
              '<button type="button" class="btn btnSecondary uiButtonBehavior scGunsActionBtn" data-guns-action="minus" data-level="' + String(level) + '"' + (canMinus ? '' : ' disabled') + '>-</button>' +
              '<button type="button" class="btn btnPrimary uiButtonBehavior scGunsActionBtn" data-guns-action="apply" data-level="' + String(level) + '"' + (canApply ? '' : ' disabled') + '>' + translate('modsGunsUpgrade') + '</button>' +
            '</div>' +
          '</div>';
      }

      gunsUi.rows.innerHTML = rowsHtml;
    }

    function updateFenceStatsUI() {
      var stats = getFenceStats() || {};
      var levelEl = documentObj.getElementById('modsTankWallFenceLevel');
      var hpEl = documentObj.getElementById('modsTankWallFenceHp');
      var armorEl = documentObj.getElementById('modsTankWallFenceArmor');
      var upgradeBtn = documentObj.getElementById('modsTankWallFenceUpgrade');

      if (levelEl) {
        levelEl.textContent = translate('modsWallsLevelLabel', {
          level: Math.max(1, Math.floor(stats.level || 1)),
        });
      }
      if (hpEl) {
        hpEl.textContent = translate('modsWallsSegmentHpLabel', {
          hp: Math.max(1, Math.floor(stats.segmentMaxHp || 0)),
        });
      }
      if (armorEl) {
        armorEl.textContent = translate('modsWallsArmorLabel', {
          armor: Math.max(0, Math.floor(stats.armorFlat || 0)),
        });
      }
      if (upgradeBtn) {
        if (stats.hasNextLevel) {
          var cost = Math.max(0, Math.floor(stats.upgradeCostDamagePoints || 0));
          upgradeBtn.textContent = translate('modsWallsUpgradeCost', { cost: cost });
          upgradeBtn.disabled = !stats.canUpgrade;
        } else {
          upgradeBtn.textContent = translate('modsWallsUpgradeMax');
          upgradeBtn.disabled = true;
        }
      }
    }

    function openRoot() {
      if (!state.isOpen) {
        resetPendingUpgrades();
      }
      if (state.view === 'talents' && closeTalents) closeTalents();
      setOverlayOpen(hangarOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(tankWallOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(rootOverlay, true, a11yOpen, a11yClose, {
        initialFocus: documentObj.getElementById('supercomputerOpenHangarMods'),
        onClose: closeAll,
      });
      state.isOpen = true;
      state.view = 'root';
      onPauseLockChange(true);
    }

    function showHangarMods() {
      setOverlayOpen(rootOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(hangarOverlay, true, a11yOpen, a11yClose, {
        initialFocus: documentObj.getElementById('modsHangarBack'),
        onClose: backFromChild,
      });
      state.view = 'hangar';
    }

    function showTankWallMods() {
      setTankWallTab('weapons');
      ensurePendingLevelsSize();
      updateDamagePointsLabel();
      renderGunsPanel();
      updateFenceStatsUI();

      setOverlayOpen(rootOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(tankWallOverlay, true, a11yOpen, a11yClose, {
        initialFocus: documentObj.getElementById('modsTankWallTabGuns'),
        onClose: backFromChild,
      });
      state.view = 'tankWall';
    }

    function showTalents() {
      if (!openTalents) return;
      setOverlayOpen(rootOverlay, false, a11yOpen, a11yClose);
      state.view = 'talents';
      openTalents({ onClose: backFromChild });
      applySharedTalentModalClass();
    }

    function backFromChild() {
      if (!state.isOpen) return;
      if (state.view === 'talents' && closeTalents) closeTalents();
      openRoot();
    }

    function closeAll() {
      if (!state.isOpen) return;
      if (state.view === 'talents' && closeTalents) closeTalents();
      setOverlayOpen(rootOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(hangarOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(tankWallOverlay, false, a11yOpen, a11yClose);
      resetPendingUpgrades();
      state.isOpen = false;
      state.view = 'closed';
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
    tankWallTabButtons.bases?.addEventListener('click', function () { setTankWallTab('bases', { focusButton: true }); });
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
        updateFenceStatsUI();
      },
      refreshTankWallIfVisible: function () {
        if (!state.isOpen || state.view !== 'tankWall') return;
        updateDamagePointsLabel();
        renderGunsPanel();
        updateFenceStatsUI();
      },
    };
  }

  global.Game = global.Game || {};
  global.Game.SupercomputerMenu = {
    createController: createController,
  };
})(typeof window !== 'undefined' ? window : this);
