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
    14: 'Кислотная лужа',
    15: 'Тройной снаряд',
    16: 'Шестерной снаряд',
    17: 'Тройной цепной заряд',
    18: 'Шестерной цепной заряд',
    19: 'Тройная матрёшка',
    20: 'Четверная матрёшка',
    21: 'Средний отталкивающий снаряд',
    22: 'Большой отталкивающий снаряд',
    23: 'Средний вакуумный снаряд',
    24: 'Большой вакуумный снаряд',
    25: 'Средний комбо-счётчик дула',
    26: 'Большой комбо-счётчик дула',
    27: 'Средний ядерный снаряд',
    28: 'Большой ядерный снаряд',
    29: 'Средний успокаивающий снаряд',
    30: 'Большой успокаивающий снаряд'
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
    14: 'Acid Pool',
    15: 'Triple Shot',
    16: 'Hex Shot',
    17: 'Triple Chain Charge',
    18: 'Hex Chain Charge',
    19: 'Triple Matryoshka',
    20: 'Quad Matryoshka',
    21: 'Medium Repulse Shot',
    22: 'Large Repulse Shot',
    23: 'Medium Vacuum Shot',
    24: 'Large Vacuum Shot',
    25: 'Medium Barrel Combo',
    26: 'Large Barrel Combo',
    27: 'Medium Nuclear Shot',
    28: 'Large Nuclear Shot',
    29: 'Medium Calming Shot',
    30: 'Large Calming Shot'
  };

  /** Short mod abbreviation for compact UI */
  var MOD_SHORT = {
    1: 'x2',  2: 'Ch',  3: 'Ma',  4: 'Rp',  5: 'Va',
    6: 'Co',  7: 'Ar',  8: 'Nu',  9: 'Ca',
    10: 'Fi', 11: 'Ic', 12: 'El', 13: 'La', 14: 'Ac',
    15: 'x3', 16: 'x6', 17: 'C3', 18: 'C6',
    19: 'M3', 20: 'M4', 21: 'Rm', 22: 'RL',
    23: 'Vm', 24: 'VL', 25: 'Cm', 26: 'CL',
    27: 'Nm', 28: 'NL', 29: 'Sm', 30: 'SL'
  };

  /**
   * Technology tree: maps base modId → array of tech-unlockable upgrades.
   * Each entry: { modId, cost, replacesModId }
   * When unlocked, all chips with replacesModId get that mod replaced by modId.
   */
  var TECH_TREE = {
    1:  [{ modId: 15, cost: 25, replacesModId: 1 },  { modId: 16, cost: 25, replacesModId: 15 }],
    2:  [{ modId: 17, cost: 25, replacesModId: 2 },  { modId: 18, cost: 25, replacesModId: 17 }],
    3:  [{ modId: 19, cost: 25, replacesModId: 3 },  { modId: 20, cost: 25, replacesModId: 19 }],
    4:  [{ modId: 21, cost: 25, replacesModId: 4 },  { modId: 22, cost: 25, replacesModId: 21 }],
    5:  [{ modId: 23, cost: 25, replacesModId: 5 },  { modId: 24, cost: 25, replacesModId: 23 }],
    6:  [{ modId: 25, cost: 25, replacesModId: 6 },  { modId: 26, cost: 25, replacesModId: 25 }],
    8:  [{ modId: 27, cost: 25, replacesModId: 8 },  { modId: 28, cost: 25, replacesModId: 27 }],
    9:  [{ modId: 29, cost: 25, replacesModId: 9 },  { modId: 30, cost: 25, replacesModId: 29 }]
  };

  /** Flat list of all tech upgrades for iteration */
  var ALL_TECH_UPGRADES = [];
  (function () {
    var keys = Object.keys(TECH_TREE);
    for (var k = 0; k < keys.length; k++) {
      var arr = TECH_TREE[keys[k]];
      for (var j = 0; j < arr.length; j++) ALL_TECH_UPGRADES.push(arr[j]);
    }
  })();

  /** Check if a modId is a tech-unlockable mod (15–30) */
  function isTechMod(modId) { return modId >= 15 && modId <= 30; }

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
   * Red chip placement with rotation applied.
   * rotation 0: A, B, C (original)
   * rotation 1: C→A, A→B, B→C (rotate CW 120°)
   * rotation 2: B→A, C→B, A→C (rotate CW 240°)
   */
  function normalizeRedPlacementRotated(modIds, rotation) {
    var base = normalizeRedPlacement(modIds);
    var arr = [base.A, base.B, base.C];
    var r = (rotation || 0) % 3;
    if (r === 0) return base;
    // rotate: shift array backwards by r positions
    var rotated = arr.slice(-r).concat(arr.slice(0, 3 - r));
    return { A: rotated[0], B: rotated[1], C: rotated[2] };
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

  /**
   * Yellow chip placement with rotation applied.
   * rotation 0: innerA, innerB, X (original)
   * rotation 1: X moves to innerA position, innerA→innerB, innerB→X
   * rotation 2: innerB→innerA, X→innerB, innerA→X
   */
  function normalizeYellowPlacementRotated(modIds, rotation) {
    var base = normalizeYellowPlacement(modIds);
    var arr = [base.innerA, base.innerB, base.X];
    var r = (rotation || 0) % 3;
    if (r === 0) return base;
    var rotated = arr.slice(-r).concat(arr.slice(0, 3 - r));
    return { innerA: rotated[0], innerB: rotated[1], X: rotated[2] };
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

  /**
   * Yellow slot adjacency map (based on shared vertices with red slots):
   *
   *   Y1 (slot1, pts: TC, CL, TL) ↔ Red1 (pts: TC, BC, CL)
   *     → Y1.innerA (at TC) must == Red1.A (at TC)
   *     → Y1.innerB (at CL) must == Red1.C (at CL)
   *
   *   Y2 (slot2, pts: TC, CR, TR) ↔ Red2 (pts: TC, BC, CR)
   *     → Y2.innerA (at TC) must == Red2.A (at TC)
   *     → Y2.innerB (at CR) must == Red2.C (at CR)
   *
   *   Y3 (slot3, pts: BC, CL, BL) ↔ Red1 (pts: TC, BC, CL)
   *     → Y3.innerA (at BC) must == Red1.B (at BC)
   *     → Y3.innerB (at CL) must == Red1.C (at CL)
   *
   *   Y4 (slot4, pts: BC, CR, BR) ↔ Red2 (pts: TC, BC, CR)
   *     → Y4.innerA (at BC) must == Red2.B (at BC)
   *     → Y4.innerB (at CR) must == Red2.C (at CR)
   */
  var YELLOW_ADJACENCY = {
    slot1: { redSlot: 'slot1', innerAKey: 'A', innerBKey: 'C' },
    slot2: { redSlot: 'slot2', innerAKey: 'A', innerBKey: 'C' },
    slot3: { redSlot: 'slot1', innerAKey: 'B', innerBKey: 'C' },
    slot4: { redSlot: 'slot2', innerAKey: 'B', innerBKey: 'C' }
  };

  /**
   * Check if a yellow chip's inner vertices match the adjacent red chip.
   * Returns true only if the adjacent red chip is installed AND both
   * shared vertices have matching modifier IDs.
   */
  function checkYellowMatch(yellowPlacement, yellowSlotKey, cellState) {
    var adj = YELLOW_ADJACENCY[yellowSlotKey];
    if (!adj) return false;
    var redChip = cellState.redSlots[adj.redSlot];
    if (!redChip) return false;
    var rp = normalizeRedPlacementRotated(redChip.modIds, redChip.rotation);
    return yellowPlacement.innerA === rp[adj.innerAKey] &&
      yellowPlacement.innerB === rp[adj.innerBKey];
  }

  /* ── Active-modifier calculation ───────────────────────── */

  function calculateActiveModifiers(cellState) {
    var mods = [];
    var matchSuccess = null;

    var red1 = cellState.redSlots.slot1;
    var red2 = cellState.redSlots.slot2;

    if (red1 && red2) {
      var p1 = normalizeRedPlacementRotated(red1.modIds, red1.rotation);
      var p2 = normalizeRedPlacementRotated(red2.modIds, red2.rotation);
      if (checkRedMatch(p1, p2)) {
        matchSuccess = true;
        mods.push({ modId: p1.A, source: 'red', vertex: 'A', order: 0 });
        mods.push({ modId: p1.B, source: 'red', vertex: 'B', order: 1 });
      } else {
        matchSuccess = false;
        // No match — only the first red chip's A vertex is active
        mods.push({ modId: p1.A, source: 'red1', vertex: 'A', order: 0 });
      }
    } else if (red1) {
      var pr1 = normalizeRedPlacementRotated(red1.modIds, red1.rotation);
      mods.push({ modId: pr1.A, source: 'red1', vertex: 'A', order: 0 });
    } else if (red2) {
      var pr2 = normalizeRedPlacementRotated(red2.modIds, red2.rotation);
      mods.push({ modId: pr2.A, source: 'red2', vertex: 'A', order: 0 });
    }

    /* Yellow: only 1 chip can be active, AND its inner vertices must match the adjacent red chip */
    var activeYellow = null;
    var activeYellowSlotKey = null;
    var yellowMatchSuccess = null;
    for (var i = 0; i < YELLOW_SLOT_KEYS.length; i++) {
      var yc = cellState.yellowSlots[YELLOW_SLOT_KEYS[i]];
      if (yc) {
        if (activeYellow) {
          console.warn('[HangarChips] Multiple yellow chips — ignoring extra');
          break;
        }
        activeYellow = yc;
        activeYellowSlotKey = YELLOW_SLOT_KEYS[i];
      }
    }

    if (activeYellow) {
      var yp = normalizeYellowPlacementRotated(activeYellow.modIds, activeYellow.rotation);
      if (!isSpecialMod(yp.X)) {
        console.warn('[HangarChips] Yellow X vertex is not special: ' + yp.X);
      }
      yellowMatchSuccess = checkYellowMatch(yp, activeYellowSlotKey, cellState);
      if (yellowMatchSuccess) {
        mods.push({ modId: yp.X, source: 'yellow', vertex: 'X', order: 2 });
      }
      // If no match, yellow modifier is NOT activated
    }

    return { modifiers: mods, redMatchSuccess: matchSuccess, hasYellow: !!activeYellow, yellowMatchSuccess: yellowMatchSuccess };
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
        yellowMatchSuccess: null,
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
    cell.uiState.yellowMatchSuccess = r.yellowMatchSuccess;
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
        sourceComboKey: chipDef.sourceComboKey,
        rotation: 0
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
        sourceComboKey: chipDef.sourceComboKey,
        rotation: 0
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

  /**
   * Rotate an installed chip clockwise (120° per step).
   * This changes which modifiers land on which vertices (A, B, C / innerA, innerB, X).
   */
  function rotateChip(cell, slotType, slotId) {
    var chip = null;
    if (slotType === 'red') {
      chip = cell.redSlots[slotId];
    } else if (slotType === 'yellow') {
      chip = cell.yellowSlots[slotId];
    }
    if (!chip) return false;
    chip.rotation = ((chip.rotation || 0) + 1) % 3;
    _recalc(cell);
    return true;
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

  /* ── Technology unlock state ───────────────────────────── */
  var _unlockedTechs = {}; // modId → true

  function getUnlockedTechs() { return _unlockedTechs; }
  function setUnlockedTechs(obj) { _unlockedTechs = (obj && typeof obj === 'object') ? obj : {}; }
  function isTechUnlocked(modId) { return !!_unlockedTechs[modId]; }

  /**
   * Check if a tech upgrade is available to unlock.
   * Requires: prerequisite is unlocked (or it's the first level).
   */
  function canUnlockTech(modId) {
    if (_unlockedTechs[modId]) return false; // already unlocked
    for (var i = 0; i < ALL_TECH_UPGRADES.length; i++) {
      var tu = ALL_TECH_UPGRADES[i];
      if (tu.modId === modId) {
        // Check prerequisite: replacesModId must be either a base mod (1-14) or an already-unlocked tech
        if (tu.replacesModId <= 14) return true; // base mod always available
        return !!_unlockedTechs[tu.replacesModId]; // prerequisite tech must be unlocked
      }
    }
    return false;
  }

  /**
   * Get the cost (in chips) to unlock a tech.
   */
  function getTechCost(modId) {
    for (var i = 0; i < ALL_TECH_UPGRADES.length; i++) {
      if (ALL_TECH_UPGRADES[i].modId === modId) return ALL_TECH_UPGRADES[i].cost;
    }
    return 25; // default
  }

  /**
   * Get what modId this tech replaces.
   */
  function getTechReplacesModId(modId) {
    for (var i = 0; i < ALL_TECH_UPGRADES.length; i++) {
      if (ALL_TECH_UPGRADES[i].modId === modId) return ALL_TECH_UPGRADES[i].replacesModId;
    }
    return -1;
  }

  /**
   * Unlock a technology: mark as unlocked and replace all occurrences
   * of the old modId with the new modId in provided chip arrays and cells.
   *
   * @param {number} modId - the tech modId to unlock (15-30)
   * @param {array} playerChips - player's chip inventory array
   * @param {array} hangarCells - all 16 hangar cells
   * @returns {object} { ok, replaced, error }
   */
  function unlockTechnology(modId, playerChips, hangarCells) {
    if (_unlockedTechs[modId]) return { ok: false, replaced: 0, error: 'already_unlocked' };
    if (!canUnlockTech(modId)) return { ok: false, replaced: 0, error: 'prerequisite_not_met' };

    var replacesId = getTechReplacesModId(modId);
    if (replacesId < 0) return { ok: false, replaced: 0, error: 'invalid_tech' };

    _unlockedTechs[modId] = true;

    var replaced = 0;

    /* Replace in player chip inventory */
    if (Array.isArray(playerChips)) {
      for (var pi = 0; pi < playerChips.length; pi++) {
        var pc = playerChips[pi];
        if (pc.modIds) {
          for (var mi = 0; mi < pc.modIds.length; mi++) {
            if (pc.modIds[mi] === replacesId) {
              pc.modIds[mi] = modId;
              replaced++;
            }
          }
        }
      }
    }

    /* Replace in hangar cells (installed chips) */
    if (Array.isArray(hangarCells)) {
      for (var ci = 0; ci < hangarCells.length; ci++) {
        var cell = hangarCells[ci];
        if (!cell) continue;
        /* red slots */
        for (var ri = 0; ri < RED_SLOT_KEYS.length; ri++) {
          var rc = cell.redSlots[RED_SLOT_KEYS[ri]];
          if (rc && rc.modIds) {
            for (var rmi = 0; rmi < rc.modIds.length; rmi++) {
              if (rc.modIds[rmi] === replacesId) {
                rc.modIds[rmi] = modId;
                replaced++;
              }
            }
          }
        }
        /* yellow slots */
        for (var yi = 0; yi < YELLOW_SLOT_KEYS.length; yi++) {
          var yc = cell.yellowSlots[YELLOW_SLOT_KEYS[yi]];
          if (yc && yc.modIds) {
            for (var ymi = 0; ymi < yc.modIds.length; ymi++) {
              if (yc.modIds[ymi] === replacesId) {
                yc.modIds[ymi] = modId;
                replaced++;
              }
            }
          }
        }
        /* Recalculate active modifiers for cell */
        _recalc(cell);
      }
    }

    return { ok: true, replaced: replaced };
  }

  /* ── Public API ────────────────────────────────────────── */

  global.Game = global.Game || {};
  global.Game.HangarChips = {
    MOD_NAMES_RU: MOD_NAMES_RU,
    MOD_NAMES_EN: MOD_NAMES_EN,
    MOD_SHORT: MOD_SHORT,
    SPECIAL_MODS: SPECIAL_MODS,
    YELLOW_SLOT_KEYS: YELLOW_SLOT_KEYS,
    RED_SLOT_KEYS: RED_SLOT_KEYS,
    TECH_TREE: TECH_TREE,
    ALL_TECH_UPGRADES: ALL_TECH_UPGRADES,
    isSpecialMod: isSpecialMod,
    isTechMod: isTechMod,
    countSpecials: countSpecials,
    allChips: _allChips,
    redPool: _pools.red,
    yellowPool: _pools.yellow,
    generateChipPool: generateChipPool,
    separatePools: separatePools,
    validatePools: validatePools,
    normalizeRedPlacement: normalizeRedPlacement,
    normalizeRedPlacementRotated: normalizeRedPlacementRotated,
    normalizeYellowPlacement: normalizeYellowPlacement,
    normalizeYellowPlacementRotated: normalizeYellowPlacementRotated,
    checkRedMatch: checkRedMatch,
    checkYellowMatch: checkYellowMatch,
    YELLOW_ADJACENCY: YELLOW_ADJACENCY,
    calculateActiveModifiers: calculateActiveModifiers,
    createEmptyCell: createEmptyCell,
    createHangarCellsState: createHangarCellsState,
    installChip: installChip,
    removeChip: removeChip,
    rotateChip: rotateChip,
    getChipById: getChipById,
    getChipByKey: getChipByKey,
    /* Technology unlock API */
    getUnlockedTechs: getUnlockedTechs,
    setUnlockedTechs: setUnlockedTechs,
    isTechUnlocked: isTechUnlocked,
    canUnlockTech: canUnlockTech,
    getTechCost: getTechCost,
    getTechReplacesModId: getTechReplacesModId,
    unlockTechnology: unlockTechnology
  };
})(typeof window !== 'undefined' ? window : this);
