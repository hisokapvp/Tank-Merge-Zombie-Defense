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

      var focusButton = options && options.focusButton;
      if (focusButton) {
        tankWallTabButtons[tab]?.focus();
      }
    }

    function updateDamagePointsLabel() {
      var damagePointsEl = documentObj.getElementById('modsTankWallDamagePoints');
      if (!damagePointsEl) return;
      var count = Math.max(0, Math.floor(getDamagePoints()));
      damagePointsEl.textContent = translate('damagePointsLabel', { count: count });
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
      updateDamagePointsLabel();
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
        updateFenceStatsUI();
      },
      refreshTankWallIfVisible: function () {
        if (!state.isOpen || state.view !== 'tankWall') return;
        updateDamagePointsLabel();
        updateFenceStatsUI();
      },
    };
  }

  global.Game = global.Game || {};
  global.Game.SupercomputerMenu = {
    createController: createController,
  };
})(typeof window !== 'undefined' ? window : this);
