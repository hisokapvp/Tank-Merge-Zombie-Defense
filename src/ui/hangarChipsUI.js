/**
 * HangarChipsUI — full UI controller for the triangular-chip hangar system.
 *
 * Renders inside #modsHangarOverlay:
 *   • Two tabs: "Улучшение ячеек" / "Мастерская"
 *   • 4×4 cell grid (left)
 *   • Butterfly SVG slot layout + available-chips list (right)
 *
 * Depends on: Game.HangarChips (src/mechanics/hangarChips.js)
 */
(function (global) {
  'use strict';

  var HC; // lazy ref to Game.HangarChips

  function hc() {
    if (!HC) HC = (global.Game && global.Game.HangarChips) || null;
    return HC;
  }

  /* ─── SVG geometry (viewBox 0 0 400 300) ───────────────── */
  var SVG_W = 400, SVG_H = 300;
  var PT = {
    TC: [200, 35],   // top-center
    BC: [200, 265],  // bottom-center
    CL: [75, 150],   // center-left (Red1 outer)
    CR: [325, 150],  // center-right (Red2 outer)
    TL: [15, 15],    // top-left external (Y1.X)
    TR: [385, 15],   // top-right external (Y2.X)
    BL: [15, 285],   // bottom-left external (Y3.X)
    BR: [385, 285]   // bottom-right external (Y4.X)
  };

  /* slot definitions:  type, slotId, 3 point-keys, which key is the "outer/X" vertex */
  var SLOT_DEFS = [
    { type: 'red',    slotId: 'slot1', pts: ['TC', 'BC', 'CL'], outerKey: 'CL', label: 'R1' },
    { type: 'red',    slotId: 'slot2', pts: ['TC', 'BC', 'CR'], outerKey: 'CR', label: 'R2' },
    { type: 'yellow', slotId: 'slot1', pts: ['TC', 'CL', 'TL'], outerKey: 'TL', label: 'Y1' },
    { type: 'yellow', slotId: 'slot2', pts: ['TC', 'CR', 'TR'], outerKey: 'TR', label: 'Y2' },
    { type: 'yellow', slotId: 'slot3', pts: ['BC', 'CL', 'BL'], outerKey: 'BL', label: 'Y3' },
    { type: 'yellow', slotId: 'slot4', pts: ['BC', 'CR', 'BR'], outerKey: 'BR', label: 'Y4' }
  ];

  /* ─── State ────────────────────────────────────────────── */
  var _cells = null;        // array[16] of cell states
  var _selectedCell = 0;    // index 0..15
  var _selectedSlot = null; // { type, slotId } or null (for chip-install target)
  var _chipFilter = 'all';  // 'all' | 'red' | 'yellow'
  var _initialized = false;
  var _doc = null;

  /* ─── DOM refs (populated on init) ─────────────────────── */
  var dom = {};

  /* ─── Translate helper ─────────────────────────────────── */
  function t(key, fallback) {
    if (global.Game && global.Game.I18n && typeof global.Game.I18n.t === 'function') {
      var v = global.Game.I18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function modName(modId) {
    var names = MOD_NAMES();
    return names[modId] || ('Mod ' + modId);
  }

  function MOD_NAMES() {
    var lang = (global.Game && global.Game.I18n && global.Game.I18n.currentLang) || 'ru';
    var h = hc();
    return lang === 'en' ? (h ? h.MOD_NAMES_EN : {}) : (h ? h.MOD_NAMES_RU : {});
  }

  function modShort(modId) {
    var h = hc();
    return h && h.MOD_SHORT ? (h.MOD_SHORT[modId] || String(modId)) : String(modId);
  }

  /* ─── Helpers ──────────────────────────────────────────── */

  function el(id) { return _doc ? _doc.getElementById(id) : null; }

  function ensureCells() {
    if (!_cells) {
      var h = hc();
      _cells = h ? h.createHangarCellsState() : [];
    }
    return _cells;
  }

  /* ─── Render: 4×4 cell grid ────────────────────────────── */

  function renderGrid() {
    var grid = dom.grid;
    if (!grid) return;
    var cells = ensureCells();
    var html = '';
    for (var i = 0; i < 16; i++) {
      var c = cells[i] || {};
      var sel = i === _selectedCell ? ' hangarGridCell--selected' : '';
      var hasChips = !!(
        (c.redSlots && (c.redSlots.slot1 || c.redSlots.slot2)) ||
        (c.yellowSlots && (c.yellowSlots.slot1 || c.yellowSlots.slot2 || c.yellowSlots.slot3 || c.yellowSlots.slot4))
      );
      var chipDot = hasChips ? '<span class="hangarGridCell__dot"></span>' : '';
      html += '<button class="hangarGridCell' + sel + '" data-cell-idx="' + i + '" type="button">' +
        '<span class="hangarGridCell__num">' + (i + 1) + '</span>' + chipDot +
        '</button>';
    }
    grid.innerHTML = html;
  }

  /* ─── Render: butterfly SVG ────────────────────────────── */

  function polyPoints(keys) {
    var s = '';
    for (var i = 0; i < keys.length; i++) {
      var p = PT[keys[i]];
      if (i > 0) s += ' ';
      s += p[0] + ',' + p[1];
    }
    return s;
  }

  function renderButterfly() {
    var view = dom.slotView;
    if (!view) return;
    var cells = ensureCells();
    var cell = cells[_selectedCell];
    if (!cell) return;

    var h = hc();
    var svg = '<svg class="hangarSvg" viewBox="0 0 ' + SVG_W + ' ' + SVG_H + '" xmlns="http://www.w3.org/2000/svg">';

    for (var d = 0; d < SLOT_DEFS.length; d++) {
      var def = SLOT_DEFS[d];
      var isRed = def.type === 'red';
      var chipData = isRed ? cell.redSlots[def.slotId] : cell.yellowSlots[def.slotId];
      var locked = !isRed && cell.uiState.yellowLocked && cell.uiState.activeYellowSlotId !== def.slotId;
      var selected = _selectedSlot && _selectedSlot.type === def.type && _selectedSlot.slotId === def.slotId;

      var strokeColor = locked ? '#555' : (isRed ? '#e53935' : '#fdd835');
      var fillColor = locked ? 'rgba(60,60,60,0.35)' : (chipData ? (isRed ? 'rgba(229,57,53,0.18)' : 'rgba(253,216,53,0.18)') : 'rgba(80,80,80,0.12)');
      var strokeW = selected ? 4 : 2.5;

      svg += '<g class="hangarSlotGroup">';
      svg += '<polygon class="hangarSlotPoly" points="' + polyPoints(def.pts) + '" ' +
        'fill="' + fillColor + '" stroke="' + strokeColor + '" stroke-width="' + strokeW + '" ' +
        'data-slot-type="' + def.type + '" data-slot-id="' + def.slotId + '" ' +
        'style="cursor:' + (locked ? 'not-allowed' : 'pointer') + '" />';

      /* vertex labels inside triangle */
      if (chipData && h) {
        var placement = isRed ? h.normalizeRedPlacementRotated(chipData.modIds, chipData.rotation) : h.normalizeYellowPlacementRotated(chipData.modIds, chipData.rotation);
        var cx = 0, cy = 0;
        for (var vi = 0; vi < def.pts.length; vi++) {
          cx += PT[def.pts[vi]][0];
          cy += PT[def.pts[vi]][1];
        }
        cx = Math.round(cx / 3);
        cy = Math.round(cy / 3);

        if (isRed) {
          /* show A, B, C labels at each vertex */
          var labels = [
            { label: 'A:' + modShort(placement.A), pos: _midPt(def.pts, 'TC') },
            { label: 'B:' + modShort(placement.B), pos: _midPt(def.pts, 'BC') },
            { label: 'C:' + modShort(placement.C), pos: _midPt(def.pts, def.outerKey) }
          ];
          for (var li = 0; li < labels.length; li++) {
            var lp = labels[li].pos;
            svg += '<text x="' + lp[0] + '" y="' + lp[1] + '" text-anchor="middle" dominant-baseline="central" ' +
              'fill="#4af626" font-size="13" font-family="monospace" pointer-events="none">' + labels[li].label + '</text>';
          }
        } else {
          /* yellow: show labels at each vertex like red chips.
             pts[0] → innerA, pts[1] → innerB, outerKey → X */
          var yLabels = [
            { label: 'A:' + modShort(placement.innerA), pos: _midPt(def.pts, def.pts[0]) },
            { label: 'B:' + modShort(placement.innerB), pos: _midPt(def.pts, def.pts[1]) },
            { label: 'X:' + modShort(placement.X), pos: _midPt(def.pts, def.outerKey) }
          ];
          for (var yl = 0; yl < yLabels.length; yl++) {
            var ylp = yLabels[yl].pos;
            var yColor = yl === 2 ? '#fdd835' : '#4af626'; // X = yellow, inner = green
            var ySize = yl === 2 ? '14' : '13';
            var yWeight = yl === 2 ? ' font-weight="bold"' : '';
            svg += '<text x="' + ylp[0] + '" y="' + ylp[1] + '" text-anchor="middle" dominant-baseline="central" ' +
              'fill="' + yColor + '" font-size="' + ySize + '"' + yWeight + ' font-family="monospace" pointer-events="none">' + yLabels[yl].label + '</text>';
          }
        }

        /* Rotate button (visible on hover via CSS) */
        var rotBtnX = cx;
        var rotBtnY = cy + 18;
        var rotDeg = (chipData.rotation || 0) * 120;
        svg += '<g class="hangarRotateBtn" data-rotate-type="' + def.type + '" data-rotate-slot="' + def.slotId + '" ' +
          'style="cursor:pointer">' +
          '<circle cx="' + rotBtnX + '" cy="' + rotBtnY + '" r="11" fill="rgba(30,28,24,.85)" stroke="#4af626" stroke-width="1.5" />' +
          '<text x="' + rotBtnX + '" y="' + (rotBtnY + 1) + '" text-anchor="middle" dominant-baseline="central" ' +
          'fill="#4af626" font-size="14" font-family="sans-serif" style="transform-origin:' + rotBtnX + 'px ' + rotBtnY + 'px;transform:rotate(' + rotDeg + 'deg)">\u21BB</text>' +
          '</g>';
      } else if (!locked) {
        /* empty label */
        var ecx = 0, ecy = 0;
        for (var ei = 0; ei < def.pts.length; ei++) {
          ecx += PT[def.pts[ei]][0];
          ecy += PT[def.pts[ei]][1];
        }
        ecx = Math.round(ecx / 3);
        ecy = Math.round(ecy / 3);
        svg += '<text x="' + ecx + '" y="' + ecy + '" text-anchor="middle" dominant-baseline="central" ' +
          'fill="#666" font-size="12" font-family="monospace" pointer-events="none">' + def.label + '</text>';
      }
      svg += '</g>'; /* close hangarSlotGroup */
    }

    svg += '</svg>';
    view.innerHTML = svg;
  }

  /** Get label position: weighted toward specific vertex of triangle */
  function _midPt(ptKeys, targetKey) {
    var tgt = PT[targetKey];
    var cx = 0, cy = 0;
    for (var i = 0; i < ptKeys.length; i++) {
      cx += PT[ptKeys[i]][0];
      cy += PT[ptKeys[i]][1];
    }
    cx /= ptKeys.length;
    cy /= ptKeys.length;
    return [Math.round((tgt[0] + cx) / 2), Math.round((tgt[1] + cy) / 2)];
  }

  /* ─── Render: active modifiers summary ─────────────────── */

  function renderActiveMods() {
    var wrap = dom.activeMods;
    if (!wrap) return;
    var cells = ensureCells();
    var cell = cells[_selectedCell];
    if (!cell) { wrap.innerHTML = ''; return; }

    var html = '<div class="hangarActiveModsTitle">' + t('hangarChipsActiveMods', 'Активные модификации') + '</div>';

    if (!cell.activeModifiers || !cell.activeModifiers.length) {
      html += '<div class="hangarActiveMods__none">' + t('hangarChipsNoMods', 'Нет активных модификаций') + '</div>';
    } else {
      for (var i = 0; i < cell.activeModifiers.length; i++) {
        var m = cell.activeModifiers[i];
        var color = m.source.indexOf('yellow') !== -1 ? '#fdd835' : '#e53935';
        html += '<div class="hangarActiveMods__row">' +
          '<span class="hangarActiveMods__dot" style="background:' + color + '"></span> ' +
          '<span>' + modName(m.modId) + '</span>' +
          '<span class="hangarActiveMods__tag">[' + m.vertex + ']</span>' +
          '</div>';
      }
    }

    /* match status */
    if (cell.uiState.redMatchSuccess === true) {
      html += '<div class="hangarMatchStatus hangarMatchStatus--ok">' + t('hangarChipsMatchSuccess', 'Совпадение! A+B активны') + '</div>';
    } else if (cell.uiState.redMatchSuccess === false) {
      html += '<div class="hangarMatchStatus hangarMatchStatus--fail">' + t('hangarChipsMatchFail', 'Нет совпадения. Только A') + '</div>';
    }

    /* yellow match status */
    if (cell.uiState.yellowMatchSuccess === true) {
      html += '<div class="hangarMatchStatus hangarMatchStatus--ok">' + t('hangarChipsYellowMatch', 'Жёлтый: совпадение! X активен') + '</div>';
    } else if (cell.uiState.yellowMatchSuccess === false) {
      html += '<div class="hangarMatchStatus hangarMatchStatus--fail">' + t('hangarChipsYellowMismatch', 'Жёлтый: нет совпадения. X не активен') + '</div>';
    }

    wrap.innerHTML = html;
  }

  /* ─── Render: available chips list ─────────────────────── */

  function renderChipsList() {
    var list = dom.chipsList;
    if (!list) return;
    var h = hc();
    if (!h) { list.innerHTML = ''; return; }

    var chips;
    if (_chipFilter === 'red') chips = h.redPool;
    else if (_chipFilter === 'yellow') chips = h.yellowPool;
    else chips = h.allChips;

    /* if a slot is selected, show only matching color */
    if (_selectedSlot) {
      if (_selectedSlot.type === 'red') chips = h.redPool;
      else chips = h.yellowPool;
    }

    var html = '<div class="hangarChipsListHeader">' +
      '<span class="hangarChipsAvailLabel">' + t('hangarChipsAvailable', 'Доступные чипы') +
      ' (' + chips.length + ')</span>' +
      '<span class="hangarChipsFilters">' +
      '<button class="hangarFilterBtn' + (_chipFilter === 'all' ? ' active' : '') + '" data-filter="all">Все</button>' +
      '<button class="hangarFilterBtn' + (_chipFilter === 'red' ? ' active' : '') + '" data-filter="red" style="color:#e53935">Красные</button>' +
      '<button class="hangarFilterBtn' + (_chipFilter === 'yellow' ? ' active' : '') + '" data-filter="yellow" style="color:#fdd835">Жёлтые</button>' +
      '</span></div>';

    html += '<div class="hangarChipsGrid">';
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      var borderColor = chip.chipColor === 'red' ? '#e53935' : '#fdd835';
      html += '<button class="hangarChipBtn" data-chip-id="' + chip.chipId + '" type="button" ' +
        'title="' + chip.sourceComboKey + ': ' + chip.modIds.map(function(m) { return modName(m); }).join(', ') + '">' +
        '<svg viewBox="0 0 40 36" class="hangarChipIcon">' +
        '<polygon points="20,2 38,34 2,34" fill="none" stroke="' + borderColor + '" stroke-width="2.5"/>';

      /* vertex dots */
      var vx = [[20, 6], [34, 31], [6, 31]]; // top, right, left
      var mods = chip.modIds;
      for (var vi = 0; vi < 3; vi++) {
        var mc = h.isSpecialMod(mods[vi]) ? '#fdd835' : '#e53935';
        svg_dot(vx[vi], mc);
      }
      function svg_dot(pos, color) {
        html += '<circle cx="' + pos[0] + '" cy="' + pos[1] + '" r="4" fill="' + color + '" />';
      }

      html += '</svg>' +
        '<span class="hangarChipBtn__key">' + chip.sourceComboKey + '</span>' +
        '</button>';
    }
    html += '</div>';
    list.innerHTML = html;
  }

  /* ─── Render: cell title ───────────────────────────────── */

  function renderCellTitle() {
    var titleEl = dom.cellTitle;
    if (!titleEl) return;
    titleEl.textContent = t('hangarChipsCellLabel', 'Ячейка') + ' ' + (_selectedCell + 1);
  }

  /* ─── Full render ──────────────────────────────────────── */

  function render() {
    renderGrid();
    renderCellTitle();
    renderButterfly();
    renderActiveMods();
    renderChipsList();
  }

  /* ─── Tab switching ────────────────────────────────────── */

  function switchHangarTab(tabId) {
    var tabCells = el('hangarTabCells');
    var tabWorkshop = el('hangarTabWorkshop');
    var panelCells = el('hangarPanelCells');
    var panelWorkshop = el('hangarPanelWorkshop');
    if (!tabCells || !tabWorkshop) return;

    var isCells = tabId === 'cells';
    tabCells.setAttribute('aria-selected', isCells ? 'true' : 'false');
    tabCells.setAttribute('tabindex', isCells ? '0' : '-1');
    tabWorkshop.setAttribute('aria-selected', isCells ? 'false' : 'true');
    tabWorkshop.setAttribute('tabindex', isCells ? '-1' : '0');
    if (panelCells) panelCells.hidden = !isCells;
    if (panelWorkshop) panelWorkshop.hidden = isCells;

    if (isCells) render();
  }

  /* ─── Install chip into selected slot ──────────────────── */

  function installChipAction(chipId) {
    var h = hc();
    if (!h || !_selectedSlot) return;
    var cells = ensureCells();
    var cell = cells[_selectedCell];
    if (!cell) return;
    var chipDef = h.getChipById(h.allChips, chipId);
    if (!chipDef) return;

    /* validate color match */
    if (_selectedSlot.type === 'red' && chipDef.chipColor !== 'red') return;
    if (_selectedSlot.type === 'yellow' && chipDef.chipColor !== 'yellow') return;

    var ok = h.installChip(cell, _selectedSlot.type, _selectedSlot.slotId, chipDef);
    if (ok) {
      _selectedSlot = null;
      render();
    }
  }

  /* ─── Remove chip from slot ────────────────────────────── */

  function removeChipAction(slotType, slotId) {
    var h = hc();
    if (!h) return;
    var cells = ensureCells();
    var cell = cells[_selectedCell];
    if (!cell) return;
    h.removeChip(cell, slotType, slotId);
    _selectedSlot = null;
    render();
  }

  /* ─── Event delegation ─────────────────────────────────── */

  function handleOverlayClick(evt) {
    var tgt = evt.target;
    if (!tgt) return;

    /* rotate button click */
    var rotateBtn = tgt.closest ? tgt.closest('[data-rotate-type]') : null;
    if (rotateBtn) {
      evt.stopPropagation();
      var rotType = rotateBtn.getAttribute('data-rotate-type');
      var rotSlot = rotateBtn.getAttribute('data-rotate-slot');
      var h = hc();
      if (h && typeof h.rotateChip === 'function') {
        var cells = ensureCells();
        var cell = cells[_selectedCell];
        if (cell) {
          h.rotateChip(cell, rotType, rotSlot);
          render();
        }
      }
      return;
    }

    /* grid cell click */
    var cellBtn = tgt.closest ? tgt.closest('[data-cell-idx]') : null;
    if (cellBtn) {
      _selectedCell = parseInt(cellBtn.getAttribute('data-cell-idx'), 10) || 0;
      _selectedSlot = null;
      render();
      return;
    }

    /* slot polygon click */
    var poly = tgt.closest ? tgt.closest('[data-slot-type]') : null;
    if (poly) {
      var slotType = poly.getAttribute('data-slot-type');
      var slotId = poly.getAttribute('data-slot-id');
      var cells = ensureCells();
      var cell = cells[_selectedCell];
      if (!cell) return;

      /* check if locked yellow slot */
      if (slotType === 'yellow' && cell.uiState.yellowLocked && cell.uiState.activeYellowSlotId !== slotId) {
        if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
          global.Game.Toast.show(t('hangarChipsYellowLocked', 'Можно установить только 1 жёлтый чип'), 1500);
        }
        return;
      }

      /* if chip is installed → remove it */
      var existingChip = slotType === 'red' ? cell.redSlots[slotId] : cell.yellowSlots[slotId];
      if (existingChip) {
        removeChipAction(slotType, slotId);
        return;
      }

      /* select slot for installation */
      _selectedSlot = { type: slotType, slotId: slotId };
      _chipFilter = slotType === 'red' ? 'red' : 'yellow';
      render();
      return;
    }

    /* chip button click (install) */
    var chipBtn = tgt.closest ? tgt.closest('[data-chip-id]') : null;
    if (chipBtn) {
      var chipId = parseInt(chipBtn.getAttribute('data-chip-id'), 10);
      if (_selectedSlot) {
        installChipAction(chipId);
      } else {
        /* auto-select first empty matching slot */
        autoInstall(chipId);
      }
      return;
    }

    /* filter buttons */
    var filterBtn = tgt.closest ? tgt.closest('[data-filter]') : null;
    if (filterBtn) {
      _chipFilter = filterBtn.getAttribute('data-filter') || 'all';
      _selectedSlot = null;
      renderChipsList();
      return;
    }

    /* tab buttons */
    if (tgt.id === 'hangarTabCells' || tgt.closest && tgt.closest('#hangarTabCells')) {
      switchHangarTab('cells');
      return;
    }
    if (tgt.id === 'hangarTabWorkshop' || tgt.closest && tgt.closest('#hangarTabWorkshop')) {
      switchHangarTab('workshop');
      return;
    }
  }

  /** Try to auto-install a chip into the first empty matching slot */
  function autoInstall(chipId) {
    var h = hc();
    if (!h) return;
    var chipDef = h.getChipById(h.allChips, chipId);
    if (!chipDef) return;
    var cells = ensureCells();
    var cell = cells[_selectedCell];
    if (!cell) return;

    if (chipDef.chipColor === 'red') {
      for (var r = 0; r < h.RED_SLOT_KEYS.length; r++) {
        if (!cell.redSlots[h.RED_SLOT_KEYS[r]]) {
          var ok = h.installChip(cell, 'red', h.RED_SLOT_KEYS[r], chipDef);
          if (ok) { render(); return; }
        }
      }
    } else {
      if (cell.uiState.yellowLocked) return;
      for (var y = 0; y < h.YELLOW_SLOT_KEYS.length; y++) {
        if (!cell.yellowSlots[h.YELLOW_SLOT_KEYS[y]]) {
          var okY = h.installChip(cell, 'yellow', h.YELLOW_SLOT_KEYS[y], chipDef);
          if (okY) { render(); return; }
        }
      }
    }
  }

  /* ─── Initialise ───────────────────────────────────────── */

  function init(docObj) {
    _doc = docObj || (typeof document !== 'undefined' ? document : null);
    if (!_doc) return;
    if (_initialized) return;
    _initialized = true;

    dom.grid = el('hangarGrid');
    dom.cellTitle = el('hangarCellTitle');
    dom.slotView = el('hangarSlotView');
    dom.activeMods = el('hangarActiveMods');
    dom.chipsList = el('hangarChipsList');

    var overlay = el('modsHangarOverlay');
    if (overlay) {
      overlay.addEventListener('click', handleOverlayClick);
    }

    ensureCells();
    render();
  }

  /* ─── External API for state persistence ───────────────── */

  function getCells() { return _cells; }

  function setCells(savedCells) {
    if (!Array.isArray(savedCells)) return;
    _cells = savedCells;
    var h = hc();
    if (h) {
      for (var i = 0; i < _cells.length; i++) {
        var cell = _cells[i];
        if (!cell.uiState) cell.uiState = { yellowLocked: false, activeYellowSlotId: null, redMatchSuccess: null, yellowMatchSuccess: null, redMismatchReason: '' };
        var r = h.calculateActiveModifiers(cell);
        cell.activeModifiers = r.modifiers;
        cell.uiState.redMatchSuccess = r.redMatchSuccess;
        cell.uiState.yellowMatchSuccess = r.yellowMatchSuccess;
      }
    }
  }

  function show() {
    if (!_initialized) init();
    render();
  }

  /* ─── Debug helpers (exposed for debug panel) ──────────── */

  function debugInstallChipById(cellIdx, slotType, slotId, chipId) {
    var h = hc();
    if (!h) return 'HangarChips not loaded';
    var cells = ensureCells();
    if (cellIdx < 0 || cellIdx >= cells.length) return 'Invalid cell index';
    var chipDef = h.getChipById(h.allChips, chipId);
    if (!chipDef) return 'Chip not found: ' + chipId;
    var ok = h.installChip(cells[cellIdx], slotType, slotId, chipDef);
    if (!ok) return 'Install failed (color mismatch or slot occupied)';
    _selectedCell = cellIdx;
    render();
    return 'OK: installed chip ' + chipId + ' (' + chipDef.sourceComboKey + ') in cell ' + cellIdx + ' ' + slotType + '/' + slotId;
  }

  function debugRemoveChip(cellIdx, slotType, slotId) {
    var h = hc();
    if (!h) return 'HangarChips not loaded';
    var cells = ensureCells();
    if (cellIdx < 0 || cellIdx >= cells.length) return 'Invalid cell index';
    h.removeChip(cells[cellIdx], slotType, slotId);
    _selectedCell = cellIdx;
    render();
    return 'OK: removed chip from cell ' + cellIdx + ' ' + slotType + '/' + slotId;
  }

  function debugClearCell(cellIdx) {
    var h = hc();
    if (!h) return 'HangarChips not loaded';
    var cells = ensureCells();
    if (cellIdx < 0 || cellIdx >= cells.length) return 'Invalid cell index';
    var c = cells[cellIdx];
    c.redSlots.slot1 = null;
    c.redSlots.slot2 = null;
    c.yellowSlots.slot1 = null;
    c.yellowSlots.slot2 = null;
    c.yellowSlots.slot3 = null;
    c.yellowSlots.slot4 = null;
    var r = h.calculateActiveModifiers(c);
    c.activeModifiers = r.modifiers;
    c.uiState = { yellowLocked: false, activeYellowSlotId: null, redMatchSuccess: null, yellowMatchSuccess: null, redMismatchReason: '' };
    _selectedCell = cellIdx;
    render();
    return 'OK: cleared cell ' + cellIdx;
  }

  function debugGetCellState(cellIdx) {
    var cells = ensureCells();
    return cells[cellIdx] || null;
  }

  function debugInstallByKey(cellIdx, slotType, slotId, comboKey) {
    var h = hc();
    if (!h) return 'HangarChips not loaded';
    var chipDef = h.getChipByKey(h.allChips, comboKey);
    if (!chipDef) return 'Chip not found by key: ' + comboKey;
    return debugInstallChipById(cellIdx, slotType, slotId, chipDef.chipId);
  }

  /* ─── Public API ───────────────────────────────────────── */

  global.Game = global.Game || {};
  global.Game.HangarChipsUI = {
    init: init,
    show: show,
    render: render,
    getCells: getCells,
    setCells: setCells,
    switchHangarTab: switchHangarTab,
    debugInstallChipById: debugInstallChipById,
    debugInstallByKey: debugInstallByKey,
    debugRemoveChip: debugRemoveChip,
    debugClearCell: debugClearCell,
    debugGetCellState: debugGetCellState
  };
})(typeof window !== 'undefined' ? window : this);
