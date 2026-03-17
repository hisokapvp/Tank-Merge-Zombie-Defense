(function (global) {
  'use strict';

  var AUTO_MERGE_COOLDOWN_MS = 300;
  var mergePairExecutor = null;
  var tankEligibilityPredicate = null;

  function getI18n() {
    return global.Game && global.Game.I18n ? global.Game.I18n : null;
  }

  function t(key, fallback, vars) {
    var i18n = getI18n();
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, vars || {});
    return fallback;
  }

  function normalizeMaxPairs(maxPairs) {
    if (maxPairs === Infinity) return Infinity;
    var parsed = Math.floor(Number(maxPairs));
    if (!Number.isFinite(parsed) || parsed < 1) return Infinity;
    return parsed;
  }

  function resolveTrackIndex(cell, tank, fallbackIndex) {
    if (Number.isFinite(tank && tank.trackIndex)) return tank.trackIndex;
    if (Number.isFinite(cell && cell.trackIndex)) return cell.trackIndex;
    if (Number.isFinite(cell && cell.i)) return cell.i;
    return fallbackIndex;
  }

  function resolveSlotIndex(cell, fallbackIndex) {
    if (Number.isFinite(cell && cell.slotIndex)) return cell.slotIndex;
    if (Number.isFinite(cell && cell.i)) return cell.i;
    return fallbackIndex;
  }

  function buildStableKey(cell, tank, fallbackIndex) {
    if (tank && typeof tank.id === 'string' && tank.id.length > 0) return 'tank:' + tank.id;
    if (Number.isFinite(cell && cell.i)) return 'cell:' + cell.i;
    return 'seq:' + fallbackIndex;
  }

  function isEligibleTank(tank, excludeAdBox) {
    if (!tank) return false;
    if (!excludeAdBox) return true;
    if (tank.requiresAd || tank.locked || tank.fromAdBox) return false;
    if (typeof tankEligibilityPredicate === 'function') {
      return tankEligibilityPredicate(tank) !== false;
    }
    return true;
  }

  function findMergePairs(options) {
    var opts = options || {};
    var state = opts.state || null;
    var maxPairs = normalizeMaxPairs(opts.maxPairs);
    var includeHangar = opts.includeHangar !== false;
    var includeTrack = opts.includeTrack !== false;
    var excludeAdBox = opts.excludeAdBox !== false;
    if (!state || !Array.isArray(state.cells) || maxPairs === 0) return [];

    var buckets = Object.create(null);
    var levels = [];
    var seq = 0;

    for (var i = 0; i < state.cells.length; i++) {
      var cell = state.cells[i];
      if (!cell || !cell.tank) continue;
      var tank = cell.tank;
      var isTrackTank = !!tank.onTrack;
      if (isTrackTank && !includeTrack) continue;
      if (!isTrackTank && !includeHangar) continue;
      if (!isEligibleTank(tank, excludeAdBox)) continue;
      if (!Number.isFinite(tank.level)) continue;

      var level = Math.floor(tank.level);
      if (!buckets[level]) {
        buckets[level] = [];
        levels.push(level);
      }

      var locationType = isTrackTank ? 1 : 0;
      var locationIndex = isTrackTank
        ? resolveTrackIndex(cell, tank, seq)
        : resolveSlotIndex(cell, seq);

      buckets[level].push({
        tank: tank,
        level: level,
        locationType: locationType,
        locationIndex: locationIndex,
        stableKey: buildStableKey(cell, tank, seq),
      });
      seq += 1;
    }

    levels.sort(function (a, b) { return a - b; });

    var pairs = [];
    for (var li = 0; li < levels.length; li++) {
      var lvl = levels[li];
      var list = buckets[lvl];
      list.sort(function (left, right) {
        if (left.locationType !== right.locationType) return left.locationType - right.locationType;
        if (left.locationIndex !== right.locationIndex) return left.locationIndex - right.locationIndex;
        if (left.stableKey < right.stableKey) return -1;
        if (left.stableKey > right.stableKey) return 1;
        return 0;
      });

      for (var j = 0; j + 1 < list.length; j += 2) {
        pairs.push([list[j].tank, list[j + 1].tank]);
        if (pairs.length >= maxPairs) return pairs;
      }
    }

    return pairs;
  }

  function getAutoMergeTier(state) {
    var unlocked = state && state.achievements && state.achievements.unlocked;
    if (!unlocked || !unlocked.engineer_novice) return 'hidden';
    if (unlocked.engineer_expert) return 'mergeAll';
    if (unlocked.engineer_pro) return 'mergeX';
    return 'merge2';
  }

  function maxPairsForTier(tier) {
    if (tier === 'merge2') return 1;
    if (tier === 'mergeX') return 5;
    if (tier === 'mergeAll') return Infinity;
    return 0;
  }

  function getAutoMergeButtonModel(state) {
    var tier = getAutoMergeTier(state);
    if (tier === 'hidden') {
      return {
        visible: false,
        enabled: false,
        label: '',
        cooldownMs: AUTO_MERGE_COOLDOWN_MS,
      };
    }

    var maxPairs = maxPairsForTier(tier);
    var pairs = findMergePairs({
      state: state,
      maxPairs: maxPairs,
      includeHangar: true,
      includeTrack: true,
      excludeAdBox: true,
    });
    var enabled = pairs.length >= 1;
    var label = '';

    if (tier === 'merge2') {
      label = t('autoMerge2', 'Объединить 2 танка');
    } else if (tier === 'mergeX') {
      var dynamicCount = Math.max(2, Math.min(10, pairs.length * 2));
      label = t('autoMergeDynamicShort', 'Объединить {count}', { count: dynamicCount });
    } else {
      label = t('autoMergeAll', 'Объединить все танки');
    }

    return {
      visible: true,
      enabled: enabled,
      label: label,
      cooldownMs: AUTO_MERGE_COOLDOWN_MS,
    };
  }

  function runAutoMerge(state, tier, opts) {
    var options = opts || {};
    var executor = options.mergePair || mergePairExecutor;
    if (typeof executor !== 'function') {
      return { executed: 0, skipped: 0, totalPairs: 0 };
    }

    var maxPairs = maxPairsForTier(tier);
    if (maxPairs <= 0 && maxPairs !== Infinity) {
      return { executed: 0, skipped: 0, totalPairs: 0 };
    }

    var pairsSnapshot = findMergePairs({
      state: state,
      maxPairs: maxPairs,
      includeHangar: true,
      includeTrack: true,
      excludeAdBox: true,
    });

    var executed = 0;
    var skipped = 0;
    for (var i = 0; i < pairsSnapshot.length; i++) {
      var pair = pairsSnapshot[i];
      var left = pair && pair[0];
      var right = pair && pair[1];
      if (!left || !right || left === right) {
        skipped += 1;
        continue;
      }
      if (!Number.isFinite(left.level) || !Number.isFinite(right.level) || left.level !== right.level) {
        skipped += 1;
        continue;
      }
      if (!isEligibleTank(left, true) || !isEligibleTank(right, true)) {
        skipped += 1;
        continue;
      }

      if (executor(left, right) === true) executed += 1;
      else skipped += 1;
    }

    return {
      executed: executed,
      skipped: skipped,
      totalPairs: pairsSnapshot.length,
    };
  }

  function setMergePairExecutor(executor) {
    mergePairExecutor = typeof executor === 'function' ? executor : null;
  }

  function setTankEligibilityPredicate(predicate) {
    tankEligibilityPredicate = typeof predicate === 'function' ? predicate : null;
  }

  global.Game = global.Game || {};
  global.Game.AutoMerge = {
    AUTO_MERGE_COOLDOWN_MS: AUTO_MERGE_COOLDOWN_MS,
    findMergePairs: findMergePairs,
    getAutoMergeTier: getAutoMergeTier,
    getAutoMergeButtonModel: getAutoMergeButtonModel,
    runAutoMerge: runAutoMerge,
    setMergePairExecutor: setMergePairExecutor,
    setTankEligibilityPredicate: setTankEligibilityPredicate,
  };
})(typeof window !== 'undefined' ? window : this);
