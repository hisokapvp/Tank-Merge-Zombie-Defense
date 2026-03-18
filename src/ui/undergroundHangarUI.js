(function (global) {
  'use strict';

  // ─── Underground Hangar UI Modal ───
  // Opens a full modal showing both main hangar (15 cells) and underground storage (16 cells).
  // Underground cells are storage-only: tanks/drones can only be used for merging.

  let _overlay = null;
  let _isOpen = false;
  let _stateRef = null;
  let _callbacks = null;

  function t(key, fallback) {
    if (global.Game && global.Game.I18n && typeof global.Game.I18n.t === 'function') {
      return global.Game.I18n.t(key) || fallback;
    }
    return fallback;
  }

  function el(id) { return document.getElementById(id); }

  // ─── Init ───

  function init(opts) {
    _callbacks = opts || {};
    _overlay = el('undergroundHangarOverlay');
    if (!_overlay) return;

    // Close button
    const closeBtn = el('undergroundHangarClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { close(); });
    }

    // Backdrop close
    const backdrop = _overlay.querySelector('[data-ugh-close]');
    if (backdrop) {
      backdrop.addEventListener('click', function () { close(); });
    }

    // Delegate clicks inside the modal
    const body = el('undergroundHangarBody');
    if (body) {
      body.addEventListener('click', handleBodyClick);
    }
  }

  // ─── Open / Close ───

  function open(stateRef) {
    if (!_overlay) return;
    _stateRef = stateRef;

    // Ensure underground hangar state exists
    const UH = global.Game && global.Game.UndergroundHangar;
    if (UH && typeof UH.ensureStateShape === 'function') {
      UH.ensureStateShape(_stateRef);
    }

    // Pause simulation
    if (_callbacks && typeof _callbacks.setPaused === 'function') {
      _callbacks.setPaused(true);
    }

    _overlay.classList.remove('hidden');
    _overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ugh-open');
    _isOpen = true;

    render();
  }

  function close() {
    if (!_overlay) return;
    _overlay.classList.add('hidden');
    _overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('ugh-open');
    _isOpen = false;

    // Unpause simulation
    if (_callbacks && typeof _callbacks.setPaused === 'function') {
      _callbacks.setPaused(false);
    }

    // Trigger close animation on canvas cell
    const UH = global.Game && global.Game.UndergroundHangar;
    if (UH && typeof UH.handleModalClose === 'function') {
      UH.handleModalClose();
    }

    // Notify game to update UI
    if (_callbacks && typeof _callbacks.updateUI === 'function') {
      _callbacks.updateUI();
    }
  }

  function isOpen() { return _isOpen; }

  // ─── Rendering ───

  function render() {
    if (!_isOpen || !_stateRef) return;
    const body = el('undergroundHangarBody');
    if (!body) return;

    let html = '';

    // ── Section: Main Hangar (верхний уровень) ──
    html += '<div class="ughSection">';
    html += '<div class="ughSection__title">' + _escHtml(t('ughMainHangarTitle', 'Верхний ангар')) + '</div>';
    html += '<div class="ughGrid ughGrid--main">';
    const mainCells = _stateRef.cells || [];
    for (let i = 0; i < mainCells.length; i++) {
      // Skip the underground hangar button cell (index 15)
      if (i === 15) continue;
      const cell = mainCells[i];
      const hasTank = !!(cell && cell.tank);
      const tankLabel = hasTank ? ('Ур.' + cell.tank.level) : '';
      const cls = 'ughCell' + (hasTank ? ' ughCell--occupied' : ' ughCell--empty');
      html += '<div class="' + cls + '" data-ugh-main-cell="' + i + '">';
      html += '<span class="ughCell__idx">' + (i + 1) + '</span>';
      if (hasTank) {
        html += '<span class="ughCell__tank">' + _escHtml(tankLabel) + '</span>';
      }
      html += '</div>';
    }
    html += '</div>';
    html += '</div>';

    // ── Section: Underground Hangar (подземный уровень) ──
    html += '<div class="ughSection">';
    html += '<div class="ughSection__title">' + _escHtml(t('ughUndergroundTitle', 'Подземный ангар (склад)')) + '</div>';
    html += '<div class="ughGrid ughGrid--underground">';
    const ughState = _stateRef.undergroundHangar || {};
    const ughCells = ughState.cells || [];
    for (let i = 0; i < 16; i++) {
      const uc = ughCells[i];
      const hasTank = !!(uc && uc.tank);
      const tankLabel = hasTank ? ('Ур.' + uc.tank.level) : '';
      const cls = 'ughCell' + (hasTank ? ' ughCell--occupied' : ' ughCell--empty');
      html += '<div class="' + cls + '" data-ugh-cell="' + i + '">';
      html += '<span class="ughCell__idx">' + (i + 1) + '</span>';
      if (hasTank) {
        html += '<span class="ughCell__tank">' + _escHtml(tankLabel) + '</span>';
      }
      html += '</div>';
    }
    html += '</div>';
    html += '</div>';

    // ── Actions ──
    html += '<div class="ughActions">';

    // Buy tank button
    const buyLevel = _callbacks && typeof _callbacks.getBuyLevel === 'function' ? _callbacks.getBuyLevel() : 1;
    const buyCost = _callbacks && typeof _callbacks.getBuyCost === 'function' ? _callbacks.getBuyCost(buyLevel) : 0;
    html += '<button class="btn scButton ughActions__btn" data-ugh-action="buy" type="button">'
      + _escHtml(t('ughBuyTank', 'Создать танк ур.{level}').replace('{level}', buyLevel))
      + ' (' + buyCost + ' 🪙)</button>';

    // Bulk buy (if unlocked via achievements)
    const bulkMode = _callbacks && typeof _callbacks.getBulkMode === 'function' ? _callbacks.getBulkMode() : 'none';
    if (bulkMode !== 'none') {
      const bulkCount = bulkMode === 'buy2' ? 2 : (bulkMode === 'buy5' ? 5 : 'max');
      html += '<button class="btn scButton ughActions__btn" data-ugh-action="buyBulk" type="button">'
        + _escHtml(t('ughBuyBulk', 'Создать x{n}').replace('{n}', String(bulkCount)))
        + '</button>';
    }

    // Auto merge (if unlocked via achievements)
    const hasAutoMerge = _callbacks && typeof _callbacks.hasAutoMerge === 'function' ? _callbacks.hasAutoMerge() : false;
    if (hasAutoMerge) {
      html += '<button class="btn scButton ughActions__btn" data-ugh-action="autoMerge" type="button">'
        + _escHtml(t('ughAutoMerge', 'Объединить танки'))
        + '</button>';
    }

    // Dismantle
    html += '<button class="btn scButton ughActions__btn ughActions__btn--danger" data-ugh-action="dismantle" type="button">'
      + _escHtml(t('ughDismantle', 'Разобрать танк'))
      + '</button>';

    html += '</div>';

    body.innerHTML = html;
  }

  // ─── Click delegation ───

  function handleBodyClick(e) {
    const tgt = e.target;

    // Action buttons
    const actionBtn = tgt.closest ? tgt.closest('[data-ugh-action]') : null;
    if (actionBtn) {
      const action = actionBtn.getAttribute('data-ugh-action');
      if (action === 'buy') {
        if (_callbacks && typeof _callbacks.onBuy === 'function') _callbacks.onBuy();
        render();
        return;
      }
      if (action === 'buyBulk') {
        if (_callbacks && typeof _callbacks.onBuyBulk === 'function') _callbacks.onBuyBulk();
        render();
        return;
      }
      if (action === 'autoMerge') {
        if (_callbacks && typeof _callbacks.onAutoMerge === 'function') _callbacks.onAutoMerge();
        render();
        return;
      }
      if (action === 'dismantle') {
        if (_callbacks && typeof _callbacks.onDismantle === 'function') _callbacks.onDismantle();
        render();
        return;
      }
    }

    // Click on underground cell (for selection / drag source)
    const ughCell = tgt.closest ? tgt.closest('[data-ugh-cell]') : null;
    if (ughCell) {
      const idx = parseInt(ughCell.getAttribute('data-ugh-cell'), 10);
      if (Number.isFinite(idx)) {
        // Future: implement cell selection / drag-merge
      }
    }
  }

  // ─── Helpers ───

  function _escHtml(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Public API ───

  global.Game = global.Game || {};
  global.Game.UndergroundHangarUI = {
    init: init,
    open: open,
    close: close,
    isOpen: isOpen,
    render: render,
    ensureStateShape: function (stateRef) {
      const UH = global.Game && global.Game.UndergroundHangar;
      if (UH && typeof UH.ensureStateShape === 'function') UH.ensureStateShape(stateRef);
    },
  };

}(window));
