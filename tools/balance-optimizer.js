(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./balance-shared.js'), require('./balance-registry.js'));
  } else {
    root.BalanceLab = root.BalanceLab || {};
    root.BalanceLab.Optimizer = factory(root.BalanceLab.Shared, root.BalanceLab.Registry);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Shared, Registry) {
  'use strict';

  function buildEvaluationData(baseData, runtimeGame) {
    return Shared.buildRuntimeData(baseData, runtimeGame);
  }

  function evaluateAssignments(baseData, runtimeGame, registry, tunableState, profiles, goals, selectedScenarioIds, assignments) {
    var ctx = {
      edit: Shared.deepClone(baseData),
      runtimeGame: Object.assign({}, runtimeGame),
      runtimePending: {},
      runtimeLocked: {},
    };
    registry.forEach(function (item) {
      var tunableConfig = tunableState[item.id];
      if (!tunableConfig || !tunableConfig.enabled || item.locked) return;
      Registry.applyTunable(ctx, item, assignments[item.id], tunableConfig);
    });
    var rows = Shared.evaluateMatrix(buildEvaluationData(ctx.edit, ctx.runtimeGame), profiles, goals, { selectedScenarioIds: selectedScenarioIds });
    var summary = Shared.summarizeCoverage(rows);
    var sanityPenalty = computeSanityPenalty(registry, tunableState, ctx.edit);
    if (sanityPenalty > 0) {
      summary = Object.assign({}, summary, {
        score: Shared.round(summary.score + sanityPenalty, 6),
        sanityPenalty: sanityPenalty,
      });
    }
    return {
      rows: rows,
      summary: summary,
      edit: ctx.edit,
      runtimeGame: ctx.runtimeGame,
      runtimePending: ctx.runtimePending,
    };
  }

  function getCurrentAssignmentValue(item, tunableConfig, context) {
    if (item.mode === 'factor') {
      return Shared.safeNumber(tunableConfig.value, 1);
    }
    if (typeof item.readCurrent === 'function') {
      return Shared.safeNumber(item.readCurrent(context), Shared.safeNumber(tunableConfig.value, 1));
    }
    return Shared.safeNumber(tunableConfig.value, 1);
  }

  function getTunableCategory(itemOrId) {
    var id = typeof itemOrId === 'string' ? itemOrId : itemOrId && itemOrId.id;
    if (!id) return 'generic';
    if (/^balance\.tank\.|^series\.tank\.|^series\.bullet\.|^runtime\./.test(id)) return 'offense';
    if (/^series\.zombie\.health(?:\.anchor)?$|^series\.zombie\.hpMul$/.test(id)) return 'zombie-health';
    if (/^balance\.zombie\.|^series\.zombie\.attackDamage$/.test(id)) return 'zombie-pressure';
    if (/^series\.fence\.|^series\.drone\.repairSpeedMult$/.test(id)) return 'fence-survival';
    if (/^series\.zombie\.rewardMul$|^series\.drone\.costMult$/.test(id)) return 'economy';
    return 'generic';
  }

  function pushUniqueCandidate(candidates, value, min, max) {
    var nextValue = Shared.clamp(Shared.safeNumber(value, 1), min, max);
    if (candidates.indexOf(nextValue) === -1) candidates.push(nextValue);
  }

  function getScenarioGoal(goals, scenario) {
    return goals && scenario && goals[scenario.bandId] ? goals[scenario.bandId][scenario.profileKey] : null;
  }

  function getGoalMidpoint(min, max, fallback) {
    if (Number.isFinite(min) && Number.isFinite(max)) return (min + max) * 0.5;
    if (Number.isFinite(min)) return min;
    if (Number.isFinite(max)) return max;
    return fallback;
  }

  function collectEmergencyFactorCandidates(item, tunableConfig, currentValue, rows, goals) {
    var category = getTunableCategory(item);
    var defaultMin = Shared.safeNumber(tunableConfig.min, item.min);
    var defaultMax = Shared.safeNumber(tunableConfig.max, item.max);
    var userEditedBounds = defaultMin !== item.min || defaultMax !== item.max;
    var min = userEditedBounds ? defaultMin : Shared.safeNumber(item.emergencyMin, defaultMin);
    var max = userEditedBounds ? defaultMax : Shared.safeNumber(item.emergencyMax, defaultMax);
    var candidates = [];

    if (item.mode !== 'factor' || !rows || !rows.length || category === 'generic' || category === 'economy') {
      return candidates;
    }

    rows.forEach(function (row) {
      var goal = getScenarioGoal(goals, row.scenario);
      var ratios = [];
      var targetSingle;
      var targetPack;
      var targetFenceDamage;
      var targetFenceSurvival;

      if (!goal) return;

      if (category === 'offense') {
        targetSingle = getGoalMidpoint(goal.zombieTtkMin, goal.zombieTtkMax, row.metrics.singleZombieTtk);
        targetPack = getGoalMidpoint(goal.packTtkMin, goal.packTtkMax, row.metrics.packTtk);
        if (row.metrics.singleZombieTtk > 0 && targetSingle > 0) {
          ratios.push(row.metrics.singleZombieTtk / targetSingle);
        }
        if (row.metrics.packTtk > 0 && targetPack > 0) {
          ratios.push(row.metrics.packTtk / targetPack);
        }
      } else if (category === 'zombie-health') {
        targetSingle = getGoalMidpoint(goal.zombieTtkMin, goal.zombieTtkMax, row.metrics.singleZombieTtk);
        targetPack = getGoalMidpoint(goal.packTtkMin, goal.packTtkMax, row.metrics.packTtk);
        if (row.metrics.singleZombieTtk > 0 && targetSingle > 0) {
          ratios.push(targetSingle / row.metrics.singleZombieTtk);
        }
        if (row.metrics.packTtk > 0 && targetPack > 0) {
          ratios.push(targetPack / row.metrics.packTtk);
        }
      } else if (category === 'zombie-pressure') {
        targetFenceDamage = getGoalMidpoint(goal.fenceDamageMin, goal.fenceDamageMax, row.metrics.fenceDamagePerAttackWindow);
        targetFenceSurvival = getGoalMidpoint(goal.fenceSurvivalMinSec, goal.fenceSurvivalMaxSec, row.metrics.fenceSurvivalSec);
        if (row.metrics.fenceDamagePerAttackWindow > 0 && targetFenceDamage > 0) {
          ratios.push(targetFenceDamage / row.metrics.fenceDamagePerAttackWindow);
        }
        if (row.metrics.fenceSurvivalSec > 0 && targetFenceSurvival > 0) {
          ratios.push(row.metrics.fenceSurvivalSec / targetFenceSurvival);
        }
      } else if (category === 'fence-survival') {
        targetFenceSurvival = getGoalMidpoint(goal.fenceSurvivalMinSec, goal.fenceSurvivalMaxSec, row.metrics.fenceSurvivalSec);
        if (row.metrics.fenceSurvivalSec > 0 && targetFenceSurvival > 0) {
          ratios.push(targetFenceSurvival / row.metrics.fenceSurvivalSec);
        }
      }

      ratios.forEach(function (ratio) {
        if (!Number.isFinite(ratio) || ratio <= 0 || Math.abs(ratio - 1) < 0.001) return;
        pushUniqueCandidate(candidates, currentValue * ratio, min, max);
        pushUniqueCandidate(candidates, currentValue * Math.sqrt(ratio), min, max);
        pushUniqueCandidate(candidates, currentValue * Math.pow(ratio, 0.25), min, max);
      });
    });

    return candidates;
  }

  function collectSanityFactorCandidates(item, tunableConfig, currentValue, currentEdit) {
    var candidates = [];

    if (item.mode !== 'factor' || !currentEdit || !(item.sanityMax > 0) || typeof item.readSanityValues !== 'function') {
      return candidates;
    }

    item.readSanityValues(currentEdit, tunableConfig).forEach(function (rawValue) {
      var safeRawValue = Shared.safeNumber(rawValue, NaN);
      if (!Number.isFinite(safeRawValue) || safeRawValue <= item.sanityMax) return;
      candidates.push(currentValue * (item.sanityMax / safeRawValue));
    });

    return candidates;
  }

  function computeSanityPenalty(registry, tunableState, currentEdit) {
    var penalty = 0;

    registry.forEach(function (item) {
      var tunableConfig = tunableState[item.id];
      if (!tunableConfig || !tunableConfig.enabled || item.locked || !(item.sanityMax > 0) || typeof item.readSanityValues !== 'function') {
        return;
      }
      item.readSanityValues(currentEdit, tunableConfig).forEach(function (rawValue) {
        var safeRawValue = Shared.safeNumber(rawValue, NaN);
        if (!Number.isFinite(safeRawValue) || safeRawValue <= 0 || safeRawValue <= item.sanityMax) return;
        penalty += Math.max(0, Math.log(safeRawValue / item.sanityMax) / Math.LN10) * 10;
      });
    });

    return Shared.round(penalty, 6);
  }

  function buildCandidateValues(item, tunableConfig, currentValue, rows, goals, currentEdit) {
    var min = Shared.safeNumber(tunableConfig.min, item.min);
    var max = Shared.safeNumber(tunableConfig.max, item.max);
    var step = Shared.safeNumber(tunableConfig.step, item.step);
    var directionBias = tunableConfig.directionBias || item.directionBias || 'neutral';
    var deltas = item.mode === 'factor'
      ? [-2, -1, 1, 2].map(function (multiplier) { return Shared.round(currentValue + step * multiplier, 6); })
      : [-2, -1, 1, 2].map(function (multiplier) { return Shared.round(currentValue + step * multiplier, 6); });
    var candidates = [currentValue];
    deltas.forEach(function (value) {
      pushUniqueCandidate(candidates, value, min, max);
    });
    pushUniqueCandidate(candidates, min, min, max);
    pushUniqueCandidate(candidates, max, min, max);
    if (directionBias === 'up' || directionBias === 'neutral') {
      pushUniqueCandidate(candidates, currentValue + (max - currentValue) * 0.5, min, max);
    }
    if (directionBias === 'down' || directionBias === 'neutral') {
      pushUniqueCandidate(candidates, currentValue - (currentValue - min) * 0.5, min, max);
    }
    collectEmergencyFactorCandidates(item, tunableConfig, currentValue, rows, goals).forEach(function (value) {
      pushUniqueCandidate(candidates, value, Shared.safeNumber(item.emergencyMin, min), Shared.safeNumber(item.emergencyMax, max));
    });
    collectSanityFactorCandidates(item, tunableConfig, currentValue, currentEdit).forEach(function (value) {
      pushUniqueCandidate(candidates, value, Shared.safeNumber(item.emergencyMin, min), Shared.safeNumber(item.emergencyMax, max));
    });
    return candidates;
  }

  function getBaselineAssignments(registry, tunableState, context) {
    var assignments = {};
    registry.forEach(function (item) {
      var tunableConfig = tunableState[item.id];
      if (!tunableConfig || !tunableConfig.enabled || item.locked) return;
      assignments[item.id] = getCurrentAssignmentValue(item, tunableConfig, context);
    });
    return assignments;
  }

  function collectChangedTunables(registry, tunableState, baselineAssignments, nextAssignments) {
    return registry.filter(function (item) {
      if (!tunableState[item.id] || !tunableState[item.id].enabled || item.locked) return false;
      return baselineAssignments[item.id] !== nextAssignments[item.id];
    }).map(function (item) {
      return {
        id: item.id,
        label: item.label,
        group: item.group,
        from: baselineAssignments[item.id],
        to: nextAssignments[item.id],
        bands: tunableState[item.id].bands.slice(),
      };
    });
  }

  function getExplanationCategory(change) {
    return getTunableCategory(change);
  }

  function buildExplanations(changedTunables, beforeRows, afterRows) {
    var byScenario = {};
    afterRows.forEach(function (row) {
      byScenario[row.scenario.id] = row;
    });
    return changedTunables.map(function (change) {
      var category = getExplanationCategory(change);
      var reasons = [];
      beforeRows.forEach(function (beforeRow) {
        var afterRow = byScenario[beforeRow.scenario.id];
        if (!afterRow) return;
        if (category === 'offense') {
          if (afterRow.metrics.singleZombieTtk < beforeRow.metrics.singleZombieTtk) {
            reasons.push(beforeRow.scenario.bandId + ' ' + Shared.PROFILE_LABELS[beforeRow.scenario.profileKey] + ': ускорен TTK против одиночной цели');
          }
        }
        if (category === 'zombie-health') {
          if (afterRow.metrics.singleZombieTtk !== beforeRow.metrics.singleZombieTtk) {
            reasons.push(beforeRow.scenario.bandId + ' ' + Shared.PROFILE_LABELS[beforeRow.scenario.profileKey] + ': TTK перестроен через явный HP зомби');
          }
        }
        if (category === 'zombie-pressure') {
          if (afterRow.metrics.fenceSurvivalSec > beforeRow.metrics.fenceSurvivalSec || afterRow.metrics.fenceDamagePerAttackWindow < beforeRow.metrics.fenceDamagePerAttackWindow) {
            reasons.push(beforeRow.scenario.bandId + ' ' + Shared.PROFILE_LABELS[beforeRow.scenario.profileKey] + ': уменьшено давление зомби на ограду');
          }
        }
        if (category === 'fence-survival' && afterRow.metrics.fenceSurvivalSec > beforeRow.metrics.fenceSurvivalSec) {
          reasons.push(beforeRow.scenario.bandId + ' ' + Shared.PROFILE_LABELS[beforeRow.scenario.profileKey] + ': увеличено окно выживания ограды');
        }
        if (category === 'economy' && afterRow.metrics.progressionPressure < beforeRow.metrics.progressionPressure) {
          reasons.push(beforeRow.scenario.bandId + ' ' + Shared.PROFILE_LABELS[beforeRow.scenario.profileKey] + ': снижено давление прогрессии');
        }
      });
      if (!reasons.length) reasons.push('Подобран как локально улучшающий общий score по целям.');
      return {
        id: change.id,
        label: change.label,
        reasons: reasons.slice(0, 3),
      };
    });
  }

  function inferRiskSummary(beforeSummary, afterSummary, changedTunables) {
    var delta = beforeSummary.score - afterSummary.score;
    if (delta > 6 && changedTunables.length <= 4) return 'low';
    if (delta > 2 && changedTunables.length <= 8) return 'medium';
    return 'high';
  }

  function cloneTunableState(tunableState) {
    var nextState = {};
    Object.keys(tunableState || {}).forEach(function (id) {
      nextState[id] = Object.assign({}, tunableState[id], {
        bands: Array.isArray(tunableState[id] && tunableState[id].bands) ? tunableState[id].bands.slice() : [],
      });
    });
    return nextState;
  }

  function enforceStrictlyIncreasingSeries(edit, readValue, writeValue, maxLevel) {
    var previousValue = null;
    var level;
    var currentValue;
    var nextValue;

    for (level = 1; level <= maxLevel; level++) {
      currentValue = readValue(edit, level);
      if (!Number.isFinite(currentValue)) continue;
      if (previousValue == null) {
        previousValue = currentValue;
        continue;
      }
      nextValue = currentValue > previousValue ? currentValue : previousValue + 1;
      if (nextValue !== currentValue) {
        writeValue(edit, level, nextValue);
      }
      previousValue = nextValue;
    }
  }

  function normalizeAutoBandCurves(edit, tunableState, focusedTunableIds) {
    var focusIds = Array.isArray(focusedTunableIds) && focusedTunableIds.length ? focusedTunableIds : [];

    function shouldNormalize(id) {
      var config = tunableState && tunableState[id];
      if (!config || !config.enabled) return false;
      return !focusIds.length || focusIds.indexOf(id) !== -1;
    }

    if (shouldNormalize('series.tank.baseDamage')) {
      enforceStrictlyIncreasingSeries(
        edit,
        function (nextEdit, level) {
          return Shared.getNestedValue(nextEdit.tanks, 'tank_lvl' + level + '.stats.baseDamage');
        },
        function (nextEdit, level, value) {
          Shared.setNestedValue(nextEdit.tanks, 'tank_lvl' + level + '.stats.baseDamage', Math.max(1, Math.round(value)));
        },
        60
      );
    }

    if (shouldNormalize('series.zombie.health')) {
      enforceStrictlyIncreasingSeries(
        edit,
        function (nextEdit, level) {
          var explicitHealth = Shared.getNestedValue(nextEdit.zombies, 'types[' + (level - 1) + '].Health');
          if (Number.isFinite(explicitHealth) && explicitHealth > 0) return explicitHealth;
          var legacyHealth = Shared.getNestedValue(nextEdit.zombies, 'types[' + (level - 1) + '].health');
          return Number.isFinite(legacyHealth) && legacyHealth > 0 ? legacyHealth : null;
        },
        function (nextEdit, level, value) {
          var explicitPath = 'types[' + (level - 1) + '].Health';
          var legacyPath = 'types[' + (level - 1) + '].health';
          var roundedValue = Math.max(1, Math.round(value));
          var explicitHealth = Shared.getNestedValue(nextEdit.zombies, explicitPath);
          var legacyHealth = Shared.getNestedValue(nextEdit.zombies, legacyPath);
          if (Number.isFinite(explicitHealth) && explicitHealth > 0) {
            Shared.setNestedValue(nextEdit.zombies, explicitPath, roundedValue);
            return;
          }
          if (Number.isFinite(legacyHealth) && legacyHealth > 0) {
            Shared.setNestedValue(nextEdit.zombies, legacyPath, roundedValue);
            return;
          }
          Shared.setNestedValue(nextEdit.zombies, explicitPath, roundedValue);
        },
        60
      );
    }
  }

  function buildBandScopedTunableState(tunableState, bandId, focusedTunableIds) {
    var nextState = cloneTunableState(tunableState);
    var focusIds = Array.isArray(focusedTunableIds) && focusedTunableIds.length ? focusedTunableIds : Object.keys(nextState);

    focusIds.forEach(function (id) {
      var config = nextState[id];
      if (!config || !config.enabled) return;
      if (Array.isArray(config.bands) && config.bands.length && config.bands.indexOf(bandId) === -1) {
        config.enabled = false;
        return;
      }
      config.bands = [bandId];
    });
    return nextState;
  }

  function getBandPriorityOrder(rows) {
    var scoreByBand = {};
    rows.forEach(function (row) {
      scoreByBand[row.scenario.bandId] = (scoreByBand[row.scenario.bandId] || 0) + Shared.safeNumber(row.evaluation && row.evaluation.score, 0);
    });
    return Object.keys(scoreByBand).sort(function (left, right) {
      return scoreByBand[right] - scoreByBand[left];
    });
  }

  function getBandScenarioIds(profiles, bandId, selectedScenarioIds) {
    return Shared.getScenarioList(profiles).filter(function (scenario) {
      return scenario.bandId === bandId && (!selectedScenarioIds || selectedScenarioIds.indexOf(scenario.id) !== -1);
    }).map(function (scenario) {
      return scenario.id;
    });
  }

  function collectRuntimePendingValues(originalRuntimeGame, currentRuntimeGame) {
    var pending = {};
    Object.keys(currentRuntimeGame || {}).forEach(function (key) {
      if (currentRuntimeGame[key] === originalRuntimeGame[key]) return;
      pending['runtime.' + key] = currentRuntimeGame[key];
    });
    return pending;
  }

  function optimize(options) {
    var registry = options.registry || Registry.createRegistry();
    var tunableState = options.tunableState || {};
    var context = Object.assign({ edit: options.data, runtimeGame: {}, runtimeLocked: {} }, options.context || {});
    var runtimeGame = Object.assign({}, context.runtimeGame || {});
    var baselineAssignments = getBaselineAssignments(registry, tunableState, context);
    var selectedScenarioIds = options.selectedScenarioIds || null;
    var bestAssignments = Object.assign({}, baselineAssignments);
    var bestResult = evaluateAssignments(options.data, runtimeGame, registry, tunableState, options.profiles, options.goals, selectedScenarioIds, bestAssignments);
    var pass;
    var improved;

    for (pass = 0; pass < 3; pass++) {
      improved = false;
      registry.forEach(function (item) {
        var tunableConfig = tunableState[item.id];
        var currentValue;
        var candidateValues;
        if (!tunableConfig || !tunableConfig.enabled || item.locked) return;
        currentValue = bestAssignments[item.id];
        candidateValues = buildCandidateValues(item, tunableConfig, currentValue, bestResult.rows, options.goals, bestResult.edit);
        candidateValues.forEach(function (candidateValue) {
          var trialAssignments = Object.assign({}, bestAssignments);
          var trialResult;
          if (candidateValue === currentValue) return;
          trialAssignments[item.id] = candidateValue;
          trialResult = evaluateAssignments(options.data, runtimeGame, registry, tunableState, options.profiles, options.goals, selectedScenarioIds, trialAssignments);
          if (trialResult.summary.score + 0.000001 < bestResult.summary.score) {
            bestAssignments = trialAssignments;
            bestResult = trialResult;
            improved = true;
          }
        });
      });
      if (!improved) break;
    }

    var baselineResult = evaluateAssignments(options.data, runtimeGame, registry, tunableState, options.profiles, options.goals, selectedScenarioIds, baselineAssignments);
    var changedTunables = collectChangedTunables(registry, tunableState, baselineAssignments, bestAssignments);
    return {
      scoreBefore: baselineResult.summary.score,
      scoreAfter: bestResult.summary.score,
      coverageBefore: baselineResult.summary.coverage,
      coverageAfter: bestResult.summary.coverage,
      summaryBefore: baselineResult.summary,
      summaryAfter: bestResult.summary,
      beforeRows: baselineResult.rows,
      afterRows: bestResult.rows,
      changedTunables: changedTunables,
      explanations: buildExplanations(changedTunables, baselineResult.rows, bestResult.rows),
      risk: inferRiskSummary(baselineResult.summary, bestResult.summary, changedTunables),
      edit: bestResult.edit,
      runtimeGame: bestResult.runtimeGame,
      runtimePending: bestResult.runtimePending,
      assignments: bestAssignments,
      iterations: pass,
    };
  }

  function optimizeByBands(options) {
    var registry = options.registry || Registry.createRegistry();
    var tunableState = options.tunableState || {};
    var context = Object.assign({ edit: options.data, runtimeGame: {}, runtimeLocked: {} }, options.context || {});
    var runtimeGame = Object.assign({}, context.runtimeGame || {});
    var selectedScenarioIds = options.selectedScenarioIds || null;
    var focusedTunableIds = Array.isArray(options.focusTunableIds) && options.focusTunableIds.length
      ? options.focusTunableIds.slice()
      : Registry.getEnabledItems(registry, tunableState).map(function (item) { return item.id; });
    var baselineAssignments = getBaselineAssignments(registry, tunableState, context);
    var baselineResult = evaluateAssignments(options.data, runtimeGame, registry, tunableState, options.profiles, options.goals, selectedScenarioIds, baselineAssignments);
    var currentData = Shared.deepClone(options.data);
    var currentRuntimeGame = Object.assign({}, runtimeGame);
    var changedTunables = [];
    var bandPasses = [];
    var totalIterations = 0;

    getBandPriorityOrder(baselineResult.rows).forEach(function (bandId) {
      var scopedTunableState = buildBandScopedTunableState(tunableState, bandId, focusedTunableIds);
      var bandScenarioIds = getBandScenarioIds(options.profiles, bandId, selectedScenarioIds);
      var bandResult;

      if (!bandScenarioIds.length || !Registry.getEnabledItems(registry, scopedTunableState).length) return;

      bandResult = optimize({
        data: currentData,
        profiles: options.profiles,
        goals: options.goals,
        registry: registry,
        tunableState: scopedTunableState,
        context: {
          edit: currentData,
          runtimeGame: currentRuntimeGame,
          runtimeLocked: context.runtimeLocked,
        },
        selectedScenarioIds: bandScenarioIds,
      });

      if (!(bandResult.scoreAfter + 0.000001 < bandResult.scoreBefore) || !bandResult.changedTunables.length) return;

      currentData = bandResult.edit;
      currentRuntimeGame = Object.assign({}, bandResult.runtimeGame);
      totalIterations += bandResult.iterations;
      Array.prototype.push.apply(changedTunables, bandResult.changedTunables);
      bandPasses.push({
        bandId: bandId,
        label: (Shared.getBandById(bandId) || {}).label || bandId,
        scoreBefore: bandResult.scoreBefore,
        scoreAfter: bandResult.scoreAfter,
        changedTunables: bandResult.changedTunables,
      });
    });

    normalizeAutoBandCurves(currentData, tunableState, focusedTunableIds);

    var finalContext = {
      edit: currentData,
      runtimeGame: currentRuntimeGame,
      runtimeLocked: context.runtimeLocked,
    };
    var finalAssignments = getBaselineAssignments(registry, tunableState, finalContext);
    var finalResult = evaluateAssignments(currentData, currentRuntimeGame, registry, tunableState, options.profiles, options.goals, selectedScenarioIds, finalAssignments);

    return {
      scoreBefore: baselineResult.summary.score,
      scoreAfter: finalResult.summary.score,
      coverageBefore: baselineResult.summary.coverage,
      coverageAfter: finalResult.summary.coverage,
      summaryBefore: baselineResult.summary,
      summaryAfter: finalResult.summary,
      beforeRows: baselineResult.rows,
      afterRows: finalResult.rows,
      changedTunables: changedTunables,
      explanations: buildExplanations(changedTunables, baselineResult.rows, finalResult.rows),
      risk: inferRiskSummary(baselineResult.summary, finalResult.summary, changedTunables),
      edit: currentData,
      runtimeGame: currentRuntimeGame,
      runtimePending: collectRuntimePendingValues(runtimeGame, currentRuntimeGame),
      assignments: finalAssignments,
      iterations: totalIterations,
      bandPasses: bandPasses,
    };
  }

  return {
    optimize: optimize,
    optimizeByBands: optimizeByBands,
  };
}));