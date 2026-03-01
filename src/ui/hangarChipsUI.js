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
  var GAP = 5; 
  var side = 160; 
  var h_tri = side * Math.sqrt(3) / 2; // ~112.5
  
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

  /** Get offset points for a triangle with a gap */
  function getGappedPoints(pts) {
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
      var ox = (dx / dist) * (dist - GAP);
      var oy = (dy / dist) * (dist - GAP);
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

  function polyPoints(keys) {
    var pts = getGappedPoints(keys);
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

      svg += '<g class="hangarSlotGroup">';
      svg += '<polygon class="hangarSlotPoly' + selectedClass + workingClass + '" points="' + polyPoints(def.pts) + '" ' +
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
      '<div class="hangarChipsFilters">' +
      '<button class="hangarFilterBtn' + (_chipFilter === 'all' ? ' active' : '') + '" data-filter="all">Все</button>' +
      '<button class="hangarFilterBtn' + (_chipFilter === 'red' ? ' active' : '') + '" data-filter="red" style="color:#e53935">Красные</button>' +
      '<button class="hangarFilterBtn' + (_chipFilter === 'yellow' ? ' active' : '') + '" data-filter="yellow" style="color:#fdd835">Жёлтые</button>' +
      '</div></div>';

    html += '<div class="hangarChipsGridWrap"><div class="hangarChipsGrid">';
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      var borderColor = chip.chipColor === 'red' ? '#e53935' : '#fdd835';
      html += '<button class="hangarChipBtn" data-chip-id="' + chip.chipId + '" type="button" ' +
        'title="' + chip.sourceComboKey + ': ' + chip.modIds.map(function(m) { return modName(m); }).join(', ') + '">' +
        '<svg viewBox="0 0 40 36" class="hangarChipIcon">' +
        '<polygon points="20,3 38,34 2,34" fill="none" stroke="' + borderColor + '" stroke-width="2.5"/>';

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
    if (!isCells) renderChipUpgradeGrid();
  }

  /* ─── Workshop sub-tab switching ───────────────────────── */

  function switchWorkshopSubTab(tabId) {
    var tabChipUpgrade = el('workshopTabChipUpgrade');
    var tabTechUnlock = el('workshopTabTechUnlock');
    var panelChipUpgrade = el('workshopPanelChipUpgrade');
    var panelTechUnlock = el('workshopPanelTechUnlock');
    if (!tabChipUpgrade || !tabTechUnlock) return;

    var isChips = tabId === 'chipUpgrade';
    tabChipUpgrade.setAttribute('aria-selected', isChips ? 'true' : 'false');
    tabChipUpgrade.setAttribute('tabindex', isChips ? '0' : '-1');
    tabChipUpgrade.classList.toggle('workshopSubTab--active', isChips);
    tabTechUnlock.setAttribute('aria-selected', isChips ? 'false' : 'true');
    tabTechUnlock.setAttribute('tabindex', isChips ? '-1' : '0');
    tabTechUnlock.classList.toggle('workshopSubTab--active', !isChips);
    if (panelChipUpgrade) panelChipUpgrade.hidden = !isChips;
    if (panelTechUnlock) panelTechUnlock.hidden = isChips;

    if (isChips) renderChipUpgradeGrid();
    if (!isChips) renderTechUnlockPanel();
  }

  /* ─── Tech Unlock state ────────────────────────────────── */
  var _techFeedProgress = {}; // modId → number of chips fed so far

  function getTechFeedProgress() { return _techFeedProgress; }
  function setTechFeedProgress(obj) { _techFeedProgress = (obj && typeof obj === 'object') ? obj : {}; }

  /** Render the Technology Unlock panel */
  function renderTechUnlockPanel() {
    var panel = el('workshopPanelTechUnlock');
    if (!panel) return;
    var h = hc();
    if (!h || !h.TECH_TREE) {
      panel.innerHTML = '<div class="levelModal__line hangarWipLabel">' + t('workshopTechUnlockWIP', 'В разработке') + '</div>';
      return;
    }

    var chips = ensurePlayerChips();
    var totalChips = 0;
    for (var ti = 0; ti < chips.length; ti++) totalChips += chips[ti].count;

    var html = '<div class="techUnlockHeader">' +
      '<span class="techUnlockTitle">' + t('techUnlockTitle', 'Открытие технологий') + '</span>' +
      '<span class="techUnlockChipCount">' + t('techUnlockChipsAvail', 'Чипов в инвентаре: {count}').replace('{count}', totalChips) + '</span>' +
      '</div>';

    html += '<div class="techUnlockGrid">';

    var treeKeys = Object.keys(h.TECH_TREE);
    for (var tk = 0; tk < treeKeys.length; tk++) {
      var baseModId = Number(treeKeys[tk]);
      var chain = h.TECH_TREE[baseModId];
      var baseName = modName(baseModId);

      html += '<div class="techUnlockGroup">';
      html += '<div class="techUnlockGroup__base">' + t('techUnlockBaseMod', 'Базовая: {name}').replace('{name}', baseName) + '</div>';

      for (var ci = 0; ci < chain.length; ci++) {
        var tech = chain[ci];
        var isUnlocked = h.isTechUnlocked(tech.modId);
        var canUnlock = h.canUnlockTech(tech.modId);
        var cost = h.getTechCost(tech.modId);
        var fed = _techFeedProgress[tech.modId] || 0;
        var remaining = Math.max(0, cost - fed);
        var canAfford = totalChips >= remaining && remaining > 0;

        var cardClass = 'techUnlockCard';
        if (isUnlocked) cardClass += ' techUnlockCard--unlocked';
        else if (!canUnlock) cardClass += ' techUnlockCard--locked';
        else if (canAfford) cardClass += ' techUnlockCard--ready';

        html += '<div class="' + cardClass + '">';
        html += '<div class="techUnlockCard__name">' + modName(tech.modId) + '</div>';
        html += '<div class="techUnlockCard__desc">' + _getTechDescription(tech.modId) + '</div>';

        if (isUnlocked) {
          html += '<div class="techUnlockCard__status techUnlockCard__status--done">' + t('techUnlockDone', '✓ Открыто') + '</div>';
        } else if (!canUnlock) {
          html += '<div class="techUnlockCard__status techUnlockCard__status--locked">' + t('techUnlockNeedPrev', 'Сначала откройте предыдущий уровень') + '</div>';
        } else {
          html += '<div class="techUnlockCard__progress">';
          var pctW = cost > 0 ? Math.min(100, Math.round(fed / cost * 100)) : 0;
          html += '<div class="techUnlockCard__bar"><div class="techUnlockCard__barFill" style="width:' + pctW + '%"></div></div>';
          html += '<span class="techUnlockCard__progressText">' + fed + ' / ' + cost + '</span>';
          html += '</div>';

          html += '<div class="techUnlockCard__actions">';
          html += '<button class="btn scButton techUnlockCard__feedBtn" data-tech-feed="' + tech.modId + '" data-tech-amount="1" type="button"' + (totalChips < 1 ? ' disabled' : '') + '>' + t('techUnlockFeed1', 'Скормить 1') + '</button>';
          html += '<button class="btn scButton techUnlockCard__feedBtn" data-tech-feed="' + tech.modId + '" data-tech-amount="5" type="button"' + (totalChips < 1 ? ' disabled' : '') + '>' + t('techUnlockFeed5', 'Скормить 5') + '</button>';
          if (canAfford) {
            html += '<button class="btn scButton techUnlockCard__feedBtn techUnlockCard__feedBtn--all" data-tech-feed="' + tech.modId + '" data-tech-amount="' + remaining + '" type="button">' + t('techUnlockFeedAll', 'Скормить всё ({n})').replace('{n}', remaining) + '</button>';
          }
          html += '</div>';
        }

        html += '</div>'; // techUnlockCard
      }
      html += '</div>'; // techUnlockGroup
    }

    html += '</div>'; // techUnlockGrid
    panel.innerHTML = html;
  }

  /** Get a short description for a tech mod */
  function _getTechDescription(modId) {
    var descs = {
      15: t('techDesc15', '3 снаряда из каждого дула в разные цели'),
      16: t('techDesc16', '6 снарядов из каждого дула в разные цели'),
      17: t('techDesc17', 'Цепная молния с 3 перескоками'),
      18: t('techDesc18', 'Цепная молния с 6 перескоками'),
      19: t('techDesc19', 'Матрёшка: большой(×3) → средний(×2) → малый(×1)'),
      20: t('techDesc20', 'Матрёшка: огромный(×4) → большой(×3) → средний(×2) → малый(×1)'),
      21: t('techDesc21', 'Ударная волна: ×0.75 урона, отталкивание 15px'),
      22: t('techDesc22', 'Ударная волна: ×1 урона, отталкивание 20px'),
      23: t('techDesc23', 'Вакуум: ×0.75 урона, стягивание 15px'),
      24: t('techDesc24', 'Вакуум: ×1 урона, стягивание 20px'),
      25: t('techDesc25', 'Каждый 4-й выстрел: 3 залпа с ×1.5 уроном'),
      26: t('techDesc26', 'Каждый 4-й выстрел: 4 залпа с ×2 уроном'),
      27: t('techDesc27', 'Раз в 30с: ядерный взрыв ×4, радиус 300px'),
      28: t('techDesc28', 'Раз в 30с: ядерный взрыв ×5, вся карта'),
      29: t('techDesc29', 'Заморозка атаки зомби на 0.75с'),
      30: t('techDesc30', 'Заморозка атаки зомби на 1с')
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

  function ensurePlayerChips() {
    if (_playerChips) return _playerChips;
    _playerChips = [];
    return _playerChips;
  }

  function getPlayerChips() { return ensurePlayerChips(); }

  function setPlayerChips(chips) {
    _playerChips = Array.isArray(chips) ? chips : [];
  }

  /** Add a chip to player's inventory. If a chip with same chipId and level exists, increment count. */
  function addPlayerChip(chipDef, level) {
    var chips = ensurePlayerChips();
    var lvl = (Number.isFinite(level) && level >= 1) ? Math.floor(level) : 1;
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].chipId === chipDef.chipId && chips[i].level === lvl) {
        chips[i].count++;
        return chips[i];
      }
    }
    var entry = {
      chipId: chipDef.chipId,
      chipColor: chipDef.chipColor,
      modIds: chipDef.modIds ? chipDef.modIds.slice() : [],
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
    var entry = null;
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].chipId === chipId && chips[i].level === level) {
        entry = chips[i];
        break;
      }
    }
    if (!entry || entry.count < 2) return -1;
    entry.count -= 2;
    var newLevel = level + 1;
    /* add merged chip */
    var h = hc();
    var chipDef = h ? h.getChipById(h.allChips, chipId) : null;
    if (chipDef) {
      addPlayerChip(chipDef, newLevel);
    } else {
      /* fallback: create manually */
      var found = false;
      for (var j = 0; j < chips.length; j++) {
        if (chips[j].chipId === chipId && chips[j].level === newLevel) {
          chips[j].count++;
          found = true;
          break;
        }
      }
      if (!found) {
        chips.push({
          chipId: chipId,
          chipColor: entry.chipColor,
          modIds: entry.modIds.slice(),
          sourceComboKey: entry.sourceComboKey,
          level: newLevel,
          count: 1
        });
      }
    }
    /* clean up empty entries */
    if (entry.count <= 0) {
      for (var k = 0; k < chips.length; k++) {
        if (chips[k] === entry) { chips.splice(k, 1); break; }
      }
    }
    return newLevel;
  }

  /** Get the attack bonus for a chip level (+10% per level, starting at level 1 = +10%). */
  function chipLevelBonus(level) {
    var lvl = (Number.isFinite(level) && level >= 1) ? Math.floor(level) : 1;
    return lvl * 10;
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
      var canMerge = chip.count >= 2;
      var cardClass = 'chipUpgradeCard' + (canMerge ? ' chipUpgradeCard--canMerge' : '');
      var bonusPct = chipLevelBonus(chip.level);
      var tooltipData = 'data-chip-upgrade-id="' + chip.chipId + '" data-chip-upgrade-level="' + chip.level + '"';

      html += '<div class="' + cardClass + '" ' + tooltipData + '>';
      
      /* chip icon SVG */
      html += '<svg viewBox="0 0 44 40" class="chipUpgradeCard__icon">' +
        '<polygon points="22,3 40,37 4,37" fill="none" stroke="' + borderColor + '" stroke-width="2.5"/>';
      var vx = [[22, 7], [36, 33], [8, 33]];
      var mods = chip.modIds;
      for (var vi = 0; vi < 3 && vi < mods.length; vi++) {
        var mc = (h && h.isSpecialMod(mods[vi])) ? '#fdd835' : '#e53935';
        html += '<circle cx="' + vx[vi][0] + '" cy="' + vx[vi][1] + '" r="4" fill="' + mc + '" />';
      }
      html += '</svg>';

      /* name */
      var chipName = chip.sourceComboKey;
      if (h && mods.length) {
        var names = [];
        for (var ni = 0; ni < mods.length; ni++) names.push(modName(mods[ni]));
        chipName = names.join('+');
      }
      html += '<span class="chipUpgradeCard__name" title="' + chipName + '">' + chipName + '</span>';

      /* level label */
      html += '<span class="chipUpgradeCard__level">' + t('workshopChipLevelLabel', 'Ур.') + ' ' + chip.level + '</span>';

      /* count badge */
      if (chip.count > 1) {
        html += '<span class="chipUpgradeCard__count">×' + chip.count + '</span>';
      }

      /* merge button */
      if (canMerge) {
        html += '<button class="chipUpgradeCard__mergeBtn" data-merge-chip="' + chip.chipId + '" data-merge-level="' + chip.level + '" type="button">' +
          t('workshopChipMerge', 'Объединить') + '</button>';
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

    /* workshop sub-tab buttons */
    if (tgt.id === 'workshopTabChipUpgrade' || tgt.closest && tgt.closest('#workshopTabChipUpgrade')) {
      switchWorkshopSubTab('chipUpgrade');
      return;
    }
    if (tgt.id === 'workshopTabTechUnlock' || tgt.closest && tgt.closest('#workshopTabTechUnlock')) {
      switchWorkshopSubTab('techUnlock');
      return;
    }

    /* merge chip button */
    var mergeBtn = tgt.closest ? tgt.closest('[data-merge-chip]') : null;
    if (mergeBtn) {
      var mergeChipId = parseInt(mergeBtn.getAttribute('data-merge-chip'), 10);
      var mergeLevel = parseInt(mergeBtn.getAttribute('data-merge-level'), 10);
      if (Number.isFinite(mergeChipId) && Number.isFinite(mergeLevel)) {
        var newLevel = mergeChips(mergeChipId, mergeLevel);
        if (newLevel > 0) {
          if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
            global.Game.Toast.show(t('workshopChipMerged', 'Чип улучшен до ур. {level}!').replace('{level}', newLevel), 1800);
          }
          renderChipUpgradeGrid();
        }
      }
      return;
    }

    /* tech unlock feed button */
    var techFeedBtn = tgt.closest ? tgt.closest('[data-tech-feed]') : null;
    if (techFeedBtn) {
      var techModId = parseInt(techFeedBtn.getAttribute('data-tech-feed'), 10);
      var techAmount = parseInt(techFeedBtn.getAttribute('data-tech-amount'), 10);
      if (Number.isFinite(techModId) && Number.isFinite(techAmount) && techAmount > 0) {
        var feedResult = feedChipsForTech(techModId, techAmount);
        if (feedResult.ok) {
          if (feedResult.unlocked) {
            if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
              global.Game.Toast.show(t('techUnlockSuccess', 'Технология «{name}» открыта! Все чипы обновлены.').replace('{name}', modName(techModId)), 2500);
            }
          } else {
            if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
              global.Game.Toast.show(t('techUnlockFedChips', 'Скормлено {n} чипов').replace('{n}', feedResult.fed), 1200);
            }
          }
          renderTechUnlockPanel();
          renderChipUpgradeGrid();
        }
      }
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
      /* tooltip hover events for chip upgrade cards */
      overlay.addEventListener('mouseover', function(evt) {
        var card = evt.target.closest ? evt.target.closest('[data-chip-upgrade-id]') : null;
        if (card) showChipUpgradeTooltip(evt);
      });
      overlay.addEventListener('mouseout', function(evt) {
        var card = evt.target.closest ? evt.target.closest('[data-chip-upgrade-id]') : null;
        if (!card || (evt.relatedTarget && !card.contains(evt.relatedTarget))) hideChipUpgradeTooltip();
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
    mergeChips: mergeChips,
    chipLevelBonus: chipLevelBonus,
    renderChipUpgradeGrid: renderChipUpgradeGrid,
    renderTechUnlockPanel: renderTechUnlockPanel,
    feedChipsForTech: feedChipsForTech,
    getTechFeedProgress: getTechFeedProgress,
    setTechFeedProgress: setTechFeedProgress,
    debugInstallChipById: debugInstallChipById,
    debugInstallByKey: debugInstallByKey,
    debugRemoveChip: debugRemoveChip,
    debugClearCell: debugClearCell,
    debugGetCellState: debugGetCellState
  };
})(typeof window !== 'undefined' ? window : this);
