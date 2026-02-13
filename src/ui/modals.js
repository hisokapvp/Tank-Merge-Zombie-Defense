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

  function openBoostModal(options) {
    var opts = options || {};
    var t = opts.t || function (k) { return k; };
    var modal = document.getElementById('boostModal');
    var textEl = document.getElementById('boostModalText');
    var watchEl = document.getElementById('boostModalWatch');
    if (textEl) textEl.textContent = t('boostModalText');
    if (watchEl) watchEl.textContent = t('boostModalWatch');
    showModal(modal, opts.a11yOpen, watchEl, opts.onClose);
  }

  function closeBoostModal(options) {
    var opts = options || {};
    hideModal(document.getElementById('boostModal'), opts.a11yClose);
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

    showModal(ui.crateModal, opts.a11yOpen, ui.crateGet, opts.onClose);

    if (typeof opts.renderCrateIcon === 'function') {
      opts.renderCrateIcon(state.crate.rewardLevel != null ? state.crate.rewardLevel : 1);
    }
  }

  function closeCrateModal(options) {
    var opts = options || {};
    var ui = opts.ui;
    if (!ui || !ui.crateModal) return;
    hideModal(ui.crateModal, opts.a11yClose);
  }

  function closeDismantleModal(options) {
    var opts = options || {};
    var ui = opts.ui;
    if (!ui || !ui.dismantleModal) return;
    hideModal(ui.dismantleModal, opts.a11yClose);
  }

  global.Game = global.Game || {};
  global.Game.UIModals = {
    openBoostModal: openBoostModal,
    closeBoostModal: closeBoostModal,
    openResetTalentsModal: openResetTalentsModal,
    closeResetTalentsModal: closeResetTalentsModal,
    openCrateModal: openCrateModal,
    closeCrateModal: closeCrateModal,
    closeDismantleModal: closeDismantleModal,
  };
})(typeof window !== 'undefined' ? window : this);
