(function (global) {
  'use strict';

  // ─── Constants ─────────────────────────────────────────────
  const BASE_KILL_COST       = 500;
  const COST_MULTIPLIER      = 2;
  const MAX_KILL_COST         = 8000;
  const DEFAULT_STORAGE_SLOTS = 9;
  const STORAGE_COLS          = 3;
  const MAX_BOX_LEVEL         = 4;
  const GUARANTEED_NEW_GAME_LOOT_ID = 'one_big_chip';

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
  const LOOT_BY_ID = LOOT_TABLE.reduce(function (acc, entry) {
    acc[entry.id] = entry;
    return acc;
  }, Object.create(null));

  const LEVEL_EXCLUDED_LOOT_IDS = {
    2: { five_silicon_dust: true, one_fragment: true },
    3: { ten_silicon_dust: true, two_fragments: true },
    4: { three_fragments: true, one_big_chip: true },
  };

  const LOOT_POOLS_BY_LEVEL = (function buildLootPools() {
    const pools = [];
    const excluded = Object.create(null);
    for (let level = 1; level <= MAX_BOX_LEVEL; level++) {
      const levelExclusions = LEVEL_EXCLUDED_LOOT_IDS[level];
      if (levelExclusions) {
        const exclusionIds = Object.keys(levelExclusions);
        for (let index = 0; index < exclusionIds.length; index++) {
          excluded[exclusionIds[index]] = true;
        }
      }
      const entries = [];
      let totalWeight = 0;
      for (let index = 0; index < LOOT_TABLE.length; index++) {
        const entry = LOOT_TABLE[index];
        if (excluded[entry.id]) continue;
        entries.push(entry);
        totalWeight += entry.weight;
      }
      pools[level] = { entries: entries, totalWeight: totalWeight };
    }
    return pools;
  })();

  // ─── Helpers ───────────────────────────────────────────────
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function normalizeBoxLevel(level) {
    if (!Number.isFinite(level)) return 1;
    return clamp(Math.floor(level), 1, MAX_BOX_LEVEL);
  }

  function generateBoxId() {
    return 'box_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }

  function createBox(level, guaranteedLootId) {
    return {
      id: generateBoxId(),
      level: normalizeBoxLevel(level),
      guaranteedLootId: typeof guaranteedLootId === 'string' ? guaranteedLootId : '',
    };
  }

  function normalizeSavedBox(savedBox) {
    let id = '';
    let level = 1;
    let guaranteedLootId = '';
    if (typeof savedBox === 'string') {
      id = savedBox;
    } else if (savedBox && typeof savedBox === 'object') {
      if (typeof savedBox.id === 'string' && savedBox.id) id = savedBox.id;
      if (Number.isFinite(savedBox.level)) level = savedBox.level;
      if (typeof savedBox.guaranteedLootId === 'string') guaranteedLootId = savedBox.guaranteedLootId;
    }
    return {
      id: id || generateBoxId(),
      level: normalizeBoxLevel(level),
      guaranteedLootId: guaranteedLootId,
    };
  }

  function cloneBoxForSave(box) {
    const normalized = normalizeSavedBox(box);
    return {
      id: normalized.id,
      level: normalized.level,
      guaranteedLootId: normalized.guaranteedLootId,
    };
  }

  function getBoxLevel(box) {
    if (box && typeof box === 'object' && Number.isFinite(box.level)) {
      return normalizeBoxLevel(box.level);
    }
    return 1;
  }

  function normalizeSavedStorage(savedStorage) {
    const normalized = [];
    if (!Array.isArray(savedStorage)) return normalized;
    for (let index = 0; index < savedStorage.length; index++) {
      normalized.push(normalizeSavedBox(savedStorage[index]));
    }
    return normalized;
  }

  function rollLootForLevel(level) {
    const normalizedLevel = normalizeBoxLevel(level);
    const pool = LOOT_POOLS_BY_LEVEL[normalizedLevel] || LOOT_POOLS_BY_LEVEL[1];
    const entries = pool && Array.isArray(pool.entries) && pool.entries.length ? pool.entries : LOOT_TABLE;
    const totalWeight = pool && Number.isFinite(pool.totalWeight) && pool.totalWeight > 0 ? pool.totalWeight : TOTAL_WEIGHT;
    let r = Math.random() * totalWeight;
    for (let i = 0; i < entries.length; i++) {
      r -= entries[i].weight;
      if (r <= 0) return entries[i];
    }
    return entries[entries.length - 1];
  }

  function getLootById(lootId) {
    if (typeof lootId !== 'string' || !lootId) return null;
    return LOOT_BY_ID[lootId] || null;
  }

  function getRandomModId() {
    // modIds 1–14 per chips.json
    return Math.floor(Math.random() * 14) + 1;
  }

  function getRandomBaseModId() {
    // Red chips can only contain non-special mods (1–9).
    return Math.floor(Math.random() * 9) + 1;
  }

  function sortNumericAsc(a, b) {
    return a - b;
  }

  function resolveChipDefByModIds(modIds) {
    const normalized = Array.isArray(modIds) ? modIds.slice().sort(sortNumericAsc) : [];
    if (normalized.length !== 3) return null;
    const HangarChips = global.Game && global.Game.HangarChips;
    if (HangarChips && Array.isArray(HangarChips.allChips) && typeof HangarChips.getChipByKey === 'function') {
      const fromPool = HangarChips.getChipByKey(HangarChips.allChips, normalized.join('-'));
      if (fromPool) return fromPool;
    }
    let chipId = 1;
    for (let a = 1; a <= 14; a++) {
      for (let b = a; b <= 14; b++) {
        for (let c = b; c <= 14; c++) {
          if (a === b && b === c) continue;
          const spec = (a >= 10 ? 1 : 0) + (b >= 10 ? 1 : 0) + (c >= 10 ? 1 : 0);
          if (spec > 1) continue;
          if (a === normalized[0] && b === normalized[1] && c === normalized[2]) {
            return {
              chipId: chipId,
              sourceComboKey: normalized.join('-'),
              modIds: normalized,
              chipColor: spec === 0 ? 'red' : 'yellow',
              specCount: spec,
            };
          }
          chipId += 1;
        }
      }
    }
    return null;
  }

  function cloneRewardChip(chipDef) {
    if (!chipDef) return null;
    return {
      chipId: chipDef.chipId,
      chipColor: chipDef.chipColor,
      modIds: Array.isArray(chipDef.modIds) ? chipDef.modIds.slice() : [],
      sourceComboKey: chipDef.sourceComboKey || '',
      level: 1,
      count: 1,
    };
  }

  function makeGuaranteedNewGameBigChip() {
    const modIds = [];
    while (modIds.length < 3) {
      const modId = getRandomBaseModId();
      if (modIds.indexOf(modId) === -1) modIds.push(modId);
    }
    const chipDef = resolveChipDefByModIds(modIds);
    return cloneRewardChip(chipDef);
  }

  function makeRandomBigChip() {
    const HangarChips = global.Game && global.Game.HangarChips;
    if (HangarChips && Array.isArray(HangarChips.allChips) && HangarChips.allChips.length) {
      const pool = HangarChips.allChips;
      const chipDef = pool[Math.floor(Math.random() * pool.length)];
      return cloneRewardChip(chipDef);
    }
    return makeGuaranteedNewGameBigChip();
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
      storage: [],            // array of { id, level, guaranteedLootId }
      conveyorAnimTime: 0,    // running conveyor animation timer
      firstNewGameBoxGuaranteedPending: false,
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
    if (typeof pl.firstNewGameBoxGuaranteedPending !== 'boolean') {
      pl.firstNewGameBoxGuaranteedPending = false;
    }
    return pl;
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
        const guaranteedLootId = pl.firstNewGameBoxGuaranteedPending ? GUARANTEED_NEW_GAME_LOOT_ID : '';
        pl.storage.push(createBox(1, guaranteedLootId));
        if (pl.firstNewGameBoxGuaranteedPending) {
          pl.firstNewGameBoxGuaranteedPending = false;
        }
        pl.killsTracked -= cost;
        pl.boxesProduced += 1;
        pl.progress = 0;
        var BridgePush = global.Game;
        if (BridgePush && typeof BridgePush.onProductionStorageSnapshotChanged === 'function') {
          BridgePush.onProductionStorageSnapshotChanged(state);
        } else if (BridgePush && BridgePush.Achievements && typeof BridgePush.Achievements.recordProductionStorageSnapshot === 'function') {
          BridgePush.Achievements.recordProductionStorageSnapshot(state);
        }
      } else {
        // Storage full — clamp kills so we don't lose them, pause at 100%
        pl.killsTracked = cost;
        pl.progress = 1;
      }
    }
  }

  // ─── Open box: resolve loot ────────────────────────────────
  function openBox(state, boxIndex) {
    const pl = ensureState(state);
    if (boxIndex < 0 || boxIndex >= pl.storage.length) return null;

    const box = normalizeSavedBox(pl.storage[boxIndex]);
    pl.storage.splice(boxIndex, 1);
    var BridgeOpen = global.Game;
    if (BridgeOpen && typeof BridgeOpen.onProductionStorageSnapshotChanged === 'function') {
      BridgeOpen.onProductionStorageSnapshotChanged(state);
    } else if (BridgeOpen && BridgeOpen.Achievements && typeof BridgeOpen.Achievements.recordProductionStorageSnapshot === 'function') {
      BridgeOpen.Achievements.recordProductionStorageSnapshot(state);
    }

    const loot = (box.level === 1 ? getLootById(box.guaranteedLootId) : null) || rollLootForLevel(box.level);
    const result = { lootId: loot.id, label: loot.label, items: [], boxLevel: box.level };

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
        const c = box && box.guaranteedLootId === GUARANTEED_NEW_GAME_LOOT_ID
          ? makeGuaranteedNewGameBigChip()
          : makeRandomBigChip();
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
        // solo-pipeline-yandex-vk batch#1 — use canonical inflow seam.
        if (ChipsUI && typeof ChipsUI.creditSiliconDust === 'function') {
          ChipsUI.creditSiliconDust(10, 'production-line-loot');
        } else if (ChipsUI && typeof ChipsUI.getSiliconDust === 'function') {
          const cur = ChipsUI.getSiliconDust() || 0;
          ChipsUI.setSiliconDust(cur + 10);
        }
        result.items.push({ type: 'siliconDust', amount: 10 });
        break;
      }
      case 'five_silicon_dust': {
        if (ChipsUI && typeof ChipsUI.creditSiliconDust === 'function') {
          ChipsUI.creditSiliconDust(5, 'production-line-loot');
        } else if (ChipsUI && typeof ChipsUI.getSiliconDust === 'function') {
          const cur = ChipsUI.getSiliconDust() || 0;
          ChipsUI.setSiliconDust(cur + 5);
        }
        result.items.push({ type: 'siliconDust', amount: 5 });
        break;
      }
    }

    return result;
  }

  function canMergeBoxes(state, sourceIndex, targetIndex) {
    const pl = ensureState(state);
    const sourceBox = pl.storage[sourceIndex];
    const targetBox = pl.storage[targetIndex];
    if (!sourceBox || !targetBox) return false;
    if (sourceIndex === targetIndex) return false;
    const sourceLevel = getBoxLevel(sourceBox);
    const targetLevel = getBoxLevel(targetBox);
    return sourceLevel === targetLevel && sourceLevel < MAX_BOX_LEVEL;
  }

  function mergeBoxes(state, sourceIndex, targetIndex) {
    const pl = ensureState(state);
    if (!canMergeBoxes(state, sourceIndex, targetIndex)) return null;
    const sourceBox = normalizeSavedBox(pl.storage[sourceIndex]);
    const targetBox = normalizeSavedBox(pl.storage[targetIndex]);
    targetBox.level = normalizeBoxLevel(targetBox.level + 1);
    targetBox.guaranteedLootId = '';
    pl.storage[sourceIndex] = sourceBox;
    pl.storage[targetIndex] = targetBox;
    pl.storage.splice(sourceIndex, 1);
    var BridgeMerge = global.Game;
    if (BridgeMerge && typeof BridgeMerge.onProductionStorageSnapshotChanged === 'function') {
      BridgeMerge.onProductionStorageSnapshotChanged(state);
    } else if (BridgeMerge && BridgeMerge.Achievements && typeof BridgeMerge.Achievements.recordProductionStorageSnapshot === 'function') {
      BridgeMerge.Achievements.recordProductionStorageSnapshot(state);
    }
    return {
      level: targetBox.level,
      targetIndex: sourceIndex < targetIndex ? targetIndex - 1 : targetIndex,
      box: cloneBoxForSave(targetBox),
    };
  }

  // ─── Serialize / deserialize for save ──────────────────────
  function serialize(state) {
    const pl = ensureState(state);
    return {
      killsTracked: pl.killsTracked,
      boxesProduced: pl.boxesProduced,
      progress: pl.progress,
      storageSlots: pl.storageSlots,
      storage: pl.storage.map(cloneBoxForSave),
      firstNewGameBoxGuaranteedPending: !!pl.firstNewGameBoxGuaranteedPending,
    };
  }

  function deserialize(state, saved) {
    const pl = ensureState(state);
    if (!saved || typeof saved !== 'object') return;
    if (Number.isFinite(saved.killsTracked))  pl.killsTracked  = Math.max(0, saved.killsTracked);
    if (Number.isFinite(saved.boxesProduced)) pl.boxesProduced = Math.max(0, Math.floor(saved.boxesProduced));
    if (Number.isFinite(saved.progress))      pl.progress      = clamp(saved.progress, 0, 1);
    if (Number.isFinite(saved.storageSlots))  pl.storageSlots  = Math.max(1, Math.floor(saved.storageSlots));
    if (Array.isArray(saved.storage))         pl.storage       = normalizeSavedStorage(saved.storage);
    if (typeof saved.firstNewGameBoxGuaranteedPending === 'boolean') {
      pl.firstNewGameBoxGuaranteedPending = saved.firstNewGameBoxGuaranteedPending;
    }
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
    canMergeBoxes: canMergeBoxes,
    mergeBoxes: mergeBoxes,
    LOOT_TABLE: LOOT_TABLE,
    DEFAULT_STORAGE_SLOTS: DEFAULT_STORAGE_SLOTS,
    STORAGE_COLS: STORAGE_COLS,
    MAX_BOX_LEVEL: MAX_BOX_LEVEL,
  };
})(typeof window !== 'undefined' ? window : this);
