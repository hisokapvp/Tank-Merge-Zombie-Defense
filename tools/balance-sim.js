#!/usr/bin/env node
/**
 * balance-sim.js — CLI Balance Simulator
 *
 * Headless simulates tank-vs-zombie combat using game config JSON files.
 * Outputs DPS, time-to-kill (TTK), difficulty curves, breakpoints.
 *
 * Usage:
 *   node tools/balance-sim.js                            # full report
 *   node tools/balance-sim.js --tank 10 --zombie 10      # single matchup
 *   node tools/balance-sim.js --duel 20                   # tank lvl N vs zombie lvl N
 *   node tools/balance-sim.js --breakpoint                # find level where zombies win
 *   node tools/balance-sim.js --curve                     # full difficulty curve
 *   node tools/balance-sim.js --wall-survival             # wall survival analysis
 *   node tools/balance-sim.js --json                      # output as JSON
 *   node tools/balance-sim.js --help
 *
 * No npm dependencies. Pure Node.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/* ======== Config Loading ======== */
const ROOT = path.resolve(__dirname, '..');
function loadJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', rel), 'utf8'));
}

let tanks, zombies, fence, dron, bullet, balance, cannon;
try {
  tanks = loadJSON('tanks.json');
  zombies = loadJSON('zombies.json');
  fence = loadJSON('fence.json');
  dron = loadJSON('dron.json');
  bullet = loadJSON('bullet.json');
  balance = loadJSON('balance.json');
  cannon = loadJSON('balance/cannonUpgrades.json');
} catch (e) {
  console.error('ERROR: Cannot load config files from assets/. Run from project root.');
  console.error(e.message);
  process.exit(1);
}

/* ======== Data Extraction ======== */
function getTankStats(level) {
  const k = 'tank_lvl' + level;
  const t = tanks[k];
  if (!t) return null;
  const s = t.stats;
  const bLevel = t.bulletLevel || 1;
  const bulletData = bullet.bullets.bullet_base.levels[bLevel - 1] || bullet.bullets.bullet_base.levels[0];
  const addDmg = bulletData.addDamage || 0;
  const aoe = bulletData.aoe || 1;

  // Apply global balance multipliers
  const balTank = balance.tank || {};
  const dmgMul = balTank.attackDamageMul || 1;
  const atkSpdMul = balTank.attackSpeedMul || 1;

  // Override per level
  const ovr = balance.tankOverrides && balance.tankOverrides['level_' + level] || {};
  const finalDmgMul = dmgMul * (ovr.attackDamageMul || 1);
  const finalAtkSpdMul = atkSpdMul * (ovr.attackSpeedMul || 1);

  // cannon upgrades (column index 1=dmgAdd, 2=atkSpdAdd based on analysis)
  const cannonRow = cannon[level - 1];
  const cannonDmgAdd = cannonRow ? cannonRow[1] : 0;

  const baseDamage = (s.baseDamage + addDmg + cannonDmgAdd) * finalDmgMul;
  const attackSpeed = (s.attackSpeed || 1) * finalAtkSpdMul;
  // Approximate fire rate: base 1 shot/sec scaled by attackSpeed
  const fireRateSec = 1 / attackSpeed;
  const dps = baseDamage / fireRateSec;

  return {
    level: level,
    baseDamage: Math.round(baseDamage * 100) / 100,
    attackSpeed: attackSpeed,
    fireRateSec: Math.round(fireRateSec * 1000) / 1000,
    dps: Math.round(dps * 100) / 100,
    aoe: aoe,
    bulletLevel: bLevel
  };
}

function getZombieStats(level) {
  const idx = level - 1;
  const z = zombies.types[idx];
  if (!z) return null;

  const balZ = balance.zombie || {};
  const dmgMul = balZ.attackDamageMul || 1;
  const spdMul = balZ.speedMul || 1;
  const atkSpdMul = balZ.attackSpeedMul || 1;

  const ovr = balance.zombieOverrides && balance.zombieOverrides[z.id] || {};
  const finalDmgMul = dmgMul * (ovr.attackDamageMul || 1);
  const finalSpdMul = spdMul * (ovr.speedMul || 1);
  const finalAtkSpdMul = atkSpdMul * (ovr.attackSpeedMul || 1);

  const hp = (z.hpMul || 1) * 100; // base HP = hpMul * 100 (estimate)
  const attackDamage = z.attackDamage * finalDmgMul;
  const atkCooldown = (z.attack.attackCooldownSec || 0.35) / finalAtkSpdMul;
  const zombieDps = attackDamage / atkCooldown;
  const moveSpeed = (z.omegaMul || 1) * finalSpdMul;

  return {
    level: level,
    id: z.id,
    hp: hp,
    hpMul: z.hpMul || 1,
    attackDamage: Math.round(attackDamage * 100) / 100,
    attackCooldownSec: Math.round(atkCooldown * 1000) / 1000,
    dps: Math.round(zombieDps * 100) / 100,
    moveSpeed: moveSpeed,
    weight: z.weight || 1,
    rewardMul: z.rewardMul || 1
  };
}

function getWallStats(level) {
  const idx = level - 1;
  const w = fence.levels[idx];
  if (!w) return null;
  return {
    level: level,
    segmentMaxHp: w.segmentMaxHp,
    armorFlat: w.armorFlat,
    upgradeCost: w.upgradeCostDamagePoints,
    effectiveHp: Math.round(w.segmentMaxHp * (1 + w.armorFlat / 100))
  };
}

function getDronStats(level) {
  const d = dron.levels[String(level)];
  if (!d) return null;
  return {
    level: level,
    moveSpeedPxSec: d.moveSpeedPxSec,
    repairSpeedMult: d.repairSpeedMult,
    costMult: d.costMult,
    effectiveRepairPerSec: Math.round((1 / dron.baseRepairSec) * d.repairSpeedMult * 10000) / 10000
  };
}

/* ======== Simulation ======== */

/**
 * Simulate: 1 tank at `tankLevel` shooting at `zombieCount` zombies of `zombieLevel`.
 * Returns: { ttk, totalDamageDealt, overkill, tankDps, zombieDps }
 */
function simulateDuel(tankLevel, zombieLevel, zombieCount) {
  zombieCount = zombieCount || 1;
  const t = getTankStats(tankLevel);
  const z = getZombieStats(zombieLevel);
  if (!t || !z) return null;

  const totalZombieHp = z.hp * zombieCount;
  const ttk = totalZombieHp / t.dps; // time to kill all zombies (seconds)

  return {
    tankLevel: tankLevel,
    zombieLevel: zombieLevel,
    zombieCount: zombieCount,
    tankDps: t.dps,
    zombieTotalHp: totalZombieHp,
    ttk: Math.round(ttk * 1000) / 1000,
    zombieDps: z.dps * zombieCount,
    zombieGroupDpsPerTank: z.dps * zombieCount
  };
}

/**
 * Simulate: N zombies attacking a wall segment.
 * Returns: time until wall segment breaks.
 */
function simulateWallSurvival(wallLevel, zombieLevel, zombieCount) {
  zombieCount = zombieCount || 10;
  const w = getWallStats(wallLevel);
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
    totalDps: Math.round(totalDps * 100) / 100,
    survivalSec: Math.round(survivalSec * 100) / 100
  };
}

/**
 * Find breakpoint: the zombie level at which zombies start winning
 * (wall breaks faster than tank kills them).
 */
function findBreakpoint(tankLevel, wallLevel, zombieCount) {
  zombieCount = zombieCount || (zombies.spawn ? zombies.spawn.perSideTarget : 60);
  const results = [];
  for (let zl = 1; zl <= 60; zl++) {
    const duel = simulateDuel(tankLevel, zl, zombieCount);
    const wall = simulateWallSurvival(wallLevel || 1, zl, zombieCount);
    if (!duel || !wall) continue;
    const ratio = duel.ttk / wall.survivalSec;
    results.push({
      zombieLevel: zl,
      ttk: duel.ttk,
      wallSurvival: wall.survivalSec,
      ratio: Math.round(ratio * 1000) / 1000,
      status: ratio < 1 ? 'TANK_WINS' : 'ZOMBIES_WIN'
    });
  }
  return results;
}

/* ======== Reports ======== */

function reportSingleDuel(tl, zl) {
  const t = getTankStats(tl);
  const z = getZombieStats(zl);
  const duel = simulateDuel(tl, zl, 1);
  if (!t || !z || !duel) {
    console.log('Invalid levels: tank=' + tl + ' zombie=' + zl);
    return null;
  }
  const report = {
    tank: t,
    zombie: z,
    duel: duel
  };
  return report;
}

function reportDifficultyCurve() {
  const curve = [];
  for (let lvl = 1; lvl <= 60; lvl++) {
    const t = getTankStats(lvl);
    const z = getZombieStats(lvl);
    if (!t || !z) continue;
    const duel = simulateDuel(lvl, lvl, 1);
    curve.push({
      level: lvl,
      tankDps: t.dps,
      zombieHp: z.hp,
      zombieDps: z.dps,
      ttk1v1: duel ? duel.ttk : null,
      dpsRatio: Math.round((t.dps / z.dps) * 100) / 100
    });
  }
  return curve;
}

function reportWallSurvival() {
  const results = [];
  const maxWall = fence.levels.length;
  for (let wl = 1; wl <= maxWall; wl += 5) {
    for (let zl = 1; zl <= 60; zl += 5) {
      const sim = simulateWallSurvival(wl, zl, 20);
      if (sim) results.push(sim);
    }
  }
  return results;
}

function reportFullSummary() {
  const summary = {
    config: {
      tankLevels: tanks.maxLevel,
      zombieTypes: zombies.types.length,
      wallLevels: fence.levels.length,
      dronLevels: Object.keys(dron.levels).length,
      bulletLevels: bullet.bullets.bullet_base.levels.length,
      cannonUpgradeLevels: cannon.length,
      spawnTargetAlive: zombies.spawn ? zombies.spawn.targetAlive : 'N/A'
    },
    globalMultipliers: {
      tank: balance.tank,
      zombie: balance.zombie
    },
    progression: {
      tankDamageRange: [getTankStats(1).baseDamage, getTankStats(59).baseDamage],
      zombieDamageRange: [getZombieStats(1).attackDamage, getZombieStats(60).attackDamage],
      wallHpRange: [fence.levels[0].segmentMaxHp, fence.levels[fence.levels.length - 1].segmentMaxHp]
    },
    difficultyCurve: reportDifficultyCurve(),
    breakpoints: {
      tank10_wall5_vs60z: findBreakpoint(10, 5, 60),
      tank30_wall20_vs60z: findBreakpoint(30, 20, 60)
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
  console.log('Tank:   baseDmg=' + t.baseDamage + '  DPS=' + t.dps + '  fireRate=' + t.fireRateSec + 's  bulletLvl=' + t.bulletLevel + '  aoe=' + t.aoe);
  console.log('Zombie: HP=' + z.hp + '  atkDmg=' + z.attackDamage + '  DPS=' + z.dps + '  atkCooldown=' + z.attackCooldownSec + 's  speed=' + z.moveSpeed);
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
  }
  return opts;
}

function showHelp() {
  console.log(`
balance-sim.js — CLI Balance Simulator for Tank Merge Zombie Defense

Usage:
  node tools/balance-sim.js [options]

Options:
  --help              Show this help
  --json              Output results as JSON (for CI parsing)

  --tank N            Tank level for matchup (default: 10)
  --zombie N          Zombie level for matchup (default: 10)
  --duel N            Quick duel: tank lvl N vs zombie lvl N (1v1)
  --count N           Number of zombies (default: 1 for duel, 60 for breakpoint)

  --curve             Print full difficulty curve (all 60 levels)
  --breakpoint        Find level where zombies start winning vs walls
  --wall N            Wall level for breakpoint analysis (default: 1)

  --wall-survival     Wall survival analysis (wall vs zombie groups)
  --summary           Full summary report (all systems)

Examples:
  node tools/balance-sim.js --duel 20
  node tools/balance-sim.js --tank 30 --zombie 25 --count 10
  node tools/balance-sim.js --breakpoint --wall 15
  node tools/balance-sim.js --curve --json
  node tools/balance-sim.js --summary --json
`);
}

function main() {
  const opts = parseArgs();

  if (opts.help) {
    showHelp();
    return;
  }

  console.log('Balance Simulator — Tank Merge Zombie Defense');
  console.log('='.repeat(50));

  // Single matchup
  if (opts.tank != null || opts.zombie != null) {
    const tl = opts.tank || 10;
    const zl = opts.zombie || 10;
    const count = opts.zombieCount || 1;
    const report = reportSingleDuel(tl, zl);
    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printSingleDuel(report);
      if (count > 1) {
        const duel = simulateDuel(tl, zl, count);
        console.log('\nWith ' + count + ' zombies: TTK=' + duel.ttk + 's  ZombieGroupDPS=' + duel.zombieGroupDpsPerTank);
      }
    }
    return;
  }

  // Quick duel
  if (opts.duel) {
    const lvl = opts.duelLevel;
    const report = reportSingleDuel(lvl, lvl);
    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printSingleDuel(report);
    }
    return;
  }

  // Difficulty curve
  if (opts.curve) {
    const curve = reportDifficultyCurve();
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
    const bp = findBreakpoint(tl, wl, count);
    if (opts.json) {
      console.log(JSON.stringify(bp, null, 2));
    } else {
      printBreakpoint('Tank lv' + tl + ', Wall lv' + wl + ', ' + count + ' zombies', bp);
    }
    return;
  }

  // Wall survival
  if (opts.wallSurvival) {
    const results = reportWallSurvival();
    if (opts.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      printWallSurvival(results);
    }
    return;
  }

  // Full summary (default or --summary)
  if (opts.summary || Object.keys(opts).length === 0 || (Object.keys(opts).length === 1 && opts.json)) {
    const summary = reportFullSummary();
    if (opts.json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log('\n== CONFIG OVERVIEW ==\n');
      printTable(
        ['System', 'Count'],
        Object.entries(summary.config).map(function (e) { return [e[0], e[1]]; })
      );
      console.log('\n== GLOBAL MULTIPLIERS ==');
      console.log('  Tank:   ' + JSON.stringify(summary.globalMultipliers.tank));
      console.log('  Zombie: ' + JSON.stringify(summary.globalMultipliers.zombie));
      console.log('\n== PROGRESSION RANGES ==');
      console.log('  Tank damage:  ' + summary.progression.tankDamageRange[0] + ' → ' + summary.progression.tankDamageRange[1]);
      console.log('  Zombie damage: ' + summary.progression.zombieDamageRange[0] + ' → ' + summary.progression.zombieDamageRange[1]);
      console.log('  Wall HP:      ' + summary.progression.wallHpRange[0] + ' → ' + summary.progression.wallHpRange[1]);
      printDifficultyCurve(summary.difficultyCurve);
      printBreakpoint('Tank lv10, Wall lv5, 60z', summary.breakpoints.tank10_wall5_vs60z);
      printBreakpoint('Tank lv30, Wall lv20, 60z', summary.breakpoints.tank30_wall20_vs60z);
    }
    return;
  }
}

main();
