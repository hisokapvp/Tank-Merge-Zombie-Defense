(function (global) {
  'use strict';

  function toSafeInt(value, fallback, minValue) {
    var fallbackValue = Number.isFinite(fallback) ? Math.floor(fallback) : 0;
    var next = Number.isFinite(value) ? Math.floor(value) : fallbackValue;
    if (Number.isFinite(minValue)) next = Math.max(minValue, next);
    return next;
  }

  function cloneArray(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function cloneObject(value, fallback) {
    if (!value || typeof value !== 'object') {
      return fallback && typeof fallback === 'object' ? fallback : {};
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return fallback && typeof fallback === 'object' ? fallback : {};
    }
  }

  function takeProgressSnapshot(state) {
    var src = state && typeof state === 'object' ? state : {};
    var player = src.player && typeof src.player === 'object' ? src.player : {};
    var supercomputer = src.supercomputer && typeof src.supercomputer === 'object' ? src.supercomputer : {};

    return {
      achievements: cloneObject(src.achievements, {
        unlocked: {},
        popupQueue: [],
        totalPurchased: 0,
        totalMerges: 0,
      }),
      upgrades: {
        talentPoints: toSafeInt(player.talentPoints, 0, 0),
        damagePoints: toSafeInt(player.damagePoints, 0, 0),
        talentsApplied: cloneArray(player.talentsApplied),
        talentsPending: cloneArray(player.talentsPending),
        cannonUpgradesApplied: cloneArray(player.cannonUpgradesApplied),
        fenceUpgradesApplied: cloneArray(player.fenceUpgradesApplied),
      },
      modifications: {
        mods: cloneObject(player.mods, null),
        totalDamageDealtRaw: toSafeInt(src.totalDamageDealtRaw, 0, 0),
        damagePointsSpent: toSafeInt(src.damagePointsSpent, 0, 0),
      },
      supercomputer: {
        computerLevel: toSafeInt(supercomputer.computerLevel, 1, 1),
        xp: toSafeInt(supercomputer.xp, 0, 0),
        xpToNext: toSafeInt(supercomputer.xpToNext, 1, 1),
        maxLevel: toSafeInt(supercomputer.maxLevel, 60, 1),
        eventShown40: !!supercomputer.eventShown40,
        eventShown50: !!supercomputer.eventShown50,
        eventShown60: !!supercomputer.eventShown60,
      },
      drones: cloneObject(src.drones, []),
    };
  }

  function restoreProgressSnapshot(state, snapshot) {
    var target = state && typeof state === 'object' ? state : null;
    var src = snapshot && typeof snapshot === 'object' ? snapshot : null;
    if (!target || !src) return;

    if (!target.player || typeof target.player !== 'object') target.player = {};
    if (!target.supercomputer || typeof target.supercomputer !== 'object') target.supercomputer = {};

    target.achievements = cloneObject(src.achievements, {
      unlocked: {},
      popupQueue: [],
      totalPurchased: 0,
      totalMerges: 0,
    });

    var upgrades = src.upgrades && typeof src.upgrades === 'object' ? src.upgrades : {};
    target.player.talentPoints = toSafeInt(upgrades.talentPoints, 0, 0);
    target.player.damagePoints = toSafeInt(upgrades.damagePoints, 0, 0);
    target.player.talentsApplied = cloneArray(upgrades.talentsApplied);
    target.player.talentsPending = cloneArray(upgrades.talentsPending);
    target.player.cannonUpgradesApplied = cloneArray(upgrades.cannonUpgradesApplied);
    target.player.fenceUpgradesApplied = cloneArray(upgrades.fenceUpgradesApplied);

    var modifications = src.modifications && typeof src.modifications === 'object' ? src.modifications : {};
    target.player.mods = cloneObject(modifications.mods, null);
    target.player.modsDirty = true;
    // fenceLevel intentionally NOT restored here — partial restart should reset fences to tier1
    target.totalDamageDealtRaw = toSafeInt(modifications.totalDamageDealtRaw, 0, 0);
    target.damagePointsSpent = toSafeInt(modifications.damagePointsSpent, 0, 0);

    var supercomputer = src.supercomputer && typeof src.supercomputer === 'object' ? src.supercomputer : {};
    target.supercomputer.computerLevel = toSafeInt(supercomputer.computerLevel, 1, 1);
    target.supercomputer.xp = toSafeInt(supercomputer.xp, 0, 0);
    target.supercomputer.xpToNext = toSafeInt(supercomputer.xpToNext, 1, 1);
    target.supercomputer.maxLevel = toSafeInt(supercomputer.maxLevel, 60, 1);
    target.supercomputer.eventShown40 = !!supercomputer.eventShown40;
    target.supercomputer.eventShown50 = !!supercomputer.eventShown50;
    target.supercomputer.eventShown60 = !!supercomputer.eventShown60;

    target.drones = cloneObject(src.drones, []);
  }

  function resetWorldRuntimeState(options) {
    var opts = options || {};
    if (typeof opts.resetWorldRuntime !== 'function') return;
    opts.resetWorldRuntime();
  }

  function restartSimulationPartial(options) {
    var opts = options || {};
    if (typeof opts.getState !== 'function' || typeof opts.resetWorldRuntime !== 'function') {
      return null;
    }

    var takeSnapshot = typeof opts.takeProgressSnapshot === 'function'
      ? opts.takeProgressSnapshot
      : function (state) { return takeProgressSnapshot(state); };
    var restoreSnapshot = typeof opts.restoreProgressSnapshot === 'function'
      ? opts.restoreProgressSnapshot
      : function (state, snapshot) { restoreProgressSnapshot(state, snapshot); };

    var beforeState = opts.getState();
    var snapshot = takeSnapshot(beforeState);

    resetWorldRuntimeState({ resetWorldRuntime: opts.resetWorldRuntime });

    var afterState = opts.getState();
    restoreSnapshot(afterState, snapshot);

    if (typeof opts.onAfterRestore === 'function') {
      opts.onAfterRestore(afterState, snapshot);
    }

    return {
      snapshot: snapshot,
      state: afterState,
    };
  }

  global.Game = global.Game || {};
  global.Game.WorldReset = {
    takeProgressSnapshot: takeProgressSnapshot,
    restoreProgressSnapshot: restoreProgressSnapshot,
    resetWorldRuntimeState: resetWorldRuntimeState,
    restartSimulationPartial: restartSimulationPartial,
  };
})(typeof window !== 'undefined' ? window : this);
