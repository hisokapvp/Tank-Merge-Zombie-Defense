(function (global) {
  'use strict';

  function showModal(modal, a11yOpen, initialFocus, onClose) {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    if (typeof a11yOpen === 'function') {
      a11yOpen(modal, { initialFocus: initialFocus || null, onClose: onClose || null });
    }
  }

  function hideModal(modal, a11yClose) {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    if (typeof a11yClose === 'function') a11yClose(modal);
  }

  function openResetTalentsModal(options) {
    var opts = options || {};
    var t = opts.t || function (k) { return k; };
    var modal = document.getElementById('resetTalentsModal');
    var textEl = document.getElementById('resetTalentsModalText');
    var watchEl = document.getElementById('resetTalentsModalWatch');
    if (textEl) textEl.textContent = t('talentResetModalText');
    if (watchEl) watchEl.textContent = t('talentResetModalWatchBtn');
    showModal(modal, opts.a11yOpen, watchEl, opts.onClose);
  }

  function closeResetTalentsModal(options) {
    var opts = options || {};
    hideModal(document.getElementById('resetTalentsModal'), opts.a11yClose);
  }

  function openCrateModal(options) {
    var opts = options || {};
    var state = opts.state;
    var ui = opts.ui;
    var t = opts.t || function (k) { return k; };
    if (!state || !state.crate || !ui || !ui.crateModal) return;

    if (ui.crateText) ui.crateText.textContent = t('crateModalText');
    if (ui.crateGet) {
      ui.crateGet.disabled = false;
      ui.crateGet.textContent = t('crateGet');
    }

    if (document && document.body) {
      document.body.classList.add('crate-open');
    }

    showModal(ui.crateModal, opts.a11yOpen, ui.crateGet, opts.onClose);

    if (typeof opts.renderCrateIcon === 'function') {
      opts.renderCrateIcon(state.crate.rewardLevel != null ? state.crate.rewardLevel : 1);
    }
  }

  function closeCrateModal(options) {
    var opts = options || {};
    var ui = opts.ui;
    if (!ui || !ui.crateModal) return;
    if (document && document.body) {
      document.body.classList.remove('crate-open');
    }
    hideModal(ui.crateModal, opts.a11yClose);
  }

  function closeDismantleModal(options) {
    var opts = options || {};
    var ui = opts.ui;
    if (!ui || !ui.dismantleModal) return;
    hideModal(ui.dismantleModal, opts.a11yClose);
  }

  function openDismantleModal(options) {
    var opts = options || {};
    var ui = opts.ui;
    var state = opts.state;
    if (!ui || !ui.dismantleModal || !state) return;

    if (!state.isDismantleMode) {
      state.isDismantleMode = true;
      state.selectedTankIds = [];
      if (typeof opts.updateDismantleButton === 'function') {
        opts.updateDismantleButton();
      }
      return;
    }

    var selected = (state.selectedTankIds || []).filter(function (id) {
      return (state.cells || []).some(function (c) { return c && c.tank && c.tank.id === id; });
    });

    if (selected.length === 0) {
      state.isDismantleMode = false;
      state.selectedTankIds = [];
      if (typeof opts.updateDismantleButton === 'function') {
        opts.updateDismantleButton();
      }
      return;
    }

    if (typeof opts.fillDismantleConfirmModal === 'function') {
      opts.fillDismantleConfirmModal(selected);
    } else {
      fillDismantleConfirmModal({
        ui: ui,
        state: state,
        t: opts.t,
        selectedTankIds: selected,
        drawTankIconTo: opts.drawTankIconTo,
      });
    }
    showModal(ui.dismantleModal, opts.a11yOpen, ui.dismantleYes, opts.onClose);
  }

  function fillDismantleConfirmModal(options) {
    var opts = options || {};
    var ui = opts.ui;
    var state = opts.state;
    var t = opts.t || function (k) { return k; };
    var selectedTankIds = opts.selectedTankIds || [];
    var drawTankIconTo = opts.drawTankIconTo;

    if (!ui || !state) return;
    if (ui.dismantleConfirmText) ui.dismantleConfirmText.textContent = t('dismantleConfirmMulti');
    if (ui.dismantleYes) ui.dismantleYes.textContent = t('dismantleYes');
    if (ui.dismantleNo) ui.dismantleNo.textContent = t('dismantleNo');

    var wrap = document.getElementById('dismantleIconsWrap');
    if (!wrap) return;

    var maxIcons = 12;
    var ids = selectedTankIds.slice(0, maxIcons);
    var rest = Math.max(0, selectedTankIds.length - maxIcons);
    wrap.innerHTML = '';

    ids.forEach(function (id) {
      var cell = (state.cells || []).find(function (c) {
        return c && c.tank && c.tank.id === id;
      });
      if (!cell || !cell.tank) return;

      var can = document.createElement('canvas');
      can.width = 36;
      can.height = 28;
      can.style.verticalAlign = 'middle';
      can.style.marginRight = '4px';
      var cctx = can.getContext('2d');
      if (typeof drawTankIconTo === 'function') {
        drawTankIconTo(cctx, 18, 14, cell.tank.level, false, 0.7, { showShadow: false });
      }
      wrap.appendChild(can);
    });

    var span = document.createElement('span');
    span.style.marginLeft = '8px';
    if (rest > 0) {
      span.textContent = t('dismantleMore') + ' ' + rest + ' · ' + selectedTankIds.length + ' ' + t('dismantleCount');
    } else {
      span.textContent = selectedTankIds.length + ' ' + t('dismantleCount');
    }
    wrap.appendChild(span);
  }

  function openLevelModal(options) {
    var opts = options || {};
    var ui = opts.ui;
    if (!ui || !ui.levelModal) return;
    if (document && document.body) {
      document.body.classList.add('levelmodal-open');
    }
    showModal(ui.levelModal, opts.a11yOpen, ui.levelAccept, opts.onClose);
    if (typeof opts.updateLevelModal === 'function') {
      opts.updateLevelModal();
    }
  }

  function closeLevelModal(options) {
    var opts = options || {};
    var ui = opts.ui;
    if (!ui || !ui.levelModal) return;
    if (document && document.body) {
      document.body.classList.remove('levelmodal-open');
    }
    hideModal(ui.levelModal, opts.a11yClose);
  }

  function setMenuOpen(options) {
    var opts = options || {};
    var ui = opts.ui;
    var open = !!opts.open;
    var state = opts.state;
    if (!state || !state.ui) return;

    state.ui.menuOpen = open;
    if (document && document.body) {
      document.body.classList.toggle('menu-open', open);
    }

    if (ui && ui.menuOverlay) {
      ui.menuOverlay.classList.toggle('hidden', !open);
      ui.menuOverlay.setAttribute('aria-hidden', (!open).toString());
      if (open) {
        if (typeof opts.a11yOpen === 'function') {
          opts.a11yOpen(ui.menuOverlay, { initialFocus: ui.menuContinue, onClose: opts.onClose });
        }
      } else if (typeof opts.a11yClose === 'function') {
        opts.a11yClose(ui.menuOverlay);
      }
    }

    if (typeof opts.updateMenuState === 'function') {
      opts.updateMenuState();
    }
  }

  global.Game = global.Game || {};
  global.Game.UIModals = {
    fillDismantleConfirmModal: fillDismantleConfirmModal,
    openDismantleModal: openDismantleModal,
    openResetTalentsModal: openResetTalentsModal,
    closeResetTalentsModal: closeResetTalentsModal,
    openCrateModal: openCrateModal,
    closeCrateModal: closeCrateModal,
    closeDismantleModal: closeDismantleModal,
    openLevelModal: openLevelModal,
    closeLevelModal: closeLevelModal,
    setMenuOpen: setMenuOpen,
  };
})(typeof window !== 'undefined' ? window : this);
