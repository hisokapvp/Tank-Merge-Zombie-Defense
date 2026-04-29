(function (global) {
  'use strict';

  let _modalEl     = null;
  let _panelEl     = null;
  let _gridEl      = null;
  let _confirmEl   = null;
  let _isOpen      = false;
  let _pendingIdx  = -1;
  let _onOpenBox   = null;  // callback(boxIndex) → lootResult
  let _t           = function (k) { return k; };
  let _a11yOpen    = null;
  let _a11yClose   = null;
  let _onPauseLockChange = null;
  let _toastFn     = null;  // optional toast callback
  let _stateRef    = null;
  let _dragState   = null;
  let _dragPreviewEl = null;
  let _suppressClicksUntil = 0;
  const DRAG_THRESHOLD_PX = 6;
  const NARROW_SHELL_BREAKPOINT_PX = 1280;

  // ─── Init (call once after DOM ready) ──────────────────────
  function init(options) {
    const opts = options || {};
    _t         = typeof opts.t === 'function'         ? opts.t         : _t;
    _a11yOpen  = typeof opts.a11yOpen === 'function'  ? opts.a11yOpen  : null;
    _a11yClose = typeof opts.a11yClose === 'function' ? opts.a11yClose : null;
    _onPauseLockChange = typeof opts.onPauseLockChange === 'function' ? opts.onPauseLockChange : null;
    _toastFn   = typeof opts.toast === 'function'     ? opts.toast     : null;
    _onOpenBox = typeof opts.onOpenBox === 'function' ? opts.onOpenBox : null;

    _modalEl   = document.getElementById('productionLineStorageModal');
    _panelEl   = _modalEl ? _modalEl.querySelector('.plStorage__panel') : null;
    _gridEl    = document.getElementById('plStorageGrid');
    _confirmEl = document.getElementById('plConfirmOverlay');

    const closeBtn = document.getElementById('plStorageClose');
    if (closeBtn) closeBtn.addEventListener('click', close);

    const helpBtn = document.getElementById('plStorageHelp');
    if (helpBtn) helpBtn.addEventListener('click', _openHelpModal);
    _syncHelpButtonCopy();

    const backdrop = _modalEl && _modalEl.querySelector('.plStorage__backdrop');
    if (backdrop) backdrop.addEventListener('click', close);

    const yesBtn = document.getElementById('plConfirmYes');
    const noBtn  = document.getElementById('plConfirmNo');
    if (yesBtn) yesBtn.addEventListener('click', _confirmOpen);
    if (noBtn)  noBtn.addEventListener('click', _cancelConfirm);

    if (typeof global.addEventListener === 'function') {
      global.addEventListener('resize', _syncResponsiveShellState);
    }
    _syncResponsiveShellState();
  }

  // ─── Open / close modal ────────────────────────────────────
  function open(state) {
    if (!_modalEl || !state || !state.productionLine) return;
    const wasOpen = _isOpen;
    _isOpen = true;
    _stateRef = state;
    _pendingIdx = -1;
    _syncResponsiveShellState();
    _hideConfirm();
    _renderGrid(state.productionLine);
    if (document.body) document.body.classList.add('pl-storage-open');
    _modalEl.classList.remove('hidden');
    _modalEl.setAttribute('aria-hidden', 'false');
    const initialFocus = document.getElementById('plStorageClose') || _modalEl.querySelector('.plStorage__panel') || _gridEl;
    if (_a11yOpen) _a11yOpen(_modalEl, { initialFocus: initialFocus });
    if (!wasOpen && _onPauseLockChange) _onPauseLockChange(true);
  }

  function close() {
    if (!_modalEl) return;
    const wasOpen = _isOpen;
    _teardownDrag();
    _isOpen = false;
    _stateRef = null;
    _pendingIdx = -1;
    if (document.body) document.body.classList.remove('pl-storage-open');
    _modalEl.classList.add('hidden');
    _modalEl.setAttribute('aria-hidden', 'true');
    if (_a11yClose) _a11yClose(_modalEl);
    if (wasOpen && _onPauseLockChange) _onPauseLockChange(false);
  }

  function isOpen() { return _isOpen; }

  function _getResponsiveShellMode() {
    const viewportWidth = Number(global.innerWidth) || 0;
    let coarsePointer = false;
    try {
      coarsePointer = !!(typeof global.matchMedia === 'function'
        && global.matchMedia('(hover: none) and (pointer: coarse)').matches);
    } catch (_err) {
      coarsePointer = false;
    }

    if (coarsePointer || (viewportWidth > 0 && viewportWidth < NARROW_SHELL_BREAKPOINT_PX)) return 'expanded';
    return 'default';
  }

  function _syncResponsiveShellState() {
    const mode = _getResponsiveShellMode();
    const expanded = mode === 'expanded';
    if (_modalEl) {
      _modalEl.classList.toggle('plStorage--expanded', expanded);
    }
    if (_panelEl) {
      _panelEl.classList.toggle('plStorage__panel--expanded', expanded);
    }
  }

  function _translate(key, fallback) {
    const value = _t(key);
    if (typeof value === 'string' && value && value !== key) return value;
    return typeof fallback === 'string' ? fallback : (typeof value === 'string' ? value : '');
  }

  function _getSharedHelpApi() {
    return global.Game && global.Game.SupercomputerMenu ? global.Game.SupercomputerMenu : null;
  }

  function _syncHelpButtonCopy() {
    const helpBtn = document.getElementById('plStorageHelp');
    if (!helpBtn) return;
    const label = _translate('plStorageHelpButton', _translate('techUnlockHelpTitle', 'Help'));
    helpBtn.setAttribute('aria-label', label);
    helpBtn.setAttribute('data-ui-tooltip', label);
    helpBtn.removeAttribute('title');
  }

  function _openHelpModal() {
    const sharedHelpApi = _getSharedHelpApi();
    if (!sharedHelpApi || typeof sharedHelpApi.showSharedHelpModal !== 'function') return;
    sharedHelpApi.showSharedHelpModal({
      translate: _translate,
      sectionTitleKey: 'plStorageTitle',
      introKey: 'plStorageHelpIntro',
      sections: [
        { titleKey: 'plStorageHelpLevel1Title', textKey: 'plStorageHelpLevel1Items' },
        { titleKey: 'plStorageHelpLevel2Title', textKey: 'plStorageHelpLevel2Items' },
        { titleKey: 'plStorageHelpLevel3Title', textKey: 'plStorageHelpLevel3Items' },
        { titleKey: 'plStorageHelpLevel4Title', textKey: 'plStorageHelpLevel4Items' },
      ],
    });
  }

  function _getBoxLevel(box) {
    const maxLevel = (global.Game && global.Game.ProductionLine && global.Game.ProductionLine.MAX_BOX_LEVEL) || 4;
    if (!box || !Number.isFinite(box.level)) return 1;
    return Math.max(1, Math.min(maxLevel, Math.floor(box.level)));
  }

  function _shouldSuppressClick() {
    return Date.now() < _suppressClicksUntil;
  }

  function _findCellAtPoint(clientX, clientY) {
    if (typeof document.elementFromPoint !== 'function') return null;
    const element = document.elementFromPoint(clientX, clientY);
    if (!element || typeof element.closest !== 'function') return null;
    return element.closest('.plStorage__cell[data-box-index]');
  }

  function _getCellIndex(cell) {
    if (!cell || !cell.hasAttribute('data-box-index')) return -1;
    const value = Number(cell.getAttribute('data-box-index'));
    return Number.isFinite(value) ? Math.floor(value) : -1;
  }

  function _clearDragAffordances() {
    if (!_gridEl) return;
    const activeCells = _gridEl.querySelectorAll('.plStorage__cell--dragging, .plStorage__cell--mergeTarget');
    for (let index = 0; index < activeCells.length; index++) {
      activeCells[index].classList.remove('plStorage__cell--dragging', 'plStorage__cell--mergeTarget');
    }
  }

  function _removeDragPreview() {
    if (_dragPreviewEl && _dragPreviewEl.parentNode) {
      _dragPreviewEl.parentNode.removeChild(_dragPreviewEl);
    }
    _dragPreviewEl = null;
  }

  function _preventTouchPointerDefault(evt) {
    const inputGuards = global.Game && global.Game.InputGuards;
    if (inputGuards && typeof inputGuards.preventTouchPointerDefault === 'function') {
      inputGuards.preventTouchPointerDefault(evt);
      return;
    }
    if (!evt || evt.pointerType !== 'touch' || evt.cancelable !== true) return;
    evt.preventDefault();
  }

  function _setDragPointerCapture(dragState) {
    if (!dragState || dragState.pointerId == null) return;
    const captureEl = dragState.captureEl;
    if (!captureEl || typeof captureEl.setPointerCapture !== 'function') return;
    try {
      dragState.captureActive = true;
      captureEl.setPointerCapture(dragState.pointerId);
    } catch (_err) {
      dragState.captureActive = false;
    }
  }

  function _releaseDragPointerCapture(dragState) {
    if (!dragState || dragState.pointerId == null || !dragState.captureActive) return;
    const captureEl = dragState.captureEl;
    if (!captureEl || typeof captureEl.releasePointerCapture !== 'function') return;
    try {
      if (typeof captureEl.hasPointerCapture !== 'function' || captureEl.hasPointerCapture(dragState.pointerId)) {
        captureEl.releasePointerCapture(dragState.pointerId);
      }
    } catch (_err) {}
    dragState.captureActive = false;
  }

  function _ensureDragPreview() {
    if (_dragPreviewEl || !_dragState || !_dragState.sourceEl || !document.body) return;
    const previewEl = _dragState.sourceEl.cloneNode(true);
    previewEl.classList.add('plStorage__dragPreview');
    previewEl.classList.remove('plStorage__cell--dragging', 'plStorage__cell--mergeTarget');
    previewEl.classList.remove('uiButtonBehavior', 'is-pressed', 'is-hovered', 'is-focused');
    previewEl.disabled = true;
    previewEl.tabIndex = -1;
    previewEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(previewEl);
    _dragPreviewEl = previewEl;
  }

  function _updateDragPreview(clientX, clientY) {
    if (!_dragState || !_dragState.moved) return;
    _ensureDragPreview();
    if (!_dragPreviewEl) return;
    const previewX = Math.round(clientX + 18);
    const previewY = Math.round(clientY + 14);
    _dragPreviewEl.style.setProperty('transform', 'translate3d(' + previewX + 'px, ' + previewY + 'px, 0) scale(1.06)', 'important');
  }

  function _teardownDrag() {
    const dragState = _dragState;
    _clearDragAffordances();
    _removeDragPreview();
    document.removeEventListener('pointermove', _handlePointerMove);
    document.removeEventListener('pointerup', _handlePointerUp);
    document.removeEventListener('pointercancel', _handlePointerCancel);
    _releaseDragPointerCapture(dragState);
    _dragState = null;
  }

  function _canMergeDragTarget(sourceIndex, targetIndex) {
    const api = global.Game && global.Game.ProductionLine;
    if (!api || typeof api.canMergeBoxes !== 'function' || !_stateRef) return false;
    return !!api.canMergeBoxes(_stateRef, sourceIndex, targetIndex);
  }

  function _updateDragTarget(clientX, clientY) {
    if (!_dragState) return;
    _clearDragAffordances();
    if (_dragState.sourceEl) _dragState.sourceEl.classList.add('plStorage__cell--dragging');
    const targetCell = _findCellAtPoint(clientX, clientY);
    const targetIndex = _getCellIndex(targetCell);
    if (_canMergeDragTarget(_dragState.sourceIndex, targetIndex)) {
      _dragState.targetIndex = targetIndex;
      if (targetCell) targetCell.classList.add('plStorage__cell--mergeTarget');
      return;
    }
    _dragState.targetIndex = -1;
  }

  function _startDrag(evt, boxIndex) {
    if (!_stateRef || !_stateRef.productionLine) return;
    if (evt.button != null && evt.button !== 0) return;
    _preventTouchPointerDefault(evt);
    _teardownDrag();
    const captureEl = evt.currentTarget || _panelEl || _modalEl || null;
    _dragState = {
      pointerId: evt.pointerId,
      sourceIndex: boxIndex,
      startX: evt.clientX,
      startY: evt.clientY,
      moved: false,
      sourceEl: evt.currentTarget,
      captureEl: captureEl,
      captureActive: false,
      targetIndex: -1,
    };
    document.addEventListener('pointermove', _handlePointerMove);
    document.addEventListener('pointerup', _handlePointerUp);
    document.addEventListener('pointercancel', _handlePointerCancel);
    _setDragPointerCapture(_dragState);
  }

  function _handlePointerMove(evt) {
    if (!_dragState || evt.pointerId !== _dragState.pointerId) return;
    _preventTouchPointerDefault(evt);
    const dx = evt.clientX - _dragState.startX;
    const dy = evt.clientY - _dragState.startY;
    if (!_dragState.moved && (dx * dx + dy * dy) < (DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX)) return;
    _dragState.moved = true;
    _updateDragPreview(evt.clientX, evt.clientY);
    _updateDragTarget(evt.clientX, evt.clientY);
  }

  function _handlePointerUp(evt) {
    if (!_dragState || evt.pointerId !== _dragState.pointerId) return;
    _preventTouchPointerDefault(evt);
    const dragState = _dragState;
    if (dragState.moved) {
      _suppressClicksUntil = Date.now() + 180;
      _updateDragPreview(evt.clientX, evt.clientY);
      _updateDragTarget(evt.clientX, evt.clientY);
      const api = global.Game && global.Game.ProductionLine;
      if (api && typeof api.mergeBoxes === 'function' && dragState.targetIndex >= 0 && _stateRef) {
        const merged = api.mergeBoxes(_stateRef, dragState.sourceIndex, dragState.targetIndex);
        if (merged) {
          _hideConfirm();
          _renderGrid(_stateRef.productionLine);
        }
      }
    }
    _teardownDrag();
  }

  function _handlePointerCancel(evt) {
    if (!_dragState || evt.pointerId !== _dragState.pointerId) return;
    _preventTouchPointerDefault(evt);
    _teardownDrag();
  }

  // ─── Render grid ───────────────────────────────────────────
  function _renderGrid(pl) {
    if (!_gridEl) return;
    _gridEl.innerHTML = '';

    const cols = (global.Game.ProductionLine && global.Game.ProductionLine.STORAGE_COLS) || 3;
    _gridEl.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';

    const slots = pl.storageSlots || 9;
    for (let i = 0; i < slots; i++) {
      const cell = document.createElement('button');
      cell.className = 'plStorage__cell';
      cell.type = 'button';
      cell.setAttribute('data-box-index', String(i));
      const inputGuards = global.Game && global.Game.InputGuards;
      if (inputGuards && typeof inputGuards.markTouchDragHost === 'function') {
        inputGuards.markTouchDragHost(cell);
      }

      if (i < pl.storage.length) {
        const box = pl.storage[i] || null;
        const boxLevel = _getBoxLevel(box);
        cell.classList.add('plStorage__cell--filled');
        cell.classList.add('plStorage__cell--level' + boxLevel);
        cell.setAttribute('data-box-level', String(boxLevel));
        cell.setAttribute('aria-label', _t('plBoxSlotFilled'));
        const icon = document.createElement('span');
        icon.className = 'plStorage__cellIcon';
        icon.textContent = '📦';
        const badge = document.createElement('span');
        badge.className = 'plStorage__levelBadge';
        badge.textContent = (_t('levelShort') || 'Lv') + ' ' + boxLevel;
        cell.appendChild(icon);
        cell.appendChild(badge);
        const idx = i;
        cell.addEventListener('click', function () {
          if (_shouldSuppressClick()) return;
          _showConfirm(idx);
        });
        cell.addEventListener('pointerdown', function (evt) { _startDrag(evt, idx); });
      } else {
        cell.classList.add('plStorage__cell--empty');
        cell.setAttribute('aria-label', _t('plBoxSlotEmpty'));
        cell.disabled = true;
        cell.textContent = '';
      }
      _gridEl.appendChild(cell);
    }
  }

  // ─── Confirm dialog ────────────────────────────────────────
  function _showConfirm(index) {
    _pendingIdx = index;
    if (!_confirmEl) return;
    const text = _confirmEl.querySelector('#plConfirmText');
    if (text) text.textContent = _t('plConfirmOpenBox');

    const yesBtn = document.getElementById('plConfirmYes');
    const noBtn  = document.getElementById('plConfirmNo');
    if (yesBtn) {
      var lbl = yesBtn.querySelector('.talentResetCooldownAdBtn__label');
      if (lbl) lbl.textContent = _t('plConfirmYes_label');
    }
    if (noBtn)  noBtn.textContent = _t('plConfirmNo_label');

    _confirmEl.classList.remove('hidden');
  }

  function _hideConfirm() {
    _pendingIdx = -1;
    if (_confirmEl) _confirmEl.classList.add('hidden');
  }

  function _confirmOpen() {
    const idx = _pendingIdx;
    _hideConfirm();
    if (idx < 0 || typeof _onOpenBox !== 'function') return;
    const result = _onOpenBox(idx);
    if (result && _toastFn) {
      _toastFn(_formatLootMessage(result));
    }
    // Re-render grid to reflect removed box
    const PL = global.Game && global.Game.ProductionLine;
    // state may need to be passed; caller refreshes via open(state)
    close();
  }

  function _cancelConfirm() {
    _hideConfirm();
  }

  // ─── Format loot for toast ─────────────────────────────────
  function _formatLootMessage(result) {
    if (!result) return '';
    return _t(result.label) || result.lootId;
  }

  // ─── Re-translate (language change) ────────────────────────
  function setTranslator(tFn) {
    if (typeof tFn === 'function') _t = tFn;
    _syncHelpButtonCopy();
  }

  // ─── Public API ────────────────────────────────────────────
  global.Game = global.Game || {};
  global.Game.ProductionLineUI = {
    init: init,
    open: open,
    close: close,
    isOpen: isOpen,
    setTranslator: setTranslator,
  };
})(typeof window !== 'undefined' ? window : this);
