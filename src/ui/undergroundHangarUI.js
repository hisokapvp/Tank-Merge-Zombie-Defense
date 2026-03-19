(function (global) {
  'use strict';

  // ─── Underground Hangar UI Modal ───
  // Opens a full modal showing both main hangar (15 cells) and underground storage (16 cells).
  // Underground cells are storage-only: tanks/drones can only be used for merging.

  let _overlay = null;
  let _isOpen = false;
  let _stateRef = null;
  let _callbacks = null;
  let _selected = null; // { type: 'main'|'underground'|'drone', index: number }

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
    _selected = null;

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

    html += '<div class="ughLayout">';
    html += '<div class="ughContent">';

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
      const isSelected = _selected && _selected.type === 'main' && _selected.index === i;
      const cls = 'ughCell' + (hasTank ? ' ughCell--occupied' : ' ughCell--empty') + (isSelected ? ' ughCell--selected' : '');
      html += '<div class="' + cls + '" data-ugh-main-cell="' + i + '">';
      html += '<span class="ughCell__idx">' + (i + 1) + '</span>';
      if (hasTank) {
        html += '<span class="ughCell__tank">' + _escHtml(tankLabel) + '</span>';
      }
      html += '</div>';
    }
    html += '</div>'; // close ughGrid--main

    // ── Drone sub-section ──
    const drones = _stateRef.drones || [];
    html += '<div class="ughSection__title" style="margin-top:10px;font-size:clamp(9px,1.4vw,11px)">'
      + _escHtml(t('ughDronesTitle', 'Дроны')) + '</div>';
    html += '<div class="ughDroneGrid">';
    for (let i = 0; i < drones.length; i++) {
      const d = drones[i];
      const occupied = !!(d && d.level);
      const isSelD = _selected && _selected.type === 'drone' && _selected.index === i;
      const cls = 'ughDroneCell' + (occupied ? ' ughDroneCell--occupied' : '') + (isSelD ? ' ughDroneCell--selected' : '');
      html += '<div class="' + cls + '" data-ugh-drone="' + i + '">';
      html += '<span class="ughDroneCell__idx">D' + (i + 1) + '</span>';
      if (occupied) {
        html += '<span class="ughDroneCell__level">Ур.' + d.level + '</span>';
      }
      html += '</div>';
    }
    if (drones.length === 0) {
      html += '<span style="font-size:10px;color:rgba(255,255,255,.3)">—</span>';
    }
    html += '</div>'; // close ughDroneGrid
    html += '</div>'; // close ughSection (main hangar)

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
      const isSelU = _selected && _selected.type === 'underground' && _selected.index === i;
      const cls = 'ughCell' + (hasTank ? ' ughCell--occupied' : ' ughCell--empty') + (isSelU ? ' ughCell--selected' : '');
      html += '<div class="' + cls + '" data-ugh-cell="' + i + '">';
      html += '<span class="ughCell__idx">' + (i + 1) + '</span>';
      if (hasTank) {
        html += '<span class="ughCell__tank">' + _escHtml(tankLabel) + '</span>';
      }
      html += '</div>';
    }
    html += '</div>';
    html += '</div>'; // close ughSection (underground)

    html += '</div>'; // close ughContent

    // ── Sidebar with actions ──
    html += '<div class="ughSidebar">';
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

    html += '</div>'; // close ughActions
    html += '</div>'; // close ughSidebar
    html += '</div>'; // close ughLayout

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

    // Click on main hangar cell
    const mainCell = tgt.closest ? tgt.closest('[data-ugh-main-cell]') : null;
    if (mainCell) {
      const idx = parseInt(mainCell.getAttribute('data-ugh-main-cell'), 10);
      if (Number.isFinite(idx)) _handleCellSelect('main', idx);
      return;
    }

    // Click on underground cell
    const ughCell = tgt.closest ? tgt.closest('[data-ugh-cell]') : null;
    if (ughCell) {
      const idx = parseInt(ughCell.getAttribute('data-ugh-cell'), 10);
      if (Number.isFinite(idx)) _handleCellSelect('underground', idx);
      return;
    }

    // Click on drone cell
    const droneCell = tgt.closest ? tgt.closest('[data-ugh-drone]') : null;
    if (droneCell) {
      const idx = parseInt(droneCell.getAttribute('data-ugh-drone'), 10);
      if (Number.isFinite(idx)) _handleCellSelect('drone', idx);
      return;
    }
  }

  // ─── Selection & merge logic ───

  function _handleCellSelect(type, index) {
    const entity = _getEntityAt(type, index);

    // Nothing selected yet — select if occupied
    if (!_selected) {
      if (entity) _selected = { type: type, index: index };
      render();
      return;
    }

    // Clicked the same cell — deselect
    if (_selected.type === type && _selected.index === index) {
      _selected = null;
      render();
      return;
    }

    const sourceEntity = _getEntityAt(_selected.type, _selected.index);
    if (!sourceEntity || !entity) {
      // Source gone or target empty — reselect or deselect
      _selected = entity ? { type: type, index: index } : null;
      render();
      return;
    }

    // Can't merge tank with drone
    const srcIsDrone = _selected.type === 'drone';
    const tgtIsDrone = type === 'drone';
    if (srcIsDrone !== tgtIsDrone) {
      _selected = { type: type, index: index };
      render();
      return;
    }

    // Different levels — reselect
    if (sourceEntity.level !== entity.level) {
      _selected = { type: type, index: index };
      render();
      return;
    }

    // Same level, same entity kind — merge!
    const merged = _tryMerge(_selected.type, _selected.index, type, index);
    _selected = null;
    if (merged && _callbacks && typeof _callbacks.updateUI === 'function') _callbacks.updateUI();
    render();
  }

  function _getEntityAt(type, index) {
    if (!_stateRef) return null;
    if (type === 'main') {
      const cell = (_stateRef.cells || [])[index];
      return cell && cell.tank ? cell.tank : null;
    }
    if (type === 'underground') {
      const ugh = _stateRef.undergroundHangar || {};
      const cell = (ugh.cells || [])[index];
      return cell && cell.tank ? cell.tank : null;
    }
    if (type === 'drone') {
      const d = (_stateRef.drones || [])[index];
      return (d && d.level) ? d : null;
    }
    return null;
  }

  function _tryMerge(srcType, srcIdx, tgtType, tgtIdx) {
    if (_callbacks && typeof _callbacks.onMerge === 'function') {
      return _callbacks.onMerge(srcType, srcIdx, tgtType, tgtIdx);
    }
    return false;
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
