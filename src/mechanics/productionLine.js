(function (global) {
  'use strict';

  // ─── Constants ─────────────────────────────────────────────
  const BASE_KILL_COST       = 500;
  const COST_MULTIPLIER      = 2;
  const MAX_KILL_COST         = 16000;
  const DEFAULT_STORAGE_SLOTS = 9;
  const STORAGE_COLS          = 3;

  // ─── Loot table ────────────────────────────────────────────
  // weight = relative chance (sum → 1.0 normalised at runtime)
  const LOOT_TABLE = [
    { id: 'drone',              weight: 1,  label: 'lootDrone' },
    { id: 'two_big_chips',      weight: 1,  label: 'lootTwoBigChips' },
    { id: 'one_big_chip',       weight: 3,  label: 'lootOneBigChip' },
    { id: 'three_fragments',    weight: 5,  label: 'lootThreeFragments' },
    { id: 'two_fragments',      weight: 10, label: 'lootTwoFragments' },
    { id: 'ten_silicon_dust',   weight: 10, label: 'lootTenSiliconDust' },
    { id: 'one_fragment',       weight: 30, label: 'lootOneFragment' },
    { id: 'five_silicon_dust',  weight: 40, label: 'lootFiveSiliconDust' },
  ];

  const TOTAL_WEIGHT = LOOT_TABLE.reduce(function (s, e) { return s + e.weight; }, 0);

  // ─── Helpers ───────────────────────────────────────────────
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function rollLoot() {
    let r = Math.random() * TOTAL_WEIGHT;
    for (let i = 0; i < LOOT_TABLE.length; i++) {
      r -= LOOT_TABLE[i].weight;
      if (r <= 0) return LOOT_TABLE[i];
    }
    return LOOT_TABLE[LOOT_TABLE.length - 1];
  }

  function getRandomModId() {
    // modIds 1–14 per chips.json
    return Math.floor(Math.random() * 14) + 1;
  }

  function getRandomChipColor() {
    const colors = ['red', 'blue', 'green', 'yellow'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function makeRandomBigChip() {
    const m1 = getRandomModId();
    let m2 = getRandomModId();
    while (m2 === m1) m2 = getRandomModId();
    let m3 = getRandomModId();
    while (m3 === m1 || m3 === m2) m3 = getRandomModId();
    return {
      chipId: 'box_chip_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      chipColor: getRandomChipColor(),
      modIds: [m1, m2, m3],
      sourceComboKey: '',
      level: 1,
      count: 1,
    };
  }

  // ─── Cost progression ─────────────────────────────────────
  function killCostForBox(boxIndex) {
    const idx = Math.max(0, Math.floor(boxIndex));
    const cost = BASE_KILL_COST * Math.pow(COST_MULTIPLIER, idx);
    return Math.min(cost, MAX_KILL_COST);
  }

  // ─── State helpers ─────────────────────────────────────────
  function createProductionLineState() {
    return {
      killsTracked: 0,        // kills counted towards current box
      boxesProduced: 0,       // total boxes ever produced (drives cost)
      progress: 0,            // 0..1 printing progress
      storageSlots: DEFAULT_STORAGE_SLOTS,
      storage: [],            // array of { id: string } (box items)
      conveyorAnimTime: 0,    // running conveyor animation timer
    };
  }

  function ensureState(state) {
    if (!state.productionLine) {
      state.productionLine = createProductionLineState();
    }
    const pl = state.productionLine;
    if (!Number.isFinite(pl.killsTracked))  pl.killsTracked  = 0;
    if (!Number.isFinite(pl.boxesProduced)) pl.boxesProduced = 0;
    if (!Number.isFinite(pl.progress))      pl.progress      = 0;
    if (!Number.isFinite(pl.storageSlots))  pl.storageSlots  = DEFAULT_STORAGE_SLOTS;
    if (!Array.isArray(pl.storage))         pl.storage       = [];
    if (!Number.isFinite(pl.conveyorAnimTime)) pl.conveyorAnimTime = 0;
    return pl;
  }

  function syncSupercomputerBuildTankState(pl) {
    var runtime = global.Game || {};
    var setBuildTank = typeof runtime.setSupercomputerWantsBuildTank === 'function'
      ? runtime.setSupercomputerWantsBuildTank
      : (runtime.SupercomputerRuntime && typeof runtime.SupercomputerRuntime.setWantsBuildTank === 'function'
        ? runtime.SupercomputerRuntime.setWantsBuildTank
        : null);
    if (!setBuildTank) return;

    var hasRoom = pl && Number.isFinite(pl.storageSlots) ? pl.storage.length < pl.storageSlots : false;
    var progress = Number.isFinite(pl && pl.progress) ? pl.progress : 0;
    setBuildTank(progress > 0 && progress < 1 && hasRoom);
  }

  // ─── Step (called every frame) ─────────────────────────────
  let _prevKills = -1;

  function step(state, dt) {
    const pl = ensureState(state);
    const totalKills = Number.isFinite(state.kills) ? state.kills : 0;

    // First frame: sync _prevKills
    if (_prevKills < 0) _prevKills = totalKills;

    // Count new kills towards production
    const newKills = totalKills - _prevKills;
    if (newKills > 0) {
      pl.killsTracked += newKills;
    }
    _prevKills = totalKills;

    // Conveyor animation always ticks
    pl.conveyorAnimTime += dt;

    // Current cost for next box
    const cost = killCostForBox(pl.boxesProduced);

    // Update printing progress
    pl.progress = clamp(pl.killsTracked / cost, 0, 1);

    // Box complete?
    if (pl.killsTracked >= cost) {
      // Only produce if storage has room
      if (pl.storage.length < pl.storageSlots) {
        pl.storage.push({
          id: 'box_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        });
        pl.killsTracked -= cost;
        pl.boxesProduced += 1;
        pl.progress = 0;
      } else {
        // Storage full — clamp kills so we don't lose them, pause at 100%
        pl.killsTracked = cost;
        pl.progress = 1;
      }
    }

    syncSupercomputerBuildTankState(pl);
  }

  // ─── Open box: resolve loot ────────────────────────────────
  function openBox(state, boxIndex) {
    const pl = ensureState(state);
    if (boxIndex < 0 || boxIndex >= pl.storage.length) return null;

    const box = pl.storage[boxIndex];
    pl.storage.splice(boxIndex, 1);

    const loot = rollLoot();
    const result = { lootId: loot.id, label: loot.label, items: [] };

    const ChipsUI = global.Game && global.Game.HangarChipsUI;
    const addDron  = global.Game && global.Game._productionLineAddDron;

    switch (loot.id) {
      case 'drone':
        if (typeof addDron === 'function') addDron(1);
        result.items.push({ type: 'drone', level: 1 });
        break;

      case 'two_big_chips': {
        const c1 = makeRandomBigChip();
        const c2 = makeRandomBigChip();
        if (ChipsUI && typeof ChipsUI.addPlayerChip === 'function') {
          ChipsUI.addPlayerChip(c1, 1);
          ChipsUI.addPlayerChip(c2, 1);
        }
        result.items.push({ type: 'chip', chip: c1 }, { type: 'chip', chip: c2 });
        break;
      }
      case 'one_big_chip': {
        const c = makeRandomBigChip();
        if (ChipsUI && typeof ChipsUI.addPlayerChip === 'function') {
          ChipsUI.addPlayerChip(c, 1);
        }
        result.items.push({ type: 'chip', chip: c });
        break;
      }
      case 'three_fragments': {
        for (let i = 0; i < 3; i++) {
          const fId = getRandomModId();
          if (ChipsUI && typeof ChipsUI.addPlayerFragment === 'function') {
            ChipsUI.addPlayerFragment(fId, 1);
          }
          result.items.push({ type: 'fragment', fragmentId: fId, count: 1 });
        }
        break;
      }
      case 'two_fragments': {
        for (let i = 0; i < 2; i++) {
          const fId = getRandomModId();
          if (ChipsUI && typeof ChipsUI.addPlayerFragment === 'function') {
            ChipsUI.addPlayerFragment(fId, 1);
          }
          result.items.push({ type: 'fragment', fragmentId: fId, count: 1 });
        }
        break;
      }
      case 'one_fragment': {
        const fId = getRandomModId();
        if (ChipsUI && typeof ChipsUI.addPlayerFragment === 'function') {
          ChipsUI.addPlayerFragment(fId, 1);
        }
        result.items.push({ type: 'fragment', fragmentId: fId, count: 1 });
        break;
      }
      case 'ten_silicon_dust': {
        if (ChipsUI && typeof ChipsUI.getSiliconDust === 'function') {
          const cur = ChipsUI.getSiliconDust() || 0;
          ChipsUI.setSiliconDust(cur + 10);
        }
        result.items.push({ type: 'siliconDust', amount: 10 });
        break;
      }
      case 'five_silicon_dust': {
        if (ChipsUI && typeof ChipsUI.getSiliconDust === 'function') {
          const cur = ChipsUI.getSiliconDust() || 0;
          ChipsUI.setSiliconDust(cur + 5);
        }
        result.items.push({ type: 'siliconDust', amount: 5 });
        break;
      }
    }

    return result;
  }

  // ─── Serialize / deserialize for save ──────────────────────
  function serialize(state) {
    const pl = ensureState(state);
    return {
      killsTracked: pl.killsTracked,
      boxesProduced: pl.boxesProduced,
      progress: pl.progress,
      storageSlots: pl.storageSlots,
      storage: pl.storage.slice(),
    };
  }

  function deserialize(state, saved) {
    const pl = ensureState(state);
    if (!saved || typeof saved !== 'object') return;
    if (Number.isFinite(saved.killsTracked))  pl.killsTracked  = Math.max(0, saved.killsTracked);
    if (Number.isFinite(saved.boxesProduced)) pl.boxesProduced = Math.max(0, Math.floor(saved.boxesProduced));
    if (Number.isFinite(saved.progress))      pl.progress      = clamp(saved.progress, 0, 1);
    if (Number.isFinite(saved.storageSlots))  pl.storageSlots  = Math.max(1, Math.floor(saved.storageSlots));
    if (Array.isArray(saved.storage))         pl.storage       = saved.storage.slice();
  }

  function resetTracking() {
    _prevKills = -1;
  }

  // ─── Public API ────────────────────────────────────────────
  global.Game = global.Game || {};
  global.Game.ProductionLine = {
    createProductionLineState: createProductionLineState,
    ensureState: ensureState,
    step: step,
    openBox: openBox,
    serialize: serialize,
    deserialize: deserialize,
    resetTracking: resetTracking,
    killCostForBox: killCostForBox,
    LOOT_TABLE: LOOT_TABLE,
    DEFAULT_STORAGE_SLOTS: DEFAULT_STORAGE_SLOTS,
    STORAGE_COLS: STORAGE_COLS,
  };
})(typeof window !== 'undefined' ? window : this);
