(function (global) {
  'use strict';

  let _modalEl     = null;
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
    _gridEl    = document.getElementById('plStorageGrid');
    _confirmEl = document.getElementById('plConfirmOverlay');

    // Close button
    const closeBtn = document.getElementById('plStorageClose');
    if (closeBtn) closeBtn.addEventListener('click', close);

    // Backdrop close
    const backdrop = _modalEl && _modalEl.querySelector('.plStorage__backdrop');
    if (backdrop) backdrop.addEventListener('click', close);

    // Confirm buttons
    const yesBtn = document.getElementById('plConfirmYes');
    const noBtn  = document.getElementById('plConfirmNo');
    if (yesBtn) yesBtn.addEventListener('click', _confirmOpen);
    if (noBtn)  noBtn.addEventListener('click', _cancelConfirm);
  }

  // ─── Open / close modal ────────────────────────────────────
  function open(state) {
    if (!_modalEl || !state || !state.productionLine) return;
    const wasOpen = _isOpen;
    _isOpen = true;
    _pendingIdx = -1;
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
    _isOpen = false;
    _pendingIdx = -1;
    if (document.body) document.body.classList.remove('pl-storage-open');
    _modalEl.classList.add('hidden');
    _modalEl.setAttribute('aria-hidden', 'true');
    if (_a11yClose) _a11yClose(_modalEl);
    if (wasOpen && _onPauseLockChange) _onPauseLockChange(false);
  }

  function isOpen() { return _isOpen; }

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

      if (i < pl.storage.length) {
        cell.classList.add('plStorage__cell--filled');
        cell.setAttribute('aria-label', _t('plBoxSlotFilled'));
        cell.textContent = '📦';
        const idx = i;
        cell.addEventListener('click', function () { _showConfirm(idx); });
      } else {
        cell.classList.add('plStorage__cell--empty');
        cell.setAttribute('aria-label', _t('plBoxSlotEmpty'));
        cell.disabled = true;
        cell.textContent = '—';
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
    if (yesBtn) yesBtn.textContent = _t('plConfirmYes_label');
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
