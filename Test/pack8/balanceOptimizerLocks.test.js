/**
 * Pack 8 — Balance Lab optimizer lock and write-safety checks.
 * Run: node Test/pack8/balanceOptimizerLocks.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function assertApprox(actual, expected, epsilon, message) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error((message || 'assertApprox') + ': expected ' + expected + ' ± ' + epsilon + ', got ' + actual);
  }
}

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  ✓ ' + name);
  } catch (error) {
    failCount++;
    failures.push({ name: name, error: error.message });
    console.log('  ✗ ' + name + ' — ' + error.message);
  }
}

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');

const Shared = require(path.join(root, 'tools', 'balance-shared.js'));
const Registry = require(path.join(root, 'tools', 'balance-registry.js'));
const Optimizer = require(path.join(root, 'tools', 'balance-optimizer.js'));

function loadJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, 'assets', relPath), 'utf8'));
}

function buildData() {
  return {
    tanks: loadJSON('tanks.json'),
    zombies: loadJSON('zombies.json'),
    fence: loadJSON('fence.json'),
    dron: loadJSON('dron.json'),
    bullet: loadJSON('bullet.json'),
    balance: loadJSON('balance.json'),
    cannon: loadJSON('balance/cannonUpgrades.json'),
    talents: loadJSON('balance/talentTree_v2.json'),
    chips: loadJSON('chips.json'),
    runtimeConstants: Shared.DEFAULT_RUNTIME_CONSTANTS,
  };
}

function setExactGoal(goals, scenario, metrics) {
  const goal = goals[scenario.bandId][scenario.profileKey];
  goal.zombieTtkMin = metrics.singleZombieTtk;
  goal.zombieTtkMax = metrics.singleZombieTtk;
  goal.packTtkMin = metrics.packTtk;
  goal.packTtkMax = metrics.packTtk;
  goal.fenceDamageMin = metrics.fenceDamagePerAttackWindow;
  goal.fenceDamageMax = metrics.fenceDamagePerAttackWindow;
  goal.fenceSurvivalMinSec = metrics.fenceSurvivalSec;
  goal.fenceSurvivalMaxSec = metrics.fenceSurvivalSec;
  goal.progressionPressureMin = metrics.progressionPressure;
  goal.progressionPressureMax = metrics.progressionPressure;
  goal.decadeJumpScore = 0;
}

const sources = {
  'game.js': fs.readFileSync(path.join(root, 'game.js'), 'utf8'),
  'src/config/worldEvents.js': fs.readFileSync(path.join(root, 'src', 'config', 'worldEvents.js'), 'utf8'),
  'src/systems/worldEventsRuntime.js': fs.readFileSync(path.join(root, 'src', 'systems', 'worldEventsRuntime.js'), 'utf8'),
};

console.log('\n── Pack 8: Balance Lab optimizer locks ──');

test('BOL-1: registry exposes required locked world-events surfaces', () => {
  const registry = Registry.createRegistry();
  ['runtime.dmgMultPerLevel', 'runtime.fireRateBase', 'runtime.fireRateAddPerLevel', 'runtime.zombieHpBase', 'runtime.zombieHpExtraPerLevel', 'locked.worldEvents.idleWave.betweenWavesSec', 'locked.worldEvents.waveAttackMul', 'locked.worldEvents.waveHpMul'].forEach((id) => {
    const item = Registry.getItemById(registry, id);
    assert(item, 'registry contains ' + id);
    assert(item.locked, id + ' is flagged as locked');
  });
});

test('BOL-2: optimizer ignores forced locked tunables even if they are marked enabled', () => {
  const data = buildData();
  const registry = Registry.createRegistry();
  const runtimeContext = Registry.createRuntimeContext(sources);
  const tunableState = Registry.createTunableState(registry, { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked });
  tunableState['locked.worldEvents.idleWave.betweenWavesSec'].enabled = true;
  tunableState['locked.worldEvents.waveAttackMul'].enabled = true;
  const profiles = Shared.createDefaultProfiles(data);
  const goals = Shared.createDefaultGoals(data, profiles);
  const result = Optimizer.optimize({
    data: data,
    profiles: profiles,
    goals: goals,
    registry: registry,
    tunableState: tunableState,
    context: { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked },
  });
  assertEqual(result.changedTunables.length, 0, 'locked-only selection produces no tunable changes');
  assertEqual(Object.keys(result.runtimePending).length, 0, 'locked-only selection produces no runtime writes');
});

test('BOL-3: unchecked tunables remain unchanged when only zombie hpMul is eligible for optimization', () => {
  const data = buildData();
  const registry = Registry.createRegistry();
  const runtimeContext = Registry.createRuntimeContext(sources);
  const tunableState = Registry.createTunableState(registry, { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked });
  tunableState['series.zombie.hpMul'].enabled = true;
  tunableState['series.zombie.hpMul'].min = 0.7;
  tunableState['series.zombie.hpMul'].max = 0.9;
  const profiles = Shared.createDefaultProfiles(data);
  const goals = Shared.createDefaultGoals(data, profiles);
  goals['band-1-10'].base.zombieTtkMin *= 0.5;
  goals['band-1-10'].base.zombieTtkMax *= 0.5;
  const result = Optimizer.optimize({
    data: data,
    profiles: profiles,
    goals: goals,
    registry: registry,
    tunableState: tunableState,
    context: { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked },
  });
  assert(result.changedTunables.every((change) => change.id === 'series.zombie.hpMul'), 'only the selected zombie hpMul surface may change');
  assertEqual(result.edit.balance.tank.attackDamageMul, data.balance.tank.attackDamageMul, 'unchecked tank global mul stayed untouched');
  assertEqual(Object.keys(result.runtimePending).length, 0, 'no JS runtime writes for JSON-only tuning');
});

test('BOL-4: locked runtime BAL constants are excluded from game.js source patching', () => {
  const registry = Registry.createRegistry();
  const runtimeContext = Registry.createRuntimeContext(sources);
  const updatedSources = Registry.applyRuntimeValuesToSources(sources, registry, runtimeContext, {
    'runtime.fireRateBase': runtimeContext.runtimeGame.fireRateBase + 0.1,
  });
  assertEqual(updatedSources['game.js'], sources['game.js'], 'game.js remains unchanged when runtime surface is locked');
  assertEqual(updatedSources['src/config/worldEvents.js'], sources['src/config/worldEvents.js'], 'worldEvents config source remains untouched');
  assertEqual(updatedSources['src/systems/worldEventsRuntime.js'], sources['src/systems/worldEventsRuntime.js'], 'worldEvents runtime source remains untouched');
});

test('BOL-5: absolute tunables read the live working-copy value instead of stale tunable snapshot', () => {
  const data = buildData();
  const registry = Registry.createRegistry();
  const runtimeContext = Registry.createRuntimeContext(sources);
  const tunableState = Registry.createTunableState(registry, { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked });
  data.balance.tank.attackDamageMul = 1.6;
  tunableState['balance.tank.attackDamageMul'].enabled = true;
  tunableState['balance.tank.attackDamageMul'].min = 1.6;
  tunableState['balance.tank.attackDamageMul'].max = 1.6;
  tunableState['balance.tank.attackDamageMul'].step = 0.01;
  const profiles = Shared.createDefaultProfiles(data);
  const goals = Shared.createDefaultGoals(data, profiles);
  const scenario = profiles['band-1-10'].base;
  const metrics = Shared.computeScenarioMetrics(data, scenario);
  setExactGoal(goals, scenario, metrics);
  const result = Optimizer.optimize({
    data: data,
    profiles: profiles,
    goals: goals,
    registry: registry,
    tunableState: tunableState,
    context: { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked },
    selectedScenarioIds: [scenario.id],
  });
  assertEqual(result.changedTunables.length, 0, 'live absolute value does not produce a phantom optimizer change');
  const runtimeMetrics = Shared.computeScenarioMetrics(Shared.buildRuntimeData(data, runtimeContext.runtimeGame), scenario);
  assertApprox(result.beforeRows[0].metrics.singleZombieTtk, runtimeMetrics.singleZombieTtk, 0.000001, 'baseline row uses the live working-copy damage value');
  assertApprox(result.beforeRows[0].metrics.packTtk, runtimeMetrics.packTtk, 0.000001, 'baseline pack ttk stays aligned with the live working-copy value');
});

test('BOL-6: optimizer respects user-edited direction bias when choosing extreme candidates', () => {
  const data = buildData();
  const registry = Registry.createRegistry();
  const runtimeContext = Registry.createRuntimeContext(sources);
  const profiles = Shared.createDefaultProfiles(data);
  const goals = Shared.createDefaultGoals(data, profiles);
  const goal = goals['band-1-10'].base;
  goal.zombieTtkMin *= 2.2;
  goal.zombieTtkMax *= 2.8;
  goal.packTtkMin *= 2.2;
  goal.packTtkMax *= 2.8;
  const scenario = profiles['band-1-10'].base;
  function runWithBias(directionBias) {
    const tunableState = Registry.createTunableState(registry, { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked });
    tunableState['balance.tank.attackDamageMul'].enabled = true;
    tunableState['balance.tank.attackDamageMul'].min = 0.5;
    tunableState['balance.tank.attackDamageMul'].max = data.balance.tank.attackDamageMul;
    tunableState['balance.tank.attackDamageMul'].step = 0.01;
    tunableState['balance.tank.attackDamageMul'].directionBias = directionBias;
    return Optimizer.optimize({
      data: data,
      profiles: profiles,
      goals: goals,
      registry: registry,
      tunableState: tunableState,
      context: { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked },
      selectedScenarioIds: [scenario.id],
    });
  }
  const upResult = runWithBias('up');
  const downResult = runWithBias('down');
  assert(downResult.changedTunables.some((change) => change.id === 'balance.tank.attackDamageMul'), 'down-biased search must still change the selected absolute tunable');
  assert(downResult.assignments['balance.tank.attackDamageMul'] <= upResult.assignments['balance.tank.attackDamageMul'], 'down bias should not end up with a more aggressive damage multiplier than up bias');
  assert(downResult.assignments['balance.tank.attackDamageMul'] < data.balance.tank.attackDamageMul, 'down bias should move the damage multiplier below the current value when longer TTK is requested');
});

test('BOL-7: optimizer explanations stay specific for Russian registry groups', () => {
  const data = buildData();
  const registry = Registry.createRegistry();
  const runtimeContext = Registry.createRuntimeContext(sources);
  const tunableState = Registry.createTunableState(registry, { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked });
  tunableState['balance.tank.attackDamageMul'].enabled = true;
  tunableState['balance.tank.attackDamageMul'].min = 0.5;
  tunableState['balance.tank.attackDamageMul'].max = data.balance.tank.attackDamageMul;
  tunableState['balance.tank.attackDamageMul'].step = 0.01;
  tunableState['balance.tank.attackDamageMul'].directionBias = 'down';
  const profiles = Shared.createDefaultProfiles(data);
  const goals = Shared.createDefaultGoals(data, profiles);
  const goal = goals['band-1-10'].base;
  goal.zombieTtkMin *= 2.2;
  goal.zombieTtkMax *= 2.8;
  goal.packTtkMin *= 2.2;
  goal.packTtkMax *= 2.8;
  const scenario = profiles['band-1-10'].base;
  const result = Optimizer.optimize({
    data: data,
    profiles: profiles,
    goals: goals,
    registry: registry,
    tunableState: tunableState,
    context: { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked },
    selectedScenarioIds: [scenario.id],
  });
  const explanation = result.explanations.find((item) => item.id === 'balance.tank.attackDamageMul');
  assert(explanation, 'explanation exists for the changed tank damage multiplier');
  assert(explanation.reasons.some((reason) => /[А-Яа-яЁё]/.test(reason)), 'explanation stays localized instead of falling back to non-Russian text');
});

test('BOL-9: goal tuning presets reshape default goals before expert-table overrides', () => {
  const data = buildData();
  const profiles = Shared.createDefaultProfiles(data);
  const baselineGoals = Shared.createDefaultGoals(data, profiles, Shared.createDefaultGoalTuning());
  const longTtkGoals = Shared.createDefaultGoals(data, profiles, Shared.getGoalTuningPreset('longTtk'));
  const zombieThreatGoals = Shared.createDefaultGoals(data, profiles, Shared.getGoalTuningPreset('zombieThreat'));
  const baseline = baselineGoals['band-21-30'].average;
  const longTtk = longTtkGoals['band-21-30'].average;
  const zombieThreat = zombieThreatGoals['band-21-30'].average;
  assert(longTtk.zombieTtkMin > baseline.zombieTtkMin, 'longTtk preset raises zombie TTK targets');
  assert(longTtk.packTtkMin > baseline.packTtkMin, 'longTtk preset raises pack TTK targets');
  assert(zombieThreat.fenceDamageMin > baseline.fenceDamageMin, 'zombie threat preset raises target fence pressure');
  assert(zombieThreat.fenceSurvivalMaxSec < baseline.fenceSurvivalMaxSec, 'zombie threat preset lowers target fence survival window');
});

test('BOL-10: optimizer can repair catastrophic top-band tank damage collapse with the band-wide series surface', () => {
  const data = buildData();
  const registry = Registry.createRegistry();
  const runtimeContext = Registry.createRuntimeContext(sources);
  const tunableState = Registry.createTunableState(registry, { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked });
  for (let level = 51; level <= 60; level++) {
    data.tanks['tank_lvl' + level].stats.baseDamage = Math.max(1, Math.round(data.tanks['tank_lvl' + level].stats.baseDamage * 0.01));
  }
  tunableState['series.tank.baseDamage'].enabled = true;
  tunableState['series.tank.baseDamage'].bands = ['band-51-60'];
  const profiles = Shared.createDefaultProfiles(data);
  const goals = Shared.createDefaultGoals(data, profiles);
  const manual = profiles['band-51-60'].manual;
  const result = Optimizer.optimize({
    data: data,
    profiles: profiles,
    goals: goals,
    registry: registry,
    tunableState: tunableState,
    context: { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked },
    selectedScenarioIds: [manual.id],
  });
  const change = result.changedTunables.find((item) => item.id === 'series.tank.baseDamage');
  assert(result.scoreAfter < result.scoreBefore, 'optimizer should find a better score for the collapsed top-band scenario');
  assert(change, 'optimizer should choose the tank base damage series when the whole band is broken');
  assert(change.to > change.from, 'optimizer should push the tank damage curve upward for the collapsed band');
  assert(result.edit.tanks.tank_lvl60.stats.baseDamage > data.tanks.tank_lvl60.stats.baseDamage, 'series surface should raise level-60 baseDamage after collapse');
});

test('BOL-11: optimizer can repair catastrophic manual top-band zombie explicit Health outlier', () => {
  const data = buildData();
  const registry = Registry.createRegistry();
  const runtimeContext = Registry.createRuntimeContext(sources);
  const tunableState = Registry.createTunableState(registry, { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked });
  data.zombies.types[59].Health = 2627515200359;
  tunableState['series.zombie.health'].enabled = true;
  tunableState['series.zombie.health'].bands = ['band-51-60'];
  const profiles = Shared.createDefaultProfiles(data);
  const goals = Shared.createDefaultGoals(data, profiles);
  const manual = profiles['band-51-60'].manual;
  const result = Optimizer.optimize({
    data: data,
    profiles: profiles,
    goals: goals,
    registry: registry,
    tunableState: tunableState,
    context: { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked },
    selectedScenarioIds: [manual.id],
  });
  const change = result.changedTunables.find((item) => item.id === 'series.zombie.health');
  assert(result.scoreAfter < result.scoreBefore, 'optimizer should find a better score for the broken level-60 zombie health scenario');
  assert(change, 'optimizer should choose the explicit zombie Health series when it is the enabled repair surface');
  assert(change.to < change.from, 'optimizer should push the zombie health curve downward for the catastrophic outlier');
  assert(result.edit.zombies.types[59].Health < data.zombies.types[59].Health, 'result edit should lower explicit Health in assets/zombies.json');
});

test('BOL-12: anchor tank surface can normalize a catastrophic level-60 damage spike without scaling the whole band', () => {
  const data = buildData();
  const registry = Registry.createRegistry();
  const runtimeContext = Registry.createRuntimeContext(sources);
  const tunableState = Registry.createTunableState(registry, { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked });
  data.tanks.tank_lvl60.stats.baseDamage = 61000000000;
  tunableState['series.tank.baseDamage.anchor'].enabled = true;
  tunableState['series.tank.baseDamage.anchor'].bands = ['band-51-60'];
  const profiles = Shared.createDefaultProfiles(data);
  const goals = Shared.createDefaultGoals(data, profiles);
  const manual = profiles['band-51-60'].manual;
  const result = Optimizer.optimize({
    data: data,
    profiles: profiles,
    goals: goals,
    registry: registry,
    tunableState: tunableState,
    context: { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked },
    selectedScenarioIds: [manual.id],
  });
  const change = result.changedTunables.find((item) => item.id === 'series.tank.baseDamage.anchor');
  assert(change, 'optimizer should use the anchor tank surface for the manual top-band outlier');
  assert(result.scoreAfter < result.scoreBefore, 'anchor tank surface should improve the broken level-60 scenario');
  assert(result.edit.tanks.tank_lvl60.stats.baseDamage < 10000, 'anchor surface should bring level-60 tank damage back to a sane numeric range');
  assertEqual(result.edit.tanks.tank_lvl59.stats.baseDamage, data.tanks.tank_lvl59.stats.baseDamage, 'anchor surface must not rescale neighboring levels in the band');
});

test('BOL-13: anchor zombie Health surface can normalize a catastrophic level-60 spike without touching neighboring levels', () => {
  const data = buildData();
  const registry = Registry.createRegistry();
  const runtimeContext = Registry.createRuntimeContext(sources);
  const tunableState = Registry.createTunableState(registry, { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked });
  data.zombies.types[59].Health = 2627515200359;
  tunableState['series.zombie.health.anchor'].enabled = true;
  tunableState['series.zombie.health.anchor'].bands = ['band-51-60'];
  const profiles = Shared.createDefaultProfiles(data);
  const goals = Shared.createDefaultGoals(data, profiles);
  const manual = profiles['band-51-60'].manual;
  const result = Optimizer.optimize({
    data: data,
    profiles: profiles,
    goals: goals,
    registry: registry,
    tunableState: tunableState,
    context: { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked },
    selectedScenarioIds: [manual.id],
  });
  const change = result.changedTunables.find((item) => item.id === 'series.zombie.health.anchor');
  assert(change, 'optimizer should use the anchor zombie-health surface for the manual top-band outlier');
  assert(result.scoreAfter < result.scoreBefore, 'anchor zombie-health surface should improve the broken level-60 scenario');
  assert(result.edit.zombies.types[59].Health < 10000000, 'anchor surface should bring level-60 explicit Health back to a sane numeric range');
  assertEqual(result.edit.zombies.types[58].Health, data.zombies.types[58].Health, 'anchor surface must not rescale neighboring zombie levels in the band');
});

test('BOL-14: low-band anchor surfaces keep tank and zombie seams monotonic', () => {
  const data = buildData();
  const registry = Registry.createRegistry();
  const tankAnchor = Registry.getItemById(registry, 'series.tank.baseDamage.anchor');
  const zombieAnchor = Registry.getItemById(registry, 'series.zombie.health.anchor');
  const ctx = { edit: data };

  Registry.applyTunable(ctx, tankAnchor, 0.1, { bands: ['band-1-10'] });
  Registry.applyTunable(ctx, zombieAnchor, 0.1, { bands: ['band-1-10'] });

  assert(data.tanks.tank_lvl10.stats.baseDamage >= data.tanks.tank_lvl9.stats.baseDamage, 'tank level-10 anchor must not fall below level 9');
  assert(data.zombies.types[9].Health >= data.zombies.types[8].Health, 'zombie level-10 anchor must not fall below level 9');
});

test('BOL-15: banded optimizer covers multiple ranges and still improves extreme TTK goals', () => {
  const data = buildData();
  const registry = Registry.createRegistry();
  const runtimeContext = Registry.createRuntimeContext(sources);
  const tunableState = Registry.createTunableState(registry, { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked });
  ['series.tank.baseDamage', 'series.zombie.health', 'series.bullet.addDamage'].forEach((id) => {
    tunableState[id].enabled = true;
  });
  const profiles = Shared.createDefaultProfiles(data);
  const goals = Shared.createDefaultGoals(data, profiles, { desiredTtk: 0.1, zombiePressure: 50, progressionPressure: 50 });
  const singlePass = Optimizer.optimize({
    data: data,
    profiles: profiles,
    goals: goals,
    registry: registry,
    tunableState: tunableState,
    context: { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked },
  });
  const banded = Optimizer.optimizeByBands({
    data: data,
    profiles: profiles,
    goals: goals,
    registry: registry,
    tunableState: tunableState,
    context: { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked },
    focusTunableIds: ['series.tank.baseDamage', 'series.zombie.health', 'series.bullet.addDamage'],
  });
  const touchedBands = new Set();
  banded.changedTunables.forEach((change) => {
    (change.bands || []).forEach((bandId) => touchedBands.add(bandId));
  });
  for (let level = 2; level <= 60; level++) {
    assert(
      banded.edit.tanks['tank_lvl' + level].stats.baseDamage >= banded.edit.tanks['tank_lvl' + (level - 1)].stats.baseDamage,
      'banded auto-mode must keep tank baseDamage monotonic at level ' + level
    );
    assert(
      banded.edit.zombies.types[level - 1].Health >= banded.edit.zombies.types[level - 2].Health,
      'banded auto-mode must keep zombie Health monotonic at level ' + level
    );
  }

  assert(singlePass.scoreAfter < singlePass.scoreBefore, 'single-pass auto-mode should still improve the extreme-goal baseline');
  assert(banded.scoreAfter < banded.scoreBefore, 'banded auto-mode should still improve the extreme-goal score against the repaired baseline');
  assert(touchedBands.size > 1, 'banded auto-mode should touch more than one level range');
  assert((banded.bandPasses || []).length > 1, 'banded auto-mode should record more than one band pass');
});

test('BOL-16: base-only scenario selection avoids surrogate-profile conflicts for desired TTK auto-mode', () => {
  const data = buildData();
  const registry = Registry.createRegistry();
  const runtimeContext = Registry.createRuntimeContext(sources);
  const tunableState = Registry.createTunableState(registry, { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked });
  ['series.tank.baseDamage', 'series.zombie.health', 'series.bullet.addDamage'].forEach((id) => {
    tunableState[id].enabled = true;
  });
  const profiles = Shared.createDefaultProfiles(data);
  const goals = Shared.createDefaultGoals(data, profiles, { desiredTtk: 0.1, zombiePressure: 50, progressionPressure: 50 });
  const baseScenarioIds = Shared.getScenarioList(profiles)
    .filter((scenario) => scenario.profileKey === 'base')
    .map((scenario) => scenario.id);
  const mixedProfiles = Optimizer.optimizeByBands({
    data: data,
    profiles: profiles,
    goals: goals,
    registry: registry,
    tunableState: tunableState,
    context: { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked },
    focusTunableIds: ['series.tank.baseDamage', 'series.zombie.health', 'series.bullet.addDamage'],
  });
  const baseOnly = Optimizer.optimizeByBands({
    data: data,
    profiles: profiles,
    goals: goals,
    registry: registry,
    tunableState: tunableState,
    context: { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked },
    selectedScenarioIds: baseScenarioIds,
    focusTunableIds: ['series.tank.baseDamage', 'series.zombie.health', 'series.bullet.addDamage'],
  });

  assert(baseOnly.afterRows.every((row) => row.scenario.profileKey === 'base'), 'base-only path should evaluate only base rows');
  assert(baseOnly.scoreAfter < mixedProfiles.scoreAfter, 'base-only auto-mode should fit desired TTK better than mixed surrogate profiles');
});

test('BOL-8: balance-sim --json mode returns clean parseable JSON for matrix and optimizer', () => {
  const matrixResult = spawnSync('node', ['tools/balance-sim.js', '--matrix', '--json'], { cwd: root, encoding: 'utf8' });
  const optimizerResult = spawnSync('node', ['tools/balance-sim.js', '--optimize', '--tunables', 'balance.tank.attackDamageMul,series.zombie.hpMul', '--json'], { cwd: root, encoding: 'utf8' });
  let matrix;
  let optimizer;
  assertEqual(matrixResult.status, 0, 'matrix json command exits successfully');
  assertEqual(optimizerResult.status, 0, 'optimizer json command exits successfully');
  try {
    matrix = JSON.parse(matrixResult.stdout);
  } catch (error) {
    throw new Error('matrix json must parse without banner noise: ' + error.message);
  }
  try {
    optimizer = JSON.parse(optimizerResult.stdout);
  } catch (error) {
    throw new Error('optimizer json must parse without banner noise: ' + error.message);
  }
  assert(Array.isArray(matrix) && matrix.length > 0, 'matrix json returns a non-empty rows array');
  assert(typeof optimizer.scoreBefore === 'number' && typeof optimizer.scoreAfter === 'number', 'optimizer json returns numeric score fields');
});

console.log('\n═══════════════════════════');
console.log('BalanceOptimizerLocks: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);