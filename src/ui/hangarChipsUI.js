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

  var TECH_ACCEL_MAX_PCT = 96;
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
  var _visualSelectedSlot = null; // { type, slotId } or null (for visible slot outline)
  var _chipFilter = 'all';  // 'all' | 'red' | 'yellow'
  var _activeSlotActions = null; // { type, slotId } — shows action buttons on slot
  var _initialized = false;
  var _doc = null;
  var _activeHangarTab = 'cells';
  var _workshopSubTab = 'chipUpgrade';
  var _chipRecycleSubTab = 'dust';

  var RED_SLOT_KEYS = ['slot1', 'slot2'];
  var YELLOW_SLOT_MATCH_MAP = {
    slot1: { redSlot: 'slot1', innerAKey: 'A', innerBKey: 'C' },
    slot2: { redSlot: 'slot2', innerAKey: 'A', innerBKey: 'C' },
    slot3: { redSlot: 'slot1', innerAKey: 'B', innerBKey: 'C' },
    slot4: { redSlot: 'slot2', innerAKey: 'B', innerBKey: 'C' }
  };

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

  function getHangarHelpSectionTitle(tabId) {
    if (tabId === 'techUnlock') return t('hangarChipsTabTechUnlock', 'Открытие технологий');
    if (tabId === 'workshop') return t('hangarChipsTabWorkshop', 'Мастерская');
    return t('hangarChipsTabCells', 'Улучшение ячеек');
  }

  function getWorkshopHelpText() {
    if (_workshopSubTab === 'chipUpgrade') {
      return t('hangarWorkshopHelpChipUpgradeText', 'В этом разделе Вы можете повышать уровень чипов за счёт объединения двух одинаковых чипов. Каждое повышения уровня чипа даёт бонус к силе атаки танка');
    }
    if (_workshopSubTab === 'chipCraft') {
      return t('hangarWorkshopHelpChipCraftText', 'В этом разделе Вы можете создавать целые чипы из фрагментов. В случае неудачного создания чипа будет потерян один случайный фрагмент чип. Используйте реагент "Кремниевая пыль" для того чтобы увеличить шанс создания целого чипа и избежать потери фрагмента.');
    }
    if (_chipRecycleSubTab === 'disassemble') {
      return t('hangarWorkshopHelpChipRecycleDisassembleText', 'В этом разделе Вы разобрать большие чипы на фрагменты. При разборе большого чипа на фрагменты Вы получаете 3 фрагмента чипа, из которых он состоял.');
    }
    if (_chipRecycleSubTab === 'reprogram') {
      return t('hangarWorkshopHelpChipRecycleReprogramText', 'В этом разделе Вы изменить текущую модификацию фрагмента чипа на любую другую за счёт перепрограммирования. Обязательно требуется наличие "Кремниевая пыль" в качестве реагента.');
    }
    return t('hangarWorkshopHelpChipRecycleDustText', 'В этом разделе Вы можете создавать реагент "Кремниевая пыль" за счёт распыления целых чипов или фрагментов чипов.');
  }

  function getHangarHelpText(tabId) {
    if (tabId === 'techUnlock') {
      return t('techUnlockHelpText', 'В этом разделе Вы можете усовершенствовать любой модификатор чипа. После изучения новой технологии будут усовершенствованы все чипы:\n- фрагменты чипов, которые есть в инвентаре\n- целые чипы, которые есть в инвентаре или вставлены в слоты\n- фрагменты чипов, которые будут получены после изучения технологии.\n- целые чипы, которые будут получены после изучения технологии.');
    }
    if (tabId === 'workshop') {
      return getWorkshopHelpText();
    }
    return t('hangarCellsHelpText', 'В этом разделе Вы можете усиливать ячейки танков за счёт добавления разных чипов в слоты. Для того чтобы два чипа начали работать в связке, нужно чтобы у них совпали модификаторы на прилегающих сторонах.\nЕсли у Вас в инвентаре будут чипы, которые могут работать в связке, то они выделятся зеленым цветом.\n\nЧипы в красных слотах в связке работают по следующему принципу:\n- первый модификатор срабатывает когда танк совершает выстрел;\n- второй модификатор срабатывает когда снаряд взрывается.\n\nЧип в желтом слоте в связке работает по следующему принципу:\n- модификатор всегда срабатывает на последних взрывах снаряда / снарядов;\n- срабатывает "свободный" модификатор, который не участвует в связке. Это либо "Огненная лужа", либо  "Ледяная зона", либо "Электроузел", либо "Лазерная метка", либо "Кислотная лужа" в зависимости от того, какой у Вас чип.');
  }

  function getActiveHangarHelpConfig() {
    var tabId = _activeHangarTab || 'cells';
    var sectionTitle = getHangarHelpSectionTitle(tabId);
    return {
      tabId: tabId,
      sectionTitle: sectionTitle,
      tooltipLabel: t('techUnlockHelpTitle', 'Справка') + ': ' + sectionTitle,
      text: getHangarHelpText(tabId)
    };
  }

  function modName(modId) {
    var names = MOD_NAMES();
    return names[modId] || ('Mod ' + modId);
  }

  function MOD_NAMES() {
    var lang = (global.Game && global.Game.I18n && global.Game.I18n.currentLang) || 'ru';
    var h = hc();
    if (h && typeof h.syncModNameMaps === 'function') h.syncModNameMaps();
    return lang === 'en' ? (h ? h.MOD_NAMES_EN : {}) : (h ? h.MOD_NAMES_RU : {});
  }

  function modShort(modId) {
    var h = hc();
    return h && h.MOD_SHORT ? (h.MOD_SHORT[modId] || String(modId)) : String(modId);
  }

  function getSlotDisplayLabel(slotType, slotId) {
    for (var i = 0; i < SLOT_DEFS.length; i++) {
      if (SLOT_DEFS[i].type === slotType && SLOT_DEFS[i].slotId === slotId) return SLOT_DEFS[i].label;
    }
    return '';
  }

  function clearSlotSelection() {
    _selectedSlot = null;
    _visualSelectedSlot = null;
  }

  function setInstallSlotSelection(slotType, slotId) {
    _selectedSlot = { type: slotType, slotId: slotId };
    _visualSelectedSlot = { type: slotType, slotId: slotId };
  }

  function setVisualSlotSelection(slotType, slotId) {
    _selectedSlot = null;
    _visualSelectedSlot = { type: slotType, slotId: slotId };
  }

  function activateInstalledSlotActions(slotType, slotId) {
    _selectedSlot = null;
    _visualSelectedSlot = { type: slotType, slotId: slotId };
    _activeSlotActions = { type: slotType, slotId: slotId };
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
    var dotR = Math.max(w, h) >= 54 ? 0 : Math.max(0.9, Math.min(1.25, w / 44));
    if (dotR > 0) {
      var vx = [[ax, ay + 2], [bx - 2, by - 1.5], [cx2 + 2, cy2 - 1.5]];
      for (var vi = 0; vi < 3 && modIds && vi < modIds.length; vi++) {
        var mc = (hc2 && hc2.isSpecialMod(modIds[vi])) ? '#fdd835' : '#e53935';
        svg += '<circle cx="' + vx[vi][0] + '" cy="' + vx[vi][1] + '" r="' + dotR + '" fill="' + mc + '" />';
      }
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

  /* Index of the cell reserved for the Underground Hangar button */
  var UNDERGROUND_HANGAR_CELL = 15;

  function renderGrid() {
    var grid = dom.grid;
    if (!grid) return;
    var cells = ensureCells();
    var html = '';
    for (var i = 0; i < 16; i++) {
      /* Cell 16 (index 15) is the Underground Hangar — locked, no chip slots */
      if (i === UNDERGROUND_HANGAR_CELL) {
        html += '<button class="hangarGridCell hangarGridCell--locked" data-cell-idx="' + i + '" type="button" disabled aria-disabled="true">' +
          '<span class="hangarGridCell__lockOverlay"></span>' +
          '<span class="hangarGridCell__lockIcon">🔒</span>' +
          '</button>';
        continue;
      }

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

  function pointListToString(points) {
    var s = '';
    for (var i = 0; i < points.length; i++) {
      if (i > 0) s += ' ';
      s += points[i][0] + ',' + points[i][1];
    }
    return s;
  }

  function insetTrianglePoints(points, factor) {
    var centroidX = 0;
    var centroidY = 0;
    var t = typeof factor === 'number' ? factor : 0.12;
    var result = [];
    for (var i = 0; i < points.length; i++) {
      centroidX += points[i][0];
      centroidY += points[i][1];
    }
    centroidX /= Math.max(1, points.length);
    centroidY /= Math.max(1, points.length);
    for (var j = 0; j < points.length; j++) {
      result.push([
        points[j][0] + (centroidX - points[j][0]) * t,
        points[j][1] + (centroidY - points[j][1]) * t
      ]);
    }
    return result;
  }

  function buildSlotDecoration(points, isRed, locked, filled) {
    if (!Array.isArray(points) || points.length !== 3) return '';
    var centroidX = (points[0][0] + points[1][0] + points[2][0]) / 3;
    var centroidY = (points[0][1] + points[1][1] + points[2][1]) / 3;
    var innerPoints = insetTrianglePoints(points, filled ? 0.12 : 0.16);
    var outerFill = locked
      ? 'rgba(52,52,52,0.26)'
      : (isRed ? 'rgba(92,26,21,0.28)' : 'rgba(118,88,14,0.28)');
    var facetA = locked
      ? 'rgba(98,98,98,0.10)'
      : (isRed ? 'rgba(255,160,142,0.14)' : 'rgba(255,236,148,0.14)');
    var facetB = locked
      ? 'rgba(38,38,38,0.24)'
      : (isRed ? 'rgba(64,18,14,0.30)' : 'rgba(88,66,12,0.30)');
    var facetC = locked
      ? 'rgba(74,74,74,0.12)'
      : (isRed ? 'rgba(184,56,46,0.16)' : 'rgba(214,176,40,0.16)');
    var seamStroke = locked
      ? 'rgba(180,180,180,0.08)'
      : (isRed ? 'rgba(255,180,164,0.14)' : 'rgba(255,241,170,0.14)');
    var centerFill = locked
      ? 'rgba(28,28,28,0.32)'
      : (isRed ? 'rgba(25,8,8,0.30)' : 'rgba(28,20,6,0.30)');

    return '' +
      '<polygon points="' + pointListToString(points) + '" fill="' + outerFill + '" pointer-events="none" />' +
      '<polygon points="' + points[0][0] + ',' + points[0][1] + ' ' + points[1][0] + ',' + points[1][1] + ' ' + centroidX + ',' + centroidY + '" fill="' + facetA + '" stroke="' + seamStroke + '" stroke-width="1" pointer-events="none" />' +
      '<polygon points="' + points[1][0] + ',' + points[1][1] + ' ' + points[2][0] + ',' + points[2][1] + ' ' + centroidX + ',' + centroidY + '" fill="' + facetB + '" stroke="' + seamStroke + '" stroke-width="1" pointer-events="none" />' +
      '<polygon points="' + points[2][0] + ',' + points[2][1] + ' ' + points[0][0] + ',' + points[0][1] + ' ' + centroidX + ',' + centroidY + '" fill="' + facetC + '" stroke="' + seamStroke + '" stroke-width="1" pointer-events="none" />' +
      '<polygon points="' + pointListToString(innerPoints) + '" fill="' + centerFill + '" stroke="' + seamStroke + '" stroke-width="1" pointer-events="none" />';
  }

  function buildRotateArrowIcon(cx, cy, direction) {
    var points = direction < 0
      ? (cx + 4) + ',' + (cy - 6) + ' ' + (cx - 5) + ',' + cy + ' ' + (cx + 4) + ',' + (cy + 6)
      : (cx - 4) + ',' + (cy - 6) + ' ' + (cx + 5) + ',' + cy + ' ' + (cx - 4) + ',' + (cy + 6);
    return '<polygon class="hangarSlotActionIcon" points="' + points + '" fill="#4af626" pointer-events="none" />';
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
      var selected = _visualSelectedSlot && _visualSelectedSlot.type === def.type && _visualSelectedSlot.slotId === def.slotId;
      var slotPoints = getGappedPoints(def.pts, GAP_DEFAULT);
      var slotPointsMarkup = pointListToString(slotPoints);

      var strokeColor = locked ? '#555' : (isRed ? '#e53935' : '#fdd835');
      var fillColor = locked
        ? 'rgba(60,60,60,0.24)'
        : (chipData
          ? (isRed ? 'rgba(229,57,53,0.12)' : 'rgba(253,216,53,0.12)')
          : (isRed ? 'rgba(132,36,30,0.08)' : 'rgba(164,130,16,0.08)'));
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
        var tutorialSlotAttr = (def.type === 'red' && def.slotId === 'slot1')
          ? ' data-tutorial-hangar-first-red-slot="true"'
          : '';

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
      svg += buildSlotDecoration(slotPoints, isRed, locked, !!chipData);
      svg += '<polygon class="hangarSlotPoly' + selectedClass + workingClass + '" points="' + slotPointsMarkup + '" ' +
        'fill="' + fillColor + '" stroke="' + strokeColor + '" stroke-width="' + strokeW + '" ' +
        'data-slot-type="' + def.type + '" data-slot-id="' + def.slotId + '"' + tutorialSlotAttr + ' ' +
        'style="cursor:' + (locked ? 'not-allowed' : 'pointer');

      if (isWorking) {
        svg += '; animation-delay: ' + animationDelay;
      }

      svg += '" />';

      var slotCx = 0, slotCy = 0;
      for (var si = 0; si < def.pts.length; si++) {
        slotCx += PT[def.pts[si]][0];
        slotCy += PT[def.pts[si]][1];
      }
      slotCx = Math.round(slotCx / 3);
      slotCy = Math.round(slotCy / 3);
      svg += '<text class="hangarSlotKeyLabel" x="' + slotCx + '" y="' + slotCy + '" text-anchor="middle" dominant-baseline="central" ' +
        'fill="#ff9800" font-size="20" font-family="monospace" pointer-events="none">' + def.label + '</text>';

      /* vertex labels inside triangle */
      if (chipData && h) {
        var placement = isRed ? h.normalizeRedPlacementRotated(chipData.modIds, chipData.rotation) : h.normalizeYellowPlacementRotated(chipData.modIds, chipData.rotation);
        var cx = slotCx;
        var cy = slotCy;

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

        /* Action buttons: rotate CCW, rotate CW, remove (visible on hover or click via CSS) */
        var abY = cy;
        var isActionsActive = _activeSlotActions && _activeSlotActions.type === def.type && _activeSlotActions.slotId === def.slotId;
        var actionsClass = 'hangarSlotActions' + (isActionsActive ? ' hangarSlotActions--active' : '');
        svg += '<g class="' + actionsClass + '">';
        /* rotate CCW */
        var lx = cx - 24;
        svg += '<g class="hangarSlotActionBtn" data-action="rotateCCW" data-action-type="' + def.type + '" data-action-slot="' + def.slotId + '" style="cursor:pointer">' +
          '<circle cx="' + lx + '" cy="' + abY + '" r="10" fill="rgba(30,28,24,.85)" stroke="#4af626" stroke-width="1.5" />' +
          buildRotateArrowIcon(lx, abY, -1) +
          '</g>';
        /* rotate CW */
        var rx = cx + 24;
        svg += '<g class="hangarSlotActionBtn" data-action="rotateCW" data-action-type="' + def.type + '" data-action-slot="' + def.slotId + '" style="cursor:pointer">' +
          '<circle cx="' + rx + '" cy="' + abY + '" r="10" fill="rgba(30,28,24,.85)" stroke="#4af626" stroke-width="1.5" />' +
          buildRotateArrowIcon(rx, abY, 1) +
          '</g>';
        /* remove chip */
        svg += '<g class="hangarSlotActionBtn" data-action="remove" data-action-type="' + def.type + '" data-action-slot="' + def.slotId + '" style="cursor:pointer">' +
          '<circle cx="' + cx + '" cy="' + (abY + 0) + '" r="10" fill="rgba(30,28,24,.85)" stroke="#e53935" stroke-width="1.5" />' +
          '<text x="' + cx + '" y="' + (abY + 0) + '" text-anchor="middle" dominant-baseline="central" fill="#e53935" font-size="12" font-family="sans-serif">\u2715</text>' +
          '</g>';
        svg += '</g>';
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
  function _getChipMatchTargetLabels(cell, chipEntry, h) {
    var targets = [];
    if (!cell || !h || !chipEntry) return targets;
    var chipDef = h.getChipById(h.allChips, chipEntry.chipId);
    if (!chipDef) return targets;

    if (chipEntry.chipColor === 'red') {
      for (var ri = 0; ri < RED_SLOT_KEYS.length; ri++) {
        var targetRedSlot = RED_SLOT_KEYS[ri];
        if (cell.redSlots[targetRedSlot]) continue;
        var otherRedSlot = targetRedSlot === 'slot1' ? 'slot2' : 'slot1';
        var otherRedChip = cell.redSlots[otherRedSlot];
        if (!otherRedChip) continue;
        var otherPlacement = h.normalizeRedPlacementRotated(otherRedChip.modIds, otherRedChip.rotation);
        for (var redRot = 0; redRot < 3; redRot++) {
          var testRedPlacement = h.normalizeRedPlacementRotated(chipEntry.modIds, redRot);
          if (h.checkRedMatch(testRedPlacement, otherPlacement)) {
            targets.push(getSlotDisplayLabel('red', targetRedSlot));
            break;
          }
        }
      }
      return targets;
    }

    if (chipEntry.chipColor === 'yellow') {
      if (cell.uiState && cell.uiState.yellowLocked) return targets;
      var yellowSlots = ['slot1', 'slot2', 'slot3', 'slot4'];
      for (var yi = 0; yi < yellowSlots.length; yi++) {
        var targetYellowSlot = yellowSlots[yi];
        if (cell.yellowSlots[targetYellowSlot]) continue;
        var adj = YELLOW_SLOT_MATCH_MAP[targetYellowSlot];
        if (!adj) continue;
        var adjRedChip = cell.redSlots[adj.redSlot];
        if (!adjRedChip) continue;
        var redPlacement = h.normalizeRedPlacementRotated(adjRedChip.modIds, adjRedChip.rotation);
        for (var yellowRot = 0; yellowRot < 3; yellowRot++) {
          var yellowPlacement = h.normalizeYellowPlacementRotated(chipEntry.modIds, yellowRot);
          if (yellowPlacement.innerA === redPlacement[adj.innerAKey] && yellowPlacement.innerB === redPlacement[adj.innerBKey]) {
            targets.push(getSlotDisplayLabel('yellow', targetYellowSlot));
            break;
          }
        }
      }
    }

    return targets;
  }

  function _wouldChipCreateMatch(cell, chipEntry, h) {
    return _getChipMatchTargetLabels(cell, chipEntry, h).length > 0;
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

  function _sortAvailableChipsByMatchPriority(chips, canMatchMap) {
    var prepared = [];
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      var chipKey = chip.chipId + '_' + chip.level;
      prepared.push({
        chip: chip,
        canMatch: !!(canMatchMap && canMatchMap[chipKey]),
        order: i,
      });
    }

    prepared.sort(function(a, b) {
      if (a.canMatch !== b.canMatch) return a.canMatch ? -1 : 1;
      return a.order - b.order;
    });

    var sorted = [];
    for (var si = 0; si < prepared.length; si++) sorted.push(prepared[si].chip);
    return sorted;
  }

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
      '<span class="hangarChipsAvailLabel">' + t('hangarChipsAvailable') +
      ' (' + chips.length + ')</span>' +
      '<div class="hangarChipsFilters">' +
      '<button class="hangarFilterBtn' + (_chipFilter === 'all' ? ' active' : '') + '" data-filter="all">' + t('hangarChipsFilterAll') + '</button>' +
      '<button class="hangarFilterBtn' + (_chipFilter === 'red' ? ' active' : '') + '" data-filter="red" style="color:#e53935">' + t('hangarChipsFilterRed') + '</button>' +
      '<button class="hangarFilterBtn' + (_chipFilter === 'yellow' ? ' active' : '') + '" data-filter="yellow" style="color:#fdd835">' + t('hangarChipsFilterYellow') + '</button>' +
      '</div></div>';

    if (!chips.length) {
      html += '<div class="chipUpgradeEmptyLabel">' + t('hangarChipsNoChips') + '</div>';
      list.innerHTML = html;
      return;
    }

    html += '<div class="hangarChipsGridWrap hangarAvailableChipsGridWrap"><div class="hangarChipsGrid hangarAvailableChipsGrid">';

    /* Pre-calculate which chips could create matches in the current cell */
    var cells = ensureCells();
    var cell = cells[_selectedCell];
    var canMatchMap = {};
    var targetSlotMap = {};
    if (cell && h) {
      for (var ci2 = 0; ci2 < chips.length; ci2++) {
        var testChip = chips[ci2];
        var matchTargets = _getChipMatchTargetLabels(cell, testChip, h);
        var chipKey = testChip.chipId + '_' + testChip.level;
        canMatchMap[chipKey] = matchTargets.length > 0;
        targetSlotMap[chipKey] = matchTargets;
      }
    }

    chips = _sortAvailableChipsByMatchPriority(chips, canMatchMap);

    var tutorialFirstRedChipKey = '';
    for (var tutorialChipIndex = 0; tutorialChipIndex < chips.length; tutorialChipIndex++) {
      if (chips[tutorialChipIndex] && chips[tutorialChipIndex].chipColor === 'red') {
        tutorialFirstRedChipKey = chips[tutorialChipIndex].chipId + '_' + chips[tutorialChipIndex].level;
        break;
      }
    }

    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      var borderColor = chip.chipColor === 'red' ? '#e53935' : '#fdd835';
      var chipKey = chip.chipId + '_' + chip.level;
      var canMatch = canMatchMap[chipKey] || false;
      var targetSlots = targetSlotMap[chipKey] || [];
      var matchClass = canMatch ? ' hangarChipInvItem--canMatch' : '';
      var chipName = _getChipDisplayName(chip);
      var tutorialAttr = tutorialFirstRedChipKey && tutorialFirstRedChipKey === chipKey
        ? ' data-tutorial-hangar-first-red-chip="true"'
        : '';
      var slotHintHtml = targetSlots.length
        ? '<span class="chipInvSlotHint" aria-hidden="true">' + _escapeHtml(targetSlots.join('/')) + '</span>'
        : '';
      html += '<button class="chipCraftInvItem hangarChipInvItem' + matchClass + '" data-chip-id="' + chip.chipId + '" data-chip-level="' + chip.level + '"' + tutorialAttr + ' type="button" title="">' +
        slotHintHtml +
        chipSvgComposed(40, 36, borderColor, chip.modIds, 'chipCraftInvIcon', 2.5) +
        '<span class="chipCraftInvLabel hangarChipInvLabel">' + _renderChipNameHtml(chipName) + '</span>' +
        '<span class="chipCraftInvLevel">' + t('hangarChipsLevelShort') + ' ' + chip.level + (chip.count > 1 ? ' \u2022 \u00d7' + chip.count : '') + '</span>' +
        '</button>';
    }
    html += '</div></div>';
    list.innerHTML = html;
    _suppressNativeChipTooltips(list);
  }

  /* ─── Render: cell title ───────────────────────────────── */

  function renderCellTitle() {
    var titleEl = dom.cellTitle;
    if (!titleEl) return;
    titleEl.textContent = t('hangarChipsCellLabel', 'Ячейка') + ' ' + (_selectedCell + 1);
  }

  /* ─── Full render ──────────────────────────────────────── */

  function render() {
    syncTechUnlockHelpButtonCopy();
    renderGrid();
    renderCellTitle();
    renderButterfly();
    renderActiveMods();
    renderChipsList();
  }

  function syncTechUnlockHelpButtonCopy() {
    var helpBtn = el('modsHangarHelpBtn');
    if (!helpBtn) return;
    var label = getActiveHangarHelpConfig().tooltipLabel;
    helpBtn.setAttribute('aria-label', label);
    helpBtn.setAttribute('data-ui-tooltip', label);
    helpBtn.removeAttribute('title');
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
    var wasWorkshop = !!(panelWorkshop && !panelWorkshop.hidden);

    var isCells = tabId === 'cells';
    var isWorkshop = tabId === 'workshop';
    var isTech = tabId === 'techUnlock';

    _activeHangarTab = isWorkshop ? 'workshop' : (isTech ? 'techUnlock' : 'cells');
    syncTechUnlockHelpButtonCopy();

    if (wasWorkshop && !isWorkshop) resetTransientUiState();

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
    var nextTab = isRecycle ? 'chipRecycle' : (isCraft ? 'chipCraft' : 'chipUpgrade');

    if (_workshopSubTab !== nextTab && (_workshopSubTab === 'chipCraft' || _workshopSubTab === 'chipRecycle')) {
      resetTransientUiState();
    }

    _workshopSubTab = nextTab;

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
    var nextTab = tabId === 'disassemble'
      ? 'disassemble'
      : (tabId === 'reprogram' ? 'reprogram' : 'dust');

    if (_chipRecycleSubTab !== nextTab) resetTransientUiState();

    _workshopSubTab = 'chipRecycle';
    _chipRecycleSubTab = nextTab;

    if (_chipRecycleSubTab === 'disassemble') {
      _dustMode = false;
      if (_craftMode !== 'disassemble') {
        _craftMode = 'disassemble';
        _craftSlots = [];
      }
    } else if (_chipRecycleSubTab === 'reprogram') {
      _dustMode = false;
      _craftMode = 'reprogram';
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
      var result = h.unlockTechnology(modId, chips, cells, ensurePlayerFragments());
      if (result.ok) {
        if (global.Game && typeof global.Game.onModifierTechnologyUnlocked === 'function') {
          global.Game.onModifierTechnologyUnlocked(modId);
        }
        if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
          global.Game.Toast.show(t('techUnlockSuccess', 'Технология «{name}» открыта! Все чипы обновлены.').replace('{name}', modName(modId)), 2500);
        }
      }
    }
    render();
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
        html += '<div class="techUnlockCard__body">';
        html += '<div class="techUnlockCard__name">' + modName(tech.modId) + '</div>';
        html += '<div class="techUnlockCard__desc">' + _getTechDescription(tech.modId) + '</div>';

        var footerHtml = '';

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

          footerHtml += '<div class="techUnlockCard__footer">';
          footerHtml += '<div class="techUnlockCard__actions">';
          footerHtml += '<button class="btn scButton techUnlockCard__cancelBtn" data-tech-cancel="' + tech.modId + '" type="button">' + t('techUnlockCancel', 'Отменить') + '</button>';
          var accelReachedMax = (_techStudying.acceleratedPct || 0) >= TECH_ACCEL_MAX_PCT;
          var accelHasResources = _hasTechAccelerationResources();
          var accelDisabled = accelReachedMax || !accelHasResources;
          var accelLabel = accelReachedMax
            ? t('techUnlockAccelMax', 'Максимальное ускорение')
            : (!accelHasResources
              ? t('techUnlockAccelNoResources', 'Нет ресурсов для ускорения')
              : t('techUnlockAccel', 'Ускорить процесс открытия'));
          footerHtml += '<button class="btn scButton techUnlockCard__accelBtn' + (accelDisabled ? ' techUnlockCard__accelBtn--disabled' : '') + '" data-tech-accel="' + tech.modId + '" type="button"' + (accelDisabled ? ' disabled aria-disabled="true"' : '') + (accelDisabled ? ' title="' + _escapeHtml(accelLabel) + '"' : '') + '>' + accelLabel + '</button>';
          footerHtml += '</div>';
          footerHtml += '</div>';
        } else {
          /* Show "Start study" button + duration */
          html += '<div class="techUnlockCard__durationInfo">' + t('techUnlockDuration', 'Время изучения: {time}').replace('{time}', _formatTime(duration)) + '</div>';
          footerHtml += '<div class="techUnlockCard__footer">';
          footerHtml += '<div class="techUnlockCard__actions techUnlockCard__actions--primary">';
          var disabled = anotherStudying ? ' disabled' : '';
          footerHtml += '<button class="btn scButton techUnlockCard__startBtn' + (anotherStudying ? ' techUnlockCard__startBtn--disabled' : '') + '" data-tech-start="' + tech.modId + '" type="button"' + disabled + '>' + t('techUnlockStart', 'Начать процесс изучения') + '</button>';
          footerHtml += '</div>';
          footerHtml += '</div>';
        }

        html += '</div>';
        html += footerHtml;
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
    return _getModDescription(modId);
  }

  /**
   * Feed chips to unlock a technology.
   * Removes `amount` chips from inventory (any chips, cheapest first).
   * When progress reaches cost → unlocks the technology.
   */
  function feedChipsForTech(modId, amount) {
    var h = hc();
    if (!h) return { ok: false, error: 'no_module' };
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
      var result = h.unlockTechnology(modId, chips, cells, ensurePlayerFragments());
      _techFeedProgress[modId] = cost; // cap at cost
      if (result && result.ok && global.Game && typeof global.Game.onModifierTechnologyUnlocked === 'function') {
        global.Game.onModifierTechnologyUnlocked(modId);
      }
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
    if (!_playerFragments) _playerFragments = [];
    var h = hc();
    if (h && typeof h.normalizeFragmentsInventory === 'function') {
      _playerFragments = h.normalizeFragmentsInventory(_playerFragments);
    }
    return _playerFragments;
  }

  function getPlayerFragments() { return ensurePlayerFragments(); }
  function setPlayerFragments(frags) {
    _playerFragments = Array.isArray(frags) ? frags.slice() : [];
    var h = hc();
    if (h && typeof h.normalizeFragmentsInventory === 'function') {
      _playerFragments = h.normalizeFragmentsInventory(_playerFragments);
    }
  }

  /** Add fragment(s) to inventory. fragmentId = modId (1–30). */
  function addPlayerFragment(fragmentId, count) {
    var frags = ensurePlayerFragments();
    var cnt = (Number.isFinite(count) && count >= 1) ? Math.floor(count) : 1;
    var h = hc();
    var normalizedId = h && typeof h.normalizeFragmentId === 'function'
      ? h.normalizeFragmentId(fragmentId)
      : fragmentId;
    for (var i = 0; i < frags.length; i++) {
      if (frags[i].fragmentId === normalizedId) {
        frags[i].count += cnt;
        return frags[i];
      }
    }
    var entry = { fragmentId: normalizedId, count: cnt };
    frags.push(entry);
    return entry;
  }

  /** Remove one fragment from inventory. Returns true if removed. */
  function removePlayerFragment(fragmentId, count) {
    var frags = ensurePlayerFragments();
    var cnt = (Number.isFinite(count) && count >= 1) ? Math.floor(count) : 1;
    var h = hc();
    var normalizedId = h && typeof h.normalizeFragmentId === 'function'
      ? h.normalizeFragmentId(fragmentId)
      : fragmentId;
    for (var i = 0; i < frags.length; i++) {
      if (frags[i].fragmentId === normalizedId) {
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
    var h = hc();
    var normalizedId = h && typeof h.normalizeFragmentId === 'function'
      ? h.normalizeFragmentId(fragmentId)
      : fragmentId;
    for (var i = 0; i < frags.length; i++) {
      if (frags[i].fragmentId === normalizedId) return frags[i].count;
    }
    return 0;
  }

  function getPlayerChips() { return ensurePlayerChips(); }

  function setPlayerChips(chips) {
    _playerChips = Array.isArray(chips) ? chips : [];
  }

  function getChipEntryCount(entry) {
    var raw = Number(entry && entry.count);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
  }

  function getChipMergePairKey(chipId, level) {
    return String(chipId) + '|' + String(level);
  }

  function buildChipMergePairCounts(chips) {
    var entries = Array.isArray(chips) ? chips : [];
    var counts = {};
    for (var i = 0; i < entries.length; i++) {
      var chip = entries[i];
      if (!chip || !Number.isFinite(chip.chipId) || !Number.isFinite(chip.level)) continue;
      var key = getChipMergePairKey(chip.chipId, chip.level);
      counts[key] = (counts[key] || 0) + getChipEntryCount(chip);
    }
    return counts;
  }

  function getChipMergePairCount(pairCounts, chipId, level) {
    if (!pairCounts || typeof pairCounts !== 'object') return 0;
    return pairCounts[getChipMergePairKey(chipId, level)] || 0;
  }

  function canChipEntryMerge(chip, pairCounts) {
    return !!chip && getChipMergePairCount(pairCounts, chip.chipId, chip.level) >= 2;
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
    var matchCount = 0;
    var entry = null;
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].chipId === chipId && chips[i].level === level) {
        if (!entry) entry = chips[i];
        matchCount += getChipEntryCount(chips[i]);
        if (matchCount >= 2) break;
      }
    }
    if (!entry || matchCount < 2) return -1;
    var newLevel = level + 1;

    var remainingToConsume = 2;
    for (var ri = chips.length - 1; ri >= 0 && remainingToConsume > 0; ri--) {
      if (chips[ri].chipId !== chipId || chips[ri].level !== level) continue;
      var copiesInEntry = getChipEntryCount(chips[ri]);
      var take = Math.min(copiesInEntry, remainingToConsume);
      if (take <= 0) continue;
      remainingToConsume -= take;
      if (copiesInEntry === take) chips.splice(ri, 1);
      else chips[ri].count = copiesInEntry - take;
    }

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
    var pairCounts = buildChipMergePairCounts(chips);
    var mergeableChips = chips.filter(function (chip) {
      return canChipEntryMerge(chip, pairCounts);
    });

    if (!mergeableChips.length) {
      grid.innerHTML = '<div class="chipUpgradeEmptyLabel">' + t('workshopChipUpgradeEmpty', 'У Вас пока нет двух одинаковых чипов, для того чтобы сделать улучшение') + '</div>';
      return;
    }

    /* sort: by chipColor (red first), then by chipId, then by level */
    var sorted = mergeableChips.slice().sort(function(a, b) {
      if (a.chipColor !== b.chipColor) return a.chipColor === 'red' ? -1 : 1;
      if (a.chipId !== b.chipId) return a.chipId - b.chipId;
      return a.level - b.level;
    });

    var html = '';
    for (var i = 0; i < sorted.length; i++) {
      var chip = sorted[i];
      var borderColor = chip.chipColor === 'red' ? '#e53935' : '#fdd835';
      var canMerge = canChipEntryMerge(chip, pairCounts);
      var cardClass = 'chipUpgradeCard' + (canMerge ? ' chipUpgradeCard--canMerge' : '');
      var tooltipData = 'data-chip-upgrade-id="' + chip.chipId + '" data-chip-upgrade-level="' + chip.level + '"';

      html += '<div class="' + cardClass + '" ' + tooltipData + ' data-drag-chip-id="' + chip.chipId + '" data-drag-chip-level="' + chip.level + '" title="">';

      /* chip icon SVG — composed of 3 sub-triangles */
      html += chipSvgComposed(44, 40, borderColor, chip.modIds, 'chipUpgradeCard__icon', 2.5);

      /* name */
      var chipName = chip.sourceComboKey;
      if (h && chip.modIds.length) {
        var names = [];
        for (var ni = 0; ni < chip.modIds.length; ni++) names.push(modName(chip.modIds[ni]));
        chipName = names.join(' + ');
      }
      html += '<span class="chipUpgradeCard__name">' + _renderChipNameHtml(chipName) + '</span>';

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
    _suppressNativeChipTooltips(grid);
  }

  /* ─── Chip upgrade tooltip ─────────────────────────────── */

  function showChipUpgradeTooltip(evt) {
    var card = evt.target.closest ? evt.target.closest('[data-chip-upgrade-id]') : null;
    if (!card) { hideChipUpgradeTooltip(); return; }
    var chipId = parseInt(card.getAttribute('data-chip-upgrade-id'), 10);
    var level = parseInt(card.getAttribute('data-chip-upgrade-level'), 10);
    if (!Number.isFinite(chipId) || !Number.isFinite(level)) return;

    var chip = _findPlayerChipEntry(chipId, level);
    if (!chip) return;
    _showGameTooltip(_buildWholeChipTooltipHtml(chip), card);
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

  function _positionTooltipElement(tip, left, top) {
    if (!tip) return;
    var margin = 12;
    var tipWidth = tip.offsetWidth || 280;
    var tipHeight = tip.offsetHeight || 120;
    var maxLeft = Math.max(margin, global.innerWidth - tipWidth - margin);
    var maxTop = Math.max(margin, global.innerHeight - tipHeight - margin);
    tip.style.left = Math.min(Math.max(margin, left), maxLeft) + 'px';
    tip.style.top = Math.min(Math.max(margin, top), maxTop) + 'px';
  }

  function _suppressNativeChipTooltips(root) {
    if (!root || !root.querySelectorAll) return;
    var targets = root.querySelectorAll(
      '.hangarChipInvItem, .hangarChipInvLabel, [data-chip-upgrade-id], .chipUpgradeCard__name, '
      + '.chipCraftInvItem[data-craft-chip-id], .chipCraftInvItem[data-craft-chip-id] .chipCraftInvLabel, '
      + '[data-hct-chip-id], [data-hct-chip-id] .chipCraftSlotCard__name, '
      + '.chipCraftResultChip, .chipCraftResultChip .chipCraftSlotCard__name, '
      + '[data-accel-chip-id], [data-accel-chip-id] .techAccelChip__label'
    );
    for (var i = 0; i < targets.length; i++) {
      targets[i].setAttribute('title', '');
    }
  }

  function _showGameTooltip(htmlContent, anchorEl) {
    var tip = _ensureGameTooltip();
    tip.innerHTML = htmlContent;
    tip.style.display = 'block';
    var rect = anchorEl.getBoundingClientRect();
    _positionTooltipElement(tip, rect.right + 12, rect.top - 8);
  }

  function _showGameTooltipAtPoint(htmlContent, clientX, clientY, tooltipEl) {
    var tip = tooltipEl || _ensureGameTooltip();
    tip.innerHTML = htmlContent;
    tip.style.display = 'block';
    _positionTooltipElement(tip, clientX + 12, clientY + 16);
  }

  function _findPlayerChipEntry(chipId, level) {
    var chips = ensurePlayerChips();
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].chipId === chipId && chips[i].level === level) return chips[i];
    }
    return null;
  }

  function _buildWholeChipTooltipHtml(chipEntry, options) {
    var opts = options || {};
    if (!chipEntry) return '';

    var tooltipLevel = Number.isFinite(opts.level)
      ? Math.max(1, Math.floor(opts.level))
      : (Number.isFinite(chipEntry.level) ? Math.max(1, Math.floor(chipEntry.level)) : 1);
    var modIds = Array.isArray(opts.modIds)
      ? opts.modIds
      : (Array.isArray(chipEntry.modIds) ? chipEntry.modIds : []);
    var tooltipName = opts.displayName || _getChipDisplayName({
      sourceComboKey: chipEntry.sourceComboKey || '',
      modIds: modIds,
    });
    var bonus = chipLevelBonus(tooltipLevel);
    var html = '<div class="chipUpgradeTooltip__title">' + _escapeHtml(tooltipName) + '</div>';

    for (var i = 0; i < modIds.length; i++) {
      var modId = modIds[i];
      if (!Number.isFinite(modId)) continue;
      var description = _getModDescription(modId);
      html += '<div class="chipUpgradeTooltip__mod">';
      html += '<div class="chipUpgradeTooltip__modName">' + _escapeHtml(modName(modId)) + '</div>';
      if (description) {
        html += '<div class="chipUpgradeTooltip__modDesc">' + _escapeHtml(description) + '</div>';
      }
      html += '</div>';
    }

    html += '<div class="chipUpgradeTooltip__meta">' + t('workshopChipTooltipLevel').replace('{level}', tooltipLevel) + '</div>';
    if (bonus > 0) {
      html += '<div class="chipUpgradeTooltip__bonus">' + t('workshopChipTooltipBonus').replace('{bonus}', bonus) + '</div>';
    }
    return html;
  }

  function _buildFragmentTooltipHtml(fragmentId, options) {
    var opts = options || {};
    if (!Number.isFinite(fragmentId)) return '';

    var html = '<div class="chipUpgradeTooltip__title">' + _escapeHtml(modName(fragmentId)) + '</div>';
    if (typeof opts.metaKey === 'string' && opts.metaKey) {
      var metaText = t(opts.metaKey);
      if (metaText && metaText !== opts.metaKey) {
        html += '<div class="chipUpgradeTooltip__meta">' + _escapeHtml(metaText) + '</div>';
      }
    }

    var description = _getModDescription(fragmentId);
    if (description) {
      html += '<div class="chipUpgradeTooltip__mod">';
      html += '<div class="chipUpgradeTooltip__modDesc">' + _escapeHtml(description) + '</div>';
      html += '</div>';
    }

    if (Number.isFinite(opts.count)) {
      html += '<div class="chipUpgradeTooltip__meta">' + t('workshopChipTooltipCount').replace('{count}', opts.count) + '</div>';
    }
    return html;
  }

  function showHangarChipBtnTooltip(btn) {
    var chipId = parseInt(btn.getAttribute('data-chip-id'), 10);
    var level = parseInt(btn.getAttribute('data-chip-level'), 10) || 1;
    var chip = _findPlayerChipEntry(chipId, level);
    if (!chip) return;
    _showGameTooltip(_buildWholeChipTooltipHtml(chip), btn);
  }

  function showCraftInvChipTooltip(item) {
    var chipId = parseInt(item.getAttribute('data-craft-chip-id'), 10);
    var level = parseInt(item.getAttribute('data-craft-chip-level'), 10) || 1;
    var chip = _findPlayerChipEntry(chipId, level);
    if (!chip) return;
    _showGameTooltip(_buildWholeChipTooltipHtml(chip), item);
  }

  function showTechAccelChipTooltip(item) {
    var chipId = parseInt(item.getAttribute('data-accel-chip-id'), 10);
    var level = parseInt(item.getAttribute('data-accel-chip-level'), 10) || 1;
    var chip = _findPlayerChipEntry(chipId, level);
    if (!chip) return;
    _showGameTooltip(_buildWholeChipTooltipHtml(chip), item);
  }

  function showCraftInvFragTooltip(item) {
    var fragId = parseInt(item.getAttribute('data-craft-frag-id'), 10);
    var displayCount = parseInt(item.getAttribute('data-craft-display-count'), 10);
    if (!Number.isFinite(fragId)) return;
    var frags = ensurePlayerFragments();
    var frag = null;
    for (var i = 0; i < frags.length; i++) {
      if (frags[i].fragmentId === fragId) { frag = frags[i]; break; }
    }
    var cnt = Number.isFinite(displayCount) ? displayCount : (frag ? frag.count : 0);
    _showGameTooltip(_buildFragmentTooltipHtml(fragId, { count: cnt }), item);
  }

  /* Tooltip for craft preview (result chip) */
  function showCraftResultTooltip(el) {
    if (!el) return;
    var resultFragmentId = parseInt(el.getAttribute('data-hct-result-frag-id'), 10);
    if (Number.isFinite(resultFragmentId)) {
      _showGameTooltip(_buildFragmentTooltipHtml(resultFragmentId, {
        metaKey: 'chipReprogramResultTooltip'
      }), el);
      return;
    }

    var modsAttr = el.getAttribute('data-hct-result-modids') || '';
    var modIds = [];
    if (modsAttr) {
      var parts = modsAttr.split(',');
      for (var pi = 0; pi < parts.length; pi++) {
        var n = parseInt(parts[pi], 10);
        if (Number.isFinite(n)) modIds.push(n);
      }
    }
    var previewEntry = {
      modIds: modIds,
      level: 1,
      sourceComboKey: '',
    };
    if (!modIds.length) return;
    _showGameTooltip(_buildWholeChipTooltipHtml(previewEntry, {
      modIds: modIds,
      level: 1,
      displayName: _getChipDisplayName(previewEntry)
    }), el);
  }

  function showCraftSlotChipTooltip(slotEl) {
    var chipId = parseInt(slotEl.getAttribute('data-hct-chip-id'), 10);
    var level = parseInt(slotEl.getAttribute('data-hct-chip-level'), 10) || 1;
    if (!Number.isFinite(chipId)) return;
    var chip = _findPlayerChipEntry(chipId, level);
    if (!chip) return;
    _showGameTooltip(_buildWholeChipTooltipHtml(chip), slotEl);
  }

  function showCraftSlotFragTooltip(slotEl) {
    var fragId = parseInt(slotEl.getAttribute('data-hct-frag-id'), 10);
    if (!Number.isFinite(fragId)) return;
    _showGameTooltip(_buildFragmentTooltipHtml(fragId), slotEl);
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

    var chipLevel = chipData.level || 1;
    var chipModIds = chipData.modIds || [];

    if (!_slotTooltipEl) {
      _slotTooltipEl = _doc.createElement('div');
      _slotTooltipEl.className = 'chipUpgradeTooltip chipSlotTooltip';
      _doc.body.appendChild(_slotTooltipEl);
    }

    var tooltipChip = {
      modIds: chipModIds,
      level: chipLevel,
      sourceComboKey: chipData.sourceComboKey || ''
    };
    _showGameTooltipAtPoint(
      _buildWholeChipTooltipHtml(tooltipChip, { modIds: chipModIds, level: chipLevel }),
      evt.clientX,
      evt.clientY,
      _slotTooltipEl
    );
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
      activateInstalledSlotActions(_selectedSlot.type, _selectedSlot.slotId);
      removePlayerChipOne(chipId, lvl);
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
    _activeSlotActions = null;

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
    setInstallSlotSelection(slotType, slotId);
    render();
  }

  /* ─── Event delegation ─────────────────────────────────── */

  function handleOverlayClick(evt) {
    var tgt = evt.target;
    if (!tgt) return;

    /* slot action buttons (rotate CCW/CW, remove) */
    var actionBtn = tgt.closest ? tgt.closest('[data-action]') : null;
    if (actionBtn) {
      evt.stopPropagation();
      var action = actionBtn.getAttribute('data-action');
      var actType = actionBtn.getAttribute('data-action-type');
      var actSlot = actionBtn.getAttribute('data-action-slot');
      if (action === 'remove') {
        _activeSlotActions = null;
        removeChipAction(actType, actSlot);
      } else {
        var dir = (action === 'rotateCCW') ? -1 : 1;
        var h = hc();
        if (h && typeof h.rotateChip === 'function') {
          var cells = ensureCells();
          var cell = cells[_selectedCell];
          if (cell) {
            h.rotateChip(cell, actType, actSlot, dir);
            render();
          }
        }
      }
      return;
    }

    /* grid cell click */
    var cellBtn = tgt.closest ? tgt.closest('[data-cell-idx]') : null;
    if (cellBtn) {
      var cellIdx = parseInt(cellBtn.getAttribute('data-cell-idx'), 10) || 0;
      if (cellIdx === UNDERGROUND_HANGAR_CELL) return; /* locked cell — ignore */
      _selectedCell = cellIdx;
      clearSlotSelection();
      _activeSlotActions = null;
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

      /* if chip is installed → toggle action buttons */
      var existingChip = slotType === 'red' ? cell.redSlots[slotId] : cell.yellowSlots[slotId];
      if (existingChip) {
        setVisualSlotSelection(slotType, slotId);
        _chipFilter = slotType;
        if (_activeSlotActions && _activeSlotActions.type === slotType && _activeSlotActions.slotId === slotId) {
          _activeSlotActions = null;
        } else {
          _activeSlotActions = { type: slotType, slotId: slotId };
        }
        render();
        return;
      }

      /* select slot for installation */
      setInstallSlotSelection(slotType, slotId);
      _chipFilter = slotType === 'red' ? 'red' : 'yellow';
      _activeSlotActions = null;
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
      clearSlotSelection();
      _activeSlotActions = null;
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

    var techHelpBtn = tgt.closest ? tgt.closest('[data-tech-help-open]') : null;
    if (techHelpBtn) {
      _showTechUnlockHelpModal();
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
        if ((_techStudying.acceleratedPct || 0) >= TECH_ACCEL_MAX_PCT) {
          if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
            global.Game.Toast.show(t('techAccelMaxReached'), 1500);
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

    var craftModalClose = tgt.closest ? tgt.closest('[data-craft-modal-close]') : null;
    if (craftModalClose) {
      _closeTechModal();
      return;
    }

    var craftRiskConfirm = tgt.closest ? tgt.closest('[data-craft-risk-confirm]') : null;
    if (craftRiskConfirm) {
      _closeTechModal();
      _executeCraftAction(true);
      return;
    }

    var craftDisassembleConfirm = tgt.closest ? tgt.closest('[data-craft-disassemble-confirm]') : null;
    if (craftDisassembleConfirm) {
      _closeTechModal();
      _executeCraftAction({ skipDisassembleConfirm: true });
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

  function hasPlayerOwnedWholeChip() {
    var chips = ensurePlayerChips();
    for (var i = 0; i < chips.length; i++) {
      if (getChipEntryCount(chips[i]) > 0) return true;
    }
    return false;
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
    return Math.max(0, TECH_ACCEL_MAX_PCT - currentAccel - selectedPct);
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

  function _showTechUnlockHelpModal() {
    var modal = _ensureTechModal();
    var helpConfig = getActiveHangarHelpConfig();
    var closeLabel = t('menuClose', 'Закрыть');
    modal.innerHTML = '<div class="techModal__dialog techModal__dialog--wide techModal__dialog--craft techModal__dialog--help" role="dialog" aria-modal="true" aria-labelledby="techUnlockHelpTitle">' +
      '<button class="modalClose scModal__close techModal__close" data-craft-modal-close type="button" aria-label="' + _escapeHtml(closeLabel) + '"></button>' +
      '<div class="techModal__title techModal__title--help" id="techUnlockHelpTitle">' + _escapeHtml(t('techUnlockHelpTitle', 'Справка')) + '</div>' +
      '<div class="techModal__subtitle techModal__subtitle--help">' + _escapeHtml(helpConfig.sectionTitle) + '</div>' +
      '<div class="techModal__text techModal__text--help">' + _renderHelpTextHtml(helpConfig.text) + '</div>' +
      '<div class="techModal__btns">' +
      '<button class="btn scButton techModal__noBtn" data-craft-modal-close type="button">' + _escapeHtml(t('techUnlockHelpClose', 'Закрыть')) + '</button>' +
      '</div>' +
      '</div>';
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
          html += '<div class="techAccelChip" data-accel-chip-id="' + chip.chipId + '" data-accel-chip-level="' + chip.level + '" data-accel-checked="false" title="">';
          html += '<div class="techAccelChip__checkBox"><span class="techAccelChip__check"></span></div>';
          html += chipSvgComposed(40, 36, borderColor, chip.modIds, 'techAccelChip__icon', 2.5);
          html += '<span class="techAccelChip__label">' + _renderChipNameHtml(accelChipName) + '</span>';
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
            html += '<span class="techAccelChip__label">' + _renderChipNameHtml(modName(frag.fragmentId)) + '</span>';
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
        .replace('{left}', String(Math.max(0, TECH_ACCEL_MAX_PCT - currentAccel)))
      + '</div>';
    html += '</div>';
    html += '<div class="techModal__btns">' +
      '<button class="btn scButton techModal__accelConfirmBtn" data-tech-accel-confirm="' + modId + '" type="button">' +
      t('techAccelBtnLabel', 'Ускорить на 0%') + '</button>' +
      '<button class="btn scButton techModal__noBtn" data-tech-cancel-no="close" type="button">' + t('techAccelClose', 'Закрыть') + '</button>' +
      '</div></div>';

    modal.innerHTML = html;
    modal.style.display = 'flex';
    _suppressNativeChipTooltips(modal);
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
    var total = Math.min(TECH_ACCEL_MAX_PCT, currentAccel + pct);
    var left = Math.max(0, TECH_ACCEL_MAX_PCT - currentAccel - pct);
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

    if ((_techStudying.acceleratedPct || 0) >= TECH_ACCEL_MAX_PCT) {
      if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
        global.Game.Toast.show(t('techAccelMaxReached'), 1500);
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
    if (_techStudying.acceleratedPct > TECH_ACCEL_MAX_PCT) _techStudying.acceleratedPct = TECH_ACCEL_MAX_PCT;

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
  var _craftMode = 'assemble'; // 'disassemble' | 'assemble' | 'reprogram'
  var _dustMode = false;       // true when "Распылить" flow is active
  var _dustSelected = {};      // { 'chip_<chipId>_<level>': count, 'frag_<fragId>': count }
  var _siliconDust = 0;        // player's silicon dust resource
  var _craftReagentDust = 0;   // units of silicon dust to spend as reagent (0-5)
  var _reprogramSourceFragmentId = null;
  var _reprogramTargetFragmentId = null;

  var DUST_PER_CHIP = 10;
  var DUST_PER_FRAGMENT = 3;
  var REPROGRAM_DUST_COST = 2;

  function _resetCraftSlots() {
    _craftSlots = [null, null, null];
    _craftReagentDust = 0;
  }

  function _resetReprogramState() {
    _reprogramSourceFragmentId = null;
    _reprogramTargetFragmentId = null;
  }

  /**
   * Check if a fragment can still be added to the assemble slots.
   * Rules: no all-same triple, max 1 special mod.
   * @param {number} fragId - modId to add
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
    if (!Number.isFinite(modId)) return '';
    var key = 'chipModifierDesc_' + Math.floor(modId);
    var description = t(key);
    return description && description !== key ? description : '';
  }

  function _resetDustMode() {
    _dustMode = false;
    _dustSelected = {};
  }

  function _getAvailableReprogramModIds() {
    var h = hc();
    var available = [];
    if (!h) return available;
    for (var baseModId = 1; baseModId <= 14; baseModId++) {
      var resolvedModId = baseModId;
      var chain = h.TECH_TREE && h.TECH_TREE[baseModId];
      if (Array.isArray(chain)) {
        for (var ci = 0; ci < chain.length; ci++) {
          if (chain[ci] && h.isTechUnlocked(chain[ci].modId)) resolvedModId = chain[ci].modId;
        }
      }
      available.push(resolvedModId);
    }
    return available;
  }

  function _getDefaultReprogramTargetId(availableModIds, sourceFragmentId) {
    for (var i = 0; i < availableModIds.length; i++) {
      if (availableModIds[i] !== sourceFragmentId) return availableModIds[i];
    }
    return null;
  }

  function _getReprogramState() {
    var availableModIds = _getAvailableReprogramModIds();
    var hasSource = Number.isFinite(_reprogramSourceFragmentId) && getFragmentCount(_reprogramSourceFragmentId) > 0;
    if (!hasSource) {
      _reprogramSourceFragmentId = null;
      _reprogramTargetFragmentId = null;
      return {
        availableModIds: availableModIds,
        sourceFragmentId: null,
        targetFragmentId: null,
        canExecute: false,
        missingDust: _siliconDust < REPROGRAM_DUST_COST,
      };
    }

    var targetValid = false;
    for (var i = 0; i < availableModIds.length; i++) {
      if (availableModIds[i] === _reprogramTargetFragmentId && availableModIds[i] !== _reprogramSourceFragmentId) {
        targetValid = true;
        break;
      }
    }
    if (!targetValid) {
      _reprogramTargetFragmentId = _getDefaultReprogramTargetId(availableModIds, _reprogramSourceFragmentId);
    }

    return {
      availableModIds: availableModIds,
      sourceFragmentId: _reprogramSourceFragmentId,
      targetFragmentId: _reprogramTargetFragmentId,
      canExecute: Number.isFinite(_reprogramSourceFragmentId)
        && Number.isFinite(_reprogramTargetFragmentId)
        && _reprogramTargetFragmentId !== _reprogramSourceFragmentId
        && _siliconDust >= REPROGRAM_DUST_COST,
      missingDust: _siliconDust < REPROGRAM_DUST_COST,
    };
  }

  function _setReprogramSource(fragmentId) {
    if (!Number.isFinite(fragmentId) || getFragmentCount(fragmentId) <= 0) return;
    _reprogramSourceFragmentId = fragmentId;
    if (_reprogramTargetFragmentId === fragmentId) _reprogramTargetFragmentId = null;
    _getReprogramState();
  }

  function resetTransientUiState() {
    _resetDustMode();
    _resetReprogramState();
    _craftMode = 'assemble';
    _resetCraftSlots();
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
      var hasSelection = Object.keys(_dustSelected).length > 0;
      totalEl.textContent = t('chipCraftDustResult', 'Получите кремниевой пыли: {amount}').replace('{amount}', _calcDustTotal());
      totalEl.style.display = hasSelection ? '' : 'none';
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

  function _renderHelpTextHtml(text) {
    var rawText = typeof text === 'string' ? text.replace(/\r\n?/g, '\n') : '';
    if (!rawText) return '';
    var lines = rawText.split('\n');
    var html = '';
    var paragraph = [];
    var listItems = [];

    function flushParagraph() {
      if (!paragraph.length) return;
      html += '<p class="techModal__paragraph">' + _escapeHtml(paragraph.join(' ')) + '</p>';
      paragraph = [];
    }

    function flushList() {
      if (!listItems.length) return;
      html += '<ul class="techModal__list">';
      for (var i = 0; i < listItems.length; i++) {
        html += '<li class="techModal__listItem">' + _escapeHtml(listItems[i]) + '</li>';
      }
      html += '</ul>';
      listItems = [];
    }

    for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      var line = lines[lineIndex].trim();
      if (!line) {
        flushParagraph();
        flushList();
        continue;
      }
      if (line.indexOf('- ') === 0) {
        flushParagraph();
        listItems.push(line.slice(2).trim());
        continue;
      }
      flushList();
      paragraph.push(line);
    }

    flushParagraph();
    flushList();
    return html;
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

  function _getAvailableChipCopies(chipId, level) {
    var chips = ensurePlayerChips();
    var total = 0;
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].chipId === chipId && chips[i].level === level && chips[i].count > 0) {
        total += chips[i].count;
      }
    }
    return total;
  }

  function _countSelectedCraftChipCopies(chipId, level) {
    var selected = 0;
    for (var i = 0; i < _craftSlots.length; i++) {
      var slot = _craftSlots[i];
      if (!slot || slot.type !== 'chip') continue;
      if (slot.chipId === chipId && slot.level === level) selected++;
    }
    return selected;
  }

  function _countSelectedCraftFragments(fragmentId) {
    var selected = 0;
    for (var i = 0; i < _craftSlots.length; i++) {
      var slot = _craftSlots[i];
      if (!slot || slot.type !== 'fragment') continue;
      if (slot.fragmentId === fragmentId) selected++;
    }
    return selected;
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
      '<span class="' + labelClass + '">' + _renderChipNameHtml(_truncateCraftCardLabel(cardLabel, opts.maxLabelLength)) + '</span>' +
      '</div>';
  }

  function _renderCraftRemoveButton(slotIndex) {
    var label = t('triageRemove', 'Удалить');
    return '<button class="chipCraftSlotRemove uiButtonBehavior" data-craft-remove="' + slotIndex + '" type="button" aria-label="' + label + '" title="' + label + '">' +
      '<span class="chipCraftSlotRemove__icon" aria-hidden="true"></span>' +
      '</button>';
  }

  function _renderCraftEnergyLines() {
    /* Vertical fan: 3 start points at top (x=50,150,250) → single end at bottom center (x=150).
       Lines start at y=-10 (inside slot card below, using svg overflow:visible)
       and end at y=91 (inside result chip above). */
    var slotXs = [50, 150, 250];
    var endX = 150;
    var startY = -10;
    var endY = 91;
    var html = '<svg class="chipCraftEnergySvg" viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true">';
    for (var i = 0; i < 3; i++) {
      var lineClass = 'chipCraftEnergyLine chipCraftEnergyLine--' + (i + 1);
      if (_craftSlots[i] && _craftSlots[i].type === 'fragment') lineClass += ' chipCraftEnergyLine--filled';
      var sx = slotXs[i];
      var d = 'M' + sx + ' ' + startY + ' C' + sx + ' 30,' + endX + ' 55,' + endX + ' ' + endY;
      html += '<g class="' + lineClass + '">';
      html += '<path class="chipCraftEnergyLine__base" d="' + d + '"></path>';
      html += '<path class="chipCraftEnergyLine__glow" d="' + d + '"></path>';
      html += '<circle class="chipCraftEnergyLine__node" cx="' + endX + '" cy="' + endY + '" r="4"></circle>';
      html += '</g>';
    }
    html += '</svg>';
    return html;
  }

  function _getCraftChancePct() {
    return Math.max(75, Math.min(100, 75 + _craftReagentDust * 5));
  }

  function _buildCraftReagentRowHtml() {
    var minusDisabled = _craftReagentDust <= 0;
    var plusDisabled = _craftReagentDust >= 5 || _siliconDust <= _craftReagentDust;
    return '<div class="chipCraftReagentRow">' +
      '<span class="chipCraftReagentLabel">' + t('chipCraftSiliconDust', 'Кремниевая пыль') + ':</span>' +
      '<div class="chipCraftReagentControls">' +
      '<button class="chipCraftReagentBtn" id="chipCraftReagentMinus" type="button"' + (minusDisabled ? ' disabled' : '') + '>−</button>' +
      '<span class="chipCraftReagentAmount">' + _siliconDust + ' / ' + _craftReagentDust + '</span>' +
      '<button class="chipCraftReagentBtn" id="chipCraftReagentPlus" type="button"' + (plusDisabled ? ' disabled' : '') + '>+</button>' +
      '</div>' +
      '<span class="chipCraftChanceLabel">' + t('chipCraftChance', 'Шанс: {chance}%').replace('{chance}', _getCraftChancePct()) + '</span>' +
      '</div>';
  }

  function _collectAssembleCraftPayload() {
    var h = hc();
    if (!h) return { error: 'module' };

    var fragModIds = [];
    var requiredFragments = {};
    for (var i = 0; i < 3; i++) {
      if (!_craftSlots[i] || _craftSlots[i].type !== 'fragment') return { error: 'slots' };
      var fragmentId = _craftSlots[i].fragmentId;
      fragModIds.push(fragmentId);
      requiredFragments[fragmentId] = (requiredFragments[fragmentId] || 0) + 1;
    }

    var result = h.assembleChip(fragModIds);
    if (!result) return { error: 'combo' };

    var requiredKeys = Object.keys(requiredFragments);
    for (var ri = 0; ri < requiredKeys.length; ri++) {
      var reqKey = requiredKeys[ri];
      var reqId = parseInt(reqKey, 10);
      if (getFragmentCount(reqId) < requiredFragments[reqKey]) {
        return { error: 'inventory' };
      }
    }

    var dustUsed = _craftReagentDust;
    if (dustUsed > 0 && _siliconDust < dustUsed) return { error: 'dust' };

    return {
      result: result,
      fragModIds: fragModIds,
      dustUsed: dustUsed,
      craftChancePct: _getCraftChancePct()
    };
  }

  function _resolveCraftResultChipDef(result) {
    var h = hc();
    if (!result || !h) return result;
    if (result.chipId !== -1) return result;
    var found = h.getChipByKey(h.allChips, result.sourceComboKey);
    return found || result;
  }

  function _renderCraftOutcomeItemHtml(item) {
    var h = hc();
    if (!item) return '';
    if (item.type === 'chip' && item.chipDef) {
      var chipColor = item.chipDef.chipColor === 'red' ? '#e53935' : '#fdd835';
      return '<div class="chipCraftOutcomeCard">' +
        _renderCraftSlotCard(
          chipSvgComposed(60, 54, chipColor, item.chipDef.modIds || [], 'chipCraftResultIcon', 3),
          _getChipDisplayName(item.chipDef),
          {
            badgeText: t('workshopChipLevelLabel', 'Ур.') + ' 1',
            extraClass: 'chipCraftSlotCard--chip chipCraftSlotCard--future',
            labelClass: 'chipCraftResultLabel'
          }
        ) +
        '</div>';
    }
    if (item.type === 'fragment') {
      var fragStroke = (h && h.isSpecialMod(item.fragmentId)) ? '#fdd835' : '#e53935';
      return '<div class="chipCraftOutcomeCard">' +
        _renderCraftSlotCard(
          _fragmentSvg(item.fragmentId, 50, fragStroke),
          modName(item.fragmentId),
          {
            extraClass: 'chipCraftSlotCard--fragment',
            labelClass: 'chipCraftSlotCard__name--wrapWords'
          }
        ) +
        '</div>';
    }
    if (item.type === 'dust') {
      return '<div class="chipCraftOutcomeCard chipCraftOutcomeCard--dust">' +
        '<div class="chipCraftOutcomeDust">' +
        '<span class="chipCraftOutcomeDust__label">' + t('chipCraftSiliconDust', 'Кремниевая пыль') + '</span>' +
        '<span class="chipCraftOutcomeDust__value">-' + item.amount + '</span>' +
        '</div>' +
        '</div>';
    }
    return '';
  }

  function _showCraftOutcomeModal(success, items) {
    var modal = _ensureTechModal();
    var closeLabel = t('techAccelClose', 'Закрыть');
    var title = success
      ? t('chipCraftResultSuccessTitle', 'Соединение удалось')
      : t('chipCraftResultFailureTitle', 'Соединение не удалось');
    var bodyText = success
      ? t('chipCraftResultSuccessText', 'Поздравляем! Вы получили новый чип.')
      : t('chipCraftResultFailureText', 'Попытка оказалась неудачной. Потеряны следующие ресурсы:');
    var titleClass = 'techModal__title' + (success ? '' : ' techModal__title--warn');
    var itemsHtml = '';
    for (var i = 0; i < items.length; i++) itemsHtml += _renderCraftOutcomeItemHtml(items[i]);
    modal.innerHTML = '<div class="techModal__dialog techModal__dialog--wide techModal__dialog--craft" role="dialog" aria-modal="true" aria-labelledby="chipCraftModalTitle">' +
      '<button class="modalClose scModal__close techModal__close" data-craft-modal-close type="button" aria-label="' + closeLabel + '" title="' + closeLabel + '"></button>' +
      '<div class="' + titleClass + '" id="chipCraftModalTitle">' + title + '</div>' +
      '<div class="techModal__text techModal__text--compact">' + bodyText + '</div>' +
      '<div class="chipCraftOutcomeGrid">' + itemsHtml + '</div>' +
      '<div class="techModal__btns">' +
      '<button class="btn scButton techModal__noBtn" data-craft-modal-close type="button">' + closeLabel + '</button>' +
      '</div>' +
      '</div>';
    modal.style.display = 'flex';
  }

  function _showCraftRiskConfirmModal(craftPayload) {
    var modal = _ensureTechModal();
    var closeLabel = t('techAccelClose', 'Закрыть');
    var continueLabel = t('chipCraftContinue', 'Продолжить');
    var cancelLabel = t('chipCraftDustCancel', 'Отменить');
    var dustClause = craftPayload.dustUsed > 0
      ? t('chipCraftRiskDustClause', ' и {amount} ед. кремниевой пыли').replace('{amount}', craftPayload.dustUsed)
      : '';
    var riskText = t('chipCraftRiskText', 'Шанс успеха: {chance}%. При неудаче вы потеряете 1 случайный фрагмент{dustClause}. Продолжить?')
      .replace('{chance}', craftPayload.craftChancePct)
      .replace('{dustClause}', dustClause);
    modal.innerHTML = '<div class="techModal__dialog techModal__dialog--craft" role="dialog" aria-modal="true" aria-labelledby="chipCraftModalTitle">' +
      '<button class="modalClose scModal__close techModal__close" data-craft-modal-close type="button" aria-label="' + closeLabel + '" title="' + closeLabel + '"></button>' +
      '<div class="techModal__title techModal__title--warn" id="chipCraftModalTitle">' + t('chipCraftRiskTitle', 'Риск потери ресурсов') + '</div>' +
      '<div class="techModal__text">' + riskText + '</div>' +
      '<div class="techModal__btns">' +
      '<button class="btn scButton techModal__accelConfirmBtn" data-craft-risk-confirm type="button">' + continueLabel + '</button>' +
      '<button class="btn scButton techModal__noBtn" data-craft-modal-close type="button">' + cancelLabel + '</button>' +
      '</div>' +
      '</div>';
    modal.style.display = 'flex';
  }

  function _showDisassembleConfirmModal(selectedCount) {
    var modal = _ensureTechModal();
    var closeLabel = t('techAccelClose', 'Закрыть');
    var confirmLabel = t('chipCraftDustConfirm', 'Подтвердить');
    var cancelLabel = t('chipCraftDustCancel', 'Отменить');
    var bodyText = t('chipRecycleConfirmText', 'Выбранные чипы ({count}) будут разобраны на составные элементы. Продолжить?')
      .replace('{count}', selectedCount);
    modal.innerHTML = '<div class="techModal__dialog techModal__dialog--craft" role="dialog" aria-modal="true" aria-labelledby="chipRecycleConfirmTitle">' +
      '<button class="modalClose scModal__close techModal__close" data-craft-modal-close type="button" aria-label="' + closeLabel + '" title="' + closeLabel + '"></button>' +
      '<div class="techModal__title techModal__title--warn" id="chipRecycleConfirmTitle">' + t('chipRecycleConfirmTitle', 'Подтвердить разборку') + '</div>' +
      '<div class="techModal__text">' + bodyText + '</div>' +
      '<div class="techModal__btns">' +
      '<button class="btn scButton techModal__accelConfirmBtn" data-craft-disassemble-confirm type="button">' + confirmLabel + '</button>' +
      '<button class="btn scButton techModal__noBtn" data-craft-modal-close type="button">' + cancelLabel + '</button>' +
      '</div>' +
      '</div>';
    modal.style.display = 'flex';
  }

  function _executeReprogram() {
    var state = _getReprogramState();
    if (!state.sourceFragmentId || !state.targetFragmentId || state.targetFragmentId === state.sourceFragmentId) return;
    if (state.missingDust) {
      if (global.Game && global.Game.Toast) {
        global.Game.Toast.show(t('chipReprogramNeedDust', 'Для перепрограммирования нужно 2 ед. кремниевой пыли'), 1800);
      }
      return;
    }
    if (!removePlayerFragment(state.sourceFragmentId, 1)) return;
    addPlayerFragment(state.targetFragmentId, 1);
    _siliconDust = Math.max(0, _siliconDust - REPROGRAM_DUST_COST);
    _resetReprogramState();
    renderChipCraftPanel();
    renderChipUpgradeGrid();
    if (global.Game && global.Game.Toast) {
      global.Game.Toast.show(
        t('chipReprogramSuccess', 'Фрагмент перепрограммирован: {from} → {to}')
          .replace('{from}', modName(state.sourceFragmentId))
          .replace('{to}', modName(state.targetFragmentId)),
        2000
      );
    }
  }

  /**
   * Add an inventory item to the craft slot. Auto-switches mode based on item type:
   * - chip → disassemble mode, fragment → assemble mode.
   */
  function _addItemToSlot(itemEl, srcType) {
    if (srcType === 'fragment' && _workshopSubTab === 'chipRecycle' && _chipRecycleSubTab === 'reprogram') {
      var reprogramFragmentId = parseInt(itemEl.getAttribute('data-craft-frag-id'), 10);
      if (!Number.isFinite(reprogramFragmentId)) return;
      _setReprogramSource(reprogramFragmentId);
      renderChipCraftPanel();
      return;
    }

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
      var availableCopies = _getAvailableChipCopies(chipId, chipLevel);
      if (availableCopies <= 0) return;
      /* Check how many of this chip type are already in slots */
      var alreadyInSlots = 0;
      for (var si = 0; si < _craftSlots.length; si++) {
        if (_craftSlots[si] && _craftSlots[si].chipId === chipId && _craftSlots[si].level === chipLevel) {
          alreadyInSlots++;
        }
      }
      if (alreadyInSlots >= availableCopies) {
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
    var recycleMode = _chipRecycleSubTab === 'disassemble'
      ? 'disassemble'
      : (_chipRecycleSubTab === 'reprogram' ? 'reprogram' : 'dust');
    var isDustView = isRecyclePanel && recycleMode === 'dust';
    var isDisassembleView = isRecyclePanel && recycleMode === 'disassemble';
    var isReprogramView = isRecyclePanel && recycleMode === 'reprogram';
    var isAssembleView = !isRecyclePanel;
    var showChipItems = isDisassembleView || isDustView;
    var showFragmentItems = isAssembleView || isDustView || isReprogramView;
    var reprogramState = isReprogramView ? _getReprogramState() : null;

    _dustMode = isDustView;
    if (isAssembleView) _craftMode = 'assemble';
    if (isDisassembleView) _craftMode = 'disassemble';
    if (isReprogramView) _craftMode = 'reprogram';

    var html = '';
    if (isRecyclePanel) {
      html += '<div class="workshopSubTabs workshopSubTabs--nested" role="tablist" aria-label="' + _escapeHtml(t('workshopTabChipRecycle', 'Переработка чипов')) + '">';
      html += '<button id="chipRecycleTabDust" class="btn scButton workshopSubTab workshopSubTab--nested' + (isDustView ? ' workshopSubTab--active' : '') + '" type="button" role="tab" aria-selected="' + (isDustView ? 'true' : 'false') + '" aria-controls="workshopPanelChipRecycle" tabindex="' + (isDustView ? '0' : '-1') + '" data-i18n="chipCraftDustBtn">' + t('chipCraftDustBtn', 'Распылить') + '</button>';
      html += '<button id="chipRecycleTabDisassemble" class="btn scButton workshopSubTab workshopSubTab--nested' + (isDisassembleView ? ' workshopSubTab--active' : '') + '" type="button" role="tab" aria-selected="' + (isDisassembleView ? 'true' : 'false') + '" aria-controls="workshopPanelChipRecycle" tabindex="' + (isDisassembleView ? '0' : '-1') + '" data-i18n="chipCraftDisassemble">' + t('chipCraftDisassemble', 'Разобрать') + '</button>';
      html += '<button id="chipRecycleTabReprogram" class="btn scButton workshopSubTab workshopSubTab--nested' + (isReprogramView ? ' workshopSubTab--active' : '') + '" type="button" role="tab" aria-selected="' + (isReprogramView ? 'true' : 'false') + '" aria-controls="workshopPanelChipRecycle" tabindex="' + (isReprogramView ? '0' : '-1') + '" data-i18n="workshopTabChipReprogram">' + t('workshopTabChipReprogram', 'Перепрограммировать') + '</button>';
      html += '</div>';
    }

    html += '<div class="chipCraftLayout' + (isDustView ? ' chipCraftLayout--singleCol' : '') + '">';

    /* ── Left column: wrapper for inventory box + bottom bar ── */
    html += '<div class="chipCraftLeftCol">';

    /* ── Left column: Inventory of fragments / whole chips ── */
    html += '<div class="chipCraftInventory">';
    html += '<div class="chipCraftInvGrid">';

    var displayedItems = 0;

    function renderFragmentInventoryCard(fragmentId, displayCount, extraClass, isDisabled) {
      var fragStroke = (h && h.isSpecialMod(fragmentId)) ? '#fdd835' : '#e53935';
      var fragName = modName(fragmentId);
      var disabledAttr = isDisabled ? ' data-craft-disabled="true"' : '';
      return '<div class="chipCraftInvItem chipCraftInvItem--fragment' + (extraClass || '') +
        '" data-craft-src="fragment" data-craft-frag-id="' + fragmentId + '" data-craft-display-count="' + displayCount + '"' + disabledAttr + '>' +
        _fragmentSvg(fragmentId, 22, fragStroke) +
        '<span class="chipCraftInvLabel">' + _renderChipNameHtml(fragName) + '</span>' +
        '<span class="chipCraftInvLevel">×' + displayCount + '</span>' +
        '</div>';
    }

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
        var selectedChipCount = isDisassembleView ? _countSelectedCraftChipCopies(pc.chipId, pc.level) : 0;
        var chipSelectedClass = ((isDustView && dustSel > 0) || selectedChipCount > 0) ? ' chipCraftInvItem--dustSelected' : '';
        html += '<div class="chipCraftInvItem' + chipSelectedClass +
          '" data-craft-src="chip" data-craft-chip-id="' + pc.chipId + '" data-craft-chip-level="' + pc.level + '" data-craft-display-count="' + pc.count + '" title="">';
        if (isDustView) {
          html += '<label class="chipCraftDustCheck"><input type="checkbox" data-dust-key="' + dustKey + '" data-dust-type="chip" data-dust-max="' + pc.count + '"' +
            (dustSel > 0 ? ' checked' : '') + '><span class="chipCraftDustCheckmark"></span></label>';
          if (dustSel > 0 && pc.count > 1) {
            html += '<span class="chipCraftDustCount">' + dustSel + '/' + pc.count + '</span>';
          }
        } else if (selectedChipCount > 0 && pc.count > 1) {
          html += '<span class="chipCraftInvStateCount">' + selectedChipCount + '/' + pc.count + '</span>';
        }
        html += chipSvgComposed(40, 36, borderColor, pc.modIds, 'chipCraftInvIcon', 2.5);
        html += '<span class="chipCraftInvLabel">' + _renderChipNameHtml(chipName) + '</span>';
        html += '<span class="chipCraftInvLevel">Ур. ' + pc.level + (pc.count > 1 ? ' • ×' + pc.count : '') + '</span>';
        html += '</div>';
      }
    }

    var playerFrags = ensurePlayerFragments();
    if (showFragmentItems) {
      for (var fi = 0; fi < playerFrags.length; fi++) {
        var frag = playerFrags[fi];
        if (frag.count <= 0) continue;
        if (isDustView) {
          for (var unitIndex = 0; unitIndex < frag.count; unitIndex++) {
            displayedItems++;
            var fragDustStroke = (h && h.isSpecialMod(frag.fragmentId)) ? '#fdd835' : '#e53935';
            var fragDustName = modName(frag.fragmentId);
            var dustKeyUnit = 'frag_' + frag.fragmentId + '_' + unitIndex;
            var dustSelUnit = _dustSelected[dustKeyUnit] || 0;
            html += '<div class="chipCraftInvItem chipCraftInvItem--fragment' + (dustSelUnit > 0 ? ' chipCraftInvItem--dustSelected' : '') +
              '" data-craft-src="fragment" data-craft-frag-id="' + frag.fragmentId + '">';
            html += '<label class="chipCraftDustCheck"><input type="checkbox" data-dust-key="' + dustKeyUnit + '" data-dust-type="fragment" data-dust-max="1"' +
              (dustSelUnit > 0 ? ' checked' : '') + '><span class="chipCraftDustCheckmark"></span></label>';
            html += _fragmentSvg(frag.fragmentId, 22, fragDustStroke);
            html += '<span class="chipCraftInvLabel">' + _renderChipNameHtml(fragDustName) + '</span>';
            html += '<span class="chipCraftInvLevel">×1</span>';
            html += '</div>';
          }
          continue;
        }
        displayedItems++;
        var dustKeyF = 'frag_' + frag.fragmentId;
        var dustSelF = _dustSelected[dustKeyF] || 0;
        if (isAssembleView) {
          displayedItems--;
          var selectedFragCount = _countSelectedCraftFragments(frag.fragmentId);
          var remainingFragCount = Math.max(0, frag.count - selectedFragCount);
          if (selectedFragCount > 0) {
            displayedItems++;
            html += renderFragmentInventoryCard(frag.fragmentId, selectedFragCount, ' chipCraftInvItem--dustSelected chipCraftInvItem--selectedStack', true);
          }
          if (remainingFragCount > 0) {
            displayedItems++;
            html += renderFragmentInventoryCard(
              frag.fragmentId,
              remainingFragCount,
              _canAddFragment(frag.fragmentId) ? ' chipCraftInvItem--canAdd' : ' chipCraftInvItem--cantAdd',
              false
            );
          }
          continue;
        }
        html += '<div class="chipCraftInvItem chipCraftInvItem--fragment' + (isDustView && dustSelF > 0 ? ' chipCraftInvItem--dustSelected' : '') +
          '" data-craft-src="fragment" data-craft-frag-id="' + frag.fragmentId + '" data-craft-display-count="' + frag.count + '">';
        if (isDustView) {
          html += '<label class="chipCraftDustCheck"><input type="checkbox" data-dust-key="' + dustKeyF + '" data-dust-type="fragment" data-dust-max="' + frag.count + '"' +
            (dustSelF > 0 ? ' checked' : '') + '><span class="chipCraftDustCheckmark"></span></label>';
          if (dustSelF > 0 && frag.count > 1) {
            html += '<span class="chipCraftDustCount">' + dustSelF + '/' + frag.count + '</span>';
          }
        }
        html += _fragmentSvg(frag.fragmentId, 22, (h && h.isSpecialMod(frag.fragmentId)) ? '#fdd835' : '#e53935');
        html += '<span class="chipCraftInvLabel">' + _renderChipNameHtml(modName(frag.fragmentId)) + '</span>';
        html += '<span class="chipCraftInvLevel">×' + frag.count + '</span>';
        html += '</div>';
      }
    }

    if (!displayedItems) {
      html += '<div class="chipUpgradeEmptyLabel" style="padding:20px 0">' + t('chipCraftNoItems', 'Нет чипов или фрагментов') + '</div>';
    }

    html += '</div>'; // chipCraftInvGrid

    html += '</div>'; // chipCraftInventory

    /* ── Bottom bar outside inventory: dust controls + silicon dust display (dust view only) ── */
    if (isDustView) {
      html += '<div class="chipCraftBottomBar">';
      html += '<span class="chipCraftDustResource">' + t('chipCraftSiliconDust', 'Кремниевая пыль') + ': <b>' + _siliconDust + '</b></span>';
      html += '<div class="chipCraftDustActions">';
      html += '<button class="btn scButton chipCraftDustConfirmBtn" id="chipCraftDustConfirm" type="button">' + t('chipCraftDustConfirm', 'Подтвердить') + '</button>';
      html += '<button class="btn scButton chipCraftDustCancelBtn" id="chipCraftDustCancel" type="button">' + t('chipCraftDustCancel', 'Отменить') + '</button>';
      var dustTotal = _calcDustTotal();
      var dustTotalVisible = Object.keys(_dustSelected).length > 0;
      html += '<span class="chipCraftDustTotal" id="chipCraftDustTotal"' + (dustTotalVisible ? '' : ' style="display:none"') + '>' +
        t('chipCraftDustResult', 'Получите кремниевой пыли: {amount}').replace('{amount}', dustTotal) + '</span>';
      html += '</div>';
      html += '</div>'; // chipCraftBottomBar
    }

    html += '</div>'; // chipCraftLeftCol

    if (!isDustView) {
      /* ── Right column: Craft preview area ── */
      var hasContent = false;
      var slotsLen = _craftSlots.length;
      for (var si = 0; si < slotsLen; si++) {
        if (_craftSlots[si]) { hasContent = true; break; }
      }
      var previewClass = 'chipCraftPreview' + (isDisassembleView ? ' chipCraftPreview--disassemble' : '');
      var dropZoneClass = 'chipCraftDropZone' + (isDisassembleView && hasContent ? ' chipCraftDropZone--disassemble' : '');
      html += '<div class="' + previewClass + '">';
      html += '<div class="' + dropZoneClass + '" id="chipCraftDropZone">';
        if (isDisassembleView && hasContent) {
          /* Dynamic disassemble slots: show all chips + one empty "+" slot */
          html += '<div class="chipCraftSlotRow chipCraftSlotRow--disassemble">';
          for (var sj = 0; sj < _craftSlots.length; sj++) {
            var slot = _craftSlots[sj];
            if (!slot) continue;
            var slotChipName = _getChipDisplayName(slot);
            html += '<div class="chipCraftSlot chipCraftSlot--filled" data-craft-slot-idx="' + sj + '" data-hct-chip-id="' + slot.chipId + '" data-hct-chip-level="' + (slot.level || 1) + '" title="">';
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
      } else if (isDisassembleView) {
          html += '<div class="chipCraftDropZone__body">';
          html += '<div class="chipCraftEmptyPreview">';
          html += '<svg viewBox="0 0 120 108" class="chipCraftPlaceholderSvg">' +
            '<polygon points="60,8 112,100 8,100" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-dasharray="6,3"/>' +
            '<line x1="60" y1="8" x2="60" y2="66" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
            '<line x1="60" y1="66" x2="24" y2="80" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
            '<line x1="60" y1="66" x2="96" y2="80" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
            '</svg>';
          html += '</div>';
          html += '<div class="chipCraftSlotOverlay" aria-hidden="true">' +
            '<span class="chipCraftSlotOverlay__text">' + t('chipCraftDisassembleOverlayHint', 'Перетащите сюда чип') + '</span>' +
            '</div>';
          html += '</div>';
      } else if (isAssembleView) {
          /* Assemble mode: 3 fixed slots horizontal + power lines (top→bottom) + result chip */
          var assemblePreview = _previewAssembleResult();
          var anyFilled = _craftSlots.some(function(s) { return s !== null && s !== undefined; });
          html += '<div class="chipCraftDropZone__body">';
          html += '<div class="chipCraftAssemblyStage">';
          html += '<div class="chipCraftIngredientRow">';
          for (var sj2 = 0; sj2 < 3; sj2++) {
            if (sj2 > 0) html += '<span class="chipCraftSlotSep" aria-hidden="true">+</span>';
            var slot2 = _craftSlots[sj2];
            var slotDataAttr2 = (slot2 && slot2.type === 'fragment') ? ' data-hct-frag-id="' + slot2.fragmentId + '"' : '';
            html += '<div class="chipCraftSlot chipCraftSlot--assembleIngredient' + (slot2 ? ' chipCraftSlot--filled' : '') + '" data-craft-slot-idx="' + sj2 + '"' + slotDataAttr2 + '>';
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
                  {
                    extraClass: 'chipCraftSlotCard--fragment',
                    labelClass: 'chipCraftSlotCard__name--wrapWords'
                  }
                );
              }
              html += _renderCraftRemoveButton(sj2);
            } else {
              html += '<div class="chipCraftSlotEmpty">+</div>';
            }
            html += '</div>';
          }
          html += '</div>'; // chipCraftIngredientRow
          html += '<div class="chipCraftEnergyRail">' + _renderCraftEnergyLines() + '</div>';
          html += '<div class="chipCraftAssemblyResult">';
          if (assemblePreview) {
            var resultColor = assemblePreview.chipColor === 'red' ? '#e53935' : '#fdd835';
            var resultModIds = assemblePreview.modIds || [];
            var resultModsAttr = resultModIds.join(',');
            var resultColorAttr = assemblePreview.chipColor || '';
            html += '<div class="chipCraftResultChip chipCraftResultChip--future" data-hct-result-modids="' + resultModsAttr + '" data-hct-result-color="' + resultColorAttr + '" title="">';
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
          html += '</div>'; // chipCraftAssemblyResult
          html += '</div>'; // chipCraftAssemblyStage
          if (!anyFilled) {
            html += '<div class="chipCraftSlotOverlay" aria-hidden="true">' +
              '<span class="chipCraftSlotOverlay__text">' + t('chipCraftSlotOverlayHint', 'Перетащите сюда фрагмент чипа') + '</span>' +
              '</div>';
          }
          html += '</div>'; // chipCraftDropZone__body
          html += _buildCraftReagentRowHtml();
      } else if (isReprogramView) {
          html += '<div class="chipCraftDropZone__body">';
          html += '<div class="chipCraftReprogramStage">';
          html += '<div class="chipCraftReprogramColumn">';
          if (reprogramState && reprogramState.sourceFragmentId) {
            var sourceStroke = (h && h.isSpecialMod(reprogramState.sourceFragmentId)) ? '#fdd835' : '#e53935';
            html += '<div class="chipCraftSlot chipCraftSlot--filled" data-reprogram-source-slot data-hct-frag-id="' + reprogramState.sourceFragmentId + '">';
            html += _renderCraftSlotCard(
              _fragmentSvg(reprogramState.sourceFragmentId, 50, sourceStroke),
              modName(reprogramState.sourceFragmentId),
              {
                extraClass: 'chipCraftSlotCard--fragment',
                labelClass: 'chipCraftSlotCard__name--wrapWords'
              }
            );
            html += _renderCraftRemoveButton('reprogram');
            html += '</div>';
          } else {
            html += '<div class="chipCraftSlot">';
            html += '<div class="chipCraftSlotEmpty">+</div>';
            html += '</div>';
          }
          html += '</div>';
          html += '<div class="chipCraftReprogramControls">';
          html += '<label class="chipCraftReprogramLabel" for="chipCraftReprogramSelect">' + t('chipReprogramSelectLabel', 'Новое свойство') + '</label>';
          html += '<div class="chipCraftReprogramSelectWrap">';
          html += '<select class="chipCraftReprogramSelect" id="chipCraftReprogramSelect"' + (!reprogramState || !reprogramState.sourceFragmentId ? ' disabled' : '') + '>';
          if (reprogramState && reprogramState.sourceFragmentId) {
            for (var rpi = 0; rpi < reprogramState.availableModIds.length; rpi++) {
              var reprogramModId = reprogramState.availableModIds[rpi];
              if (reprogramModId === reprogramState.sourceFragmentId) continue;
              html += '<option value="' + reprogramModId + '"' + (reprogramModId === reprogramState.targetFragmentId ? ' selected' : '') + '>' + _escapeHtml(modName(reprogramModId)) + '</option>';
            }
          } else {
            html += '<option value="">' + _escapeHtml(t('chipCraftSlotOverlayHint', 'Перетащите сюда фрагмент чипа')) + '</option>';
          }
          html += '</select>';
          html += '</div>';
          html += '<div class="chipCraftReprogramDustInfo' + (reprogramState && reprogramState.missingDust ? ' chipCraftReprogramDustInfo--warn' : '') + '">' +
            t('chipReprogramDustCost', 'Кремниевая пыль: {have} / {need}')
              .replace('{have}', _siliconDust)
              .replace('{need}', REPROGRAM_DUST_COST) +
            '</div>';
          html += '</div>';
          html += '<div class="chipCraftReprogramColumn">';
          if (reprogramState && reprogramState.targetFragmentId) {
            var targetStroke = (h && h.isSpecialMod(reprogramState.targetFragmentId)) ? '#fdd835' : '#4af626';
            html += '<div class="chipCraftResultChip chipCraftResultChip--future" data-hct-result-frag-id="' + reprogramState.targetFragmentId + '">';
            html += _renderCraftSlotCard(
              _fragmentSvg(reprogramState.targetFragmentId, 50, targetStroke),
              modName(reprogramState.targetFragmentId),
              {
                extraClass: 'chipCraftSlotCard--fragment chipCraftSlotCard--future',
                labelClass: 'chipCraftSlotCard__name--wrapWords chipCraftResultLabel'
              }
            );
            html += '</div>';
          } else {
            html += '<div class="chipCraftSlot chipCraftSlot--resultSlot">';
            html += '<div class="chipCraftSlotEmpty" style="opacity:0.3">?</div>';
            html += '</div>';
          }
          html += '</div>';
          html += '</div>';
          if (!reprogramState || !reprogramState.sourceFragmentId) {
            html += '<div class="chipCraftSlotOverlay" aria-hidden="true">' +
              '<span class="chipCraftSlotOverlay__text">' + t('chipCraftSlotOverlayHint', 'Перетащите сюда фрагмент чипа') + '</span>' +
              '</div>';
          }
          html += '</div>';
      } else {
        html += '<div class="chipCraftEmptyPreview">';
        html += '<svg viewBox="0 0 120 108" class="chipCraftPlaceholderSvg">' +
          '<polygon points="60,8 112,100 8,100" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-dasharray="6,3"/>' +
          '<line x1="60" y1="8" x2="60" y2="66" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
          '<line x1="60" y1="66" x2="24" y2="80" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
          '<line x1="60" y1="66" x2="96" y2="80" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
          '</svg>';
        html += '</div>';
      }
      html += '</div>'; // chipCraftDropZone

      /* ── Action button below drop zone (always visible, disabled when no valid content) ── */
      var slotMode = _detectCraftMode();
      var expectedMode = isDisassembleView ? 'disassemble' : 'assemble';
      var canExec = isReprogramView
        ? !!(reprogramState && reprogramState.canExecute)
        : (hasContent && slotMode === expectedMode);
      var execLabel = isDisassembleView
        ? t('chipCraftDisassemble', 'Разобрать')
        : (isReprogramView
          ? t('chipReprogramAction', 'Перепрограммировать')
          : t('chipCraftAssemble', 'Создать чип'));
      html += '<button class="btn scButton chipCraftActionBtn' + (!canExec ? ' chipCraftActionBtn--disabled' : '') +
        '" id="chipCraftActionBtn" type="button"' + (!canExec ? ' disabled' : '') + '>' + execLabel + '</button>';

      html += '</div>'; // chipCraftPreview
    }

    html += '</div>'; // chipCraftLayout

    panel.innerHTML = html;
    _suppressNativeChipTooltips(panel);

    /* ── Attach event handlers for craft panel ── */
    _attachCraftPanelEvents(panel);
  }

  function _attachCraftPanelEvents(panel) {
    /* NOTE: use panel.querySelector instead of el() (getElementById) to avoid
       binding to stale elements in the hidden sibling panel (chipCraft / chipRecycle
       both use the same id strings, so getElementById returns the first in DOM). */
    function pelq(id) { return panel.querySelector('#' + id); }

    var recycleDustTab = pelq('chipRecycleTabDust');
    if (recycleDustTab) {
      recycleDustTab.addEventListener('click', function () {
        switchChipRecycleSubTab('dust');
      });
    }
    var recycleDisassembleTab = pelq('chipRecycleTabDisassemble');
    if (recycleDisassembleTab) {
      recycleDisassembleTab.addEventListener('click', function () {
        switchChipRecycleSubTab('disassemble');
      });
    }
    var recycleReprogramTab = pelq('chipRecycleTabReprogram');
    if (recycleReprogramTab) {
      recycleReprogramTab.addEventListener('click', function () {
        switchChipRecycleSubTab('reprogram');
      });
    }

    /* ── Dust mode buttons ── */
    var dustBtn = pelq('chipCraftDustBtn');
    if (dustBtn) {
      dustBtn.addEventListener('click', function () {
        _dustMode = true;
        _dustSelected = {};
        renderChipCraftPanel();
      });
    }
    var dustConfirm = pelq('chipCraftDustConfirm');
    if (dustConfirm) {
      dustConfirm.addEventListener('click', function () {
        _executeDust();
      });
    }
    var dustCancel = pelq('chipCraftDustCancel');
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
      var dropZone = pelq('chipCraftDropZone');
      var invItems = panel.querySelectorAll('.chipCraftInvItem');
      for (var i = 0; i < invItems.length; i++) {
        (function (item) {
          /* ── Click handler (also serves as drag-drop fallback) ── */
          item.addEventListener('click', function (evt) {
            /* Skip if click was on a checkbox */
            if (evt.target.tagName === 'INPUT') return;
            if (item.getAttribute('data-craft-disabled') === 'true') return;
            var srcType = item.getAttribute('data-craft-src');
            _addItemToSlot(item, srcType);
          });

          /* ── Pointer-based drag to drop zone ── */
          item.addEventListener('pointerdown', function (evt) {
            if (_dustMode) return;
            if (evt.target.tagName === 'INPUT') return;
            if (item.getAttribute('data-craft-disabled') === 'true') return;
            var srcType = item.getAttribute('data-craft-src');
            var startX = evt.clientX, startY = evt.clientY;
            var moved = false;
            var ghost = null;
            var rect = item.getBoundingClientRect();
            var ghostWidth = Math.ceil(rect.width);
            var ghostHeight = Math.ceil(rect.height);
            var ghostOffsetX = Math.round(ghostWidth / 2);
            var ghostOffsetY = Math.round(ghostHeight / 2);

            function onMove(e) {
              var dx = e.clientX - startX, dy = e.clientY - startY;
              if (!moved && (dx * dx + dy * dy) < 36) return; // 6px threshold
              moved = true;
              if (!ghost) {
                ghost = item.cloneNode(true);
                ghost.className = item.className + ' chipCraftDragGhost';
                ghost.style.position = 'fixed';
                ghost.style.zIndex = '10000';
                ghost.style.pointerEvents = 'none';
                ghost.style.opacity = '0.75';
                ghost.style.width = ghostWidth + 'px';
                ghost.style.minHeight = ghostHeight + 'px';
                ghost.style.height = ghostHeight + 'px';
                ghost.style.boxSizing = 'border-box';
                ghost.style.margin = '0';
                _doc.body.appendChild(ghost);
              }
              ghost.style.left = (e.clientX - ghostOffsetX) + 'px';
              ghost.style.top = (e.clientY - ghostOffsetY) + 'px';
            }

            function onUp(e) {
              _doc.removeEventListener('pointermove', onMove);
              _doc.removeEventListener('pointerup', onUp);
              if (ghost) { ghost.remove(); ghost = null; }
              if (!moved) return; // handled by click
              /* Did we drop over chipCraftDropZone? */
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
        var rawIdx = evt.currentTarget.getAttribute('data-craft-remove');
        if (rawIdx === 'reprogram') {
          _resetReprogramState();
          renderChipCraftPanel();
          return;
        }
        var idx = parseInt(rawIdx, 10);
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
    var reagentMinus = pelq('chipCraftReagentMinus');
    if (reagentMinus) {
      reagentMinus.addEventListener('click', function () {
        if (_craftReagentDust > 0) {
          _craftReagentDust--;
          renderChipCraftPanel();
        }
      });
    }
    var reagentPlus = pelq('chipCraftReagentPlus');
    if (reagentPlus) {
      reagentPlus.addEventListener('click', function () {
        if (_craftReagentDust < 5 && _siliconDust > _craftReagentDust) {
          _craftReagentDust++;
          renderChipCraftPanel();
        }
      });
    }

    /* Click on action button */
    var actionBtn = pelq('chipCraftActionBtn');
    if (actionBtn) {
      actionBtn.addEventListener('click', function () {
        _executeCraftAction();
      });
    }

    var reprogramSelect = pelq('chipCraftReprogramSelect');
    if (reprogramSelect) {
      reprogramSelect.addEventListener('change', function (evt) {
        var nextTargetId = parseInt(evt.target.value, 10);
        _reprogramTargetFragmentId = Number.isFinite(nextTargetId) ? nextTargetId : null;
        renderChipCraftPanel();
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
  function _executeCraftAction(options) {
    var h = hc();
    if (!h) return;
    var skipRiskConfirm = false;
    var skipDisassembleConfirm = false;
    if (options === true) {
      skipRiskConfirm = true;
    } else if (options && typeof options === 'object') {
      skipRiskConfirm = !!options.skipRiskConfirm;
      skipDisassembleConfirm = !!options.skipDisassembleConfirm;
    }

    if (_craftMode === 'reprogram' && _workshopSubTab === 'chipRecycle' && _chipRecycleSubTab === 'reprogram') {
      _executeReprogram();
      return;
    }

    var mode = _detectCraftMode();

    if (mode === 'disassemble') {
      var selectedChipCount = 0;
      for (var ci = 0; ci < _craftSlots.length; ci++) {
        if (_craftSlots[ci] && _craftSlots[ci].type === 'chip') selectedChipCount++;
      }
      if (!skipDisassembleConfirm && selectedChipCount > 0) {
        _showDisassembleConfirmModal(selectedChipCount);
        return;
      }

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
      var craftPayload = _collectAssembleCraftPayload();
      if (craftPayload.error === 'combo') {
        if (global.Game && global.Game.Toast) global.Game.Toast.show(t('chipCraftInvalidCombo', 'Невозможно создать чип из этих фрагментов'), 1800);
        return;
      }
      if (craftPayload.error === 'dust') {
        if (global.Game && global.Game.Toast) global.Game.Toast.show(t('chipCraftNotEnoughDust', 'Недостаточно кремниевой пыли'), 1800);
        return;
      }
      if (craftPayload.error) {
        if (global.Game && global.Game.Toast) global.Game.Toast.show(t('chipCraftNoChipInv', 'Не удалось подтвердить выбранные фрагменты'), 1800);
        return;
      }

      if (!skipRiskConfirm && craftPayload.craftChancePct < 100) {
        _showCraftRiskConfirmModal(craftPayload);
        return;
      }

      if (Math.random() * 100 >= craftPayload.craftChancePct) {
        var lostFragmentId = craftPayload.fragModIds[Math.floor(Math.random() * craftPayload.fragModIds.length)];
        var lostItems = [];
        removePlayerFragment(lostFragmentId, 1);
        lostItems.push({ type: 'fragment', fragmentId: lostFragmentId });
        if (craftPayload.dustUsed > 0) {
          _siliconDust = Math.max(0, _siliconDust - craftPayload.dustUsed);
          lostItems.push({ type: 'dust', amount: craftPayload.dustUsed });
        }
        _resetCraftSlots();
        renderChipCraftPanel();
        renderChipUpgradeGrid();
        _showCraftOutcomeModal(false, lostItems);
        return;
      }

      for (var ri = 0; ri < craftPayload.fragModIds.length; ri++) {
        removePlayerFragment(craftPayload.fragModIds[ri], 1);
      }
      if (craftPayload.dustUsed > 0) {
        _siliconDust = Math.max(0, _siliconDust - craftPayload.dustUsed);
      }

      var chipDef = _resolveCraftResultChipDef(craftPayload.result);

      /* Add assembled chip to inventory at level 1 */
      addPlayerChip(chipDef, 1);

      _resetCraftSlots();
      renderChipCraftPanel();
      renderChipUpgradeGrid();
      _showCraftOutcomeModal(true, [{ type: 'chip', chipDef: chipDef }]);
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
        var chipBtn = tgt.closest('.hangarChipInvItem[data-chip-id]');
        if (chipBtn) { showHangarChipBtnTooltip(chipBtn); return; }
        /* Tech acceleration modal whole-chip cards */
        var accelChip = tgt.closest('[data-accel-chip-id]');
        if (accelChip) { showTechAccelChipTooltip(accelChip); return; }
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
            _positionTooltipElement(_slotTooltipEl, evt.clientX + 12, evt.clientY + 16);
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
          tgt.closest('.hangarChipInvItem[data-chip-id]') ||
          tgt.closest('[data-accel-chip-id]') ||
          tgt.closest('.chipCraftInvItem') ||
          tgt.closest('.chipCraftResultChip') ||
          tgt.closest('[data-hct-chip-id]') ||
          tgt.closest('[data-hct-frag-id]');
        if (leavingTrigger) {
          var staysInTrigger = rel && rel.closest && (
            rel.closest('[data-chip-upgrade-id]') ||
            rel.closest('.hangarChipInvItem[data-chip-id]') ||
            rel.closest('[data-accel-chip-id]') ||
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
          var chipBtnRect = chipBtn.getBoundingClientRect();
          var ghost2 = chipBtn.cloneNode(true);
          ghost2.className = chipBtn.className + ' chipDragGhost';
          ghost2.style.position = 'fixed';
          ghost2.style.left = evt.clientX + 'px';
          ghost2.style.top = evt.clientY + 'px';
          ghost2.style.width = Math.ceil(chipBtnRect.width) + 'px';
          ghost2.style.minHeight = Math.ceil(chipBtnRect.height) + 'px';
          ghost2.style.height = Math.ceil(chipBtnRect.height) + 'px';
          ghost2.style.boxSizing = 'border-box';
          ghost2.style.pointerEvents = 'none';
          ghost2.style.zIndex = '99999';
          ghost2.style.opacity = '0.85';
          ghost2.style.transform = 'translate(-50%, -50%)';
          ghost2.setAttribute('aria-hidden', 'true');
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
          /* Capture pointer so touch drag survives browser pan/scroll */
          if (evt.pointerId !== undefined) {
            try { overlay.setPointerCapture(evt.pointerId); } catch(e) { /* noop */ }
          }
          return;
        }

        var card = evt.target.closest ? evt.target.closest('[data-drag-chip-id]') : null;
        if (!card) return;
        var chipId = parseInt(card.getAttribute('data-drag-chip-id'), 10);
        var level = parseInt(card.getAttribute('data-drag-chip-level'), 10);
        if (!Number.isFinite(chipId) || !Number.isFinite(level)) return;

        /* Only allow dragging chips that have a matching entry for merge */
        var chips = ensurePlayerChips();
        var pairCounts = buildChipMergePairCounts(chips);
        if (getChipMergePairCount(pairCounts, chipId, level) < 2) return;

        evt.preventDefault();

        /* Create ghost element with the same footprint as the source card. */
        var rect = card.getBoundingClientRect();
        var ghost = card.cloneNode(true);
        ghost.className = card.className + ' chipDragGhost chipUpgradeCard--dragGhost';
        ghost.style.position = 'fixed';
        ghost.style.left = evt.clientX + 'px';
        ghost.style.top = evt.clientY + 'px';
        ghost.style.width = Math.ceil(rect.width) + 'px';
        ghost.style.minHeight = Math.ceil(rect.height) + 'px';
        ghost.style.height = Math.ceil(rect.height) + 'px';
        ghost.style.boxSizing = 'border-box';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '99999';
        ghost.style.opacity = '0.85';
        ghost.style.transform = 'translate(-50%, -50%)';
        ghost.setAttribute('aria-hidden', 'true');
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
        /* Capture pointer so touch drag survives browser pan/scroll */
        if (evt.pointerId !== undefined) {
          try { overlay.setPointerCapture(evt.pointerId); } catch(e) { /* noop */ }
        }
      });

      overlay.addEventListener('pointermove', function(evt) {
        /* Prevent browser scroll/pan while dragging on touch devices */
        if ((_slotDragging || _chipDragging) && evt.cancelable) {
          evt.preventDefault();
        }
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
            activateInstalledSlotActions(slotType, slotId);
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

      function _cancelAllDrags() {
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
      }

      overlay.addEventListener('pointerleave', _cancelAllDrags);

      /* Clean up on pointer cancel (touch drag interrupted by browser) */
      overlay.addEventListener('pointercancel', function(evt) {
        _cancelAllDrags();
        if (evt.pointerId !== undefined) {
          try { overlay.releasePointerCapture(evt.pointerId); } catch(e) { /* noop */ }
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

  function getActiveHangarTab() {
    return _activeHangarTab;
  }

  function getSelectedCellIndex() {
    return _selectedCell;
  }

  function getTutorialFirstRedChipElement() {
    return _doc ? _doc.querySelector('#modsHangarOverlay [data-tutorial-hangar-first-red-chip="true"]') : null;
  }

  function getTutorialFirstRedSlotElement() {
    return _doc ? _doc.querySelector('#modsHangarOverlay [data-tutorial-hangar-first-red-slot="true"]') : null;
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
    getActiveHangarTab: getActiveHangarTab,
    getSelectedCellIndex: getSelectedCellIndex,
    getTutorialFirstRedChipElement: getTutorialFirstRedChipElement,
    getTutorialFirstRedSlotElement: getTutorialFirstRedSlotElement,
    switchHangarTab: switchHangarTab,
    switchWorkshopSubTab: switchWorkshopSubTab,
    getPlayerChips: getPlayerChips,
    hasPlayerOwnedWholeChip: hasPlayerOwnedWholeChip,
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
    resetTransientUiState: resetTransientUiState,
    debugInstallChipById: debugInstallChipById,
    debugInstallByKey: debugInstallByKey,
    debugRemoveChip: debugRemoveChip,
    debugClearCell: debugClearCell,
    debugGetCellState: debugGetCellState
  };
})(typeof window !== 'undefined' ? window : this);
