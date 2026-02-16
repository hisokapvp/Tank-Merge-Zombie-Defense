(function (global) {
  'use strict';

  function createInitialState(options) {
    var opts = options || {};
    var maxLevel = Number.isFinite(opts.maxLevel) ? Math.floor(opts.maxLevel) : 60;

    return {
      coins: 120,
      kills: 0,
      cells: [],
      boardRect: { x: 0, y: 0, w: 0, h: 0 },
      zombies: [],
      projectiles: [],
      impacts: [],
      decals: [],
      particles: [],
      damageNumbers: [],
      decors: [],
      mapSeeds: {
        stampsSeed: null,
        decorSeed: null,
      },
      fenceSegments: [],
      fenceSegmentsMeta: null,
      savedFenceState: null,
      crate: null,
      nextCrateAt: 0,
      dragging: null,
      boostUntil: 0,
      empUntil: 0,
      activeEffects: {
        attackUntil: 0,
        speedUntil: 0,
        economyUntil: 0,
      },
      player: {
        level: 1,
        xp: 0,
        xpToNext: 500,
        maxLevel: maxLevel,
        talentPoints: 0,
        talentsApplied: [],
        talentsPending: [],
        activeCooldowns: [0, 0, 0],
        mods: null,
        modsDirty: true,
        eventShown40: false,
        eventShown50: false,
        eventShown60: false,
      },
      endgameVisuals: false,
      maxTankLevelAchieved: 1,
      buyCounts: {},
      buyPrices: {},
      achievements: {
        unlocked: {},
        popupQueue: [],
        totalPurchased: 0,
        totalMerges: 0,
      },
      ui: {
        talentsOpen: false,
        talentBranch: 0,
        levelReward: null,
        levelRewardTimer: 0,
        menuOpen: true,
      },
      selectedHangarCellIndex: null,
      isDismantleMode: false,
      selectedTankIds: [],
    };
  }

  global.Game = global.Game || {};
  global.Game.InitialState = {
    createInitialState: createInitialState,
  };
})(typeof window !== 'undefined' ? window : this);
