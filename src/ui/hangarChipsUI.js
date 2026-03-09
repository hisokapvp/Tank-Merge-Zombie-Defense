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
  /* All 6 triangles are equilateral with side ≈ 130px.
     TC-BC is the shared central vertical edge. */
  var SVG_W = 400, SVG_H = 300;
  var GAP_DEFAULT = 15;   // normal spacing between slot triangles
  var GAP_MATCHED = 7;    // spacing when matching chips are installed (attract)
  var ATTRACTION_DIST = 7; // translation distance (px) when chip matches
  var side = 160;
  var h_tri = side * Math.sqrt(3) / 2; // ~138.6

  var cy = SVG_H / 2;
  var cx = SVG_W / 2;

  var PT = {
    TC: [cx, cy - side / 2],      // Top-center (top of red vertical edge)
    BC: [cx, cy + side / 2],      // Bottom-center (bottom of red vertical edge)
    CL: [cx - h_tri, cy],         // Center-left (shared vertex for R1, Y1, Y3)
    CR: [cx + h_tri, cy],         // Center-right (shared vertex for R2, Y2, Y4)
    TL: [cx - h_tri, cy - side],  // Top-left
    TR: [cx + h_tri, cy - side],  // Top-right
    BL: [cx - h_tri, cy + side],  // Bottom-left
    BR: [cx + h_tri, cy + side]   // Bottom-right
  };

  /** Get offset points for a triangle with a custom gap */
  function getGappedPoints(pts, gap) {
    var g = (typeof gap === 'number') ? gap : GAP_DEFAULT;
    var c = [0, 0];
    for (var i = 0; i < pts.length; i++) {
      c[0] += PT[pts[i]][0];
      c[1] += PT[pts[i]][1];
    }
    c[0] /= pts.length;
    c[1] /= pts.length;

    var res = [];
    for (var j = 0; j < pts.length; j++) {
      var p = PT[pts[j]];
      var dx = p[0] - c[0], dy = p[1] - c[1];
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) { res.push(p); continue; }
      var ox = (dx / dist) * (dist - g);
      var oy = (dy / dist) * (dist - g);
      res.push([c[0] + ox, c[1] + oy]);
    }
    return res;
  }

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
  var _workshopSubTab = 'chipUpgrade';
  var _chipRecycleSubTab = 'dust';

  /* ─── Chip drag-and-drop state (Workshop) ──────────────── */
  var _chipDragging = null; // { chipId, level, startX, startY, x, y, moved, ghostEl, sourceEl }

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

  /**
   * Generate a chip SVG icon composed of 3 sub-triangles.
   * Each sub-triangle has a colored fill matching the modifier type.
   * @param {number} w - viewBox width
   * @param {number} h - viewBox height
   * @param {string} borderColor - stroke color of outer triangle
   * @param {number[]} modIds - array of 3 mod IDs
   * @param {string} cssClass - CSS class for <svg>
   * @param {number} strokeW - outer stroke width
   * @returns {string} SVG markup
   */
  function chipSvgComposed(w, h, borderColor, modIds, cssClass, strokeW) {
    var sw = strokeW || 2.5;
    var cls = cssClass || 'hangarChipIcon';
    var hc2 = hc();

    /* Triangle vertices (apex at top for "pointing up") */
    var ax = w / 2, ay = 2;          // top
    var bx = w - 2, by = h - 2;      // bottom-right
    var cx2 = 2, cy2 = h - 2;        // bottom-left

    /* Centroid */
    var cenX = (ax + bx + cx2) / 3;
    var cenY = (ay + by + cy2) / 3;

    /* 3 sub-triangles: Top, BottomLeft, BottomRight */
    var subTris = [
      { pts: ax + ',' + ay + ' ' + cx2 + ',' + cy2 + ' ' + cenX + ',' + cenY, modIdx: 0 },
      { pts: cx2 + ',' + cy2 + ' ' + bx + ',' + by + ' ' + cenX + ',' + cenY, modIdx: 1 },
      { pts: ax + ',' + ay + ' ' + cenX + ',' + cenY + ' ' + bx + ',' + by, modIdx: 2 }
    ];

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" class="' + cls + '">';

    for (var i = 0; i < subTris.length; i++) {
      var modId = (modIds && modIds.length > subTris[i].modIdx) ? modIds[subTris[i].modIdx] : 0;
      var isSpec = hc2 && hc2.isSpecialMod(modId);
      var subFill = modId ? (isSpec ? 'rgba(253,216,53,0.22)' : 'rgba(229,57,53,0.22)') : 'rgba(80,80,80,0.08)';
      var subStroke = modId ? (isSpec ? '#fdd835' : '#e53935') : 'rgba(255,255,255,0.1)';
      svg += '<polygon points="' + subTris[i].pts + '" fill="' + subFill + '" stroke="' + subStroke + '" stroke-width="1"/>';
    }

    /* Outer triangle border */
    svg += '<polygon points="' + ax + ',' + ay + ' ' + bx + ',' + by + ' ' + cx2 + ',' + cy2 + '" fill="none" stroke="' + borderColor + '" stroke-width="' + sw + '"/>';

    /* Vertex dots */
    var dotR = Math.max(2.5, Math.min(4, w / 10));
    var vx = [[ax, ay + 4], [bx - 4, by - 3], [cx2 + 4, cy2 - 3]];
    for (var vi = 0; vi < 3 && modIds && vi < modIds.length; vi++) {
      var mc = (hc2 && hc2.isSpecialMod(modIds[vi])) ? '#fdd835' : '#e53935';
      svg += '<circle cx="' + vx[vi][0] + '" cy="' + vx[vi][1] + '" r="' + dotR + '" fill="' + mc + '" />';
    }

    svg += '</svg>';
    return svg;
  }

  /**
   * Generate a small (fragment) chip SVG — inverted triangle pointing UP.
   * @param {number} modId
   * @param {number} size
   * @param {string} strokeColor
   * @returns {string} SVG markup
   */
  function _fragmentSvgUp(modId, size, strokeColor) {
    var w = size || 40;
    var fh = Math.round(w * 0.9);
    var sc = strokeColor || '#e53935';
    var hc2 = hc();
    var isSpec = hc2 && hc2.isSpecialMod(modId);
    var fillDot = isSpec ? '#fdd835' : '#e53935';
    /* Small upward triangle */
    var ax = w / 2, ay = 2;
    var bx = w - 3, by = fh - 2;
    var cx2 = 3, cy2 = fh - 2;
    return '<svg viewBox="0 0 ' + w + ' ' + fh + '" width="' + w + '" height="' + fh + '" class="chipFragmentIcon">' +
      '<polygon points="' + ax + ',' + ay + ' ' + bx + ',' + by + ' ' + cx2 + ',' + cy2 + '" ' +
      'fill="rgba(80,80,80,0.12)" stroke="' + sc + '" stroke-width="2"/>' +
      '<circle cx="' + ax + '" cy="' + (ay + 6) + '" r="3.5" fill="' + fillDot + '"/>' +
      '</svg>';
  }

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

      var dotHtml = '';
      if (c.redSlots) {
        var anyRed = !!(c.redSlots.slot1 || c.redSlots.slot2);
        var bothRed = !!(c.redSlots.slot1 && c.redSlots.slot2);
        var redMatch = (c.uiState && c.uiState.redMatchSuccess === true);
        if (redMatch || (anyRed && !bothRed)) {
          var redCount = (c.redSlots.slot1 ? 1 : 0) + (c.redSlots.slot2 ? 1 : 0);
          var activeRedCount = redMatch ? 2 : (anyRed && !bothRed ? 1 : 0);
          for (var r = 0; r < activeRedCount; r++) {
            dotHtml += '<span class="hangarGridCell__dotItem hangarGridCell__dotItem--red"></span>';
          }
        }
      }
      if (c.yellowSlots && c.uiState && c.uiState.yellowMatchSuccess === true) {
        dotHtml += '<span class="hangarGridCell__dotItem hangarGridCell__dotItem--yellow"></span>';
      }

      var chipDot = dotHtml ? '<div class="hangarGridCell__dot">' + dotHtml + '</div>' : '';
      html += '<button class="hangarGridCell' + sel + '" data-cell-idx="' + i + '" type="button">' +
        '<span class="hangarGridCell__num">' + (i + 1) + '</span>' + chipDot +
        '</button>';
    }
    grid.innerHTML = html;
  }

  /* ─── Render: butterfly SVG ────────────────────────────── */

  function polyPoints(keys, gap) {
    var pts = getGappedPoints(keys, gap);
    var s = '';
    for (var i = 0; i < pts.length; i++) {
      if (i > 0) s += ' ';
      s += pts[i][0] + ',' + pts[i][1];
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

    /* Determine if red/yellow have matching chips → attract (shift position, keep size) */
    var redMatched = (cell.uiState && cell.uiState.redMatchSuccess === true);

    var svg = '<svg class="hangarSvg" viewBox="0 0 ' + SVG_W + ' ' + SVG_H + '" xmlns="http://www.w3.org/2000/svg">';

    for (var d = 0; d < SLOT_DEFS.length; d++) {
      var def = SLOT_DEFS[d];
      var isRed = def.type === 'red';
      var chipData = isRed ? cell.redSlots[def.slotId] : cell.yellowSlots[def.slotId];

      /* Yellow attraction: only if this specific yellow slot is active and matched */
      var yellowMatched = (cell.uiState && cell.uiState.yellowMatchSuccess === true && cell.uiState.activeYellowSlotId === def.slotId);

      var locked = !isRed && cell.uiState.yellowLocked && cell.uiState.activeYellowSlotId !== def.slotId;
      var selected = _selectedSlot && _selectedSlot.type === def.type && _selectedSlot.slotId === def.slotId;

      var strokeColor = locked ? '#555' : (isRed ? '#e53935' : '#fdd835');
      var fillColor = locked ? 'rgba(60,60,60,0.35)' : (chipData ? (isRed ? 'rgba(229,57,53,0.18)' : 'rgba(253,216,53,0.18)') : 'rgba(80,80,80,0.12)');
      var strokeW = selected ? 4 : 2.5;
      var selectedClass = selected ? ' hangarSlotPoly--selected' : '';

      var isWorking = false;
      if (chipData) {
        if (isRed) {
          // New logic for red: matches or solo chip
          var anyRed = !!(cell.redSlots && (cell.redSlots.slot1 || cell.redSlots.slot2));
          var bothRed = !!(cell.redSlots && cell.redSlots.slot1 && cell.redSlots.slot2);
          var redMatch = (cell.uiState.redMatchSuccess === true);
          isWorking = redMatch || (anyRed && !bothRed);
        } else {
          isWorking = (cell.uiState.yellowMatchSuccess === true && cell.uiState.activeYellowSlotId === def.slotId);
        }
      }
      var workingClass = isWorking ? ' hangarSlotPoly--working' : '';

      // Add individual animation delays to make shake effect individual for each element
      var animationDelay = (d * 0.05) + 's';

      /* Calculate translation for attraction */
      var tx = 0, ty = 0;
      if (redMatched && isRed) {
        // Red slots attract each other along X axis
        if (def.slotId === 'slot1') tx = ATTRACTION_DIST; // R1 moves Right
        else if (def.slotId === 'slot2') tx = -ATTRACTION_DIST; // R2 moves Left
      } else if (yellowMatched && !isRed) {
        // Yellow slots attract diagonally toward their adjacent red triangle
        // Equilateral-triangle geometry: shared-edge normal is at 60° → (0.5, ±0.866)
        // Y1(slot1)/Y3(slot3) → adjacent to R1 (left-center)
        // Y2(slot2)/Y4(slot4) → adjacent to R2 (right-center)
        var isLeftSide = (def.slotId === 'slot1' || def.slotId === 'slot3');
        var isTopSide  = (def.slotId === 'slot1' || def.slotId === 'slot2');
        tx = (isLeftSide ? 1 : -1) * ATTRACTION_DIST * 0.5;
        ty = (isTopSide  ? 1 : -1) * ATTRACTION_DIST * 0.866;
        if (redMatched) {
          // Also add the horizontal component that the adjacent red has shifted
          tx += (isLeftSide ? 1 : -1) * (GAP_DEFAULT - GAP_MATCHED);
        }
      }

      /* Always use GAP_DEFAULT to keep size constant */
      svg += '<g class="hangarSlotGroup" style="transform: translate(' + tx + 'px, ' + ty + 'px)">';
      svg += '<polygon class="hangarSlotPoly' + selectedClass + workingClass + '" points="' + polyPoints(def.pts, GAP_DEFAULT) + '" ' +
        'fill="' + fillColor + '" stroke="' + strokeColor + '" stroke-width="' + strokeW + '" ' +
        'data-slot-type="' + def.type + '" data-slot-id="' + def.slotId + '" ' +
        'style="cursor:' + (locked ? 'not-allowed' : 'pointer');

      if (isWorking) {
        svg += '; animation-delay: ' + animationDelay;
      }

      svg += '" />';

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

  function _getPolyCenter(keys) {
    var c = [0, 0];
    for (var i = 0; i < keys.length; i++) {
      c[0] += PT[keys[i]][0];
      c[1] += PT[keys[i]][1];
    }
    c[0] /= keys.length;
    c[1] /= keys.length;
    return c;
  }

  /**
   * Check if installing a chip in any empty slot of the current cell
   * would create (or contribute to) a match.
   */
  function _wouldChipCreateMatch(cell, chipEntry, h) {
    if (!cell || !h || !chipEntry) return false;
    var chipDef = h.getChipById(h.allChips, chipEntry.chipId);
    if (!chipDef) return false;

    if (chipEntry.chipColor === 'red') {
      /* Check if the other red slot has a chip and would match */
      var otherRedSlot = cell.redSlots.slot1 ? 'slot1' : (cell.redSlots.slot2 ? 'slot2' : null);
      if (!otherRedSlot) return false; /* no red chip installed, can't match */
      var otherRedChip = cell.redSlots[otherRedSlot];
      if (!otherRedChip) return false;
      /* Try all 3 rotations */
      var otherP = h.normalizeRedPlacementRotated(otherRedChip.modIds, otherRedChip.rotation);
      for (var rot = 0; rot < 3; rot++) {
        var testP = h.normalizeRedPlacementRotated(chipEntry.modIds, rot);
        if (h.checkRedMatch(testP, otherP)) return true;
      }
      return false;
    } else if (chipEntry.chipColor === 'yellow') {
      /* Check if any yellow slot adjacent to an installed red chip would match */
      var YELLOW_ADJ = {
        slot1: { redSlot: 'slot1', innerAKey: 'A', innerBKey: 'C' },
        slot2: { redSlot: 'slot2', innerAKey: 'A', innerBKey: 'C' },
        slot3: { redSlot: 'slot1', innerAKey: 'B', innerBKey: 'C' },
        slot4: { redSlot: 'slot2', innerAKey: 'B', innerBKey: 'C' }
      };
      var ySlotKeys = ['slot1', 'slot2', 'slot3', 'slot4'];
      for (var yi = 0; yi < ySlotKeys.length; yi++) {
        var yKey = ySlotKeys[yi];
        if (cell.yellowSlots[yKey]) continue; /* slot occupied */
        var adj = YELLOW_ADJ[yKey];
        var adjRed = cell.redSlots[adj.redSlot];
        if (!adjRed) continue; /* no adjacent red */
        var rp = h.normalizeRedPlacementRotated(adjRed.modIds, adjRed.rotation);
        for (var rot2 = 0; rot2 < 3; rot2++) {
          var yp = h.normalizeYellowPlacementRotated(chipEntry.modIds, rot2);
          if (yp.innerA === rp[adj.innerAKey] && yp.innerB === rp[adj.innerBKey]) return true;
        }
      }
      return false;
    }
    return false;
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

    wrap.innerHTML = html;
  }

  /* ─── Render: available chips list ─────────────────────── */

  function renderChipsList() {
    var list = dom.chipsList;
    if (!list) return;
    var h = hc();
    if (!h) { list.innerHTML = ''; return; }

    /* Use player inventory instead of full chip pool */
    var playerChips = ensurePlayerChips();
    var chips = [];
    for (var pi = 0; pi < playerChips.length; pi++) {
      var pc = playerChips[pi];
      if (pc.count <= 0) continue;
      chips.push(pc);
    }

    /* if a slot is selected, show only matching color */
    var filterColor = _chipFilter;
    if (_selectedSlot) {
      filterColor = _selectedSlot.type;
    }
    if (filterColor === 'red') {
      chips = chips.filter(function(c) { return c.chipColor === 'red'; });
    } else if (filterColor === 'yellow') {
      chips = chips.filter(function(c) { return c.chipColor === 'yellow'; });
    }

    var html = '<div class="hangarChipsListHeader">' +
      '<span class="hangarChipsAvailLabel">' + t('hangarChipsAvailable', 'Чипы в инвентаре') +
      ' (' + chips.length + ')</span>' +
      '<div class="hangarChipsFilters">' +
      '<button class="hangarFilterBtn' + (_chipFilter === 'all' ? ' active' : '') + '" data-filter="all">Все</button>' +
      '<button class="hangarFilterBtn' + (_chipFilter === 'red' ? ' active' : '') + '" data-filter="red" style="color:#e53935">Красные</button>' +
      '<button class="hangarFilterBtn' + (_chipFilter === 'yellow' ? ' active' : '') + '" data-filter="yellow" style="color:#fdd835">Жёлтые</button>' +
      '</div></div>';

    if (!chips.length) {
      html += '<div class="chipUpgradeEmptyLabel">' + t('hangarChipsNoChips', 'Нет подходящих чипов в инвентаре') + '</div>';
      list.innerHTML = html;
      return;
    }

    html += '<div class="hangarChipsGridWrap"><div class="hangarChipsGrid">';

    /* Pre-calculate which chips could create matches in the current cell */
    var cells = ensureCells();
    var cell = cells[_selectedCell];
    var canMatchMap = {};
    if (cell && h) {
      for (var ci2 = 0; ci2 < chips.length; ci2++) {
        var testChip = chips[ci2];
        canMatchMap[testChip.chipId + '_' + testChip.level] = _wouldChipCreateMatch(cell, testChip, h);
      }
    }

    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      var borderColor = chip.chipColor === 'red' ? '#e53935' : '#fdd835';
      var canMatch = canMatchMap[chip.chipId + '_' + chip.level] || false;
      var matchClass = canMatch ? ' hangarChipBtn--canMatch' : '';
      html += '<button class="hangarChipBtn' + matchClass + '" data-chip-id="' + chip.chipId + '" data-chip-level="' + chip.level + '" type="button">' +
        chipSvgComposed(40, 36, borderColor, chip.modIds, 'hangarChipIcon', 2.5) +
        '<span class="hangarChipBtn__key">' + chip.sourceComboKey + '</span>' +
        '<span class="hangarChipBtn__lvl">Ур.' + chip.level + '</span>' +
        (chip.count > 1 ? '<span class="hangarChipBtn__cnt">×' + chip.count + '</span>' : '') +
        '</button>';
    }
    html += '</div></div>';
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
    var tabTechUnlock = el('hangarTabTechUnlock');
    var panelCells = el('hangarPanelCells');
    var panelWorkshop = el('hangarPanelWorkshop');
    var panelTechUnlock = el('hangarPanelTechUnlock');
    if (!tabCells || !tabWorkshop) return;

    var isCells = tabId === 'cells';
    var isWorkshop = tabId === 'workshop';
    var isTech = tabId === 'techUnlock';

    tabCells.setAttribute('aria-selected', isCells ? 'true' : 'false');
    tabCells.setAttribute('tabindex', isCells ? '0' : '-1');
    tabWorkshop.setAttribute('aria-selected', isWorkshop ? 'true' : 'false');
    tabWorkshop.setAttribute('tabindex', isWorkshop ? '0' : '-1');
    if (tabTechUnlock) {
      tabTechUnlock.setAttribute('aria-selected', isTech ? 'true' : 'false');
      tabTechUnlock.setAttribute('tabindex', isTech ? '0' : '-1');
    }
    if (panelCells) panelCells.hidden = !isCells;
    if (panelWorkshop) panelWorkshop.hidden = !isWorkshop;
    if (panelTechUnlock) panelTechUnlock.hidden = !isTech;

    if (isCells) render();
    if (isWorkshop) {
      if (_workshopSubTab === 'chipCraft' || _workshopSubTab === 'chipRecycle') renderChipCraftPanel();
      else renderChipUpgradeGrid();
    }
    if (isTech) renderTechUnlockPanel();
  }

  /* ─── Workshop sub-tab switching ───────────────────────── */

  function switchWorkshopSubTab(tabId) {
    var tabChipUpgrade = el('workshopTabChipUpgrade');
    var tabChipCraft = el('workshopTabChipCraft');
    var tabChipRecycle = el('workshopTabChipRecycle');
    var panelChipUpgrade = el('workshopPanelChipUpgrade');
    var panelChipCraft = el('workshopPanelChipCraft');
    var panelChipRecycle = el('workshopPanelChipRecycle');
    if (!tabChipUpgrade) return;

    var isChips = tabId === 'chipUpgrade';
    var isCraft = tabId === 'chipCraft';
    var isRecycle = tabId === 'chipRecycle';

    _workshopSubTab = isRecycle ? 'chipRecycle' : (isCraft ? 'chipCraft' : 'chipUpgrade');

    tabChipUpgrade.setAttribute('aria-selected', isChips ? 'true' : 'false');
    tabChipUpgrade.setAttribute('tabindex', isChips ? '0' : '-1');
    tabChipUpgrade.classList.toggle('workshopSubTab--active', isChips);

    if (tabChipCraft) {
      tabChipCraft.setAttribute('aria-selected', isCraft ? 'true' : 'false');
      tabChipCraft.setAttribute('tabindex', isCraft ? '0' : '-1');
      tabChipCraft.classList.toggle('workshopSubTab--active', isCraft);
    }
    if (tabChipRecycle) {
      tabChipRecycle.setAttribute('aria-selected', isRecycle ? 'true' : 'false');
      tabChipRecycle.setAttribute('tabindex', isRecycle ? '0' : '-1');
      tabChipRecycle.classList.toggle('workshopSubTab--active', isRecycle);
    }

    if (panelChipUpgrade) panelChipUpgrade.hidden = !isChips;
    if (panelChipCraft) panelChipCraft.hidden = !isCraft;
    if (panelChipRecycle) panelChipRecycle.hidden = !isRecycle;

    if (isChips) renderChipUpgradeGrid();
    if (isCraft) {
      _dustMode = false;
      if (_craftMode !== 'assemble') _resetCraftSlots();
      _craftMode = 'assemble';
      renderChipCraftPanel();
    }
    if (isRecycle) {
      switchChipRecycleSubTab(_chipRecycleSubTab);
    }
  }

  function switchChipRecycleSubTab(tabId) {
    _workshopSubTab = 'chipRecycle';
    _chipRecycleSubTab = tabId === 'disassemble' ? 'disassemble' : 'dust';

    if (_chipRecycleSubTab === 'disassemble') {
      _dustMode = false;
      if (_craftMode !== 'disassemble') {
        _craftMode = 'disassemble';
        _craftSlots = [];
      }
    } else {
      _dustMode = true;
    }

    renderChipCraftPanel();
  }

  /* ─── Tech Unlock state ────────────────────────────────── */
  var _techFeedProgress = {}; // modId → number of chips fed so far

  function getTechFeedProgress() { return _techFeedProgress; }
  function setTechFeedProgress(obj) { _techFeedProgress = (obj && typeof obj === 'object') ? obj : {}; }

  /* ─── Tech Study state (Tasks 6-8) ────────────────────── */
  var _techStudying = null; // { modId, elapsed, duration, acceleratedPct } or null
  var _techStudyTimerId = null;
  var _techStudyLastTick = 0; // wall-clock ms of last timer tick
  var TECH_STUDY_DURATION_OPEN = 7200;   // 2 hours in seconds for available techs
  var TECH_STUDY_DURATION_LOCKED = 18000; // 5 hours in seconds for locked techs

  function getTechStudying() { return _techStudying; }
  function setTechStudying(obj) { _techStudying = (obj && typeof obj === 'object') ? obj : null; }

  function _startTechStudyTimer() {
    if (_techStudyTimerId) return;
    _techStudyLastTick = Date.now();
    /* Task 1: Use 250ms interval + wall-clock delta for smooth second-by-second countdown */
    _techStudyTimerId = setInterval(function() {
      if (!_techStudying) { _stopTechStudyTimer(); return; }
      /* Fix 4: Only pause timer when settings or bigMenu are open */
      if (_isTechTimerPaused()) { _techStudyLastTick = Date.now(); return; }
      var now = Date.now();
      var deltaSec = Math.max(0, (now - _techStudyLastTick) / 1000);
      _techStudyLastTick = now;
      /* Fix 7: Speed multiplier — acceleratedPct increases tick speed, not reduces duration */
      var accelPct = _techStudying.acceleratedPct || 0;
      var speedMul = accelPct >= 100 ? 20 : (1 / (1 - accelPct / 100));
      _techStudying.elapsed += deltaSec * speedMul;
      /* Check completion against FULL duration (not reduced) */
      if (_techStudying.elapsed >= _techStudying.duration) {
        _completeTechStudy();
      } else {
        /* Update timer display */
        _updateTechStudyTimerDisplay();
      }
    }, 250);
  }

  function _stopTechStudyTimer() {
    if (_techStudyTimerId) {
      clearInterval(_techStudyTimerId);
      _techStudyTimerId = null;
    }
  }

  function _completeTechStudy() {
    if (!_techStudying) return;
    var modId = _techStudying.modId;
    _stopTechStudyTimer();
    _techStudying = null;

    /* Actually unlock the technology */
    var h = hc();
    if (h) {
      var chips = ensurePlayerChips();
      var cells = ensureCells();
      var result = h.unlockTechnology(modId, chips, cells);
      if (result.ok) {
        if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
          global.Game.Toast.show(t('techUnlockSuccess', 'Технология «{name}» открыта! Все чипы обновлены.').replace('{name}', modName(modId)), 2500);
        }
      }
    }
    renderTechUnlockPanel();
    renderChipUpgradeGrid();
  }

  function _updateTechStudyTimerDisplay() {
    if (!_techStudying) return;
    var timerEl = _doc ? _doc.querySelector('[data-tech-timer="' + _techStudying.modId + '"]') : null;
    if (timerEl) {
      /* Fix 7: Show remaining based on full duration, speed multiplier handles acceleration */
      var remaining = Math.max(0, Math.ceil(_techStudying.duration - _techStudying.elapsed));
      timerEl.textContent = _formatTime(remaining);
    }
    /* Update progress bar */
    var barEl = _doc ? _doc.querySelector('[data-tech-study-bar="' + _techStudying.modId + '"]') : null;
    if (barEl) {
      var pct = Math.min(100, Math.round(_techStudying.elapsed / _techStudying.duration * 100));
      barEl.style.width = pct + '%';
    }
  }

  function _formatTime(seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    var parts = [];
    if (h > 0) parts.push(h + 'ч');
    if (m > 0 || h > 0) parts.push(m + 'м');
    parts.push(s + 'с');
    return parts.join(' ');
  }

  function _getTechDuration(modId) {
    var h = hc();
    if (!h) return TECH_STUDY_DURATION_OPEN;
    /* Tier is determined by what the tech replaces:
       if it replaces a base mod (1-14) → tier 1 (2h)
       if it replaces a tech mod (15+)  → tier 2 (5h) */
    var replacesId = h.getTechReplacesModId(modId);
    if (replacesId >= 0 && replacesId <= 14) return TECH_STUDY_DURATION_OPEN;  // Tier 1: 2h
    return TECH_STUDY_DURATION_LOCKED; // Tier 2: 5h
  }

  /** Get acceleration rates per resource based on tech duration */
  function _getTechAccelRates(modId) {
    var dur = _getTechDuration(modId);
    if (dur === TECH_STUDY_DURATION_LOCKED) {
      return {
        chip: 10,
        fragment: 1,
        dust: 1,
      };
    }
    return {
      chip: 20,
      fragment: 6,
      dust: 2,
    };
  }

  function _getAccelPerChip(modId) {
    return _getTechAccelRates(modId).chip;
  }

  /** Check if the tech study timer should be paused (only when settings/bigMenu open) */
  function _isTechTimerPaused() {
    return !!(global.Game && typeof global.Game._isTechTimerPaused === 'function' && global.Game._isTechTimerPaused());
  }

  /** Render the Technology Unlock panel */
  function renderTechUnlockPanel() {
    var panel = el('techUnlockContainer');
    if (!panel) return;
    var h = hc();
    if (!h || !h.TECH_TREE) {
      panel.innerHTML = '<div class="levelModal__line hangarWipLabel">' + t('workshopTechUnlockWIP', 'В разработке') + '</div>';
      return;
    }

    var html = '<div class="techUnlockHeader">' +
      '<span class="techUnlockTitle">' + t('techUnlockTitle', 'Варианты технологий') + '</span>' +
      '</div>';

    html += '<div class="techUnlockGrid">';

    var treeKeys = Object.keys(h.TECH_TREE);
    for (var tk = 0; tk < treeKeys.length; tk++) {
      var baseModId = Number(treeKeys[tk]);
      var chain = h.TECH_TREE[baseModId];

      for (var ci = 0; ci < chain.length; ci++) {
        var tech = chain[ci];
        var isUnlocked = h.isTechUnlocked(tech.modId);
        var canUnlock = h.canUnlockTech(tech.modId);
        var isStudying = _techStudying && _techStudying.modId === tech.modId;
        var anotherStudying = _techStudying && _techStudying.modId !== tech.modId;
        var duration = _getTechDuration(tech.modId);

        var cardClass = 'techUnlockCard';
        if (isUnlocked) cardClass += ' techUnlockCard--unlocked';
        else if (!canUnlock) cardClass += ' techUnlockCard--locked';
        else if (isStudying) cardClass += ' techUnlockCard--studying';

        html += '<div class="' + cardClass + '">';
        html += '<div class="techUnlockCard__name">' + modName(tech.modId) + '</div>';
        html += '<div class="techUnlockCard__desc">' + _getTechDescription(tech.modId) + '</div>';

        if (isUnlocked) {
          html += '<div class="techUnlockCard__status techUnlockCard__status--done">' + t('techUnlockDone', '✓ Открыто') + '</div>';
        } else if (!canUnlock) {
          var prevModId = tech.replacesModId;
          var prevName = modName(prevModId);
          var lockMsg = t('techUnlockNeedPrevNamed', 'Для разблокировки откройте "{name}"').replace('{name}', prevName);
          html += '<div class="techUnlockCard__status techUnlockCard__status--locked">' + lockMsg + '</div>';
          html += '<div class="techUnlockCard__durationInfo">' + t('techUnlockDuration', 'Время изучения: {time}').replace('{time}', _formatTime(TECH_STUDY_DURATION_LOCKED)) + '</div>';
        } else if (isStudying) {
          /* Show progress bar + timer + cancel + accelerate */
          /* Use full duration — acceleration is handled via speedMul in timer */
          var remaining = Math.max(0, Math.ceil(_techStudying.duration - _techStudying.elapsed));
          var pctW = _techStudying.duration > 0 ? Math.min(100, Math.round(_techStudying.elapsed / _techStudying.duration * 100)) : 0;

          html += '<div class="techUnlockCard__progress">';
          html += '<div class="techUnlockCard__bar"><div class="techUnlockCard__barFill" data-tech-study-bar="' + tech.modId + '" style="width:' + pctW + '%"></div></div>';
          /* Task 3: fixed-width timer text so progress bar doesn't jump */
          html += '<span class="techUnlockCard__progressText techUnlockCard__progressText--fixed" data-tech-timer="' + tech.modId + '">' + _formatTime(remaining) + '</span>';
          html += '</div>';

          if (_techStudying.acceleratedPct > 0) {
            html += '<div class="techUnlockCard__accelInfo">' + t('techUnlockAccelerated', 'Ускорено на {pct}%').replace('{pct}', _techStudying.acceleratedPct) + '</div>';
          }

          html += '<div class="techUnlockCard__actions">';
          html += '<button class="btn scButton techUnlockCard__cancelBtn" data-tech-cancel="' + tech.modId + '" type="button">' + t('techUnlockCancel', 'Отменить') + '</button>';
          var accelReachedMax = (_techStudying.acceleratedPct || 0) >= 95;
          var accelHasResources = _hasTechAccelerationResources();
          var accelDisabled = accelReachedMax || !accelHasResources;
          var accelLabel = accelReachedMax
            ? t('techUnlockAccelMax', 'Максимальное ускорение')
            : (!accelHasResources
              ? t('techUnlockAccelNoResources', 'Нет ресурсов для ускорения')
              : t('techUnlockAccel', 'Ускорить процесс открытия'));
          html += '<button class="btn scButton techUnlockCard__accelBtn' + (accelDisabled ? ' techUnlockCard__accelBtn--disabled' : '') + '" data-tech-accel="' + tech.modId + '" type="button"' + (accelDisabled ? ' disabled aria-disabled="true"' : '') + (accelDisabled ? ' title="' + _escapeHtml(accelLabel) + '"' : '') + '>' + accelLabel + '</button>';
          html += '</div>';
        } else {
          /* Show "Start study" button + duration */
          html += '<div class="techUnlockCard__durationInfo">' + t('techUnlockDuration', 'Время изучения: {time}').replace('{time}', _formatTime(duration)) + '</div>';
          html += '<div class="techUnlockCard__actions">';
          var disabled = anotherStudying ? ' disabled' : '';
          html += '<button class="btn scButton techUnlockCard__startBtn' + (anotherStudying ? ' techUnlockCard__startBtn--disabled' : '') + '" data-tech-start="' + tech.modId + '" type="button"' + disabled + '>' + t('techUnlockStart', 'Начать процесс изучения') + '</button>';
          html += '</div>';
        }

        html += '</div>'; // techUnlockCard
      }
    }

    html += '</div>'; // techUnlockGrid
    panel.innerHTML = html;

    /* Restart timer if studying */
    if (_techStudying) _startTechStudyTimer();
  }

  /** Get a short description for a tech mod */
  function _getTechDescription(modId) {
    var descs = {
      15: 'Танк стреляет тремя снарядами',
      16: 'Танк стреляет шестью снарядами',
      17: 'Цепная молния с 3 перескоками',
      18: 'Цепная молния с 6 перескоками',
      19: 'Матрёшка: большой(×3) → средний(×2) → малый(×1)',
      20: 'Матрёшка: огромный(×4) → большой(×3) → средний(×2) → малый(×1)',
      21: 'Ударная волна: ×0.75 урона, отталкивание 15px',
      22: 'Ударная волна: ×1 урона, отталкивание 20px',
      23: 'Вакуум: ×0.75 урона, стягивание 15px',
      24: 'Вакуум: ×1 урона, стягивание 20px',
      25: 'Каждый 4-й выстрел: 3 залпа с ×1.5 уроном',
      26: 'Каждый 4-й выстрел: 4 залпа с ×2 уроном',
      27: 'Раз в 30с: ядерный взрыв ×4, радиус 300px',
      28: 'Раз в 30с: ядерный взрыв ×5, вся карта',
      29: 'Заморозка атаки зомби на 0.75с',
      30: 'Заморозка атаки зомби на 1с'
    };
    return descs[modId] || '';
  }

  /**
   * Feed chips to unlock a technology.
   * Removes `amount` chips from inventory (any chips, cheapest first).
   * When progress reaches cost → unlocks the technology.
   */
  function feedChipsForTech(modId, amount) {
    var h = hc();
    if (!h) return { ok: false, error: 'no_module' };
    if (h.isTechUnlocked(modId)) return { ok: false, error: 'already_unlocked' };
    if (!h.canUnlockTech(modId)) return { ok: false, error: 'prerequisite' };

    var cost = h.getTechCost(modId);
    var fed = _techFeedProgress[modId] || 0;
    var remaining = cost - fed;
    if (remaining <= 0) return { ok: false, error: 'already_full' };

    var chips = ensurePlayerChips();
    var totalAvail = 0;
    for (var i = 0; i < chips.length; i++) totalAvail += chips[i].count;

    var toFeed = Math.min(amount, remaining, totalAvail);
    if (toFeed <= 0) return { ok: false, error: 'no_chips' };

    /* Remove chips from inventory (cheapest / lowest level first) */
    var removed = 0;
    /* Sort by level ascending so we consume lowest-level chips first */
    var sorted = chips.slice().sort(function(a, b) { return a.level - b.level; });

    for (var si = 0; si < sorted.length && removed < toFeed; si++) {
      var entry = sorted[si];
      var take = Math.min(entry.count, toFeed - removed);
      entry.count -= take;
      removed += take;
    }
    /* Clean up zero-count entries */
    for (var ci = chips.length - 1; ci >= 0; ci--) {
      if (chips[ci].count <= 0) chips.splice(ci, 1);
    }

    _techFeedProgress[modId] = fed + removed;

    /* Check if we've reached the cost */
    if (_techFeedProgress[modId] >= cost) {
      /* Unlock technology! */
      var cells = ensureCells();
      var result = h.unlockTechnology(modId, chips, cells);
      _techFeedProgress[modId] = cost; // cap at cost
      return { ok: true, unlocked: true, fed: removed, replaced: result.replaced };
    }

    return { ok: true, unlocked: false, fed: removed };
  }

  /* ─── Player chip inventory (with levels) ──────────────── */

  /* _playerChips: array of { chipId, chipColor, modIds, sourceComboKey, level, count }
     Chips with same chipId and same level are grouped together. */
  var _playerChips = null;

  /* _playerFragments: array of { fragmentId (=modId), count }
     Each fragment is one of the 30 possible modifier properties. */
  var _playerFragments = null;

  function ensurePlayerChips() {
    if (_playerChips) return _playerChips;
    _playerChips = [];
    return _playerChips;
  }

  function ensurePlayerFragments() {
    if (_playerFragments) return _playerFragments;
    _playerFragments = [];
    return _playerFragments;
  }

  function getPlayerFragments() { return ensurePlayerFragments(); }
  function setPlayerFragments(frags) { _playerFragments = Array.isArray(frags) ? frags : []; }

  /** Add fragment(s) to inventory. fragmentId = modId (1–30). */
  function addPlayerFragment(fragmentId, count) {
    var frags = ensurePlayerFragments();
    var cnt = (Number.isFinite(count) && count >= 1) ? Math.floor(count) : 1;
    for (var i = 0; i < frags.length; i++) {
      if (frags[i].fragmentId === fragmentId) {
        frags[i].count += cnt;
        return frags[i];
      }
    }
    var entry = { fragmentId: fragmentId, count: cnt };
    frags.push(entry);
    return entry;
  }

  /** Remove one fragment from inventory. Returns true if removed. */
  function removePlayerFragment(fragmentId, count) {
    var frags = ensurePlayerFragments();
    var cnt = (Number.isFinite(count) && count >= 1) ? Math.floor(count) : 1;
    for (var i = 0; i < frags.length; i++) {
      if (frags[i].fragmentId === fragmentId) {
        frags[i].count -= cnt;
        if (frags[i].count <= 0) frags.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /** Get fragment count for a given fragmentId */
  function getFragmentCount(fragmentId) {
    var frags = ensurePlayerFragments();
    for (var i = 0; i < frags.length; i++) {
      if (frags[i].fragmentId === fragmentId) return frags[i].count;
    }
    return 0;
  }

  function getPlayerChips() { return ensurePlayerChips(); }

  function setPlayerChips(chips) {
    _playerChips = Array.isArray(chips) ? chips : [];
  }

  /** Add a chip to player's inventory. Each chip is a separate entry (no stacking). */
  function addPlayerChip(chipDef, level) {
    var chips = ensurePlayerChips();
    var lvl = (Number.isFinite(level) && level >= 1) ? Math.floor(level) : 1;
    var mods = chipDef.modIds ? chipDef.modIds.slice() : [];
    /* Auto-upgrade modIds to match currently unlocked technologies */
    var h = hc();
    if (h && typeof h.applyTechUpgradesToModIds === 'function') {
      h.applyTechUpgradesToModIds(mods);
    }
    var entry = {
      chipId: chipDef.chipId,
      chipColor: chipDef.chipColor,
      modIds: mods,
      sourceComboKey: chipDef.sourceComboKey || '',
      level: lvl,
      count: 1
    };
    chips.push(entry);
    return entry;
  }

  /** Remove one chip from player's inventory entry. If count reaches 0, remove the entry. */
  function removePlayerChipOne(chipId, level) {
    var chips = ensurePlayerChips();
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].chipId === chipId && chips[i].level === level) {
        chips[i].count--;
        if (chips[i].count <= 0) chips.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /** Merge two identical chips (same chipId, same level) → one chip at level+1.
      Returns the new level or -1 on failure. */
  function mergeChips(chipId, level) {
    var chips = ensurePlayerChips();
    /* Find two separate entries with same chipId+level */
    var idx1 = -1, idx2 = -1;
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].chipId === chipId && chips[i].level === level) {
        if (idx1 === -1) { idx1 = i; }
        else { idx2 = i; break; }
      }
    }
    if (idx1 === -1 || idx2 === -1) return -1;
    var entry = chips[idx1];
    var newLevel = level + 1;
    /* Remove both entries (higher index first to preserve lower) */
    chips.splice(idx2, 1);
    chips.splice(idx1, 1);
    /* add merged chip */
    var h = hc();
    var chipDef = h ? h.getChipById(h.allChips, chipId) : null;
    if (chipDef) {
      /* Use entry's modIds (may be upgraded by tech) instead of chipDef's original */
      var mergedDef = { chipId: chipDef.chipId, chipColor: chipDef.chipColor, modIds: entry.modIds, sourceComboKey: entry.sourceComboKey };
      addPlayerChip(mergedDef, newLevel);
    } else {
      chips.push({
        chipId: chipId,
        chipColor: entry.chipColor,
        modIds: entry.modIds.slice(),
        sourceComboKey: entry.sourceComboKey,
        level: newLevel,
        count: 1
      });
    }
    return newLevel;
  }

  /** Get the attack bonus for a chip level. Level 1 = 0%, level 2 = +10%, level 3 = +20%, etc.
   *  Task 2: Bonus starts from level 2, no bonus at level 1. */
  function chipLevelBonus(level) {
    var lvl = (Number.isFinite(level) && level >= 1) ? Math.floor(level) : 1;
    return Math.max(0, (lvl - 1) * 10);
  }

  /* ─── Render: chip upgrade grid ────────────────────────── */

  var _chipUpgradeTooltipEl = null;

  function renderChipUpgradeGrid() {
    var grid = el('chipUpgradeGrid');
    if (!grid) return;
    var chips = ensurePlayerChips();
    var h = hc();

    if (!chips.length) {
      grid.innerHTML = '<div class="chipUpgradeEmptyLabel">' + t('workshopChipUpgradeEmpty', 'У вас пока нет чипов') + '</div>';
      return;
    }

    /* sort: by chipColor (red first), then by chipId, then by level */
    var sorted = chips.slice().sort(function(a, b) {
      if (a.chipColor !== b.chipColor) return a.chipColor === 'red' ? -1 : 1;
      if (a.chipId !== b.chipId) return a.chipId - b.chipId;
      return a.level - b.level;
    });

    var html = '';
    for (var i = 0; i < sorted.length; i++) {
      var chip = sorted[i];
      var borderColor = chip.chipColor === 'red' ? '#e53935' : '#fdd835';
      /* Check if another entry with same chipId+level exists (for merge) */
      var canMerge = false;
      for (var cm = 0; cm < sorted.length; cm++) {
        if (cm !== i && sorted[cm].chipId === chip.chipId && sorted[cm].level === chip.level) {
          canMerge = true; break;
        }
      }
      var cardClass = 'chipUpgradeCard' + (canMerge ? ' chipUpgradeCard--canMerge' : '');
      var bonusPct = chipLevelBonus(chip.level);
      var tooltipData = 'data-chip-upgrade-id="' + chip.chipId + '" data-chip-upgrade-level="' + chip.level + '"';

      html += '<div class="' + cardClass + '" ' + tooltipData + ' data-drag-chip-id="' + chip.chipId + '" data-drag-chip-level="' + chip.level + '">';

      /* chip icon SVG — composed of 3 sub-triangles */
      html += chipSvgComposed(44, 40, borderColor, chip.modIds, 'chipUpgradeCard__icon', 2.5);

      /* name */
      var chipName = chip.sourceComboKey;
      if (h && chip.modIds.length) {
        var names = [];
        for (var ni = 0; ni < chip.modIds.length; ni++) names.push(modName(chip.modIds[ni]));
        chipName = names.join(' + ');
      }
      html += '<span class="chipUpgradeCard__name" title="' + _escapeHtml(chipName) + '">' + _renderChipNameHtml(chipName) + '</span>';

      /* level label */
      html += '<span class="chipUpgradeCard__level">' + t('workshopChipLevelLabel', 'Ур.') + ' ' + chip.level + '</span>';

      /* count badge */
      if (chip.count > 1) {
        html += '<span class="chipUpgradeCard__count">×' + chip.count + '</span>';
      }

      /* Merge hint (drag instruction instead of button) */
      if (canMerge) {
        html += '<span class="chipUpgradeCard__mergeHint">' + t('workshopChipDragHint', 'Перетащите для слияния') + '</span>';
      }

      html += '</div>';
    }
    grid.innerHTML = html;
  }

  /* ─── Chip upgrade tooltip ─────────────────────────────── */

  function showChipUpgradeTooltip(evt) {
    var card = evt.target.closest ? evt.target.closest('[data-chip-upgrade-id]') : null;
    if (!card) { hideChipUpgradeTooltip(); return; }
    var chipId = parseInt(card.getAttribute('data-chip-upgrade-id'), 10);
    var level = parseInt(card.getAttribute('data-chip-upgrade-level'), 10);
    if (!Number.isFinite(chipId) || !Number.isFinite(level)) return;

    var chips = ensurePlayerChips();
    var chip = null;
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].chipId === chipId && chips[i].level === level) { chip = chips[i]; break; }
    }
    if (!chip) return;

    if (!_chipUpgradeTooltipEl) {
      _chipUpgradeTooltipEl = _doc.createElement('div');
      _chipUpgradeTooltipEl.className = 'chipUpgradeTooltip';
      _doc.body.appendChild(_chipUpgradeTooltipEl);
    }

    var bonus = chipLevelBonus(chip.level);
    var h = hc();
    var chipName = chip.sourceComboKey;
    if (h && chip.modIds.length) {
      var names = [];
      for (var ni = 0; ni < chip.modIds.length; ni++) names.push(modName(chip.modIds[ni]));
      chipName = names.join(' + ');
    }

    var html = '<div class="chipUpgradeTooltip__title">' + chipName + '</div>';
    html += '<div>' + t('workshopChipTooltipLevel', 'Уровень: {level}').replace('{level}', chip.level) + '</div>';
    html += '<div class="chipUpgradeTooltip__bonus">' + t('workshopChipTooltipBonus', 'Бонус: +{bonus}% к силе атаки').replace('{bonus}', bonus) + '</div>';
    if (chip.count > 1) {
      html += '<div>' + t('workshopChipTooltipCount', 'Количество: {count}').replace('{count}', chip.count) + '</div>';
    }
    if (chip.count >= 2) {
      html += '<div style="margin-top:4px;font-size:11px;color:rgba(74,246,38,.7)">' + t('workshopChipTooltipMergeHint', 'Объединить 2 одинаковых чипа для повышения уровня') + '</div>';
    }

    _chipUpgradeTooltipEl.innerHTML = html;
    _chipUpgradeTooltipEl.style.display = 'block';

    var rect = card.getBoundingClientRect();
    _chipUpgradeTooltipEl.style.left = Math.min(rect.right + 8, global.innerWidth - 240) + 'px';
    _chipUpgradeTooltipEl.style.top = Math.max(0, rect.top - 10) + 'px';
  }

  function hideChipUpgradeTooltip() {
    if (_chipUpgradeTooltipEl) {
      _chipUpgradeTooltipEl.style.display = 'none';
    }
  }

  /* ─── Generic game-styled tooltip (shared, reuses _chipUpgradeTooltipEl) ── */

  function _ensureGameTooltip() {
    if (!_chipUpgradeTooltipEl) {
      _chipUpgradeTooltipEl = _doc.createElement('div');
      _chipUpgradeTooltipEl.className = 'chipUpgradeTooltip';
      _doc.body.appendChild(_chipUpgradeTooltipEl);
    }
    return _chipUpgradeTooltipEl;
  }

  function _showGameTooltip(htmlContent, anchorEl) {
    var tip = _ensureGameTooltip();
    tip.innerHTML = htmlContent;
    tip.style.display = 'block';
    var rect = anchorEl.getBoundingClientRect();
    tip.style.left = Math.min(rect.right + 8, global.innerWidth - 240) + 'px';
    tip.style.top = Math.max(0, rect.top - 10) + 'px';
  }

  function showHangarChipBtnTooltip(btn) {
    var chipId = parseInt(btn.getAttribute('data-chip-id'), 10);
    var level = parseInt(btn.getAttribute('data-chip-level'), 10) || 1;
    var chips = ensurePlayerChips();
    var chip = null;
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].chipId === chipId && chips[i].level === level) { chip = chips[i]; break; }
    }
    if (!chip) return;
    var h = hc();
    var chipName = chip.sourceComboKey;
    if (h && chip.modIds.length) {
      var names = [];
      for (var ni = 0; ni < chip.modIds.length; ni++) names.push(modName(chip.modIds[ni]));
      chipName = names.join(' + ');
    }
    var bonus = chipLevelBonus(chip.level);
    var html = '<div class="chipUpgradeTooltip__title">' + chipName + '</div>';
    html += '<div>' + t('workshopChipTooltipLevel', 'Уровень: {level}').replace('{level}', chip.level) + '</div>';
    html += '<div class="chipUpgradeTooltip__bonus">' + t('workshopChipTooltipBonus', 'Бонус: +{bonus}% к силе атаки').replace('{bonus}', bonus) + '</div>';
    html += '<div>' + t('workshopChipTooltipCount', 'Количество: {count}').replace('{count}', chip.count) + '</div>';
    _showGameTooltip(html, btn);
  }

  function showCraftInvChipTooltip(item) {
    var chipId = parseInt(item.getAttribute('data-craft-chip-id'), 10);
    var level = parseInt(item.getAttribute('data-craft-chip-level'), 10) || 1;
    var chips = ensurePlayerChips();
    var chip = null;
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].chipId === chipId && chips[i].level === level) { chip = chips[i]; break; }
    }
    if (!chip) return;
    var h = hc();
    var chipName = chip.sourceComboKey;
    if (h && chip.modIds.length) {
      var names = [];
      for (var ni = 0; ni < chip.modIds.length; ni++) names.push(modName(chip.modIds[ni]));
      chipName = names.join(' + ');
    }
    var bonus = chipLevelBonus(chip.level);
    var html = '<div class="chipUpgradeTooltip__title">' + chipName + '</div>';
    html += '<div>' + t('workshopChipTooltipLevel', 'Уровень: {level}').replace('{level}', chip.level) + '</div>';
    html += '<div class="chipUpgradeTooltip__bonus">' + t('workshopChipTooltipBonus', 'Бонус: +{bonus}% к силе атаки').replace('{bonus}', bonus) + '</div>';
    html += '<div>' + t('workshopChipTooltipCount', 'Количество: {count}').replace('{count}', chip.count) + '</div>';
    _showGameTooltip(html, item);
  }

  function showCraftInvFragTooltip(item) {
    var fragId = parseInt(item.getAttribute('data-craft-frag-id'), 10);
    if (!Number.isFinite(fragId)) return;
    var frags = ensurePlayerFragments();
    var frag = null;
    for (var i = 0; i < frags.length; i++) {
      if (frags[i].fragmentId === fragId) { frag = frags[i]; break; }
    }
    var name = modName(fragId);
    var desc = _getModDescription(fragId);
    var cnt = frag ? frag.count : 0;
    var html = '<div class="chipUpgradeTooltip__title">' + name + '</div>';
    if (desc) html += '<div style="font-size:11px;color:rgba(255,255,255,.7)">' + desc + '</div>';
    html += '<div>' + t('workshopChipTooltipCount', 'Количество: {count}').replace('{count}', cnt) + '</div>';
    _showGameTooltip(html, item);
  }

  /* Tooltip for craft preview (result chip) */
  function showCraftResultTooltip(el) {
    if (!el) return;
    var modsAttr = el.getAttribute('data-hct-result-modids') || '';
    var modIds = [];
    if (modsAttr) {
      var parts = modsAttr.split(',');
      for (var pi = 0; pi < parts.length; pi++) {
        var n = parseInt(parts[pi], 10);
        if (Number.isFinite(n)) modIds.push(n);
      }
    }
    var h = hc();
    var title = t('chipCraftPreviewLabel', 'Превью чипа');
    if (modIds.length) {
      var names = [];
      for (var mi = 0; mi < modIds.length; mi++) names.push(modName(modIds[mi]));
      title = names.join(' + ');
    }
    var html = '<div class="chipUpgradeTooltip__title">' + title + '</div>';
    _showGameTooltip(html, el);
  }

  function showCraftSlotChipTooltip(slotEl) {
    var chipId = parseInt(slotEl.getAttribute('data-hct-chip-id'), 10);
    var level = parseInt(slotEl.getAttribute('data-hct-chip-level'), 10) || 1;
    if (!Number.isFinite(chipId)) return;
    var chips = ensurePlayerChips();
    var chip = null;
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].chipId === chipId && chips[i].level === level) { chip = chips[i]; break; }
    }
    var h = hc();
    var chipName = chip ? chip.sourceComboKey : '';
    var modIds = chip ? chip.modIds : [];
    if (h && modIds.length) {
      var names = [];
      for (var ni = 0; ni < modIds.length; ni++) names.push(modName(modIds[ni]));
      chipName = names.join(' + ');
    }
    var html = '<div class="chipUpgradeTooltip__title">' + chipName + '</div>';
    if (chip) {
      var bonus = chipLevelBonus(chip.level);
      html += '<div>' + t('workshopChipTooltipLevel', 'Уровень: {level}').replace('{level}', chip.level) + '</div>';
      html += '<div class="chipUpgradeTooltip__bonus">' + t('workshopChipTooltipBonus', 'Бонус: +{bonus}% к силе атаки').replace('{bonus}', bonus) + '</div>';
    }
    _showGameTooltip(html, slotEl);
  }

  function showCraftSlotFragTooltip(slotEl) {
    var fragId = parseInt(slotEl.getAttribute('data-hct-frag-id'), 10);
    if (!Number.isFinite(fragId)) return;
    var name = modName(fragId);
    var desc = _getModDescription(fragId);
    var html = '<div class="chipUpgradeTooltip__title">' + name + '</div>';
    if (desc) html += '<div style="font-size:11px;color:rgba(255,255,255,.7)">' + desc + '</div>';
    _showGameTooltip(html, slotEl);
  }

  /* ─── Task 5: Tooltip for installed slot chips ─────────── */

  var _slotTooltipEl = null;

  function _showSlotChipTooltip(evt, slotPoly) {
    var slotType = slotPoly.getAttribute('data-slot-type');
    var slotId = slotPoly.getAttribute('data-slot-id');
    if (!slotType || !slotId) return;

    var cells = ensureCells();
    var cell = cells[_selectedCell];
    if (!cell) return;

    var chipData = slotType === 'red' ? cell.redSlots[slotId] : cell.yellowSlots[slotId];
    if (!chipData) { _hideSlotChipTooltip(); return; }

    var h = hc();
    if (!h) return;

    /* Find chip in player inventory to get level info */
    var chips = ensurePlayerChips();
    var chipLevel = chipData.level || 1;
    var chipName = chipData.sourceComboKey || '';
    var chipModIds = chipData.modIds || [];

    if (h && chipModIds.length) {
      var names = [];
      for (var ni = 0; ni < chipModIds.length; ni++) names.push(modName(chipModIds[ni]));
      chipName = names.join(' + ');
    }

    if (!_slotTooltipEl) {
      _slotTooltipEl = _doc.createElement('div');
      _slotTooltipEl.className = 'chipUpgradeTooltip chipSlotTooltip';
      _doc.body.appendChild(_slotTooltipEl);
    }

    var bonus = chipLevelBonus(chipLevel);
    var colorLabel = slotType === 'red' ? 'Красный' : 'Жёлтый';
    var html = '<div class="chipUpgradeTooltip__title">' + chipName + '</div>';
    html += '<div>' + t('workshopChipTooltipLevel', 'Уровень: {level}').replace('{level}', chipLevel) + '</div>';
    html += '<div style="color:' + (slotType === 'red' ? '#e53935' : '#fdd835') + ';font-size:11px">' + colorLabel + ' слот: ' + slotId + '</div>';
    if (bonus > 0) {
      html += '<div class="chipUpgradeTooltip__bonus">' + t('workshopChipTooltipBonus', 'Бонус: +{bonus}% к силе атаки').replace('{bonus}', bonus) + '</div>';
    } else {
      html += '<div style="font-size:11px;color:rgba(255,255,255,.4)">' + t('chipTooltipNoBonus', 'Нет бонуса к атаке (нужен ур.2+)') + '</div>';
    }
    if (chipData.rotation) {
      html += '<div style="font-size:10px;color:rgba(255,255,255,.35)">Поворот: ' + (chipData.rotation * 120) + '°</div>';
    }

    _slotTooltipEl.innerHTML = html;
    _slotTooltipEl.style.display = 'block';
    _slotTooltipEl.style.left = Math.min(evt.clientX + 12, global.innerWidth - 260) + 'px';
    _slotTooltipEl.style.top = Math.max(0, evt.clientY + 16) + 'px';
  }

  function _hideSlotChipTooltip() {
    if (_slotTooltipEl) {
      _slotTooltipEl.style.display = 'none';
    }
  }

  /* ─── Install chip into selected slot ──────────────────── */

  function installChipAction(chipId, chipLevel) {
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

    var lvl = (Number.isFinite(chipLevel) && chipLevel >= 1) ? chipLevel : 1;

    /* check inventory has this chip */
    var chips = ensurePlayerChips();
    var invEntry = null;
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].chipId === chipId && chips[i].level === lvl && chips[i].count > 0) {
        invEntry = chips[i];
        break;
      }
    }
    if (!invEntry) {
      if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
        global.Game.Toast.show(t('hangarChipsNoInvChip', 'Этого чипа нет в инвентаре'), 1500);
      }
      return;
    }

    var ok = h.installChip(cell, _selectedSlot.type, _selectedSlot.slotId, chipDef, lvl, invEntry.modIds);
    if (ok) {
      /* Remove from inventory */
      removePlayerChipOne(chipId, lvl);
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

    /* Return chip to inventory before removing from slot */
    var chipData = slotType === 'red' ? cell.redSlots[slotId] : cell.yellowSlots[slotId];
    if (chipData) {
      var chipDef = h.getChipById(h.allChips, chipData.chipId);
      if (chipDef) {
        /* Use slot's modIds (may have been upgraded by tech unlock) */
        var returnDef = {
          chipId: chipDef.chipId,
          chipColor: chipDef.chipColor,
          modIds: chipData.modIds || chipDef.modIds,
          sourceComboKey: chipData.sourceComboKey || chipDef.sourceComboKey
        };
        addPlayerChip(returnDef, chipData.level || 1);
      }
    }

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
      var chipLevel = parseInt(chipBtn.getAttribute('data-chip-level'), 10) || 1;
      if (_selectedSlot) {
        installChipAction(chipId, chipLevel);
      } else {
        /* no slot selected — show a hint instead of auto-installing */
        if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
          global.Game.Toast.show(t('hangarChipsSelectSlot', 'Сначала выберите слот для установки чипа'), 1500);
        }
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
    if (tgt.id === 'hangarTabTechUnlock' || tgt.closest && tgt.closest('#hangarTabTechUnlock')) {
      switchHangarTab('techUnlock');
      return;
    }

    /* workshop sub-tab buttons */
    if (tgt.id === 'workshopTabChipUpgrade' || tgt.closest && tgt.closest('#workshopTabChipUpgrade')) {
      switchWorkshopSubTab('chipUpgrade');
      return;
    }

    /* workshop chip-craft sub-tab */
    if (tgt.id === 'workshopTabChipCraft' || tgt.closest && tgt.closest('#workshopTabChipCraft')) {
      switchWorkshopSubTab('chipCraft');
      return;
    }
    if (tgt.id === 'workshopTabChipRecycle' || tgt.closest && tgt.closest('#workshopTabChipRecycle')) {
      switchWorkshopSubTab('chipRecycle');
      return;
    }

    /* merge chip button — removed, now uses drag-and-drop */

    /* tech start study button */
    var techStartBtn = tgt.closest ? tgt.closest('[data-tech-start]') : null;
    if (techStartBtn) {
      var startModId = parseInt(techStartBtn.getAttribute('data-tech-start'), 10);
      if (Number.isFinite(startModId) && !_techStudying) {
        var h = hc();
        if (h && h.canUnlockTech(startModId)) {
          var dur = _getTechDuration(startModId);
          _techStudying = { modId: startModId, elapsed: 0, duration: dur, acceleratedPct: 0 };
          _startTechStudyTimer();
          renderTechUnlockPanel();
        }
      }
      return;
    }

    /* tech cancel button */
    var techCancelBtn = tgt.closest ? tgt.closest('[data-tech-cancel]') : null;
    if (techCancelBtn) {
      var cancelModId = parseInt(techCancelBtn.getAttribute('data-tech-cancel'), 10);
      if (Number.isFinite(cancelModId) && _techStudying && _techStudying.modId === cancelModId) {
        _showTechCancelConfirm(cancelModId);
      }
      return;
    }

    /* tech accelerate button */
    var techAccelBtn = tgt.closest ? tgt.closest('[data-tech-accel]') : null;
    if (techAccelBtn) {
      var accelModId = parseInt(techAccelBtn.getAttribute('data-tech-accel'), 10);
      if (Number.isFinite(accelModId) && _techStudying && _techStudying.modId === accelModId) {
        /* Fix 2: Block if at 95% */
        if ((_techStudying.acceleratedPct || 0) >= 95) {
          if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
            global.Game.Toast.show(t('techAccelMaxReached', 'Достигнуто максимальное ускорение (95%)'), 1500);
          }
          return;
        }
        _showTechAccelModal(accelModId);
      }
      return;
    }

    /* tech cancel confirm buttons */
    var techCancelYes = tgt.closest ? tgt.closest('[data-tech-cancel-yes]') : null;
    if (techCancelYes) {
      _stopTechStudyTimer();
      _techStudying = null;
      _closeTechModal();
      renderTechUnlockPanel();
      return;
    }
    var techCancelNo = tgt.closest ? tgt.closest('[data-tech-cancel-no]') : null;
    if (techCancelNo) {
      _closeTechModal();
      return;
    }

    /* tech accel confirm button */
    var techAccelConfirm = tgt.closest ? tgt.closest('[data-tech-accel-confirm]') : null;
    if (techAccelConfirm) {
      _applyTechAcceleration();
      return;
    }

    /* tech accel chip checkbox toggle */
    var techAccelChip = tgt.closest ? tgt.closest('[data-accel-chip-id]') : null;
    if (techAccelChip) {
      var isChecked = techAccelChip.getAttribute('data-accel-checked') === 'true';
      /* Task 4: If not checked and already at limit, block toggling on */
      if (!isChecked) {
        var chipRate = _getTechAccelRates(_techStudying.modId).chip;
        if (chipRate > _getTechAccelRemainingBudget()) {
          if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
            global.Game.Toast.show(t('techAccelSelectionLimit', 'Этот ресурс превысит лимит ускорения. Выберите другой.'), 2000);
          }
          return;
        }
      }
      if (!isChecked && _isAccelSelectionAtMax()) {
        if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
          global.Game.Toast.show(t('techAccelSelectionLimit', 'Этот ресурс превысит лимит ускорения. Выберите другой.'), 2000);
        }
        return;
      }
      techAccelChip.setAttribute('data-accel-checked', isChecked ? 'false' : 'true');
      var checkMark = techAccelChip.querySelector('.techAccelChip__check');
      if (checkMark) checkMark.textContent = isChecked ? '' : '✓';
      /* Update acceleration percentage */
      _updateAccelPercentage();
      return;
    }

    /* tech accel fragment checkbox toggle */
    var techAccelFrag = tgt.closest ? tgt.closest('[data-accel-frag-id]') : null;
    if (techAccelFrag) {
      var isFragChecked = techAccelFrag.getAttribute('data-accel-checked') === 'true';
      if (!isFragChecked) {
        var fragRate = _getTechAccelRates(_techStudying.modId).fragment;
        if (fragRate > _getTechAccelRemainingBudget()) {
          if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
            global.Game.Toast.show(t('techAccelSelectionLimit', 'Этот ресурс превысит лимит ускорения. Выберите другой.'), 2000);
          }
          return;
        }
      }
      if (!isFragChecked && _isAccelSelectionAtMax()) {
        if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
          global.Game.Toast.show(t('techAccelSelectionLimit', 'Этот ресурс превысит лимит ускорения. Выберите другой.'), 2000);
        }
        return;
      }
      techAccelFrag.setAttribute('data-accel-checked', isFragChecked ? 'false' : 'true');
      var fragCheckMark = techAccelFrag.querySelector('.techAccelChip__check');
      if (fragCheckMark) fragCheckMark.textContent = isFragChecked ? '' : '✓';
      _updateAccelPercentage();
      return;
    }

    var techAccelDustStepBtn = tgt.closest ? tgt.closest('[data-accel-dust-step]') : null;
    if (techAccelDustStepBtn) {
      var step = parseInt(techAccelDustStepBtn.getAttribute('data-accel-dust-step'), 10);
      if (!Number.isFinite(step) || !_techStudying) return;
      if (step > 0) {
        var dustRate = _getTechAccelRates(_techStudying.modId).dust;
        if (_techAccelDustSelected >= _siliconDust) return;
        if (dustRate > _getTechAccelRemainingBudget()) {
          if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
            global.Game.Toast.show(t('techAccelSelectionLimit', 'Этот ресурс превысит лимит ускорения. Выберите другой.'), 2000);
          }
          return;
        }
        _techAccelDustSelected += 1;
      } else if (step < 0) {
        _techAccelDustSelected = Math.max(0, _techAccelDustSelected - 1);
      }
      _updateAccelPercentage();
      return;
    }

    /* Close tech modal on backdrop click */
    var modalBackdrop = tgt.closest ? tgt.closest('.techModal__backdrop') : null;
    if (modalBackdrop && tgt === modalBackdrop) {
      _closeTechModal();
      return;
    }
  }

  /* ─── Tech study modals ────────────────────────────────── */

  var _techModalEl = null;
  var _techAccelDustSelected = 0;

  function _ensureTechModal() {
    if (!_techModalEl) {
      _techModalEl = _doc.createElement('div');
      _techModalEl.className = 'techModal__backdrop';
      _techModalEl.style.display = 'none';
      _doc.body.appendChild(_techModalEl);
      /* Delegate clicks inside modal */
      _techModalEl.addEventListener('click', handleOverlayClick);
    }
    return _techModalEl;
  }

  function _closeTechModal() {
    _techAccelDustSelected = 0;
    if (_techModalEl) {
      _techModalEl.style.display = 'none';
      _techModalEl.innerHTML = '';
    }
  }

  function _sumEntryCounts(entries, countKey) {
    var total = 0;
    if (!Array.isArray(entries)) return total;
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var raw = entry && Number.isFinite(entry[countKey]) ? entry[countKey] : 0;
      total += Math.max(0, Math.floor(raw));
    }
    return total;
  }

  function _hasTechAccelerationResources() {
    return _sumEntryCounts(ensurePlayerChips(), 'count') > 0
      || _sumEntryCounts(ensurePlayerFragments(), 'count') > 0
      || _siliconDust > 0;
  }

  function _getTechAccelSelectionState() {
    var state = {
      chipCount: 0,
      fragmentCount: 0,
      dustCount: 0,
      pct: 0,
    };
    if (!_techStudying) return state;
    var rates = _getTechAccelRates(_techStudying.modId);
    if (_techModalEl) {
      state.chipCount = _techModalEl.querySelectorAll('[data-accel-chip-id][data-accel-checked="true"]').length;
      state.fragmentCount = _techModalEl.querySelectorAll('[data-accel-frag-id][data-accel-checked="true"]').length;
    }
    state.dustCount = Math.max(0, Math.min(_techAccelDustSelected, _siliconDust));
    state.pct = state.chipCount * rates.chip + state.fragmentCount * rates.fragment + state.dustCount * rates.dust;
    return state;
  }

  function _getTechAccelRemainingBudget() {
    if (!_techStudying) return 0;
    var currentAccel = _techStudying.acceleratedPct || 0;
    var selectedPct = _getTechAccelSelectionState().pct;
    return Math.max(0, 95 - currentAccel - selectedPct);
  }

  function _showTechCancelConfirm(modId) {
    var modal = _ensureTechModal();
    var html = '<div class="techModal__dialog">' +
      '<div class="techModal__text">' +
      t('techCancelConfirmText', 'Если Вы отмените процесс обучения, то прогресс в открытии технологии будет утерян. Отменить процесс обучения?') +
      '</div>' +
      '<div class="techModal__btns">' +
      '<button class="btn scButton techModal__yesBtn" data-tech-cancel-yes="' + modId + '" type="button">' + t('techCancelYes', 'Да') + '</button>' +
      '<button class="btn scButton techModal__noBtn" data-tech-cancel-no="' + modId + '" type="button">' + t('techCancelNo', 'Нет') + '</button>' +
      '</div>' +
      '</div>';
    modal.innerHTML = html;
    modal.style.display = 'flex';
  }

  function _showTechAccelModal(modId) {
    var modal = _ensureTechModal();
    var chips = ensurePlayerChips();
    var frags = ensurePlayerFragments();
    var h = hc();

    _techAccelDustSelected = 0;
    var accelRates = _getTechAccelRates(modId);
    var currentAccel = _techStudying ? (_techStudying.acceleratedPct || 0) : 0;
    var html = '<div class="techModal__dialog techModal__dialog--wide">' +
      '<div class="techModal__title">' + t('techAccelTitle', 'Ускорить процесс открытия') + '</div>' +
      '<div class="techModal__subtitle">' + t('techAccelSubtitle', 'Выберите ресурсы для ускорения.') + '</div>' +
      '<div class="techModal__rateLine">' + t('techAccelRateSummary', 'Кремниевая пыль +{dust}% • большой чип +{chip}% • фрагмент +{fragment}%').replace('{dust}', accelRates.dust).replace('{chip}', accelRates.chip).replace('{fragment}', accelRates.fragment) + '</div>';

    var hasCards = chips.length > 0 || frags.length > 0;
    var hasItems = hasCards || _siliconDust > 0;

    if (!hasItems) {
      html += '<div class="techModal__empty">' + t('techAccelNoChips', 'Нет больших чипов, фрагментов или кремниевой пыли') + '</div>';
    } else if (hasCards) {
      html += '<div class="techAccelGridWrap"><div class="techAccelGrid">';
      for (var i = 0; i < chips.length; i++) {
        var chip = chips[i];
        var borderColor = chip.chipColor === 'red' ? '#e53935' : '#fdd835';
        var accelChipName = _getChipDisplayName(chip) + ' • ' + t('workshopChipLevelLabel', 'Ур.') + ' ' + chip.level;
        for (var ci = 0; ci < chip.count; ci++) {
          html += '<div class="techAccelChip" data-accel-chip-id="' + chip.chipId + '" data-accel-chip-level="' + chip.level + '" data-accel-checked="false">';
          html += '<div class="techAccelChip__checkBox"><span class="techAccelChip__check"></span></div>';
          html += chipSvgComposed(40, 36, borderColor, chip.modIds, 'techAccelChip__icon', 2.5);
          html += '<span class="techAccelChip__label" title="' + _escapeHtml(accelChipName) + '">' + _renderChipNameHtml(accelChipName) + '</span>';
          html += '<span class="techAccelChip__meta">+' + accelRates.chip + '%</span>';
          html += '</div>';
        }
      }
      if (frags.length) {
        for (var fi = 0; fi < frags.length; fi++) {
          var frag = frags[fi];
          var fragStroke = (h && h.isSpecialMod(frag.fragmentId)) ? '#fdd835' : '#e53935';
          for (var fc = 0; fc < frag.count; fc++) {
            html += '<div class="techAccelChip" data-accel-frag-id="' + frag.fragmentId + '" data-accel-checked="false">';
            html += '<div class="techAccelChip__checkBox"><span class="techAccelChip__check"></span></div>';
            html += _fragmentSvg(frag.fragmentId, 36, fragStroke);
            html += '<span class="techAccelChip__label" title="' + _escapeHtml(modName(frag.fragmentId)) + '">' + _renderChipNameHtml(modName(frag.fragmentId)) + '</span>';
            html += '<span class="techAccelChip__meta">+' + accelRates.fragment + '%</span>';
            html += '</div>';
          }
        }
      }
      html += '</div></div>';
    }

    html += '<div class="techModal__footer">';
    html += '<div class="techModal__dustRow">';
    html += '<div class="techModal__dustLabel">'
      + '<span>' + t('chipCraftSiliconDust', 'Кремниевая пыль') + ':</span>'
      + '<span class="techModal__dustValue" data-accel-dust-count>' + _formatTechAccelDustCount(0) + '</span>'
      + '</div>';
    html += '<div class="techAccelDustControls">';
    html += '<button class="techAccelDustControls__btn" data-accel-dust-step="-1" type="button" aria-label="-">−</button>';
    html += '<button class="techAccelDustControls__btn" data-accel-dust-step="1" type="button" aria-label="+">+</button>';
    html += '</div>';
    html += '</div>';
    html += '<div class="techModal__selectionInfo" data-tech-accel-summary>'
      + t('techAccelSelectedSummary', 'Выбрано ускорение: {pct}% • итог после применения: {total}% • осталось до лимита: {left}%')
        .replace('{pct}', '0')
        .replace('{total}', String(currentAccel))
        .replace('{left}', String(Math.max(0, 95 - currentAccel)))
      + '</div>';
    html += '</div>';
    html += '<div class="techModal__btns">' +
      '<button class="btn scButton techModal__accelConfirmBtn" data-tech-accel-confirm="' + modId + '" type="button">' +
      t('techAccelBtnLabel', 'Ускорить на 0%') + '</button>' +
      '<button class="btn scButton techModal__noBtn" data-tech-cancel-no="close" type="button">' + t('techAccelClose', 'Закрыть') + '</button>' +
      '</div></div>';

    modal.innerHTML = html;
    modal.style.display = 'flex';
    _updateAccelPercentage();
  }

  /** Task 4: Check if the current chip/fragment selection has reached the max acceleration limit */
  function _isAccelSelectionAtMax() {
    return _getTechAccelRemainingBudget() <= 0;
  }

  function _formatTechAccelDustCount(selectedDustCount) {
    return _siliconDust + ' / ' + Math.max(0, selectedDustCount || 0);
  }

  function _updateAccelPercentage() {
    if (!_techModalEl || !_techStudying) return;
    var selection = _getTechAccelSelectionState();
    var rates = _getTechAccelRates(_techStudying.modId);
    var pct = selection.pct;
    var currentAccel = _techStudying.acceleratedPct || 0;
    var total = Math.min(95, currentAccel + pct);
    var left = Math.max(0, 95 - currentAccel - pct);
    var confirmBtn = _techModalEl.querySelector('[data-tech-accel-confirm]');
    if (confirmBtn) {
      confirmBtn.textContent = t('techAccelBtnLabel', 'Ускорить на {pct}%').replace('{pct}', pct);
      confirmBtn.disabled = (selection.chipCount + selection.fragmentCount + selection.dustCount) === 0 || pct <= 0;
    }
    var summaryEl = _techModalEl.querySelector('[data-tech-accel-summary]');
    if (summaryEl) {
      summaryEl.textContent = t('techAccelSelectedSummary', 'Выбрано ускорение: {pct}% • итог после применения: {total}% • осталось до лимита: {left}%')
        .replace('{pct}', pct)
        .replace('{total}', total)
        .replace('{left}', left);
    }
    var dustCountEl = _techModalEl.querySelector('[data-accel-dust-count]');
    if (dustCountEl) {
      dustCountEl.textContent = _formatTechAccelDustCount(selection.dustCount);
    }
    var dustMinusBtn = _techModalEl.querySelector('[data-accel-dust-step="-1"]');
    if (dustMinusBtn) dustMinusBtn.disabled = selection.dustCount <= 0;
    var dustPlusBtn = _techModalEl.querySelector('[data-accel-dust-step="1"]');
    if (dustPlusBtn) dustPlusBtn.disabled = _siliconDust <= 0 || selection.dustCount >= _siliconDust || rates.dust > left;

    var allItems = _techModalEl.querySelectorAll('[data-accel-chip-id], [data-accel-frag-id]');
    for (var i = 0; i < allItems.length; i++) {
      var itemEl = allItems[i];
      var isChecked = itemEl.getAttribute('data-accel-checked') === 'true';
      var itemDelta = itemEl.hasAttribute('data-accel-chip-id') ? rates.chip : rates.fragment;
      if (!isChecked && itemDelta > left) {
        itemEl.classList.add('techAccelChip--disabled');
        itemEl.setAttribute('aria-disabled', 'true');
        itemEl.setAttribute('data-accel-disabled-reason', t('techAccelLimitBadge', 'Лимит'));
      } else {
        itemEl.classList.remove('techAccelChip--disabled');
        itemEl.removeAttribute('aria-disabled');
        itemEl.removeAttribute('data-accel-disabled-reason');
      }
    }
  }

  function _applyTechAcceleration() {
    if (!_techModalEl || !_techStudying) return;

    /* Fix 2: Block if already at 95% */
    if ((_techStudying.acceleratedPct || 0) >= 95) {
      if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
        global.Game.Toast.show(t('techAccelMaxReached', 'Достигнуто максимальное ускорение (95%)'), 1500);
      }
      _closeTechModal();
      return;
    }

    var checkedChips = _techModalEl.querySelectorAll('[data-accel-chip-id][data-accel-checked="true"]');
    var checkedFrags = _techModalEl.querySelectorAll('[data-accel-frag-id][data-accel-checked="true"]');
    var dustToBurn = Math.max(0, Math.min(_techAccelDustSelected, _siliconDust));
    if (!checkedChips.length && !checkedFrags.length && !dustToBurn) {
      _closeTechModal();
      return;
    }

    /* Collect chips to burn */
    var chipsToBurn = [];
    for (var i = 0; i < checkedChips.length; i++) {
      var chipId = parseInt(checkedChips[i].getAttribute('data-accel-chip-id'), 10);
      var level = parseInt(checkedChips[i].getAttribute('data-accel-chip-level'), 10);
      chipsToBurn.push({ chipId: chipId, level: level });
    }

    /* Collect fragments to burn */
    var fragsToBurn = [];
    for (var fi = 0; fi < checkedFrags.length; fi++) {
      var fragId = parseInt(checkedFrags[fi].getAttribute('data-accel-frag-id'), 10);
      fragsToBurn.push(fragId);
    }

    /* Burn chips from inventory */
    for (var j = 0; j < chipsToBurn.length; j++) {
      removePlayerChipOne(chipsToBurn[j].chipId, chipsToBurn[j].level);
    }

    /* Burn fragments from inventory */
    for (var fj = 0; fj < fragsToBurn.length; fj++) {
      removePlayerFragment(fragsToBurn[fj], 1);
    }

    if (dustToBurn > 0) {
      _siliconDust -= dustToBurn;
    }

    var accelRates = _getTechAccelRates(_techStudying.modId);
    var totalAccel = chipsToBurn.length * accelRates.chip + fragsToBurn.length * accelRates.fragment + dustToBurn * accelRates.dust;
    _techStudying.acceleratedPct = (_techStudying.acceleratedPct || 0) + totalAccel;
    if (_techStudying.acceleratedPct > 95) _techStudying.acceleratedPct = 95; // Cap at 95%

    /* Fix 7: Check completion against full duration (not reduced) */
    if (_techStudying.elapsed >= _techStudying.duration) {
      _closeTechModal();
      _completeTechStudy();
      return;
    }

    if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
      global.Game.Toast.show(t('techAccelApplied', 'Ускорение применено. Итоговое ускорение: {pct}%').replace('{pct}', _techStudying.acceleratedPct), 2000);
    }

    _closeTechModal();
    renderTechUnlockPanel();
    renderChipUpgradeGrid();
  }

  /* ─── Chip Crafting Panel (Создание чипов) ─────────────── */

  var _craftSlots = [null, null, null]; // 3 slots for fragments or dynamic array for disassemble
  var _craftMode = 'assemble'; // 'disassemble' | 'assemble' — always one of two
  var _dustMode = false;       // true when "Распылить" flow is active
  var _dustSelected = {};      // { 'chip_<chipId>_<level>': count, 'frag_<fragId>': count }
  var _siliconDust = 0;        // player's silicon dust resource
  var _craftReagentDust = 0;   // units of silicon dust to spend as reagent (0-5)

  var DUST_PER_CHIP = 10;
  var DUST_PER_FRAGMENT = 3;

  function _resetCraftSlots() {
    _craftSlots = [null, null, null];
    _craftReagentDust = 0;
  }

  /**
   * Check if a fragment can still be added to the assemble slots.
   * Rules: no all-same triple, max 1 special mod.
   * @param {number} fragId — modId to add
   * @returns {boolean}
   */
  function _canAddFragment(fragId) {
    var h = hc();
    if (!h) return true;
    var existing = [];
    for (var i = 0; i < 3; i++) {
      if (_craftSlots[i] && _craftSlots[i].type === 'fragment') {
        existing.push(_craftSlots[i].fragmentId);
      }
    }
    if (existing.length >= 3) return false;
    var test = existing.concat([fragId]);
    /* Check: not all same (if all 3 would be same) */
    if (test.length === 3 && test[0] === test[1] && test[1] === test[2]) return false;
    /* Check: max 1 special */
    var specCount = 0;
    for (var j = 0; j < test.length; j++) {
      if (h.isSpecialMod(test[j])) specCount++;
    }
    if (specCount > 1) return false;
    return true;
  }

  /**
   * Preview what chip would result from the current 3 fragments.
   * @returns {object|null} chip def or null if invalid/incomplete
   */
  function _previewAssembleResult() {
    var h = hc();
    if (!h) return null;
    var fragIds = [];
    for (var i = 0; i < 3; i++) {
      if (!_craftSlots[i] || _craftSlots[i].type !== 'fragment') return null;
      fragIds.push(_craftSlots[i].fragmentId);
    }
    return h.assembleChip(fragIds);
  }

  /** Get a description for a mod (fragment or chip mod) */
  function _getModDescription(modId) {
    var descs = {
      1: 'Танк стреляет двумя снарядами',
      2: 'Цепная молния с 2 перескоками',
      3: 'Матрёшка: большой(×2) → малый(×1)',
      4: 'Отталкивание: +0.5× урона, 10px',
      5: 'Вакуум: +0.5× урона, 50px радиус',
      6: 'Каждый 4-й выстрел: 3 залпа ×1.25',
      7: 'Случайный эффект каждый выстрел',
      8: 'Раз в 30с: ядерный взрыв ×3, 100px',
      9: 'Заморозка атаки зомби на 0.5с',
      10: 'Оставляет огненную лужу',
      11: 'Оставляет ледяную зону замедления',
      12: 'Создаёт электроузел с периодическим уроном',
      13: 'Отмечает цель; попадание = ×2 урон',
      14: 'Оставляет кислотную лужу',
      15: 'Танк стреляет тремя снарядами',
      16: 'Танк стреляет шестью снарядами',
      17: 'Цепная молния с 3 перескоками',
      18: 'Цепная молния с 6 перескоками',
      19: 'Матрёшка: большой(×3) → средний(×2) → малый(×1)',
      20: 'Матрёшка: огромный(×4) → большой(×3) → средний(×2) → малый(×1)',
      21: 'Ударная волна: ×0.75 урона, отталкивание 15px',
      22: 'Ударная волна: ×1 урона, отталкивание 20px',
      23: 'Вакуум: ×0.75 урона, стягивание 15px',
      24: 'Вакуум: ×1 урона, стягивание 20px',
      25: 'Каждый 4-й выстрел: 3 залпа с ×1.5 уроном',
      26: 'Каждый 4-й выстрел: 4 залпа с ×2 уроном',
      27: 'Раз в 30с: ядерный взрыв ×4, радиус 300px',
      28: 'Раз в 30с: ядерный взрыв ×5, вся карта',
      29: 'Заморозка атаки зомби на 0.75с',
      30: 'Заморозка атаки зомби на 1с'
    };
    return descs[modId] || '';
  }

  function _resetDustMode() {
    _dustMode = false;
    _dustSelected = {};
  }

  function _calcDustTotal() {
    var total = 0;
    var keys = Object.keys(_dustSelected);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var cnt = _dustSelected[k] || 0;
      if (k.indexOf('chip_') === 0) total += cnt * DUST_PER_CHIP;
      else if (k.indexOf('frag_') === 0) total += cnt * DUST_PER_FRAGMENT;
    }
    return total;
  }

  /** Toggle a single dust checkbox: update _dustSelected, total display, and card highlight */
  function _toggleDustCheckbox(cb) {
    var key = cb.getAttribute('data-dust-key');
    var maxQ = parseInt(cb.getAttribute('data-dust-max'), 10) || 1;
    if (cb.checked) {
      _dustSelected[key] = maxQ;
    } else {
      delete _dustSelected[key];
    }
    var totalEl = el('chipCraftDustTotal');
    if (totalEl) {
      totalEl.textContent = t('chipCraftDustResult', 'Получите кремниевой пыли: {amount}').replace('{amount}', _calcDustTotal());
    }
    var item = cb.closest('.chipCraftInvItem');
    if (item) {
      if (cb.checked) item.classList.add('chipCraftInvItem--dustSelected');
      else item.classList.remove('chipCraftInvItem--dustSelected');
    }
  }

  /** Detect craft mode based on current slot contents */
  function _detectCraftMode() {
    var wholeChipCount = 0;
    var fragmentCount = 0;
    var len = _craftSlots.length;
    for (var i = 0; i < len; i++) {
      if (_craftSlots[i]) {
        if (_craftSlots[i].type === 'chip') wholeChipCount++;
        else if (_craftSlots[i].type === 'fragment') fragmentCount++;
      }
    }
    if (wholeChipCount >= 1 && fragmentCount === 0) return 'disassemble';
    if (fragmentCount > 0 && fragmentCount <= 3 && wholeChipCount === 0) return fragmentCount === 3 ? 'assemble' : 'partial';
    return null;
  }

  /** Draw a fragment SVG icon — small upward triangle */
  function _fragmentSvg(modId, size, strokeColor) {
    return _fragmentSvgUp(modId, size, strokeColor);
  }

  function _getChipDisplayName(chipEntry) {
    if (!chipEntry) return '';
    var h = hc();
    var chipName = chipEntry.sourceComboKey || '';
    var modIds = chipEntry.modIds || [];
    if (h && modIds.length) {
      var names = [];
      for (var ni = 0; ni < modIds.length; ni++) names.push(modName(modIds[ni]));
      chipName = names.join(' + ');
    }
    return chipName;
  }

  function _escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _renderChipNameHtml(label) {
    var text = String(label || '').trim();
    if (!text) return '';
    var parts = text.split(/\s*\+\s*/);
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      if (i > 0) out += '<span class="chipNameJoin"> + </span><wbr>';
      out += '<span class="chipNameToken">' + _escapeHtml(parts[i]) + '</span>';
    }
    return out;
  }

  function _truncateCraftCardLabel(label, maxLen) {
    var text = label || '';
    var limit = Number.isFinite(maxLen) ? maxLen : 0;
    return limit > 0 && text.length > limit ? (text.substring(0, Math.max(1, limit - 1)) + '…') : text;
  }

  function _renderCraftSlotCard(iconHtml, fullName, options) {
    var opts = options || {};
    var cardClass = 'chipCraftSlotCard';
    if (opts.extraClass) cardClass += ' ' + opts.extraClass;
    var labelClass = 'chipCraftSlotCard__name' + (opts.labelClass ? (' ' + opts.labelClass) : '');
    var badgeHtml = opts.badgeText
      ? '<span class="chipCraftSlotCard__badge">' + opts.badgeText + '</span>'
      : '';
    var cardLabel = fullName || '';
    return '<div class="' + cardClass + '">' +
      badgeHtml +
      '<div class="chipCraftSlotCard__iconWrap">' + iconHtml + '</div>' +
      '<span class="' + labelClass + '" title="' + _escapeHtml(cardLabel) + '">' + _renderChipNameHtml(_truncateCraftCardLabel(cardLabel, opts.maxLabelLength)) + '</span>' +
      '</div>';
  }

  function _renderCraftRemoveButton(slotIndex) {
    var label = t('triageRemove', 'Удалить');
    return '<button class="chipCraftSlotRemove uiButtonBehavior" data-craft-remove="' + slotIndex + '" type="button" aria-label="' + label + '" title="' + label + '">' +
      '<span class="chipCraftSlotRemove__icon" aria-hidden="true"></span>' +
      '</button>';
  }

  /**
   * Add an inventory item to the craft slot. Auto-switches mode based on item type:
   * - chip → disassemble mode, fragment → assemble mode.
   */
  function _addItemToSlot(itemEl, srcType) {
    if (srcType === 'chip') {
      /* Auto-switch to disassemble mode when dragging/clicking a whole chip */
      if (_craftMode !== 'disassemble') {
        _craftMode = 'disassemble';
        _craftSlots = [];
      }
      var chipId = parseInt(itemEl.getAttribute('data-craft-chip-id'), 10);
      var chipLevel = parseInt(itemEl.getAttribute('data-craft-chip-level'), 10) || 1;
      var chips = ensurePlayerChips();
      var chipEntry = null;
      for (var ci = 0; ci < chips.length; ci++) {
        if (chips[ci].chipId === chipId && chips[ci].level === chipLevel && chips[ci].count > 0) {
          chipEntry = chips[ci]; break;
        }
      }
      if (!chipEntry) return;
      /* Check how many of this chip type are already in slots */
      var alreadyInSlots = 0;
      for (var si = 0; si < _craftSlots.length; si++) {
        if (_craftSlots[si] && _craftSlots[si].chipId === chipId && _craftSlots[si].level === chipLevel) {
          alreadyInSlots++;
        }
      }
      if (alreadyInSlots >= chipEntry.count) {
        if (global.Game && global.Game.Toast) global.Game.Toast.show(t('chipCraftNoMoreOfThis', 'Все экземпляры этого чипа уже добавлены'), 1500);
        return;
      }
      _craftSlots.push({ type: 'chip', chipId: chipEntry.chipId, chipColor: chipEntry.chipColor, modIds: chipEntry.modIds.slice(), sourceComboKey: chipEntry.sourceComboKey, level: chipEntry.level });
    } else if (srcType === 'fragment') {
      /* Auto-switch to assemble mode when dragging/clicking a fragment */
      if (_craftMode !== 'assemble') {
        _craftMode = 'assemble';
        _resetCraftSlots();
      }
      var fragId = parseInt(itemEl.getAttribute('data-craft-frag-id'), 10);
      var hasChip = _craftSlots.some(function (s) { return s && s.type === 'chip'; });
      if (hasChip) { _resetCraftSlots(); }
      /* Validate fragment compatibility */
      if (!_canAddFragment(fragId)) {
        if (global.Game && global.Game.Toast) global.Game.Toast.show(t('chipCraftFragInvalid', 'Этот фрагмент нельзя добавить (невалидная комбинация)'), 1500);
        return;
      }
      /* Check player has enough of this fragment */
      var playerFrags2 = ensurePlayerFragments();
      var fragEntry2 = null;
      for (var fi2 = 0; fi2 < playerFrags2.length; fi2++) {
        if (playerFrags2[fi2].fragmentId === fragId) { fragEntry2 = playerFrags2[fi2]; break; }
      }
      if (!fragEntry2 || fragEntry2.count <= 0) return;
      var alreadyUsed = 0;
      for (var si2 = 0; si2 < 3; si2++) {
        if (_craftSlots[si2] && _craftSlots[si2].type === 'fragment' && _craftSlots[si2].fragmentId === fragId) alreadyUsed++;
      }
      if (alreadyUsed >= fragEntry2.count) {
        if (global.Game && global.Game.Toast) global.Game.Toast.show(t('chipCraftNoMoreFrags', 'Все экземпляры этого фрагмента уже добавлены'), 1500);
        return;
      }
      var emptyIdx = -1;
      for (var si = 0; si < 3; si++) {
        if (!_craftSlots[si]) { emptyIdx = si; break; }
      }
      if (emptyIdx === -1) {
        if (global.Game && global.Game.Toast) global.Game.Toast.show(t('chipCraftSlotsFull', 'Все 3 слота заняты'), 1500);
        return;
      }
      _craftSlots[emptyIdx] = { type: 'fragment', fragmentId: fragId };
    } else {
      return;
    }
    renderChipCraftPanel();
  }

  /** Render the chip crafting panel */
  function renderChipCraftPanel() {
    var panel = _workshopSubTab === 'chipRecycle'
      ? el('workshopPanelChipRecycle')
      : el('workshopPanelChipCraft');
    if (!panel) return;
    var h = hc();
    if (!h) { panel.innerHTML = '<div class="chipUpgradeEmptyLabel">Модуль не загружен</div>'; return; }

    var isRecyclePanel = _workshopSubTab === 'chipRecycle';
    var recycleMode = _chipRecycleSubTab === 'disassemble' ? 'disassemble' : 'dust';
    var isDustView = isRecyclePanel && recycleMode === 'dust';
    var isDisassembleView = isRecyclePanel && recycleMode === 'disassemble';
    var isAssembleView = !isRecyclePanel;
    var showChipItems = isDisassembleView || isDustView;
    var showFragmentItems = isAssembleView || isDustView;

    _dustMode = isDustView;
    if (isAssembleView) _craftMode = 'assemble';
    if (isDisassembleView) _craftMode = 'disassemble';

    var html = '';
    if (isRecyclePanel) {
      html += '<div class="workshopSubTabs workshopSubTabs--nested" role="tablist" aria-label="' + _escapeHtml(t('workshopTabChipRecycle', 'Переработка чипов')) + '">';
      html += '<button id="chipRecycleTabDust" class="btn scButton workshopSubTab workshopSubTab--nested' + (isDustView ? ' workshopSubTab--active' : '') + '" type="button" role="tab" aria-selected="' + (isDustView ? 'true' : 'false') + '" aria-controls="workshopPanelChipRecycle" tabindex="' + (isDustView ? '0' : '-1') + '" data-i18n="chipCraftDustBtn">' + t('chipCraftDustBtn', 'Распылить') + '</button>';
      html += '<button id="chipRecycleTabDisassemble" class="btn scButton workshopSubTab workshopSubTab--nested' + (isDisassembleView ? ' workshopSubTab--active' : '') + '" type="button" role="tab" aria-selected="' + (isDisassembleView ? 'true' : 'false') + '" aria-controls="workshopPanelChipRecycle" tabindex="' + (isDisassembleView ? '0' : '-1') + '" data-i18n="chipCraftDisassemble">' + t('chipCraftDisassemble', 'Разобрать') + '</button>';
      html += '</div>';
    }

    html += '<div class="chipCraftLayout' + (isDustView ? ' chipCraftLayout--singleCol' : '') + '">';

    /* ── Left column: wrapper for inventory box + bottom bar ── */
    html += '<div class="chipCraftLeftCol">';

    /* ── Left column: Inventory of fragments / whole chips ── */
    html += '<div class="chipCraftInventory">';
    html += '<div class="chipCraftInvGrid">';

    var displayedItems = 0;

    var playerChips = ensurePlayerChips();
    if (showChipItems) {
      for (var ci = 0; ci < playerChips.length; ci++) {
        var pc = playerChips[ci];
        if (pc.count <= 0) continue;
        displayedItems++;
        var borderColor = pc.chipColor === 'red' ? '#e53935' : '#fdd835';
        var chipName = _getChipDisplayName(pc);
        var dustKey = 'chip_' + pc.chipId + '_' + pc.level;
        var dustSel = _dustSelected[dustKey] || 0;
        html += '<div class="chipCraftInvItem' + (isDustView && dustSel > 0 ? ' chipCraftInvItem--dustSelected' : '') +
          '" data-craft-src="chip" data-craft-chip-id="' + pc.chipId + '" data-craft-chip-level="' + pc.level + '">';
        if (isDustView) {
          html += '<label class="chipCraftDustCheck"><input type="checkbox" data-dust-key="' + dustKey + '" data-dust-type="chip" data-dust-max="' + pc.count + '"' +
            (dustSel > 0 ? ' checked' : '') + '><span class="chipCraftDustCheckmark"></span></label>';
          if (dustSel > 0 && pc.count > 1) {
            html += '<span class="chipCraftDustCount">' + dustSel + '/' + pc.count + '</span>';
          }
        }
        html += chipSvgComposed(40, 36, borderColor, pc.modIds, 'chipCraftInvIcon', 2.5);
        html += '<span class="chipCraftInvLabel" title="' + _escapeHtml(chipName) + '">' + _renderChipNameHtml(chipName) + '</span>';
        html += '<span class="chipCraftInvLevel">Ур. ' + pc.level + '</span>';
        html += '</div>';
      }
    }

    var playerFrags = ensurePlayerFragments();
    if (showFragmentItems) {
      for (var fi = 0; fi < playerFrags.length; fi++) {
        var frag = playerFrags[fi];
        if (frag.count <= 0) continue;
        displayedItems++;
        var fragStroke = (h && h.isSpecialMod(frag.fragmentId)) ? '#fdd835' : '#e53935';
        var fragName = modName(frag.fragmentId);
        var dustKeyF = 'frag_' + frag.fragmentId;
        var dustSelF = _dustSelected[dustKeyF] || 0;
        var fragCanAdd = isAssembleView && !isDustView ? _canAddFragment(frag.fragmentId) : true;
        var fragHighlightClass = '';
        if (isAssembleView && !isDustView) {
          fragHighlightClass = fragCanAdd ? ' chipCraftInvItem--canAdd' : ' chipCraftInvItem--cantAdd';
        }
        html += '<div class="chipCraftInvItem chipCraftInvItem--fragment' + (isDustView && dustSelF > 0 ? ' chipCraftInvItem--dustSelected' : '') + fragHighlightClass +
          '" data-craft-src="fragment" data-craft-frag-id="' + frag.fragmentId + '">';
        if (isDustView) {
          html += '<label class="chipCraftDustCheck"><input type="checkbox" data-dust-key="' + dustKeyF + '" data-dust-type="fragment" data-dust-max="' + frag.count + '"' +
            (dustSelF > 0 ? ' checked' : '') + '><span class="chipCraftDustCheckmark"></span></label>';
          if (dustSelF > 0 && frag.count > 1) {
            html += '<span class="chipCraftDustCount">' + dustSelF + '/' + frag.count + '</span>';
          }
        }
        html += _fragmentSvg(frag.fragmentId, 22, fragStroke);
        html += '<span class="chipCraftInvLabel" title="' + _escapeHtml(fragName) + '">' + _renderChipNameHtml(fragName) + '</span>';
        html += '<span class="chipCraftInvLevel">×' + frag.count + '</span>';
        html += '</div>';
      }
    }

    if (!displayedItems) {
      html += '<div class="chipUpgradeEmptyLabel" style="padding:20px 0">' + t('chipCraftNoItems', 'Нет чипов или фрагментов') + '</div>';
    }

    html += '</div>'; // chipCraftInvGrid

    html += '</div>'; // chipCraftInventory

    /* ── Bottom bar outside inventory: dust controls + silicon dust display ── */
    html += '<div class="chipCraftBottomBar">';
    html += '<span class="chipCraftDustResource">' + t('chipCraftSiliconDust', 'Кремниевая пыль') + ': <b>' + _siliconDust + '</b></span>';
    if (isDustView) {
      html += '<div class="chipCraftDustActions">';
      html += '<button class="btn scButton chipCraftDustConfirmBtn" id="chipCraftDustConfirm" type="button">' + t('chipCraftDustConfirm', 'Подтвердить') + '</button>';
      html += '<button class="btn scButton chipCraftDustCancelBtn" id="chipCraftDustCancel" type="button">' + t('chipCraftDustCancel', 'Отменить') + '</button>';
      var dustTotal = _calcDustTotal();
      html += '<span class="chipCraftDustTotal" id="chipCraftDustTotal">' +
        t('chipCraftDustResult', 'Получите кремниевой пыли: {amount}').replace('{amount}', dustTotal) + '</span>';
      html += '</div>';
    }
    html += '</div>'; // chipCraftBottomBar

    html += '</div>'; // chipCraftLeftCol

    if (!isDustView) {
      /* ── Right column: Craft preview area ── */
      html += '<div class="chipCraftPreview">';
      html += '<div class="chipCraftDropZone" id="chipCraftDropZone">';
      var hasContent = false;
      var slotsLen = _craftSlots.length;
      for (var si = 0; si < slotsLen; si++) {
        if (_craftSlots[si]) { hasContent = true; break; }
      }
      if (hasContent) {
        if (isDisassembleView) {
          /* Dynamic disassemble slots: show all chips + one empty "+" slot */
          html += '<div class="chipCraftSlotRow chipCraftSlotRow--disassemble">';
          for (var sj = 0; sj < _craftSlots.length; sj++) {
            var slot = _craftSlots[sj];
            if (!slot) continue;
            var slotChipName = _getChipDisplayName(slot);
            html += '<div class="chipCraftSlot chipCraftSlot--filled" data-craft-slot-idx="' + sj + '" data-hct-chip-id="' + slot.chipId + '" data-hct-chip-level="' + (slot.level || 1) + '">';
            var sc = slot.chipColor === 'red' ? '#e53935' : '#fdd835';
            html += _renderCraftSlotCard(
              chipSvgComposed(60, 54, sc, slot.modIds, 'chipCraftSlotIcon', 3),
              slotChipName,
              {
                badgeText: t('workshopChipLevelLabel', 'Ур.') + ' ' + (slot.level || 1),
                extraClass: 'chipCraftSlotCard--chip'
              }
            );
            html += _renderCraftRemoveButton(sj);
            html += '</div>';
          }
          /* Always show one empty "+" slot at the end */
          html += '<div class="chipCraftSlot chipCraftSlot--addMore">';
          html += '<div class="chipCraftSlotEmpty">+</div>';
          html += '</div>';
          html += '</div>';
        } else {
          /* Assemble mode: 3 fixed slots + inline arrow + result chip in one row */
          var assemblePreview = _previewAssembleResult();
          html += '<div class="chipCraftSlotRow chipCraftSlotRow--withResult">';
          for (var sj2 = 0; sj2 < 3; sj2++) {
            if (sj2 > 0) {
              html += '<div class="chipCraftSlotSep">+</div>';
            }
            var slot2 = _craftSlots[sj2];
            var slotDataAttr2 = (slot2 && slot2.type === 'fragment') ? ' data-hct-frag-id="' + slot2.fragmentId + '"' : '';
            html += '<div class="chipCraftSlot' + (slot2 ? ' chipCraftSlot--filled' : '') + '" data-craft-slot-idx="' + sj2 + '"' + slotDataAttr2 + '>';
            if (slot2) {
              if (slot2.type === 'chip') {
                var sc2 = slot2.chipColor === 'red' ? '#e53935' : '#fdd835';
                html += _renderCraftSlotCard(
                  chipSvgComposed(60, 54, sc2, slot2.modIds, 'chipCraftSlotIcon', 3),
                  _getChipDisplayName(slot2),
                  {
                    badgeText: t('workshopChipLevelLabel', 'Ур.') + ' ' + (slot2.level || 1),
                    extraClass: 'chipCraftSlotCard--chip'
                  }
                );
              } else if (slot2.type === 'fragment') {
                var fSc = (h && h.isSpecialMod(slot2.fragmentId)) ? '#fdd835' : '#e53935';
                html += _renderCraftSlotCard(
                  _fragmentSvg(slot2.fragmentId, 50, fSc),
                  modName(slot2.fragmentId),
                  { extraClass: 'chipCraftSlotCard--fragment', maxLabelLength: 15 }
                );
              }
              html += _renderCraftRemoveButton(sj2);
            } else {
              html += '<div class="chipCraftSlotEmpty">+</div>';
            }
            html += '</div>';
          }
          /* Arrow separator */
          html += '<div class="chipCraftSlotSep chipCraftSlotSep--arrow">⇒</div>';
          /* Result chip slot */
          if (assemblePreview) {
            var resultColor = assemblePreview.chipColor === 'red' ? '#e53935' : '#fdd835';
            var resultModIds = assemblePreview.modIds || [];
            var resultModsAttr = resultModIds.join(',');
            var resultColorAttr = assemblePreview.chipColor || '';
            html += '<div class="chipCraftResultChip chipCraftResultChip--future" data-hct-result-modids="' + resultModsAttr + '" data-hct-result-color="' + resultColorAttr + '">';
            var resultChipName = _getChipDisplayName(assemblePreview);
            html += _renderCraftSlotCard(
              chipSvgComposed(60, 54, resultColor, resultModIds, 'chipCraftResultIcon', 3),
              resultChipName,
              {
                extraClass: 'chipCraftSlotCard--chip chipCraftSlotCard--future',
                labelClass: 'chipCraftResultLabel'
              }
            );
            html += '</div>';
          } else {
            html += '<div class="chipCraftSlot chipCraftSlot--resultSlot">';
            html += '<div class="chipCraftSlotEmpty" style="opacity:0.3">?</div>';
            html += '</div>';
          }
          html += '</div>'; // chipCraftSlotRow--withResult

          /* ── Silicon Dust reagent controls (always visible in assemble mode) ── */
          var craftChance = 75 + _craftReagentDust * 5;
          var minusDisabled = _craftReagentDust <= 0;
          var plusDisabled = _craftReagentDust >= 5 || _siliconDust <= _craftReagentDust;
          html += '<div class="chipCraftReagentRow">';
          html += '<span class="chipCraftReagentLabel">' +
            t('chipCraftSiliconDust', 'Кремниевая пыль') + ':</span>';
          html += '<div class="chipCraftReagentControls">';
          html += '<button class="chipCraftReagentBtn" id="chipCraftReagentMinus" type="button"' +
            (minusDisabled ? ' disabled' : '') + '>−</button>';
          html += '<span class="chipCraftReagentAmount">' + _siliconDust + ' / ' + _craftReagentDust + '</span>';
          html += '<button class="chipCraftReagentBtn" id="chipCraftReagentPlus" type="button"' +
            (plusDisabled ? ' disabled' : '') + '>+</button>';
          html += '</div>';
          html += '<span class="chipCraftChanceLabel">' +
            t('chipCraftChance', 'Шанс: {chance}%').replace('{chance}', craftChance) + '</span>';
          html += '</div>';
        }
      } else {
        html += '<div class="chipCraftEmptyPreview">';
        html += '<svg viewBox="0 0 120 108" class="chipCraftPlaceholderSvg">' +
          '<polygon points="60,8 112,100 8,100" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-dasharray="6,3"/>' +
          '<line x1="60" y1="8" x2="60" y2="66" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
          '<line x1="60" y1="66" x2="24" y2="80" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
          '<line x1="60" y1="66" x2="96" y2="80" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
          '</svg>';
        html += '<span class="chipCraftPlaceholderText">' + t('chipCraftDragHere', 'Перетащите чип или фрагменты сюда') + '</span>';
        html += '</div>';
      }
      html += '</div>'; // chipCraftDropZone

      /* ── Action button below drop zone (always visible, disabled when no valid content) ── */
      var slotMode = _detectCraftMode();
      var expectedMode = isDisassembleView ? 'disassemble' : 'assemble';
      var canExec = hasContent && slotMode === expectedMode;
      var execLabel = isDisassembleView
        ? t('chipCraftDisassemble', 'Разобрать')
        : t('chipCraftAssemble', 'Создать чип');
      html += '<button class="btn scButton chipCraftActionBtn' + (!canExec ? ' chipCraftActionBtn--disabled' : '') +
        '" id="chipCraftActionBtn" type="button"' + (!canExec ? ' disabled' : '') + '>' + execLabel + '</button>';

      html += '</div>'; // chipCraftPreview
    }

    html += '</div>'; // chipCraftLayout

    panel.innerHTML = html;

    /* ── Attach event handlers for craft panel ── */
    _attachCraftPanelEvents(panel);
  }

  function _attachCraftPanelEvents(panel) {

    var recycleDustTab = el('chipRecycleTabDust');
    if (recycleDustTab) {
      recycleDustTab.addEventListener('click', function () {
        switchChipRecycleSubTab('dust');
      });
    }
    var recycleDisassembleTab = el('chipRecycleTabDisassemble');
    if (recycleDisassembleTab) {
      recycleDisassembleTab.addEventListener('click', function () {
        switchChipRecycleSubTab('disassemble');
      });
    }

    /* ── Dust mode buttons ── */
    var dustBtn = el('chipCraftDustBtn');
    if (dustBtn) {
      dustBtn.addEventListener('click', function () {
        _dustMode = true;
        _dustSelected = {};
        renderChipCraftPanel();
      });
    }
    var dustConfirm = el('chipCraftDustConfirm');
    if (dustConfirm) {
      dustConfirm.addEventListener('click', function () {
        _executeDust();
      });
    }
    var dustCancel = el('chipCraftDustCancel');
    if (dustCancel) {
      dustCancel.addEventListener('click', function () {
        _dustSelected = {};
        renderChipCraftPanel();
      });
    }

    /* ── Dust checkboxes ── */
    var dustChecks = panel.querySelectorAll('[data-dust-key]');
    for (var di = 0; di < dustChecks.length; di++) {
      dustChecks[di].addEventListener('change', function (evt) {
        var cb = evt.target;
        _toggleDustCheckbox(cb);
      });
    }

    /* ── Dust mode: click anywhere on chip card toggles the checkbox ── */
    if (_dustMode) {
      var dustItems = panel.querySelectorAll('.chipCraftInvItem');
      for (var dii = 0; dii < dustItems.length; dii++) {
        dustItems[dii].addEventListener('click', function (evt) {
          /* If the click was directly on the checkbox input or label, the change event handles it */
          if (evt.target.tagName === 'INPUT') return;
          if (evt.target.closest && evt.target.closest('.chipCraftDustCheck')) return;
          var card = evt.currentTarget;
          var cb = card.querySelector('[data-dust-key]');
          if (!cb) return;
          cb.checked = !cb.checked;
          _toggleDustCheckbox(cb);
        });
      }
    }

    /* ── Mode toggle buttons ── */
    var modeBtns = panel.querySelectorAll('[data-craft-mode-btn]');
    for (var mi = 0; mi < modeBtns.length; mi++) {
      modeBtns[mi].addEventListener('click', function (evt) {
        var newMode = evt.currentTarget.getAttribute('data-craft-mode-btn');
        if (newMode === _craftMode) return;
        _craftMode = newMode;
        _resetCraftSlots();
        renderChipCraftPanel();
      });
    }

    /* ── Click on inventory item → add to craft slot (only when NOT in dust mode) ── */
    /* Auto-switches mode: chip → disassemble, fragment → assemble */
    if (!_dustMode) {
      var invItems = panel.querySelectorAll('.chipCraftInvItem');
      for (var i = 0; i < invItems.length; i++) {
        (function (item) {
          /* ── Click handler (also serves as drag-drop fallback) ── */
          item.addEventListener('click', function (evt) {
            /* Skip if click was on a checkbox */
            if (evt.target.tagName === 'INPUT') return;
            var srcType = item.getAttribute('data-craft-src');
            _addItemToSlot(item, srcType);
          });

          /* ── Pointer-based drag to drop zone ── */
          item.addEventListener('pointerdown', function (evt) {
            if (_dustMode) return;
            if (evt.target.tagName === 'INPUT') return;
            var srcType = item.getAttribute('data-craft-src');
            var startX = evt.clientX, startY = evt.clientY;
            var moved = false;
            var ghost = null;

            function onMove(e) {
              var dx = e.clientX - startX, dy = e.clientY - startY;
              if (!moved && (dx * dx + dy * dy) < 36) return; // 6px threshold
              moved = true;
              if (!ghost) {
                ghost = item.cloneNode(true);
                ghost.className = 'chipCraftInvItem chipCraftDragGhost';
                ghost.style.cssText = 'position:fixed;z-index:10000;pointer-events:none;opacity:0.75;width:72px;';
                _doc.body.appendChild(ghost);
              }
              ghost.style.left = (e.clientX - 36) + 'px';
              ghost.style.top = (e.clientY - 36) + 'px';
            }

            function onUp(e) {
              _doc.removeEventListener('pointermove', onMove);
              _doc.removeEventListener('pointerup', onUp);
              if (ghost) { ghost.remove(); ghost = null; }
              if (!moved) return; // handled by click
              /* Did we drop over chipCraftDropZone? */
              var dropZone = el('chipCraftDropZone');
              if (dropZone) {
                var rect = dropZone.getBoundingClientRect();
                if (e.clientX >= rect.left && e.clientX <= rect.right &&
                    e.clientY >= rect.top && e.clientY <= rect.bottom) {
                  _addItemToSlot(item, srcType);
                }
              }
            }

            _doc.addEventListener('pointermove', onMove);
            _doc.addEventListener('pointerup', onUp);
          });
        })(invItems[i]);
      }
    }

    /* Click on slot remove button → remove from slot */
    var removeButtons = panel.querySelectorAll('[data-craft-remove]');
    for (var ri = 0; ri < removeButtons.length; ri++) {
      removeButtons[ri].addEventListener('click', function (evt) {
        evt.stopPropagation();
        var idx = parseInt(evt.currentTarget.getAttribute('data-craft-remove'), 10);
        if (_craftMode === 'disassemble') {
          /* Dynamic array: splice the item out */
          _craftSlots.splice(idx, 1);
        } else {
          _craftSlots[idx] = null;
        }
        renderChipCraftPanel();
      });
    }

    /* ── Silicon Dust reagent +/- buttons ── */
    var reagentMinus = el('chipCraftReagentMinus');
    if (reagentMinus) {
      reagentMinus.addEventListener('click', function () {
        if (_craftReagentDust > 0) {
          _craftReagentDust--;
          renderChipCraftPanel();
        }
      });
    }
    var reagentPlus = el('chipCraftReagentPlus');
    if (reagentPlus) {
      reagentPlus.addEventListener('click', function () {
        if (_craftReagentDust < 5 && _siliconDust > _craftReagentDust) {
          _craftReagentDust++;
          renderChipCraftPanel();
        }
      });
    }

    /* Click on action button */
    var actionBtn = el('chipCraftActionBtn');
    if (actionBtn) {
      actionBtn.addEventListener('click', function () {
        _executeCraftAction();
      });
    }
  }

  /** Execute dust conversion: destroy selected items, gain silicon dust */
  function _executeDust() {
    var keys = Object.keys(_dustSelected);
    if (!keys.length) {
      if (global.Game && global.Game.Toast) global.Game.Toast.show(t('chipCraftDustNoneSelected', 'Выберите хотя бы один элемент'), 1500);
      return;
    }
    var totalDust = _calcDustTotal();
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var cnt = _dustSelected[k];
      if (k.indexOf('chip_') === 0) {
        var parts = k.split('_');
        var cId = parseInt(parts[1], 10);
        var cLvl = parseInt(parts[2], 10) || 1;
        for (var cc = 0; cc < cnt; cc++) {
          removePlayerChipOne(cId, cLvl);
        }
      } else if (k.indexOf('frag_') === 0) {
        var fId = parseInt(k.split('_')[1], 10);
        removePlayerFragment(fId, cnt);
      }
    }
    _siliconDust += totalDust;
    if (global.Game && global.Game.Toast) {
      global.Game.Toast.show(t('chipCraftDustGained', 'Получено кремниевой пыли: {amount}').replace('{amount}', totalDust), 2000);
    }
    _resetDustMode();
    renderChipCraftPanel();
    renderChipUpgradeGrid();
  }

  /** Execute the craft action (disassemble or assemble) */
  function _executeCraftAction() {
    var h = hc();
    if (!h) return;
    var mode = _detectCraftMode();

    if (mode === 'disassemble') {
      /* Disassemble all chips in the dynamic slots */
      var totalDisassembled = 0;
      for (var di = 0; di < _craftSlots.length; di++) {
        var chipSlot = _craftSlots[di];
        if (!chipSlot || chipSlot.type !== 'chip') continue;

        /* Remove chip from inventory */
        var removed = removePlayerChipOne(chipSlot.chipId, chipSlot.level);
        if (!removed) continue;

        /* Create 3 fragments */
        var frags = h.disassembleChip(chipSlot.modIds);
        for (var fi = 0; fi < frags.length; fi++) {
          addPlayerFragment(frags[fi].fragmentId, 1);
        }
        totalDisassembled++;
      }

      if (totalDisassembled > 0) {
        if (global.Game && global.Game.Toast) {
          var msg = totalDisassembled === 1
            ? t('chipCraftDisassembled', 'Чип разобран на 3 фрагмента!')
            : t('chipCraftDisassembledMultiple', 'Разобрано чипов: {count}, получено фрагментов: {frags}')
              .replace('{count}', totalDisassembled)
              .replace('{frags}', totalDisassembled * 3);
          global.Game.Toast.show(msg, 1800);
        }
      } else {
        if (global.Game && global.Game.Toast) global.Game.Toast.show(t('chipCraftNoChipInv', 'Чип не найден в инвентаре'), 1500);
      }

      _craftSlots = [];
      renderChipCraftPanel();
      renderChipUpgradeGrid();

    } else if (mode === 'assemble') {
      /* Collect 3 fragment modIds */
      var fragModIds = [];
      for (var si = 0; si < 3; si++) {
        if (!_craftSlots[si] || _craftSlots[si].type !== 'fragment') return;
        fragModIds.push(_craftSlots[si].fragmentId);
      }

      /* Try to assemble (validate combo) */
      var result = h.assembleChip(fragModIds);
      if (!result) {
        if (global.Game && global.Game.Toast) global.Game.Toast.show(t('chipCraftInvalidCombo', 'Невозможно создать чип из этих фрагментов'), 1800);
        return;
      }

      /* Validate silicon dust reagent */
      var dustUsed = _craftReagentDust;
      if (dustUsed > 0 && _siliconDust < dustUsed) {
        if (global.Game && global.Game.Toast) global.Game.Toast.show(t('chipCraftNotEnoughDust', 'Недостаточно кремниевой пыли'), 1800);
        return;
      }

      /* Consume silicon dust reagent */
      if (dustUsed > 0) _siliconDust -= dustUsed;

      /* Remove 3 fragments from inventory */
      for (var ri = 0; ri < fragModIds.length; ri++) {
        removePlayerFragment(fragModIds[ri], 1);
      }

      /* Roll craft chance: base 75% + 5% per dust unit */
      var craftChancePct = 0.75 + dustUsed * 0.05;
      if (Math.random() > craftChancePct) {
        /* Craft failed — fragments and dust already consumed */
        if (global.Game && global.Game.Toast) {
          global.Game.Toast.show(t('chipCraftFailed', 'Создание чипа провалилось. Фрагменты не подлежат восстановлению'), 5000);
        }
        _resetCraftSlots();
        renderChipCraftPanel();
        renderChipUpgradeGrid();
        return;
      }

      /* Resolve chipDef — if result.chipId === -1, find or create */
      var chipDef = result;
      if (result.chipId === -1) {
        var found = h.getChipByKey(h.allChips, result.sourceComboKey);
        if (found) chipDef = found;
      }

      /* Add assembled chip to inventory at level 1 */
      addPlayerChip(chipDef, 1);

      if (global.Game && global.Game.Toast) {
        global.Game.Toast.show(t('chipCraftAssembled', 'Чип «{key}» создан!').replace('{key}', chipDef.sourceComboKey), 1800);
      }

      _resetCraftSlots();
      renderChipCraftPanel();
      renderChipUpgradeGrid();
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
      /* tooltip hover events for chip upgrade cards */
      overlay.addEventListener('mouseover', function(evt) {
        var tgt = evt.target;
        if (!tgt || !tgt.closest) return;
        /* Chip upgrade grid cards */
        var card = tgt.closest('[data-chip-upgrade-id]');
        if (card) { showChipUpgradeTooltip(evt); return; }
        /* Hangar inventory chip buttons (available chips list) */
        var chipBtn = tgt.closest('.hangarChipBtn[data-chip-id]');
        if (chipBtn) { showHangarChipBtnTooltip(chipBtn); return; }
        /* Craft panel inventory items */
        var craftItem = tgt.closest('.chipCraftInvItem');
        if (craftItem) {
          if (craftItem.getAttribute('data-craft-chip-id')) { showCraftInvChipTooltip(craftItem); return; }
          if (craftItem.getAttribute('data-craft-frag-id')) { showCraftInvFragTooltip(craftItem); return; }
        }
        /* Craft preview result chip (assemble preview) */
        var resultChip = tgt.closest('.chipCraftResultChip');
        if (resultChip) { showCraftResultTooltip(resultChip); return; }
        /* Craft drop zone slots */
        var slotChip = tgt.closest('[data-hct-chip-id]');
        if (slotChip) { showCraftSlotChipTooltip(slotChip); return; }
        var slotFrag = tgt.closest('[data-hct-frag-id]');
        if (slotFrag) { showCraftSlotFragTooltip(slotFrag); return; }
        /* Task 5: tooltip for chips installed in SVG slot triangles */
        var slotPoly = tgt.closest('[data-slot-type]');
        if (slotPoly) { _showSlotChipTooltip(evt, slotPoly); return; }
        /* Moved over non-trigger area — hide game tooltip */
        hideChipUpgradeTooltip();
      });
      overlay.addEventListener('mousemove', function(evt) {
        /* Task 5: update tooltip position when moving over slot */
        if (_slotTooltipEl && _slotTooltipEl.style.display !== 'none') {
          var slotPoly = evt.target.closest ? evt.target.closest('[data-slot-type]') : null;
          if (slotPoly) {
            _slotTooltipEl.style.left = Math.min(evt.clientX + 12, global.innerWidth - 260) + 'px';
            _slotTooltipEl.style.top = Math.max(0, evt.clientY + 16) + 'px';
          }
        }
      });
      overlay.addEventListener('mouseout', function(evt) {
        var tgt = evt.target;
        var rel = evt.relatedTarget;
        if (!tgt || !tgt.closest) return;
        /* If leaving any known game-tooltip trigger element, hide when not entering another one */
        var leavingTrigger =
          tgt.closest('[data-chip-upgrade-id]') ||
          tgt.closest('.hangarChipBtn[data-chip-id]') ||
          tgt.closest('.chipCraftInvItem') ||
          tgt.closest('.chipCraftResultChip') ||
          tgt.closest('[data-hct-chip-id]') ||
          tgt.closest('[data-hct-frag-id]');
        if (leavingTrigger) {
          var staysInTrigger = rel && rel.closest && (
            rel.closest('[data-chip-upgrade-id]') ||
            rel.closest('.hangarChipBtn[data-chip-id]') ||
            rel.closest('.chipCraftInvItem') ||
            rel.closest('.chipCraftResultChip') ||
            rel.closest('[data-hct-chip-id]') ||
            rel.closest('[data-hct-frag-id]')
          );
          if (!staysInTrigger) hideChipUpgradeTooltip();
        }
        /* Task 5: hide slot tooltip */
        var slotPoly = tgt.closest('[data-slot-type]');
        if (slotPoly && rel && !slotPoly.contains(rel)) _hideSlotChipTooltip();
        if (!slotPoly) _hideSlotChipTooltip();
      });

      /* ─── Chip drag-and-drop (merge + install into slots) ──── */
      var _slotDragging = null; // { chipId, level, chipColor, startX, startY, ghostEl, sourceEl }

      overlay.addEventListener('pointerdown', function(evt) {
        /* Check for chip button in inventory (for slot installation) */
        var chipBtn = evt.target.closest ? evt.target.closest('[data-chip-id]') : null;
        if (chipBtn && !evt.target.closest('[data-drag-chip-id]')) {
          var sid = parseInt(chipBtn.getAttribute('data-chip-id'), 10);
          var slvl = parseInt(chipBtn.getAttribute('data-chip-level'), 10) || 1;
          if (!Number.isFinite(sid)) return;

          var chips2 = ensurePlayerChips();
          var invE = null;
          for (var ii = 0; ii < chips2.length; ii++) {
            if (chips2[ii].chipId === sid && chips2[ii].level === slvl && chips2[ii].count > 0) {
              invE = chips2[ii]; break;
            }
          }
          if (!invE) return;

          evt.preventDefault();
          var ghost2 = _doc.createElement('div');
          ghost2.className = 'chipDragGhost';
          ghost2.innerHTML = chipBtn.innerHTML;
          ghost2.style.position = 'fixed';
          ghost2.style.left = evt.clientX + 'px';
          ghost2.style.top = evt.clientY + 'px';
          ghost2.style.pointerEvents = 'none';
          ghost2.style.zIndex = '99999';
          ghost2.style.opacity = '0.85';
          ghost2.style.transform = 'translate(-50%, -50%) scale(1.1)';
          _doc.body.appendChild(ghost2);

          _slotDragging = {
            chipId: sid,
            level: slvl,
            chipColor: invE.chipColor,
            startX: evt.clientX,
            startY: evt.clientY,
            moved: false,
            ghostEl: ghost2,
            sourceEl: chipBtn
          };
          return;
        }

        var card = evt.target.closest ? evt.target.closest('[data-drag-chip-id]') : null;
        if (!card) return;
        var chipId = parseInt(card.getAttribute('data-drag-chip-id'), 10);
        var level = parseInt(card.getAttribute('data-drag-chip-level'), 10);
        if (!Number.isFinite(chipId) || !Number.isFinite(level)) return;

        /* Only allow dragging chips that have a matching entry for merge */
        var chips = ensurePlayerChips();
        var matchCount = 0;
        for (var mi = 0; mi < chips.length; mi++) {
          if (chips[mi].chipId === chipId && chips[mi].level === level) matchCount++;
          if (matchCount >= 2) break;
        }
        if (matchCount < 2) return;

        evt.preventDefault();

        /* Create ghost element */
        var ghost = _doc.createElement('div');
        ghost.className = 'chipDragGhost';
        ghost.innerHTML = card.innerHTML;
        ghost.style.position = 'fixed';
        ghost.style.left = evt.clientX + 'px';
        ghost.style.top = evt.clientY + 'px';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '99999';
        ghost.style.opacity = '0.85';
        ghost.style.transform = 'translate(-50%, -50%) scale(1.1)';
        _doc.body.appendChild(ghost);

        card.classList.add('chipUpgradeCard--dragging');

        _chipDragging = {
          chipId: chipId,
          level: level,
          startX: evt.clientX,
          startY: evt.clientY,
          x: evt.clientX,
          y: evt.clientY,
          moved: false,
          ghostEl: ghost,
          sourceEl: card
        };
      });

      overlay.addEventListener('pointermove', function(evt) {
        /* Handle slot-install drag */
        if (_slotDragging) {
          var sdx = evt.clientX - _slotDragging.startX;
          var sdy = evt.clientY - _slotDragging.startY;
          if (Math.abs(sdx) + Math.abs(sdy) > 6) _slotDragging.moved = true;
          if (_slotDragging.ghostEl) {
            _slotDragging.ghostEl.style.left = evt.clientX + 'px';
            _slotDragging.ghostEl.style.top = evt.clientY + 'px';
          }
          /* Highlight slot polygons */
          var allPolys = overlay.querySelectorAll('[data-slot-type]');
          for (var pi = 0; pi < allPolys.length; pi++) {
            var poly = allPolys[pi];
            var sr = poly.getBoundingClientRect();
            var hit2 = evt.clientX >= sr.left && evt.clientX <= sr.right &&
                       evt.clientY >= sr.top && evt.clientY <= sr.bottom;
            if (hit2 && poly.getAttribute('data-slot-type') === _slotDragging.chipColor) {
              poly.style.filter = 'brightness(1.5)';
              poly.style.strokeWidth = '4';
            } else {
              poly.style.filter = '';
              poly.style.strokeWidth = '';
            }
          }
          return;
        }
        if (!_chipDragging) return;
        _chipDragging.x = evt.clientX;
        _chipDragging.y = evt.clientY;
        var dx = _chipDragging.x - _chipDragging.startX;
        var dy = _chipDragging.y - _chipDragging.startY;
        if (Math.abs(dx) + Math.abs(dy) > 6) _chipDragging.moved = true;
        if (_chipDragging.ghostEl) {
          _chipDragging.ghostEl.style.left = evt.clientX + 'px';
          _chipDragging.ghostEl.style.top = evt.clientY + 'px';
        }

        /* Highlight potential drop targets */
        var allCards = overlay.querySelectorAll('[data-drag-chip-id]');
        for (var i = 0; i < allCards.length; i++) {
          var c = allCards[i];
          if (c === _chipDragging.sourceEl) continue;
          var cId = parseInt(c.getAttribute('data-drag-chip-id'), 10);
          var cLvl = parseInt(c.getAttribute('data-drag-chip-level'), 10);
          var rect = c.getBoundingClientRect();
          var hit = evt.clientX >= rect.left && evt.clientX <= rect.right &&
                    evt.clientY >= rect.top && evt.clientY <= rect.bottom;
          if (hit && cId === _chipDragging.chipId && cLvl === _chipDragging.level) {
            c.classList.add('chipUpgradeCard--dropTarget');
          } else {
            c.classList.remove('chipUpgradeCard--dropTarget');
          }
        }
      });

      overlay.addEventListener('pointerup', function(evt) {
        /* Handle slot-install drop */
        if (_slotDragging) {
          var sd = _slotDragging;
          _slotDragging = null;
          if (sd.ghostEl && sd.ghostEl.parentNode) sd.ghostEl.parentNode.removeChild(sd.ghostEl);
          /* Reset polygon styles */
          var allPolys2 = overlay.querySelectorAll('[data-slot-type]');
          for (var pi2 = 0; pi2 < allPolys2.length; pi2++) {
            allPolys2[pi2].style.filter = '';
            allPolys2[pi2].style.strokeWidth = '';
          }
          if (!sd.moved) return;

          /* Find slot under pointer */
          var hitEl = _doc.elementFromPoint(evt.clientX, evt.clientY);
          var slotPoly = hitEl ? (hitEl.closest ? hitEl.closest('[data-slot-type]') : null) : null;
          if (!slotPoly) return;

          var slotType = slotPoly.getAttribute('data-slot-type');
          var slotId = slotPoly.getAttribute('data-slot-id');
          if (slotType !== sd.chipColor) {
            if (global.Game && global.Game.Toast) global.Game.Toast.show(t('hangarChipsColorMismatch', 'Цвет чипа не совпадает со слотом'), 1500);
            return;
          }

          var cells = ensureCells();
          var cell = cells[_selectedCell];
          if (!cell) return;

          /* Check if yellow locked */
          if (slotType === 'yellow' && cell.uiState.yellowLocked && cell.uiState.activeYellowSlotId !== slotId) {
            if (global.Game && global.Game.Toast) global.Game.Toast.show(t('hangarChipsYellowLocked', 'Можно установить только 1 жёлтый чип'), 1500);
            return;
          }

          var h2 = hc();
          if (!h2) return;

          /* If slot occupied, return existing chip to inventory */
          var existingChip = slotType === 'red' ? cell.redSlots[slotId] : cell.yellowSlots[slotId];
          if (existingChip) {
            var existDef = h2.getChipById(h2.allChips, existingChip.chipId);
            if (existDef) {
              addPlayerChip({
                chipId: existDef.chipId,
                chipColor: existDef.chipColor,
                modIds: existingChip.modIds || existDef.modIds,
                sourceComboKey: existingChip.sourceComboKey || existDef.sourceComboKey
              }, existingChip.level || 1);
            }
            h2.removeChip(cell, slotType, slotId);
          }

          /* Install new chip */
          var chipDef = h2.getChipById(h2.allChips, sd.chipId);
          if (!chipDef) return;
          var chips3 = ensurePlayerChips();
          var invE2 = null;
          for (var i3 = 0; i3 < chips3.length; i3++) {
            if (chips3[i3].chipId === sd.chipId && chips3[i3].level === sd.level && chips3[i3].count > 0) {
              invE2 = chips3[i3]; break;
            }
          }
          if (!invE2) return;
          var ok2 = h2.installChip(cell, slotType, slotId, chipDef, sd.level, invE2.modIds);
          if (ok2) {
            removePlayerChipOne(sd.chipId, sd.level);
            _selectedSlot = null;
            render();
          }
          return;
        }

        if (!_chipDragging) return;
        var drag = _chipDragging;
        _chipDragging = null;

        /* Clean up ghost */
        if (drag.ghostEl && drag.ghostEl.parentNode) {
          drag.ghostEl.parentNode.removeChild(drag.ghostEl);
        }
        if (drag.sourceEl) {
          drag.sourceEl.classList.remove('chipUpgradeCard--dragging');
        }

        /* Remove drop target highlights */
        var allCards = overlay.querySelectorAll('.chipUpgradeCard--dropTarget');
        for (var i = 0; i < allCards.length; i++) {
          allCards[i].classList.remove('chipUpgradeCard--dropTarget');
        }

        if (!drag.moved) return; /* Was just a click, not a drag */

        /* Find target card under pointer */
        var targetCard = _doc.elementFromPoint(evt.clientX, evt.clientY);
        if (targetCard) targetCard = targetCard.closest ? targetCard.closest('[data-drag-chip-id]') : null;
        if (!targetCard || targetCard === drag.sourceEl) return;

        var targetChipId = parseInt(targetCard.getAttribute('data-drag-chip-id'), 10);
        var targetLevel = parseInt(targetCard.getAttribute('data-drag-chip-level'), 10);

        /* Both must be same chipId and same level */
        if (targetChipId === drag.chipId && targetLevel === drag.level) {
          var newLevel = mergeChips(drag.chipId, drag.level);
          if (newLevel > 0) {
            if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
              global.Game.Toast.show(t('workshopChipMerged', 'Чип улучшен до ур. {level}!').replace('{level}', newLevel), 1800);
            }
            renderChipUpgradeGrid();
          }
        } else {
          if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
            global.Game.Toast.show(t('workshopChipMergeFail', 'Можно объединять только одинаковые чипы одного уровня'), 1500);
          }
        }
      });

      overlay.addEventListener('pointerleave', function() {
        if (_slotDragging) {
          if (_slotDragging.ghostEl && _slotDragging.ghostEl.parentNode) _slotDragging.ghostEl.parentNode.removeChild(_slotDragging.ghostEl);
          var allPolys3 = overlay.querySelectorAll('[data-slot-type]');
          for (var pi3 = 0; pi3 < allPolys3.length; pi3++) {
            allPolys3[pi3].style.filter = '';
            allPolys3[pi3].style.strokeWidth = '';
          }
          _slotDragging = null;
        }
        if (_chipDragging) {
          if (_chipDragging.ghostEl && _chipDragging.ghostEl.parentNode) {
            _chipDragging.ghostEl.parentNode.removeChild(_chipDragging.ghostEl);
          }
          if (_chipDragging.sourceEl) {
            _chipDragging.sourceEl.classList.remove('chipUpgradeCard--dragging');
          }
          var allCards = overlay.querySelectorAll('.chipUpgradeCard--dropTarget');
          for (var i = 0; i < allCards.length; i++) {
            allCards[i].classList.remove('chipUpgradeCard--dropTarget');
          }
          _chipDragging = null;
        }
      });
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
    switchWorkshopSubTab: switchWorkshopSubTab,
    getPlayerChips: getPlayerChips,
    setPlayerChips: setPlayerChips,
    addPlayerChip: addPlayerChip,
    removePlayerChipOne: removePlayerChipOne,
    mergeChips: mergeChips,
    chipLevelBonus: chipLevelBonus,
    renderChipUpgradeGrid: renderChipUpgradeGrid,
    renderTechUnlockPanel: renderTechUnlockPanel,
    renderChipCraftPanel: renderChipCraftPanel,
    feedChipsForTech: feedChipsForTech,
    getTechFeedProgress: getTechFeedProgress,
    setTechFeedProgress: setTechFeedProgress,
    getTechStudying: getTechStudying,
    setTechStudying: function(obj) {
      setTechStudying(obj);
      if (_techStudying) _startTechStudyTimer();
    },
    getPlayerFragments: getPlayerFragments,
    setPlayerFragments: setPlayerFragments,
    addPlayerFragment: addPlayerFragment,
    removePlayerFragment: removePlayerFragment,
    getFragmentCount: getFragmentCount,
    getSiliconDust: function () { return _siliconDust; },
    setSiliconDust: function (v) { _siliconDust = (typeof v === 'number' && v >= 0) ? v : 0; },
    debugInstallChipById: debugInstallChipById,
    debugInstallByKey: debugInstallByKey,
    debugRemoveChip: debugRemoveChip,
    debugClearCell: debugClearCell,
    debugGetCellState: debugGetCellState
  };
})(typeof window !== 'undefined' ? window : this);
