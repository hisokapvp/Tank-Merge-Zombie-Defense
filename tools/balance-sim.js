#!/usr/bin/env node
/**
 * balance-sim.js — CLI Balance Simulator
 *
 * Headless simulates tank-vs-zombie combat using game config JSON files.
 * Outputs DPS, time-to-kill (TTK), difficulty curves, breakpoints.
 * Includes real zombie HP formula from game.js, talent modifiers, and chip effects.
 *
 * Usage:
 *   node tools/balance-sim.js                            # full report
 *   node tools/balance-sim.js --tank 10 --zombie 10      # single matchup
 *   node tools/balance-sim.js --duel 20                   # tank lvl N vs zombie lvl N
 *   node tools/balance-sim.js --breakpoint                # find level where zombies win
 *   node tools/balance-sim.js --curve                     # full difficulty curve
 *   node tools/balance-sim.js --wall-survival             # wall survival analysis
 *   node tools/balance-sim.js --talents OFF:3,2,1,0,...   # apply talent ranks
 *   node tools/balance-sim.js --chip 6                    # apply chip modifier
 *   node tools/balance-sim.js --json                      # output as JSON
 *   node tools/balance-sim.js --help
 *
 * No npm dependencies. Pure Node.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Shared = require('./balance-shared.js');
const Registry = require('./balance-registry.js');
const Optimizer = require('./balance-optimizer.js');

/* ======== Config Loading ======== */
const ROOT = path.resolve(__dirname, '..');
function loadJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', rel), 'utf8'));
}

let tanks, zombies, fence, dron, bullet, balance, cannon, talentTree, chips;
try {
  tanks = loadJSON('tanks.json');
  zombies = loadJSON('zombies.json');
  fence = loadJSON('fence.json');
  dron = loadJSON('dron.json');
  bullet = loadJSON('bullet.json');
  balance = loadJSON('balance.json');
  cannon = loadJSON('balance/cannonUpgrades.json');
  talentTree = loadJSON('balance/talentTree_v2.json');
  chips = loadJSON('chips.json');
} catch (e) {
  console.error('ERROR: Cannot load config files from assets/. Run from project root.');
  console.error(e.message);
  process.exit(1);
}

/* ======== BAL Constants (mirror game.js) ======== */
const BAL = Shared.DEFAULT_RUNTIME_CONSTANTS;

/* ======== Helpers ======== */
function round2(v) { return Math.round(v * 100) / 100; }
function round3(v) { return Math.round(v * 1000) / 1000; }
function round4(v) { return Math.round(v * 10000) / 10000; }

function buildDataBundle(runtimeOverride) {
  return {
    tanks: tanks,
    zombies: zombies,
    fence: fence,
    dron: dron,
    bullet: bullet,
    balance: balance,
    cannon: cannon,
    talents: talentTree,
    chips: chips,
    runtimeConstants: Object.assign({}, BAL, runtimeOverride || {}),
  };
}

function buildScenario(levels, simOpts) {
  var band = Shared.getBandForLevel(levels.zombieLevel || levels.tankLevel || 1);
  return Shared.ensureScenarioShape(buildDataBundle(), {
    bandId: band.id,
    profileKey: 'manual',
    tankLevel: levels.tankLevel || 1,
    zombieLevel: levels.zombieLevel || levels.tankLevel || 1,
    wallLevel: levels.wallLevel || 1,
    droneLevel: levels.droneLevel || 1,
    zombieCount: levels.zombieCount || 1,
    attackWindowSec: levels.attackWindowSec || 12,
    chipModId: simOpts && simOpts.chipModId ? simOpts.chipModId : null,
    talents: simOpts && simOpts.talentRanks ? simOpts.talentRanks : Shared.createEmptyTalentRanks(),
    modifiers: Shared.createIdentityModifiers(),
  }, band.id, 'manual');
}

/* ======== Talent System ======== */

/**
 * Parse a talent spec string like "OFF:3,2,1,0,0;DEF:1,1,0;ECO:2,0,0"
 * into { offense: [3,2,1,...], defense: [1,1,0,...], economy: [2,0,0,...] }
 */
function parseTalentSpec(spec) {
  const result = { offense: [], defense: [], economy: [] };
  if (!spec) return result;
  const parts = spec.split(';');
  for (const p of parts) {
    const [key, vals] = p.split(':');
    if (!key || !vals) continue;
    const ranks = vals.split(',').map(Number);
    const k = key.trim().toUpperCase();
    if (k === 'OFF' || k === 'OFFENSE' || k === '0') result.offense = ranks;
    else if (k === 'DEF' || k === 'DEFENSE' || k === '1') result.defense = ranks;
    else if (k === 'ECO' || k === 'ECONOMY' || k === '2') result.economy = ranks;
  }
  return result;
}

/**
 * Compute talent mods from talent tree config and allocated ranks.
 * Returns an object like { damageMul, fireRateMul, aoeMul, ... }
 */
function computeTalentMods(talentRanks) {
  return Shared.computeTalentMods(talentTree, talentRanks);
}

/* ======== Chip Effects Model ======== */

/**
 * Compute chip DPS modifier for a given modId.
 * Returns { dpsMultiplier, desc }
 *
 * Combo mods (6/25/26) — new behavior:
 *   Shots 1-3: 1 normal cascade projectile (x1.0 dmg).
 *   Shot 4: burst of N projectiles at comboDmgMul.
 *   Average DPS = (3*1 + 1*N*comboDmgMul) / 4.
 */
function computeChipEffect(modId) {
  return Shared.computeChipEffect(modId);
}

/* ======== Data Extraction ======== */

/**
 * Zombie HP multiplier — exact formula from game.js zombieHpMultiplier():
 *   dmgScale = dmgMultPerLevel^(lvl-1)
 *   extra = 1 + zombieHpExtraPerLevel * (lvl-1)
 *   return dmgScale * extra
 */
function zombieHpMultiplier(level) {
  return Shared.zombieHpMultiplier(level, BAL);
}

function getTankStats(level, opts) {
  opts = opts || {};
  if (!tanks['tank_lvl' + level]) return null;
  const scenario = buildScenario({ tankLevel: level, zombieLevel: level, wallLevel: opts.wallLevel || 1, droneLevel: opts.droneLevel || 1, zombieCount: opts.zombieCount || 1 }, opts);
  const stats = Shared.getTankStats(buildDataBundle(opts.runtimeConstants), scenario);
  return {
    level: stats.level,
    baseDamage: round2(stats.shotDamage),
    fireRate: round3(stats.shotsPerSec),
    fireRateSec: round3(1 / Math.max(0.0001, stats.shotsPerSec)),
    dpsBase: round2(stats.shotDamage * stats.shotsPerSec),
    dps: round2(stats.dps),
    aoe: round3(Shared.safeNumber(getNestedValueFromBullet(stats.bulletLevel, 'aoe'), 1)),
    bulletLevel: stats.bulletLevel,
    avgProjectiles: round3(stats.avgProjectiles),
    chipDpsMul: round3(stats.chipDpsMul),
    chipDesc: stats.chipDesc,
    talentDmgMul: round3(Shared.computeTalentMods(talentTree, scenario.talents).damageMul),
    talentFireRateMul: round3(Shared.computeTalentMods(talentTree, scenario.talents).fireRateMul),
  };
}

function getZombieStats(level) {
  if (!zombies.types[level - 1]) return null;
  return Shared.getZombieStats(buildDataBundle(), buildScenario({ tankLevel: level, zombieLevel: level, wallLevel: 1, zombieCount: 1 }, {}));
}

function getWallStats(level, opts) {
  opts = opts || {};
  if (!fence.levels[level - 1]) return null;
  const stats = Shared.getWallStats(buildDataBundle(), buildScenario({ tankLevel: 1, zombieLevel: opts.zombieLevel || 1, wallLevel: level, zombieCount: opts.zombieCount || 1 }, opts));
  return {
    level: stats.level,
    segmentMaxHp: round2(stats.segmentMaxHp),
    armorFlat: stats.armorFlat,
    upgradeCost: stats.upgradeCostDamagePoints,
    effectiveHp: round2(stats.segmentMaxHp * (1 + stats.armorFlat / 100))
  };
}

function getDronStats(level) {
  if (!dron.levels[String(level)]) return null;
  const stats = Shared.getDroneStats(buildDataBundle(), buildScenario({ tankLevel: 1, zombieLevel: 1, wallLevel: 1, droneLevel: level, zombieCount: 1 }, {}));
  return {
    level: stats.level,
    moveSpeedPxSec: stats.moveSpeedPxSec,
    repairSpeedMult: stats.repairSpeedMult,
    costMult: stats.costMult,
    effectiveRepairPerSec: round4((1 / dron.baseRepairSec) * stats.repairSpeedMult)
  };
}

function getNestedValueFromBullet(level, key) {
  const levels = bullet.bullets.bullet_base.levels || [];
  const cfg = levels[Math.max(0, level - 1)] || levels[0] || {};
  return cfg[key];
}

function reportScenarioMatrix() {
  const data = buildDataBundle();
  const profiles = Shared.createDefaultProfiles(data);
  const goals = Shared.createDefaultGoals(data, profiles);
  return Shared.evaluateMatrix(data, profiles, goals, {});
}

function reportOptimizer(opts) {
  const data = buildDataBundle();
  const profiles = Shared.createDefaultProfiles(data);
  const goals = Shared.createDefaultGoals(data, profiles);
  const runtimeContext = {
    runtimeGame: Object.assign({}, BAL),
    runtimeLocked: {},
  };
  const registry = Registry.createRegistry();
  const tunableState = Registry.createTunableState(registry, { edit: data, runtimeGame: runtimeContext.runtimeGame, runtimeLocked: runtimeContext.runtimeLocked });
  const selectedIds = opts.tunables
    ? opts.tunables.split(',').map(function (id) { return id.trim(); }).filter(Boolean)
    : ['balance.tank.attackDamageMul', 'balance.zombie.attackDamageMul', 'series.zombie.hpMul', 'series.fence.segmentMaxHp'];
  selectedIds.forEach(function (id) {
    if (tunableState[id]) tunableState[id].enabled = true;
  });
  return Optimizer.optimize({
    data: data,
    profiles: profiles,
    goals: goals,
    registry: registry,
    tunableState: tunableState,
    context: runtimeContext,
  });
}

/* ======== Simulation ======== */

function simulateDuel(tankLevel, zombieLevel, zombieCount, simOpts) {
  zombieCount = zombieCount || 1;
  simOpts = simOpts || {};
  const t = getTankStats(tankLevel, simOpts);
  const z = getZombieStats(zombieLevel);
  if (!t || !z) return null;

  const totalZombieHp = z.hp * zombieCount;
  const ttk = totalZombieHp / t.dps;

  return {
    tankLevel: tankLevel,
    zombieLevel: zombieLevel,
    zombieCount: zombieCount,
    tankDps: t.dps,
    tankDpsBase: t.dpsBase,
    zombieTotalHp: round2(totalZombieHp),
    ttk: round3(ttk),
    zombieDps: round2(z.dps * zombieCount),
    zombieGroupDpsPerTank: round2(z.dps * zombieCount)
  };
}

function simulateWallSurvival(wallLevel, zombieLevel, zombieCount, simOpts) {
  zombieCount = zombieCount || 10;
  simOpts = simOpts || {};
  const w = getWallStats(wallLevel, simOpts);
  const z = getZombieStats(zombieLevel);
  if (!w || !z) return null;

  const effectiveDamagePerHit = Math.max(1, z.attackDamage - w.armorFlat);
  const totalDps = (effectiveDamagePerHit / z.attackCooldownSec) * zombieCount;
  const survivalSec = w.segmentMaxHp / totalDps;

  return {
    wallLevel: wallLevel,
    zombieLevel: zombieLevel,
    zombieCount: zombieCount,
    wallHp: w.segmentMaxHp,
    wallArmor: w.armorFlat,
    effectiveDmgPerHit: Math.round(effectiveDamagePerHit),
    totalDps: round2(totalDps),
    survivalSec: round2(survivalSec)
  };
}

function findBreakpoint(tankLevel, wallLevel, zombieCount, simOpts) {
  zombieCount = zombieCount || (zombies.spawn ? zombies.spawn.perSideTarget : 60);
  simOpts = simOpts || {};
  const results = [];
  for (let zl = 1; zl <= 60; zl++) {
    const duel = simulateDuel(tankLevel, zl, zombieCount, simOpts);
    const wall = simulateWallSurvival(wallLevel || 1, zl, zombieCount, simOpts);
    if (!duel || !wall) continue;
    const ratio = duel.ttk / wall.survivalSec;
    results.push({
      zombieLevel: zl,
      ttk: duel.ttk,
      wallSurvival: wall.survivalSec,
      ratio: round3(ratio),
      status: ratio < 1 ? 'TANK_WINS' : 'ZOMBIES_WIN'
    });
  }
  return results;
}

/* ======== Reports ======== */

function reportSingleDuel(tl, zl, simOpts) {
  simOpts = simOpts || {};
  const t = getTankStats(tl, simOpts);
  const z = getZombieStats(zl);
  const duel = simulateDuel(tl, zl, 1, simOpts);
  if (!t || !z || !duel) {
    console.log('Invalid levels: tank=' + tl + ' zombie=' + zl);
    return null;
  }
  return { tank: t, zombie: z, duel: duel };
}

function reportDifficultyCurve(simOpts) {
  simOpts = simOpts || {};
  const curve = [];
  for (let lvl = 1; lvl <= 60; lvl++) {
    const t = getTankStats(lvl, simOpts);
    const z = getZombieStats(lvl);
    if (!t || !z) continue;
    const duel = simulateDuel(lvl, lvl, 1, simOpts);
    curve.push({
      level: lvl,
      tankDps: t.dps,
      zombieHp: z.hp,
      zombieDps: z.dps,
      ttk1v1: duel ? duel.ttk : null,
      dpsRatio: round2(t.dps / z.dps)
    });
  }
  return curve;
}

function reportWallSurvival(simOpts) {
  simOpts = simOpts || {};
  const results = [];
  const maxWall = fence.levels.length;
  for (let wl = 1; wl <= maxWall; wl += 5) {
    for (let zl = 1; zl <= 60; zl += 5) {
      const sim = simulateWallSurvival(wl, zl, 20, simOpts);
      if (sim) results.push(sim);
    }
  }
  return results;
}

function reportFullSummary(simOpts) {
  simOpts = simOpts || {};
  const t1 = getTankStats(1, simOpts);
  const t59 = getTankStats(59, simOpts);
  const summary = {
    config: {
      tankLevels: tanks.maxLevel,
      zombieTypes: zombies.types.length,
      wallLevels: fence.levels.length,
      dronLevels: Object.keys(dron.levels).length,
      bulletLevels: bullet.bullets.bullet_base.levels.length,
      cannonUpgradeLevels: cannon.length,
      talentsCount: talentTree.talents.length,
      chipsCount: chips.modifiers ? Object.keys(chips.modifiers).length : 0,
      spawnTargetAlive: zombies.spawn ? zombies.spawn.targetAlive : 'N/A'
    },
    balConstants: BAL,
    globalMultipliers: {
      tank: balance.tank,
      zombie: balance.zombie
    },
    progression: {
      tankDamageRange: [t1 ? t1.baseDamage : 'N/A', t59 ? t59.baseDamage : 'N/A'],
      zombieHpRange: [getZombieStats(1).hp, getZombieStats(60).hp],
      zombieDamageRange: [getZombieStats(1).attackDamage, getZombieStats(60).attackDamage],
      wallHpRange: [fence.levels[0].segmentMaxHp, fence.levels[fence.levels.length - 1].segmentMaxHp]
    },
    difficultyCurve: reportDifficultyCurve(simOpts),
    breakpoints: {
      tank10_wall5_vs60z: findBreakpoint(10, 5, 60, simOpts),
      tank30_wall20_vs60z: findBreakpoint(30, 20, 60, simOpts)
    }
  };
  return summary;
}

/* ======== Pretty Print ======== */

function printTable(headers, rows) {
  const widths = headers.map(function (h, i) {
    return Math.max(h.length, Math.max.apply(null, rows.map(function (r) {
      return String(r[i]).length;
    })));
  });
  const sep = widths.map(function (w) { return '-'.repeat(w + 2); }).join('+');
  const fmtRow = function (r) {
    return r.map(function (c, i) { return (' ' + String(c)).padEnd(widths[i] + 2); }).join('|');
  };
  console.log(fmtRow(headers));
  console.log(sep);
  rows.forEach(function (r) { console.log(fmtRow(r)); });
}

function printDifficultyCurve(curve) {
  console.log('\n== DIFFICULTY CURVE (Tank lvl N vs Zombie lvl N, 1v1) ==\n');
  printTable(
    ['Lvl', 'TankDPS', 'ZombieHP', 'ZombieDPS', 'TTK(s)', 'DPS Ratio'],
    curve.map(function (c) {
      return [c.level, c.tankDps, c.zombieHp, c.zombieDps, c.ttk1v1, c.dpsRatio];
    })
  );
}

function printBreakpoint(label, data) {
  console.log('\n== BREAKPOINT: ' + label + ' ==\n');
  const transition = data.find(function (d) { return d.status === 'ZOMBIES_WIN'; });
  if (transition) {
    console.log('Zombies start winning at zombie level ' + transition.zombieLevel);
    console.log('  TTK=' + transition.ttk + 's vs WallSurvival=' + transition.wallSurvival + 's (ratio=' + transition.ratio + ')');
  } else {
    console.log('Tank wins at all tested zombie levels.');
  }
  printTable(
    ['ZLvl', 'TTK(s)', 'WallSurv(s)', 'Ratio', 'Status'],
    data.filter(function (_, i) { return i % 3 === 0 || data[i].status !== data[Math.max(0, i - 1)].status; })
      .map(function (d) { return [d.zombieLevel, d.ttk, d.wallSurvival, d.ratio, d.status]; })
  );
}

function printSingleDuel(report) {
  const t = report.tank;
  const z = report.zombie;
  const d = report.duel;
  console.log('\n== DUEL: Tank Lvl ' + t.level + ' vs Zombie Lvl ' + z.level + ' ==\n');
  console.log('Tank:   baseDmg=' + t.baseDamage + '  DPS=' + t.dps + '  fireRate=' + t.fireRate + '/s  bulletLvl=' + t.bulletLevel + '  aoe=' + t.aoe);
  if (t.talentDmgMul > 1 || t.talentFireRateMul > 1) {
    console.log('        talentDmgMul=' + t.talentDmgMul + '  talentFireRateMul=' + t.talentFireRateMul + '  avgProjectiles=' + t.avgProjectiles);
  }
  if (t.chipDesc) {
    console.log('        chip: ' + t.chipDesc + ' (dpsMul=' + t.chipDpsMul + ')');
  }
  console.log('Zombie: HP=' + z.hp + '  levelHpMul=' + z.levelHpMul + '  atkDmg=' + z.attackDamage + '  DPS=' + z.dps + '  atkCooldown=' + z.attackCooldownSec + 's');
  console.log('Result: TTK=' + d.ttk + 's');
}

function printWallSurvival(results) {
  console.log('\n== WALL SURVIVAL (20 zombies attacking) ==\n');
  printTable(
    ['WallLvl', 'ZombieLvl', 'WallHP', 'Armor', 'EffDmg/hit', 'TotalDPS', 'Survival(s)'],
    results.map(function (r) {
      return [r.wallLevel, r.zombieLevel, r.wallHp, r.wallArmor, r.effectiveDmgPerHit, r.totalDps, r.survivalSec];
    })
  );
}

function printChipEffects() {
  console.log('\n== CHIP MODIFIER DPS MULTIPLIERS ==\n');
  const rows = [];
  for (let id = 1; id <= 30; id++) {
    const eff = computeChipEffect(id);
    rows.push([id, 'x' + eff.dpsMultiplier, eff.desc]);
  }
  printTable(['ModId', 'DPS Mul', 'Description'], rows);
}

function printZombieHpProgression() {
  console.log('\n== ZOMBIE HP PROGRESSION (real formula from game.js) ==\n');
  console.log('Formula: HP = zombieHpBase(' + BAL.zombieHpBase + ') * dmgMultPerLevel(' + BAL.dmgMultPerLevel + ')^(lvl-1)');
  console.log('              * (1 + zombieHpExtraPerLevel(' + BAL.zombieHpExtraPerLevel + ')*(lvl-1)) * hpMul\n');
  const rows = [];
  for (let lvl = 1; lvl <= 60; lvl++) {
    const z = getZombieStats(lvl);
    if (z) rows.push([lvl, z.hp, z.levelHpMul, z.hpMul, z.attackDamage, z.dps]);
  }
  printTable(['Lvl', 'HP', 'LevelHpMul', 'hpMul', 'AtkDmg', 'DPS'], rows);
}

function printScenarioMatrix(rows) {
  console.log('\n== BALANCE MATRIX (default profiles/goals) ==\n');
  printTable(
    ['Band', 'Profile', 'ZombieTTK', 'PackTTK', 'FenceSurv', 'Pressure', 'Score'],
    rows.map(function (row) {
      return [
        Shared.getBandById(row.scenario.bandId).label,
        Shared.PROFILE_LABELS[row.scenario.profileKey],
        row.metrics.singleZombieTtk,
        row.metrics.packTtk,
        row.metrics.fenceSurvivalSec,
        row.metrics.progressionPressure,
        row.evaluation.score,
      ];
    })
  );
}

function printOptimizerSummary(result) {
  console.log('\n== OPTIMIZER SUMMARY ==\n');
  console.log('Score: ' + result.scoreBefore + ' -> ' + result.scoreAfter);
  console.log('Coverage: ' + result.coverageBefore + ' -> ' + result.coverageAfter);
  console.log('Risk: ' + result.risk);
  printTable(
    ['Group', 'Tunable', 'From', 'To'],
    result.changedTunables.map(function (change) {
      return [change.group, change.label, change.from, change.to];
    })
  );
}

/* ======== CLI ======== */
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--tank') opts.tank = parseInt(args[++i]);
    else if (a === '--zombie') opts.zombie = parseInt(args[++i]);
    else if (a === '--duel') { opts.duel = true; opts.duelLevel = parseInt(args[++i]) || 10; }
    else if (a === '--breakpoint') opts.breakpoint = true;
    else if (a === '--curve') opts.curve = true;
    else if (a === '--wall-survival') opts.wallSurvival = true;
    else if (a === '--wall') opts.wallLevel = parseInt(args[++i]);
    else if (a === '--count') opts.zombieCount = parseInt(args[++i]);
    else if (a === '--summary') opts.summary = true;
    else if (a === '--talents') opts.talents = args[++i];
    else if (a === '--chips' || a === '--chip') opts.chipModId = parseInt(args[++i]);
    else if (a === '--matrix') opts.matrix = true;
    else if (a === '--optimize') opts.optimize = true;
    else if (a === '--tunables') opts.tunables = args[++i];
    else if (a === '--chip-list') opts.chipList = true;
    else if (a === '--zombie-hp') opts.zombieHp = true;
  }
  return opts;
}

function showHelp() {
  console.log([
    '',
    'balance-sim.js -- CLI Balance Simulator for Tank Merge Zombie Defense',
    '',
    'Usage:',
    '  node tools/balance-sim.js [options]',
    '',
    'Options:',
    '  --help              Show this help',
    '  --json              Output results as JSON (for CI parsing)',
    '',
    '  --tank N            Tank level for matchup (default: 10)',
    '  --zombie N          Zombie level for matchup (default: 10)',
    '  --duel N            Quick duel: tank lvl N vs zombie lvl N (1v1)',
    '  --count N           Number of zombies (default: 1 for duel, 60 for breakpoint)',
    '',
    '  --curve             Print full difficulty curve (all 60 levels)',
    '  --breakpoint        Find level where zombies start winning vs walls',
    '  --wall N            Wall level for breakpoint analysis (default: 1)',
    '  --wall-survival     Wall survival analysis (wall vs zombie groups)',
    '  --summary           Full summary report (all systems)',
    '  --matrix            Evaluate default band/profile matrix via shared balance kernel',
    '  --optimize          Run default optimizer pass via shared registry/tunables',
    '  --tunables IDS      Comma-separated registry ids for --optimize',
    '',
    '  --talents SPEC      Apply talent ranks (e.g. "OFF:5,3,2;DEF:1,1;ECO:2,0")',
    '  --chip N            Apply chip modifier N to tank DPS calculation',
    '  --chip-list         Show all chip modifier DPS multipliers',
    '  --zombie-hp         Show zombie HP progression table (real formula)',
    '',
    'Talent Spec Format:',
    '  OFF:r1,r2,...  -- offense talents, rank per talent (tree order)',
    '  DEF:r1,r2,...  -- defense talents',
    '  ECO:r1,r2,...  -- economy talents',
    '  Separate branches with semicolons.',
    '',
    'Examples:',
    '  node tools/balance-sim.js --duel 20',
    '  node tools/balance-sim.js --duel 20 --chip 6',
    '  node tools/balance-sim.js --duel 20 --talents "OFF:5,3"',
    '  node tools/balance-sim.js --tank 30 --zombie 25 --count 10',
    '  node tools/balance-sim.js --breakpoint --wall 15',
    '  node tools/balance-sim.js --curve --json',
    '  node tools/balance-sim.js --matrix',
    '  node tools/balance-sim.js --optimize --tunables balance.tank.attackDamageMul,series.zombie.hpMul',
    '  node tools/balance-sim.js --chip-list',
    '  node tools/balance-sim.js --zombie-hp',
    '  node tools/balance-sim.js --summary --json',
    '',
  ].join('\n'));
}

function main() {
  const opts = parseArgs();

  if (opts.help) {
    showHelp();
    return;
  }

  if (!opts.json) {
    console.log('Balance Simulator -- Tank Merge Zombie Defense');
    console.log('='.repeat(50));
  }

  // Build simulation options from CLI flags
  const simOpts = {};
  if (opts.talents) {
    const talentRanks = parseTalentSpec(opts.talents);
    simOpts.talentRanks = talentRanks;
    simOpts.talentMods = computeTalentMods(talentRanks);
      if (!opts.json) {
        console.log('\nTalents applied: dmgMul=' + round3(simOpts.talentMods.damageMul) +
          ' fireRateMul=' + round3(simOpts.talentMods.fireRateMul) +
          ' aoeMul=' + round3(simOpts.talentMods.aoeMul) +
          ' rangeMul=' + round3(simOpts.talentMods.rangeMul) +
          ' doubleShotChance=' + round3(simOpts.talentMods.doubleShotChance));
      }
  }
  if (opts.chipModId) {
    simOpts.chipModId = opts.chipModId;
    const chip = computeChipEffect(opts.chipModId);
      if (!opts.json) {
        console.log('\nChip applied: mod' + opts.chipModId + ' -- ' + chip.desc);
      }
  }

  // Chip list
  if (opts.chipList) {
    if (opts.json) {
      const all = {};
      for (let id = 1; id <= 30; id++) all[id] = computeChipEffect(id);
      console.log(JSON.stringify(all, null, 2));
    } else {
      printChipEffects();
    }
    return;
  }

  // Zombie HP progression
  if (opts.zombieHp) {
    if (opts.json) {
      const rows = [];
      for (let lvl = 1; lvl <= 60; lvl++) {
        const z = getZombieStats(lvl);
        if (z) rows.push(z);
      }
      console.log(JSON.stringify(rows, null, 2));
    } else {
      printZombieHpProgression();
    }
    return;
  }

  if (opts.matrix) {
    const matrix = reportScenarioMatrix();
    if (opts.json) {
      console.log(JSON.stringify(matrix, null, 2));
    } else {
      printScenarioMatrix(matrix);
    }
    return;
  }

  if (opts.optimize) {
    const result = reportOptimizer(opts);
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printOptimizerSummary(result);
    }
    return;
  }

  // Single matchup
  if (opts.tank != null || opts.zombie != null) {
    const tl = opts.tank || 10;
    const zl = opts.zombie || 10;
    const count = opts.zombieCount || 1;
    const report = reportSingleDuel(tl, zl, simOpts);
    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printSingleDuel(report);
      if (count > 1) {
        const duel = simulateDuel(tl, zl, count, simOpts);
        console.log('\nWith ' + count + ' zombies: TTK=' + duel.ttk + 's  ZombieGroupDPS=' + duel.zombieGroupDpsPerTank);
      }
    }
    return;
  }

  // Quick duel
  if (opts.duel) {
    const lvl = opts.duelLevel;
    const report = reportSingleDuel(lvl, lvl, simOpts);
    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printSingleDuel(report);
    }
    return;
  }

  // Difficulty curve
  if (opts.curve) {
    const curve = reportDifficultyCurve(simOpts);
    if (opts.json) {
      console.log(JSON.stringify(curve, null, 2));
    } else {
      printDifficultyCurve(curve);
    }
    return;
  }

  // Breakpoint
  if (opts.breakpoint) {
    const tl = opts.tank || 10;
    const wl = opts.wallLevel || 1;
    const count = opts.zombieCount || 60;
    const bp = findBreakpoint(tl, wl, count, simOpts);
    if (opts.json) {
      console.log(JSON.stringify(bp, null, 2));
    } else {
      printBreakpoint('Tank lv' + tl + ', Wall lv' + wl + ', ' + count + ' zombies', bp);
    }
    return;
  }

  // Wall survival
  if (opts.wallSurvival) {
    const results = reportWallSurvival(simOpts);
    if (opts.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      printWallSurvival(results);
    }
    return;
  }

  // Full summary (default or --summary)
  const nonCmdKeys = Object.keys(opts).filter(function (k) {
    return k !== 'json' && k !== 'talents' && k !== 'chipModId';
  });
  if (opts.summary || nonCmdKeys.length === 0) {
    const summary = reportFullSummary(simOpts);
    if (opts.json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log('\n== CONFIG OVERVIEW ==\n');
      printTable(
        ['System', 'Count'],
        Object.entries(summary.config).map(function (e) { return [e[0], e[1]]; })
      );
      console.log('\n== BAL CONSTANTS ==');
      console.log('  zombieHpBase=' + BAL.zombieHpBase + '  dmgMultPerLevel=' + BAL.dmgMultPerLevel + '  zombieHpExtraPerLevel=' + BAL.zombieHpExtraPerLevel);
      console.log('  dmgBase=' + BAL.dmgBase + '  fireRateBase=' + BAL.fireRateBase + '  fireRateAddPerLevel=' + BAL.fireRateAddPerLevel);
      console.log('\n== GLOBAL MULTIPLIERS ==');
      console.log('  Tank:   ' + JSON.stringify(summary.globalMultipliers.tank));
      console.log('  Zombie: ' + JSON.stringify(summary.globalMultipliers.zombie));
      console.log('\n== PROGRESSION RANGES ==');
      console.log('  Tank damage:   ' + summary.progression.tankDamageRange[0] + ' -> ' + summary.progression.tankDamageRange[1]);
      console.log('  Zombie HP:     ' + summary.progression.zombieHpRange[0] + ' -> ' + summary.progression.zombieHpRange[1]);
      console.log('  Zombie damage: ' + summary.progression.zombieDamageRange[0] + ' -> ' + summary.progression.zombieDamageRange[1]);
      console.log('  Wall HP:       ' + summary.progression.wallHpRange[0] + ' -> ' + summary.progression.wallHpRange[1]);
      printDifficultyCurve(summary.difficultyCurve);
      printBreakpoint('Tank lv10, Wall lv5, 60z', summary.breakpoints.tank10_wall5_vs60z);
      printBreakpoint('Tank lv30, Wall lv20, 60z', summary.breakpoints.tank30_wall20_vs60z);
    }
    return;
  }
}

main();
