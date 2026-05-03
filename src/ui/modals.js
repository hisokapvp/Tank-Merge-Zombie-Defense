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

  function ensureResetTalentsModalControls(t) {
    var translate = typeof t === 'function' ? t : function (key) { return key; };
    var modal = document.getElementById('resetTalentsModal');
    if (!modal) return null;
    var textEl = document.getElementById('resetTalentsModalText');
    var contentWrap = modal.querySelector('.levelModal__contentWrap');
    var closeBtn = document.getElementById('resetTalentsModalClose');
    var confirmBtn = document.getElementById('resetTalentsModalWatch');
    if (!contentWrap || !confirmBtn) {
      return {
        modal: modal,
        textEl: textEl,
        closeBtn: closeBtn,
        confirmBtn: confirmBtn,
        cancelBtn: document.getElementById('resetTalentsModalCancel'),
      };
    }

    var actions = document.getElementById('resetTalentsModalActions');
    if (!actions) {
      actions = document.createElement('div');
      actions.id = 'resetTalentsModalActions';
      actions.className = 'menuInlineActions';
      contentWrap.appendChild(actions);
    }
    if (confirmBtn.parentNode !== actions) actions.appendChild(confirmBtn);

    var cancelBtn = document.getElementById('resetTalentsModalCancel');
    if (!cancelBtn) {
      cancelBtn = document.createElement('button');
      cancelBtn.id = 'resetTalentsModalCancel';
      cancelBtn.className = 'btn btnSecondary';
      cancelBtn.type = 'button';
      actions.appendChild(cancelBtn);
    }

    confirmBtn.textContent = translate('talentResetModalWatchBtn');
    cancelBtn.textContent = translate('dismantleNo');

    return {
      modal: modal,
      textEl: textEl,
      closeBtn: closeBtn,
      confirmBtn: confirmBtn,
      cancelBtn: cancelBtn,
    };
  }

  function openResetTalentsModal(options) {
    var opts = options || {};
    var t = opts.t || function (k) { return k; };
    var controls = ensureResetTalentsModalControls(t);
    if (!controls || !controls.modal) return;
    if (controls.textEl) controls.textEl.textContent = t('talentResetModalText', { cost: opts.cost || '0' });
    if (controls.closeBtn) controls.closeBtn.setAttribute('aria-label', opts.closeAriaLabel || t('menuClose'));
    if (controls.confirmBtn) {
      controls.confirmBtn.textContent = opts.confirmLabel || t('talentResetModalWatchBtn');
      controls.confirmBtn.disabled = !!opts.confirmDisabled;
      controls.confirmBtn.removeAttribute('title');
      if (opts.confirmTooltip) controls.confirmBtn.setAttribute('data-ui-tooltip', opts.confirmTooltip);
      else controls.confirmBtn.removeAttribute('data-ui-tooltip');
    }
    if (controls.cancelBtn) controls.cancelBtn.textContent = opts.cancelLabel || t('dismantleNo');
    showModal(
      controls.modal,
      opts.a11yOpen,
      controls.confirmBtn && !controls.confirmBtn.disabled ? controls.confirmBtn : controls.cancelBtn,
      opts.onClose
    );
  }

  function closeResetTalentsModal(options) {
    var opts = options || {};
    hideModal(document.getElementById('resetTalentsModal'), opts.a11yClose);
  }

  function openTalentResetCooldownModal(options) {
    var opts = options || {};
    var t = opts.t || function (k) { return k; };
    var modal = document.getElementById('talentResetCooldownModal');
    if (!modal) return;

    var titleEl = document.getElementById('talentResetCooldownModalTitle');
    var textEl = document.getElementById('talentResetCooldownModalText');
    var closeBtn = document.getElementById('talentResetCooldownModalClose');
    var dismissBtn = document.getElementById('talentResetCooldownModalDismiss');
    var refreshBtn = document.getElementById('talentResetCooldownModalRefresh');
    var refreshLabelEl = refreshBtn ? refreshBtn.querySelector('.talentResetCooldownAdBtn__label') : null;

    if (titleEl) titleEl.textContent = opts.titleLabel || t('talentResetAll');
    if (textEl) textEl.textContent = opts.text || t('talentResetCooldownModalText', { time: opts.time || '00:00:00' });
    if (closeBtn) closeBtn.setAttribute('aria-label', opts.closeAriaLabel || t('menuClose'));
    if (dismissBtn) dismissBtn.textContent = opts.dismissLabel || t('menuClose');
    if (refreshLabelEl) refreshLabelEl.textContent = opts.refreshLabel || t('talentResetCooldownRefreshNow');
    else if (refreshBtn) refreshBtn.textContent = opts.refreshLabel || t('talentResetCooldownRefreshNow');
    if (refreshBtn) {
      refreshBtn.removeAttribute('title');
      if (opts.refreshTooltip) refreshBtn.setAttribute('data-ui-tooltip', opts.refreshTooltip);
      else refreshBtn.removeAttribute('data-ui-tooltip');
    }

    showModal(
      modal,
      opts.a11yOpen,
      dismissBtn || refreshBtn || closeBtn,
      opts.onClose
    );
  }

  function closeTalentResetCooldownModal(options) {
    var opts = options || {};
    hideModal(document.getElementById('talentResetCooldownModal'), opts.a11yClose);
  }

  function ensureCrateClaimButtonContent(button) {
    if (!button) return null;
    button.classList.add('talentResetCooldownAdBtn', 'crateModal__claimBtn');

    var labelEl = button.querySelector('.talentResetCooldownAdBtn__label');
    var iconEl = button.querySelector('.talentResetCooldownAdBtn__icon');

    if (!labelEl || !iconEl) {
      button.textContent = '';
      labelEl = document.createElement('span');
      labelEl.className = 'talentResetCooldownAdBtn__label';
      iconEl = document.createElement('span');
      iconEl.className = 'talentResetCooldownAdBtn__icon';
      iconEl.setAttribute('aria-hidden', 'true');
      button.appendChild(labelEl);
      button.appendChild(iconEl);
    }

    return labelEl;
  }

  function openCrateModal(options) {
    var opts = options || {};
    var state = opts.state;
    var ui = opts.ui;
    var t = opts.t || function (k) { return k; };
    if (!state || !state.crate || !ui || !ui.crateModal) return;

    var titleEl = document.getElementById('crateTitle');
    var dismissBtn = document.getElementById('crateDismiss');
    var closeBtn = ui.crateClose || document.getElementById('crateClose');
    var claimLabelEl = ensureCrateClaimButtonContent(ui.crateGet);

    if (titleEl) titleEl.textContent = t('crateModalTitle');
    if (ui.crateText) ui.crateText.textContent = t('crateModalText');
    if (dismissBtn) dismissBtn.textContent = t('menuClose');
    if (closeBtn) closeBtn.setAttribute('aria-label', t('menuClose'));
    if (ui.crateGet) {
      ui.crateGet.disabled = false;
      if (claimLabelEl) claimLabelEl.textContent = t('crateGet');
      else ui.crateGet.textContent = t('crateGet');
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
    if (document && document.body) {
      document.body.classList.remove('dismantle-open');
    }
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
    if (document && document.body) {
      document.body.classList.add('dismantle-open');
    }
    showModal(ui.dismantleModal, opts.a11yOpen, ui.dismantleYes, opts.onClose);
  }

  function getDismantleTankCountText(count, t) {
    var n = Math.max(0, Math.floor(Number(count) || 0));
    var pluralize = window.Game && window.Game.I18n && window.Game.I18n.pluralize;
    if (typeof pluralize === 'function') {
      return n + ' ' + pluralize(n, t('tankWord1'), t('tankWord2_4'), t('tankWord5'));
    }
    // inline fallback if pluralize module not loaded
    var word1 = t('tankWord1');
    var word2_4 = t('tankWord2_4');
    var word5 = t('tankWord5');
    if (word2_4 === word5) {
      return n + ' ' + (n === 1 ? word1 : word5);
    }
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return n + ' ' + word5;
    if (mod10 === 1) return n + ' ' + word1;
    if (mod10 >= 2 && mod10 <= 4) return n + ' ' + word2_4;
    return n + ' ' + word5;
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
    if (ui.dismantleYes) ui.dismantleYes.textContent = t('dismantleConfirmYes');
    if (ui.dismantleNo) ui.dismantleNo.textContent = t('dismantleConfirmCancel');

    var wrap = document.getElementById('dismantleIconsWrap');
    if (!wrap) return;

    var ids = selectedTankIds.slice();
    wrap.innerHTML = '';

    ids.forEach(function (id) {
      var cell = (state.cells || []).find(function (c) {
        return c && c.tank && c.tank.id === id;
      });
      if (!cell || !cell.tank) return;

      // Keep visual size at x1.5 while reserving extra vertical space to avoid clipping.
      var iconScale = 1.05;
      var iconWidth = 54;
      var iconHeight = 52;
      var can = document.createElement('canvas');
      can.width = iconWidth;
      can.height = iconHeight;
      can.style.verticalAlign = 'middle';
      can.style.marginRight = '4px';
      var cctx = can.getContext('2d');
      if (typeof drawTankIconTo === 'function') {
        drawTankIconTo(cctx, iconWidth * 0.5, iconHeight * 0.5, cell.tank.level, false, iconScale, { showShadow: false });
      }
      wrap.appendChild(can);
    });

    var span = document.createElement('span');
    span.style.marginLeft = '8px';
    var countText = getDismantleTankCountText(selectedTankIds.length, t);
    span.textContent = countText;
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
    openTalentResetCooldownModal: openTalentResetCooldownModal,
    closeTalentResetCooldownModal: closeTalentResetCooldownModal,
    openCrateModal: openCrateModal,
    closeCrateModal: closeCrateModal,
    closeDismantleModal: closeDismantleModal,
    openLevelModal: openLevelModal,
    closeLevelModal: closeLevelModal,
    setMenuOpen: setMenuOpen,
  };
})(typeof window !== 'undefined' ? window : this);
