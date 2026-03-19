(function (global) {
  'use strict';

  // ─── Underground Hangar UI Modal ───
  // Opens a full modal showing both main hangar (15 cells) and underground storage (16 cells).
  // Underground cells can store both tanks and drones.

  let _overlay = null;
  let _isOpen = false;
  let _stateRef = null;
  let _callbacks = null;
  let _selected = null; // { type: 'main'|'underground'|'drone', index: number }
  const MAIN_TYPES = { main: true, underground: true };
  const DRONE_TOP_SLOT_INDICES = [0, 1, 2];
  const DRONE_LEFT_SLOT_INDICES = [3, 4, 5];
  const DRONE_RIGHT_SLOT_INDICES = [6, 7, 8];

  function t(key, fallback) {
    if (global.Game && global.Game.I18n && typeof global.Game.I18n.t === 'function') {
      return global.Game.I18n.t(key) || fallback;
    }
    return fallback;
  }

  function el(id) { return document.getElementById(id); }

  function levelLabel(level) {
    return _escHtml(String(t('levelShort', 'Lv'))) + String(level);
  }

  function getDroneSlotCount() {
    const DronesApi = global.Game && global.Game.Drones;
    const count = Number(DronesApi && DronesApi.DRONE_SLOT_COUNT);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 9;
  }

  function getDroneBySlotIndex(slotIndex) {
    if (!_stateRef || !Array.isArray(_stateRef.drones)) return null;
    for (let index = 0; index < _stateRef.drones.length; index++) {
      const drone = _stateRef.drones[index];
      if (!drone) continue;
      if (Number(drone.slotIndex) === slotIndex) return drone;
    }
    return null;
  }

  function getTankCell(type, index) {
    if (!_stateRef) return null;
    if (type === 'main') return (_stateRef.cells || [])[index] || null;
    if (type === 'underground') {
      const hangarState = _stateRef.undergroundHangar || {};
      return (hangarState.cells || [])[index] || null;
    }
    return null;
  }

  function getEntityKindAt(type, index) {
    if (type === 'main') return 'tank';
    if (type === 'drone') return 'drone';
    if (type === 'underground') {
      const cell = getTankCell(type, index);
      if (cell && cell.tank) return 'tank';
      if (cell && cell.drone) return 'drone';
      return null;
    }
    return null;
  }

  function canTypeAcceptKind(type, kind) {
    if (!kind) return false;
    if (type === 'main') return kind === 'tank';
    if (type === 'drone') return kind === 'drone';
    if (type === 'underground') return kind === 'tank' || kind === 'drone';
    return false;
  }

  function canMergeSelection(srcType, tgtType, srcEntity, tgtEntity, kind) {
    if (!srcEntity || !tgtEntity || !kind) return false;
    if (srcEntity.level !== tgtEntity.level) return false;
    if (kind === 'tank') {
      return (srcType === 'main' || srcType === 'underground')
        && (tgtType === 'main' || tgtType === 'underground');
    }
    return (srcType === 'drone' || srcType === 'underground')
      && (tgtType === 'drone' || tgtType === 'underground');
  }

  function getSelectionAffordance(type, index, entity, kindOverride) {
    if (!_selected) return '';
    if (_selected.type === type && _selected.index === index) return '';
    const sourceEntity = _getEntityAt(_selected.type, _selected.index);
    const sourceKind = getEntityKindAt(_selected.type, _selected.index);
    const targetKind = kindOverride || (entity ? getEntityKindAt(type, index) : null);
    if (!sourceEntity || !sourceKind) return '';
    if (!entity) return canTypeAcceptKind(type, sourceKind) ? 'move' : '';
    if (sourceKind !== targetKind) return '';
    if (canMergeSelection(_selected.type, type, sourceEntity, entity, sourceKind)) return 'merge';
    return '';
  }

  function buildCellClass(baseClass, selected, occupied, affordance) {
    let cls = baseClass;
    cls += occupied ? ' ' + baseClass + '--occupied' : ' ' + baseClass + '--empty';
    if (selected) cls += ' ' + baseClass + '--selected';
    if (affordance === 'move') cls += ' ' + baseClass + '--canMove';
    if (affordance === 'merge') cls += ' ' + baseClass + '--canMerge';
    return cls;
  }

  function renderTankCell(type, index, entity, label) {
    const occupied = !!entity;
    const selected = !!(_selected && _selected.type === type && _selected.index === index);
    const affordance = getSelectionAffordance(type, index, entity, 'tank');
    const cls = buildCellClass('ughCell', selected, occupied, affordance);
    let html = '<div class="' + cls + '" data-ugh-' + (type === 'main' ? 'main-cell' : 'cell') + '="' + index + '">';
    html += '<span class="ughCell__idx">' + _escHtml(label) + '</span>';
    html += '<div class="ughCell__surface">';
    if (occupied) {
      html += '<canvas class="ughCell__spriteCanvas" data-ugh-sprite="tank" data-ugh-level="' + entity.level + '" width="84" height="84"></canvas>';
      html += '<span class="ughCell__levelBadge">' + levelLabel(entity.level) + '</span>';
    } else {
      html += '<span class="ughCell__emptyMark"></span>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderUndergroundCell(index, cell, label) {
    const entity = cell && cell.tank ? cell.tank : (cell && cell.drone ? cell.drone : null);
    const kind = cell && cell.tank ? 'tank' : (cell && cell.drone ? 'drone' : null);
    const occupied = !!entity;
    const selected = !!(_selected && _selected.type === 'underground' && _selected.index === index);
    const affordance = getSelectionAffordance('underground', index, entity, kind);
    const cls = buildCellClass('ughCell', selected, occupied, affordance);
    let html = '<div class="' + cls + '" data-ugh-cell="' + index + '">';
    html += '<span class="ughCell__idx">' + _escHtml(label) + '</span>';
    html += '<div class="ughCell__surface">';
    if (occupied && kind === 'tank') {
      html += '<canvas class="ughCell__spriteCanvas" data-ugh-sprite="tank" data-ugh-level="' + entity.level + '" width="84" height="84"></canvas>';
      html += '<span class="ughCell__levelBadge">' + levelLabel(entity.level) + '</span>';
    } else if (occupied && kind === 'drone') {
      html += '<canvas class="ughCell__spriteCanvas" data-ugh-sprite="drone-storage" data-ugh-storage-cell="' + index + '" width="84" height="84"></canvas>';
      html += '<span class="ughCell__levelBadge">' + levelLabel(entity.level) + '</span>';
    } else {
      html += '<span class="ughCell__emptyMark"></span>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderDroneCell(slotIndex) {
    const drone = getDroneBySlotIndex(slotIndex);
    const occupied = !!drone;
    const selected = !!(_selected && _selected.type === 'drone' && _selected.index === slotIndex);
    const affordance = getSelectionAffordance('drone', slotIndex, drone, 'drone');
    const cls = buildCellClass('ughDroneCell', selected, occupied, affordance);
    let html = '<div class="' + cls + '" data-ugh-drone="' + slotIndex + '">';
    html += '<span class="ughDroneCell__idx">D' + String(slotIndex + 1) + '</span>';
    html += '<div class="ughDroneCell__surface">';
    if (occupied) {
      html += '<canvas class="ughDroneCell__spriteCanvas" data-ugh-sprite="drone" data-ugh-drone-slot="' + slotIndex + '" width="56" height="56"></canvas>';
      html += '<span class="ughDroneCell__levelBadge">' + levelLabel(drone.level) + '</span>';
    } else {
      html += '<span class="ughDroneCell__emptyMark"></span>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderDroneRail(slotIndices, modifierClass) {
    let html = '<div class="ughDroneRail ' + modifierClass + '">';
    for (let index = 0; index < slotIndices.length; index++) {
      html += renderDroneCell(slotIndices[index]);
    }
    html += '</div>';
    return html;
  }

  function drawTankSpriteCanvas(canvas, level) {
    if (!canvas) return;
    const targetCtx = canvas.getContext('2d');
    if (!targetCtx) return;
    const sprites = global.Game && global.Game.TankSprites;
    if (!sprites || typeof sprites.pickBody !== 'function' || typeof sprites.pickCannon !== 'function') return;
    const body = sprites.pickBody(level);
    const cannon = sprites.pickCannon(level);
    if (!body || !cannon) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const bodyWidth = body.cfg && body.cfg.frame && body.cfg.frame.w ? body.cfg.frame.w : body.img.width;
    const bodyHeight = body.cfg && body.cfg.frame && body.cfg.frame.h ? body.cfg.frame.h : body.img.height;
    const bodyFrameX = body.cfg && body.cfg.frame && Number.isFinite(body.cfg.frame.x) ? body.cfg.frame.x : 0;
    const bodyFrameY = body.cfg && body.cfg.frame && Number.isFinite(body.cfg.frame.y) ? body.cfg.frame.y : 0;
    const cannonWidth = cannon.cfg && cannon.cfg.frame && cannon.cfg.frame.w ? cannon.cfg.frame.w : cannon.img.width;
    const cannonHeight = cannon.cfg && cannon.cfg.frame && cannon.cfg.frame.h ? cannon.cfg.frame.h : cannon.img.height;
    const maxWidth = canvasWidth * 0.72;
    const maxHeight = canvasHeight * 0.58;
    const scale = Math.min(maxWidth / bodyWidth, maxHeight / bodyHeight);
    const centerX = canvasWidth * 0.5;
    const centerY = canvasHeight * 0.5;
    const bodyAnchor = body.cfg && body.cfg.anchor ? body.cfg.anchor : { x: 0.5, y: 0.6 };
    const cannonAnchor = cannon.cfg && cannon.cfg.anchor ? cannon.cfg.anchor : { x: 0.35, y: 0.5 };

    targetCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    targetCtx.imageSmoothingEnabled = false;
    targetCtx.globalAlpha = 0.96;

    targetCtx.drawImage(
      body.img,
      bodyFrameX,
      bodyFrameY,
      bodyWidth,
      bodyHeight,
      centerX - bodyWidth * scale * bodyAnchor.x,
      centerY - bodyHeight * scale * bodyAnchor.y,
      bodyWidth * scale,
      bodyHeight * scale
    );

    targetCtx.drawImage(
      cannon.img,
      0,
      0,
      cannonWidth,
      cannonHeight,
      centerX - cannonWidth * scale * cannonAnchor.x,
      centerY - cannonHeight * scale * cannonAnchor.y,
      cannonWidth * scale,
      cannonHeight * scale
    );
  }

  function drawDroneSpriteCanvas(canvas, drone) {
    if (!canvas || !drone) return;
    const targetCtx = canvas.getContext('2d');
    if (!targetCtx) return;
    const dronSprites = (global.Game && global.Game.DronSprites) || global.DronSprites;
    if (!dronSprites || !dronSprites.ready || !dronSprites.atlasImg || typeof dronSprites.getAnimation !== 'function' || typeof dronSprites.pickFrame !== 'function') return;
    const DronesApi = global.Game && global.Game.Drones;
    const animName = DronesApi && typeof DronesApi._resolveHangarDroneAnimName === 'function'
      ? DronesApi._resolveHangarDroneAnimName(drone)
      : (drone.mode === 'repair' ? 'work' : 'wait');
    const animation = dronSprites.getAnimation(animName) || dronSprites.getAnimation('wait');
    const frameId = animation && Array.isArray(animation.frames) && animation.frames.length ? animation.frames[0] : null;
    const frame = frameId ? dronSprites.pickFrame(frameId) : null;
    if (!frame) return;

    const cfg = dronSprites.config || {};
    const scaleBase = Number.isFinite(cfg.scale) && cfg.scale > 0 ? cfg.scale : 1;
    const scale = Math.min(canvas.width * 0.62 / frame.w, canvas.height * 0.62 / frame.h) * scaleBase;
    const anchor = cfg.anchor && typeof cfg.anchor === 'object' ? cfg.anchor : { x: 0.5, y: 0.5 };
    const centerX = canvas.width * 0.5;
    const centerY = canvas.height * 0.5;

    targetCtx.clearRect(0, 0, canvas.width, canvas.height);
    targetCtx.imageSmoothingEnabled = false;
    targetCtx.globalAlpha = 0.96;
    targetCtx.drawImage(
      dronSprites.atlasImg,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      centerX - frame.w * scale * anchor.x,
      centerY - frame.h * scale * anchor.y,
      frame.w * scale,
      frame.h * scale
    );
  }

  function renderSpriteCanvases(root) {
    if (!root) return;
    const spriteCanvases = root.querySelectorAll('[data-ugh-sprite]');
    for (let index = 0; index < spriteCanvases.length; index++) {
      const canvas = spriteCanvases[index];
      const spriteType = canvas.getAttribute('data-ugh-sprite');
      if (spriteType === 'tank') {
        const level = Number(canvas.getAttribute('data-ugh-level'));
        if (Number.isFinite(level)) drawTankSpriteCanvas(canvas, level);
        continue;
      }
      if (spriteType === 'drone') {
        const slotIndex = Number(canvas.getAttribute('data-ugh-drone-slot'));
        if (Number.isFinite(slotIndex)) drawDroneSpriteCanvas(canvas, getDroneBySlotIndex(slotIndex));
        continue;
      }
      if (spriteType === 'drone-storage') {
        const storageIndex = Number(canvas.getAttribute('data-ugh-storage-cell'));
        const storageCell = getTankCell('underground', storageIndex);
        if (Number.isFinite(storageIndex) && storageCell && storageCell.drone) {
          drawDroneSpriteCanvas(canvas, storageCell.drone);
        }
      }
    }
  }

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
    html += '<div class="ughMainCluster">';
    html += renderDroneRail(DRONE_TOP_SLOT_INDICES, 'ughDroneRail--top');
    html += '<div class="ughMainCluster__row">';
    html += renderDroneRail(DRONE_LEFT_SLOT_INDICES, 'ughDroneRail--left');
    html += '<div class="ughGrid ughGrid--main">';
    const mainCells = _stateRef.cells || [];
    for (let i = 0; i < mainCells.length; i++) {
      // Skip the underground hangar button cell (index 15)
      if (i === 15) continue;
      const cell = mainCells[i];
      html += renderTankCell('main', i, cell && cell.tank ? cell.tank : null, String(i + 1));
    }
    html += '</div>'; // close ughGrid--main
    html += renderDroneRail(DRONE_RIGHT_SLOT_INDICES, 'ughDroneRail--right');
    html += '</div>'; // close ughMainCluster__row
    html += '</div>'; // close ughMainCluster
    html += '</div>'; // close ughSection (main hangar)

    // ── Section: Underground Hangar (подземный уровень) ──
    html += '<div class="ughSection">';
    html += '<div class="ughSection__title">' + _escHtml(t('ughUndergroundTitle', 'Подземный ангар')) + '</div>';
    html += '<div class="ughGrid ughGrid--underground">';
    const ughState = _stateRef.undergroundHangar || {};
    const ughCells = ughState.cells || [];
    for (let i = 0; i < 16; i++) {
      const uc = ughCells[i];
      html += renderUndergroundCell(i, uc, String(i + 1));
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
    const bulkPlan = _callbacks && typeof _callbacks.getBulkBuyPlan === 'function' ? _callbacks.getBulkBuyPlan() : null;
    if (bulkPlan && bulkPlan.visible) {
      html += '<button class="btn scButton ughActions__btn" data-ugh-action="buyBulk" type="button"'
        + (bulkPlan.enabled ? '' : ' disabled') + '>'
        + _escHtml(t('ughBuyBulk', 'Создать x{n}').replace('{n}', String(bulkPlan.xDisplay || bulkPlan.count || 2)))
        + '</button>';
    }

    // Auto merge (if unlocked via achievements)
    const autoMergeModel = _callbacks && typeof _callbacks.getAutoMergeButtonModel === 'function'
      ? _callbacks.getAutoMergeButtonModel()
      : null;
    if (autoMergeModel && autoMergeModel.visible) {
      html += '<button class="btn scButton ughActions__btn" data-ugh-action="autoMerge" type="button"'
        + (autoMergeModel.enabled ? '' : ' disabled') + '>'
        + _escHtml(autoMergeModel.label || t('ughAutoMerge', 'Объединить танки'))
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
    renderSpriteCanvases(body);
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
    if (!sourceEntity) {
      _selected = entity ? { type: type, index: index } : null;
      render();
      return;
    }

    const sourceKind = getEntityKindAt(_selected.type, _selected.index);
    const targetKind = entity ? getEntityKindAt(type, index) : null;

    if (!entity && !canTypeAcceptKind(type, sourceKind)) {
      render();
      return;
    }

    if (entity && sourceKind !== targetKind) {
      if (entity) _selected = { type: type, index: index };
      render();
      return;
    }

    if (!entity) {
      const moved = _tryMove(_selected.type, _selected.index, type, index);
      if (moved && _callbacks && typeof _callbacks.updateUI === 'function') _callbacks.updateUI();
      if (moved) _selected = null;
      render();
      return;
    }

    // Different levels — reselect
    if (!canMergeSelection(_selected.type, type, sourceEntity, entity, sourceKind)) {
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
      if (!cell) return null;
      if (cell.tank) return cell.tank;
      if (cell.drone) return cell.drone;
      return null;
    }
    if (type === 'drone') {
      const d = getDroneBySlotIndex(index);
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

  function _tryMove(srcType, srcIdx, tgtType, tgtIdx) {
    if (_callbacks && typeof _callbacks.onMove === 'function') {
      return _callbacks.onMove(srcType, srcIdx, tgtType, tgtIdx);
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
