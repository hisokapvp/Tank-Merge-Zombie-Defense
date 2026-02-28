/**
 * HangarChips — core mechanics for triangular chip system in hangar cells.
 *
 * 381 unique chips (unordered triples from mods 1–14, at most 1 special 10–14,
 * no all-same triples). Split into 156 red (0 specials) and 225 yellow (1 special).
 *
 * Each of 16 hangar cells has 2 red + 4 yellow slots arranged in a butterfly/bowtie.
 * Only 1 yellow chip can be installed per cell at a time.
 */
(function (global) {
  'use strict';

  /* ── Mod name dictionaries ─────────────────────────────── */

  var MOD_NAMES_RU = {
    1: 'Двойной снаряд',
    2: 'Двойной цепной заряд',
    3: 'Двойная матрёшка',
    4: 'Малый отталкивающий снаряд',
    5: 'Малый вакуумный снаряд',
    6: 'Малый комбо-счётчик дула',
    7: 'Аркадный хаос',
    8: 'Малый ядерный снаряд',
    9: 'Малый успокаивающий снаряд',
    10: 'Огненная лужа',
    11: 'Ледяная зона',
    12: 'Электроузел',
    13: 'Лазерная метка',
    14: 'Кислотная лужа'
  };

  var MOD_NAMES_EN = {
    1: 'Double Shot',
    2: 'Double Chain Charge',
    3: 'Double Matryoshka',
    4: 'Small Repulse Shot',
    5: 'Small Vacuum Shot',
    6: 'Small Barrel Combo',
    7: 'Arcade Chaos',
    8: 'Small Nuclear Shot',
    9: 'Small Calming Shot',
    10: 'Fire Pool',
    11: 'Ice Zone',
    12: 'Electro Node',
    13: 'Laser Mark',
    14: 'Acid Pool'
  };

  /** Short mod abbreviation for compact UI */
  var MOD_SHORT = {
    1: 'x2',  2: 'Ch',  3: 'Ma',  4: 'Rp',  5: 'Va',
    6: 'Co',  7: 'Ar',  8: 'Nu',  9: 'Ca',
    10: 'Fi', 11: 'Ic', 12: 'El', 13: 'La', 14: 'Ac'
  };

  var SPECIAL_MODS = [10, 11, 12, 13, 14];
  var YELLOW_SLOT_KEYS = ['slot1', 'slot2', 'slot3', 'slot4'];
  var RED_SLOT_KEYS = ['slot1', 'slot2'];

  /* ── Helpers ────────────────────────────────────────────── */

  function isSpecialMod(modId) {
    return modId >= 10 && modId <= 14;
  }

  function countSpecials(mods) {
    var c = 0;
    for (var i = 0; i < mods.length; i++) { if (isSpecialMod(mods[i])) c++; }
    return c;
  }

  /* ── Chip generation ───────────────────────────────────── */

  function generateChipPool() {
    var chips = [];
    var chipId = 1;
    for (var a = 1; a <= 14; a++) {
      for (var b = a; b <= 14; b++) {
        for (var c = b; c <= 14; c++) {
          if (a === b && b === c) continue;                // no all-same
          var spec = (a >= 10 ? 1 : 0) + (b >= 10 ? 1 : 0) + (c >= 10 ? 1 : 0);
          if (spec > 1) continue;                          // max 1 special
          chips.push({
            chipId: chipId++,
            sourceComboKey: a + '-' + b + '-' + c,
            modIds: [a, b, c],
            chipColor: spec === 0 ? 'red' : 'yellow',
            specCount: spec
          });
        }
      }
    }
    return chips;
  }

  function separatePools(chips) {
    var red = [], yellow = [];
    for (var i = 0; i < chips.length; i++) {
      (chips[i].chipColor === 'red' ? red : yellow).push(chips[i]);
    }
    return { red: red, yellow: yellow };
  }

  function validatePools(pools) {
    var errs = [];
    var total = pools.red.length + pools.yellow.length;
    if (total !== 381) errs.push('Total chips: ' + total + ' (expected 381)');
    if (pools.red.length !== 156) errs.push('Red chips: ' + pools.red.length + ' (expected 156)');
    if (pools.yellow.length !== 225) errs.push('Yellow chips: ' + pools.yellow.length + ' (expected 225)');
    for (var i = 0; i < pools.yellow.length; i++) {
      if (countSpecials(pools.yellow[i].modIds) !== 1) {
        errs.push('Yellow chip ' + pools.yellow[i].chipId + ' has wrong spec count');
      }
    }
    if (errs.length) {
      console.error('[HangarChips] Validation errors:', errs);
      return false;
    }
    console.log('[HangarChips] Pool OK: 381 chips (156 red, 225 yellow)');
    return true;
  }

  /* ── Placement normalisation ───────────────────────────── */

  /**
   * Red chip placement: vertices A (top-inner), B (bottom-inner), C (outer).
   * Deterministic: sorted ascending → A=smallest, B=middle, C=largest.
   */
  function normalizeRedPlacement(modIds) {
    var s = modIds.slice().sort(function (a, b) { return a - b; });
    return { A: s[0], B: s[1], C: s[2] };
  }

  /**
   * Yellow chip placement: X (outer, must be the special 10–14).
   * Inner vertices get the two non-special mods, sorted ascending.
   */
  function normalizeYellowPlacement(modIds) {
    var specIdx = -1;
    for (var i = 0; i < modIds.length; i++) {
      if (isSpecialMod(modIds[i])) { specIdx = i; break; }
    }
    if (specIdx === -1) {
      console.warn('[HangarChips] Yellow chip has no special mod — fallback');
      return { innerA: modIds[0], innerB: modIds[1], X: modIds[2] };
    }
    var inner = [];
    for (var j = 0; j < modIds.length; j++) {
      if (j !== specIdx) inner.push(modIds[j]);
    }
    inner.sort(function (a, b) { return a - b; });
    return { innerA: inner[0], innerB: inner[1], X: modIds[specIdx] };
  }

  /* ── Adjacency & matching ──────────────────────────────── */

  /**
   * Red slot adjacency:
   *   Red1.A (top-inner) ↔ Red2.A (top-inner)
   *   Red1.B (bottom-inner) ↔ Red2.B (bottom-inner)
   * Both pairs must match for the bonus.
   */
  function checkRedMatch(p1, p2) {
    return p1.A === p2.A && p1.B === p2.B;
  }

  /* ── Active-modifier calculation ───────────────────────── */

  function calculateActiveModifiers(cellState) {
    var mods = [];
    var matchSuccess = null;

    var red1 = cellState.redSlots.slot1;
    var red2 = cellState.redSlots.slot2;

    if (red1 && red2) {
      var p1 = normalizeRedPlacement(red1.modIds);
      var p2 = normalizeRedPlacement(red2.modIds);
      if (checkRedMatch(p1, p2)) {
        matchSuccess = true;
        mods.push({ modId: p1.A, source: 'red', vertex: 'A' });
        mods.push({ modId: p1.B, source: 'red', vertex: 'B' });
      } else {
        matchSuccess = false;
        mods.push({ modId: p1.A, source: 'red1', vertex: 'A' });
        mods.push({ modId: p2.A, source: 'red2', vertex: 'A' });
      }
    } else if (red1) {
      var pr1 = normalizeRedPlacement(red1.modIds);
      mods.push({ modId: pr1.A, source: 'red1', vertex: 'A' });
    } else if (red2) {
      var pr2 = normalizeRedPlacement(red2.modIds);
      mods.push({ modId: pr2.A, source: 'red2', vertex: 'A' });
    }

    /* Yellow: only 1 chip can be active */
    var activeYellow = null;
    for (var i = 0; i < YELLOW_SLOT_KEYS.length; i++) {
      var yc = cellState.yellowSlots[YELLOW_SLOT_KEYS[i]];
      if (yc) {
        if (activeYellow) {
          console.warn('[HangarChips] Multiple yellow chips — ignoring extra');
          break;
        }
        activeYellow = yc;
      }
    }

    if (activeYellow) {
      var yp = normalizeYellowPlacement(activeYellow.modIds);
      if (!isSpecialMod(yp.X)) {
        console.warn('[HangarChips] Yellow X vertex is not special: ' + yp.X);
      }
      mods.push({ modId: yp.X, source: 'yellow', vertex: 'X' });
    }

    return { modifiers: mods, redMatchSuccess: matchSuccess, hasYellow: !!activeYellow };
  }

  /* ── Cell state helpers ────────────────────────────────── */

  function createEmptyCell(id) {
    return {
      id: id,
      tankId: null,
      redSlots: { slot1: null, slot2: null },
      yellowSlots: { slot1: null, slot2: null, slot3: null, slot4: null },
      activeModifiers: [],
      uiState: {
        yellowLocked: false,
        activeYellowSlotId: null,
        redMatchSuccess: null,
        redMismatchReason: ''
      }
    };
  }

  function createHangarCellsState() {
    var cells = [];
    for (var i = 0; i < 16; i++) cells.push(createEmptyCell(i));
    return cells;
  }

  function _recalc(cell) {
    var r = calculateActiveModifiers(cell);
    cell.activeModifiers = r.modifiers;
    cell.uiState.redMatchSuccess = r.redMatchSuccess;
    /* update yellowLocked */
    var hasY = false;
    var activeSlot = null;
    for (var i = 0; i < YELLOW_SLOT_KEYS.length; i++) {
      if (cell.yellowSlots[YELLOW_SLOT_KEYS[i]]) {
        hasY = true;
        activeSlot = YELLOW_SLOT_KEYS[i];
        break;
      }
    }
    cell.uiState.yellowLocked = hasY;
    cell.uiState.activeYellowSlotId = activeSlot;
  }

  function installChip(cell, slotType, slotId, chipDef) {
    if (slotType === 'red') {
      if (slotId !== 'slot1' && slotId !== 'slot2') return false;
      if (chipDef.chipColor !== 'red') return false;
      cell.redSlots[slotId] = {
        chipId: chipDef.chipId,
        modIds: chipDef.modIds.slice(),
        sourceComboKey: chipDef.sourceComboKey
      };
    } else if (slotType === 'yellow') {
      if (YELLOW_SLOT_KEYS.indexOf(slotId) === -1) return false;
      if (chipDef.chipColor !== 'yellow') return false;
      /* check no other yellow */
      for (var i = 0; i < YELLOW_SLOT_KEYS.length; i++) {
        if (cell.yellowSlots[YELLOW_SLOT_KEYS[i]] && YELLOW_SLOT_KEYS[i] !== slotId) return false;
      }
      cell.yellowSlots[slotId] = {
        chipId: chipDef.chipId,
        modIds: chipDef.modIds.slice(),
        sourceComboKey: chipDef.sourceComboKey
      };
    } else {
      return false;
    }
    _recalc(cell);
    return true;
  }

  function removeChip(cell, slotType, slotId) {
    if (slotType === 'red') {
      cell.redSlots[slotId] = null;
    } else if (slotType === 'yellow') {
      cell.yellowSlots[slotId] = null;
    }
    _recalc(cell);
  }

  function getChipById(allChips, chipId) {
    for (var i = 0; i < allChips.length; i++) {
      if (allChips[i].chipId === chipId) return allChips[i];
    }
    return null;
  }

  function getChipByKey(allChips, key) {
    for (var i = 0; i < allChips.length; i++) {
      if (allChips[i].sourceComboKey === key) return allChips[i];
    }
    return null;
  }

  /* ── Initialise chip pool at load time ─────────────────── */

  var _allChips = generateChipPool();
  var _pools = separatePools(_allChips);
  validatePools(_pools);

  /* ── Public API ────────────────────────────────────────── */

  global.Game = global.Game || {};
  global.Game.HangarChips = {
    MOD_NAMES_RU: MOD_NAMES_RU,
    MOD_NAMES_EN: MOD_NAMES_EN,
    MOD_SHORT: MOD_SHORT,
    SPECIAL_MODS: SPECIAL_MODS,
    YELLOW_SLOT_KEYS: YELLOW_SLOT_KEYS,
    RED_SLOT_KEYS: RED_SLOT_KEYS,
    isSpecialMod: isSpecialMod,
    countSpecials: countSpecials,
    allChips: _allChips,
    redPool: _pools.red,
    yellowPool: _pools.yellow,
    generateChipPool: generateChipPool,
    separatePools: separatePools,
    validatePools: validatePools,
    normalizeRedPlacement: normalizeRedPlacement,
    normalizeYellowPlacement: normalizeYellowPlacement,
    checkRedMatch: checkRedMatch,
    calculateActiveModifiers: calculateActiveModifiers,
    createEmptyCell: createEmptyCell,
    createHangarCellsState: createHangarCellsState,
    installChip: installChip,
    removeChip: removeChip,
    getChipById: getChipById,
    getChipByKey: getChipByKey
  };
})(typeof window !== 'undefined' ? window : this);
