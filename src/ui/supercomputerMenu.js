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
    var translate = typeof opts.translate === 'function' ? opts.translate : function (_, vars) {
      return 'Damage points: ' + (vars && vars.count != null ? vars.count : 0);
    };

    var state = {
      isOpen: false,
      view: 'closed',
    };

    function updateDamagePointsLabel() {
      var damagePointsEl = documentObj.getElementById('modsTankWallDamagePoints');
      if (!damagePointsEl) return;
      var count = Math.max(0, Math.floor(getDamagePoints()));
      damagePointsEl.textContent = translate('damagePointsLabel', { count: count });
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
      updateDamagePointsLabel();

      setOverlayOpen(rootOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(tankWallOverlay, true, a11yOpen, a11yClose, {
        initialFocus: documentObj.getElementById('modsTankWallTabBases'),
        onClose: backFromChild,
      });
      state.view = 'tankWall';
    }

    function showTalents() {
      if (!openTalents) return;
      setOverlayOpen(rootOverlay, false, a11yOpen, a11yClose);
      state.view = 'talents';
      openTalents({ onClose: backFromChild });
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
      },
    };
  }

  global.Game = global.Game || {};
  global.Game.SupercomputerMenu = {
    createController: createController,
  };
})(typeof window !== 'undefined' ? window : this);
