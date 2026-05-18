(function (global) {
  'use strict';

  function createInitialTutorialState() {
    var tutorialSteps = global.Game && global.Game.TutorialSteps;
    if (tutorialSteps && typeof tutorialSteps.buildInitialTutorialState === 'function') {
      return tutorialSteps.buildInitialTutorialState();
    }

    return {
      version: 5,
      disabled: false,
      completed: false,
      currentStepId: 'starter_tank',
      steps: {
        starter_tank: {
          completed: false,
          dismissed: false,
          bubbleOpen: true,
        },
        second_tank: {
          completed: false,
          dismissed: false,
          bubbleOpen: true,
        },
        merge_tank: {
          completed: false,
          dismissed: false,
          bubbleOpen: true,
        },
      },
    };
  }

  function createInitialState(options) {
    var opts = options || {};
    var reason = opts.reason === 'new_game' ? 'new_game' : 'boot';
    var maxLevel = Number.isFinite(opts.maxLevel) ? Math.floor(opts.maxLevel) : 60;

    // --- Fence segments с repairCount ---
    var fenceSegments = [];
    if (global.Game && global.Game.FenceLayout && typeof global.Game.FenceLayout.buildSquareFenceSegments === 'function') {
      var segments = global.Game.FenceLayout.buildSquareFenceSegments({});
      for (var i = 0; i < segments.length; i++) {
        var seg = Object.assign({}, segments[i]);
        seg.repairCount = 0;
        fenceSegments.push(seg);
      }
    }
    // ---
    return {
      coins: 40,
      kills: 0,
      totalDamageDealtRaw: 0,
      zombieWaveAtkMult: 1,
      damagePointsSpent: 0,
      fenceLevel: 1,
      fenceRepairCount: 0,
      cells: [],
      boardRect: { x: 0, y: 0, w: 0, h: 0 },
      zombies: [],
      projectiles: [],
      impacts: [],
      decals: [],
      particles: [],
      damageNumbers: [],
      drones: [],
      decors: [],
      wallDecors: [],
      mapSeeds: {
        stampsSeed: null,
        decorSeed: null,
      },
      nextZombieRenderOrder: 1,
      fenceSegments: fenceSegments,
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
      supercomputer: {
        computerLevel: 0,
        xp: 0,
        xpToNext: 50,
        maxLevel: maxLevel,
        hp: 920,
        maxHp: 920,
        armorFlat: 2,
        x: 0,
        y: 0,
        offsetY: 64,
        state: 'idle',
        animElapsedSec: 0,
        glitchLoopsRemaining: 0,
        glitchCooldownUntil: 0,
        wantsBuildTank: false,
        pendingBuildTank: false,
        eventShown40: false,
        eventShown50: false,
        eventShown60: false,
      },
      player: {
        talentPoints: 0,
        damagePoints: 0,
        talentsApplied: [],
        talentsPending: [],
        talentsVersion: 2,
        talentsV2: {
          ranksById: {},
          freePoints: 0,
        },
        freeTalentPointsV2: 0,
        activeCooldowns: [0, 0, 0],
        cannonUpgradesApplied: Array(maxLevel).fill(0),
        fenceUpgradesApplied: Array(60).fill(0),
        mods: null,
        modsDirty: true,
        eventShown40: false,
        eventShown50: false,
        eventShown60: false,
      },
      endgameVisuals: false,
      maxTankLevelAchieved: 1,
      runtimeMaxTankLevelAchieved: 1,
      currentFenceTierApplied: 1,
      buyCounts: {},
      buyPrices: {},
      achievements: {
        unlocked: {},
        popupQueue: [],
        rewarded: {},
        rewardHistory: [],
        deferredRewards: [],
        totalPurchased: 0,
        totalMerges: 0,
        totalManualFenceRepairs: 0,
        totalModifierTechUnlocks: 0,
        totalDroneAcquisitions: 0,
        totalNoRepairAttackWaveStreak: 0,
        totalChipComboTriples: 0,
        totalChipCraftFromFragments: 0,
        totalMoneyEarned: 0,
        totalPerfectFenceWaves: 0,
        totalHangarMasterLevel: 0,
        totalMaxTankLevel: 0,
        reservePowerPeakCycle: 0,
        // Lifetime counters (ADR — see src/mechanics/achievements.js ACHIEVEMENT_FAMILIES dust_master/fragment_collector):
        // monotonic, survive partial+full reset, only positive deltas, written via creditSiliconDust + addPlayerFragment seams.
        dustEarnedLifetime: 0,
        fragmentsAcquired: 0,
        // solo-pipeline-yandex-vk batch#2 — daily_attendance family.
        // totalLoginDays — monotonic counter дней входа в игру (UTC, идемпотентно по lastLoginDate).
        // lastLoginDate — ISO yyyy-mm-dd (UTC) последнего засчитанного входа.
        totalLoginDays: 0,
        lastLoginDate: '',
        // solo-pipeline-yandex-vk batch#? — zombie_slayer family.
        // totalZombieKills — legacy mirror lifetime kill counter; canonical stats.zombieKillsTotal.
        // Survives partial reset (pattern dustEarnedLifetime). Increments only via
        // Game.Achievements.recordZombieKilled from flushZombieDeathFx batch seam.
        totalZombieKills: 0,
        // Item 2 — Сколько раз игрок выполнил «Перезагрузка симуляции» (partial reset).
        // Канонический счётчик. Инкрементируется в Game.WorldReset.restartSimulationPartial
        // ДО takeProgressSnapshot, поэтому переживает partial reset через snapshot.achievements.
        totalSimulationResets: 0,
        // Item 3 — survivor (Выживший) achievement.
        // Legacy mirror lifetime счётчика волн, переживших полное разрушение всех фрагментов забора.
        // Канонический stats.survivorWaveCompletionsCount; ensureStats нормализует пару.
        // Поскольку достижение one-shot (target=1), partial reset не критичен после первого grant,
        // но мы держим mirror для save schema parity.
        totalSurvivorWaveCompletions: 0,
        completedModifierTechs: {},
        counters: {
          productionStorageSnapshot: { total: 0, level2: 0, level4: 0 },
        },
      },
      stats: {
        tanksMergedCount: 0,
        tanksBoughtCount: 0,
        manualFenceRepairsCount: 0,
        modifierTechUnlocksCount: 0,
        droneAcquisitionsCount: 0,
        noRepairAttackWaveStreakCount: 0,
        moneyEarnedCount: 0,
        perfectFenceWavesCount: 0,
        hangarMasterLevelCount: 0,
        maxTankLevelCount: 0,
        chipComboTriplesCount: 0,
        chipCraftFromFragmentsCount: 0,
        // box_hunter canonical counter (military aid crate opens). No legacy ach.totalBonusBoxesOpened mirror —
        // pure stats.* fresh-start, no retroactive grants. Increments only via Game.Achievements.recordBonusBoxOpened
        // from game.js claimCrateReward seam.
        bonusBoxesOpenedCount: 0,
        // Lifetime dust/fragment counters — canonical home in stats; ensureStats mirrors achievements.* legacy pair.
        dustEarnedLifetime: 0,
        fragmentsAcquired: 0,
        // solo-pipeline-yandex-vk batch#2 — daily_attendance canonical counter.
        // Инкремент только через Game.Achievements.recordDailyLoginTick (UTC-day idempotency).
        totalLoginDays: 0,
        // solo-pipeline-yandex-vk — zombie_slayer canonical counter (lifetime).
        // Инкремент только через Game.Achievements.recordZombieKilled из flushZombieDeathFx batch seam.
        // Survives partial reset; clamp на MAX_SAFE_INTEGER. Source breakdown в zombieKillsBySource.
        zombieKillsTotal: 0,
        zombieKillsBySource: { tank: 0, drone: 0, talent: 0, wall: 0 },
      },
      ui: {
        talentsOpen: false,
        talentBranch: 0,
        levelReward: null,
        levelRewardTimer: 0,
        menuOpen: true,
        toast: {
          active: null,
          queue: [],
        },
        unlockFx: {
          autoMergeUntilMs: 0,
          bulkBuyUntilMs: 0,
        },
      },
      flags: {
        preRetryAutosavedThisCritical: false,
        wasCritical: false,
        preRetrySaveFailed: false,
      },
      selectedHangarCellIndex: null,
      isDismantleMode: false,
      selectedTankIds: [],
      tutorial: createInitialTutorialState(),
      hangarCells: null,
      playerChips: [],
      productionLine: {
        killsTracked: 0,
        boxesProduced: 0,
        progress: 0,
        storageSlots: 9,
        storage: [],
        conveyorAnimTime: 0,
        firstNewGameBoxGuaranteedPending: reason === 'new_game',
      },
      // Yandex chip-bundle shop ledger (item 6, batch#2 of
      // solo-pipeline-yandex-vk). `entitlements` keyed by purchaseToken
      // tracks "what was already credited" so applyBundle (item 10) is
      // idempotent across reloads. `lastSync` is a unix-ms timestamp of
      // the last successful cloud-save reconciliation. `pendingDeliveries`
      // queues purchase tokens that survived the host call but have not
      // yet been credited locally (e.g. interrupted boot). Saved/restored
      // by Phase 3 saveSchema/cloudSave (next batch); kept default-init
      // here so the field exists on first run and on legacy saves.
      shop: {
        entitlements: {},
        lastSync: 0,
        pendingDeliveries: [],
      },
    };
  }

  global.Game = global.Game || {};
  global.Game.InitialState = {
    createInitialState: createInitialState,
  };
})(typeof window !== 'undefined' ? window : this);
