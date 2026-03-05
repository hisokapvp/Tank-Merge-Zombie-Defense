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
const BAL = {
  dmgBase: 7,
  dmgMultPerLevel: 1.48,
  fireRateBase: 0.85,
  fireRateAddPerLevel: 0.075,
  rangeBase: 315,
  rangePerLevel: 10,
  zombieHpBase: 44,
  zombieHpVar: 0.22,
  zombieHpExtraPerLevel: 0.12,
  zombieLevelOmegaMul: 0.08,
};

/* ======== Helpers ======== */
function round2(v) { return Math.round(v * 100) / 100; }
function round3(v) { return Math.round(v * 1000) / 1000; }
function round4(v) { return Math.round(v * 10000) / 10000; }

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
  const mods = {
    damageMul: 1,
    fireRateMul: 1,
    rangeMul: 1,
    aoeMul: 1,
    orbitSpeedMul: 1,
    doubleShotChance: 0,
    tripleShotChance: 0,
    tankBuyCostMul: 1,
    coinsKillMul: 1,
    coinsShotMul: 1,
    xpMul: 1,
    wallHpMul: 1,
    wallArmorFlat: 0,
  };

  if (!talentTree || !talentTree.talents) return mods;

  const branchTalents = {};
  for (const t of talentTree.talents) {
    const branch = t.branch;
    if (!branchTalents[branch]) branchTalents[branch] = [];
    branchTalents[branch].push(t);
  }

  for (const [branch, talents] of Object.entries(branchTalents)) {
    const allocatedRanks = talentRanks[branch] || [];
    for (let i = 0; i < talents.length && i < allocatedRanks.length; i++) {
      const talent = talents[i];
      const rank = Math.min(allocatedRanks[i] || 0, talent.maxRank || 0);
      if (rank <= 0 || !talent.effects) continue;

      for (const eff of talent.effects) {
        if (eff.type === 'stat_mul' && eff.stat && eff.perRank) {
          if (mods[eff.stat] !== undefined) {
            mods[eff.stat] += eff.perRank * rank;
          }
        } else if (eff.type === 'stat_add' && eff.stat && eff.perRank) {
          if (mods[eff.stat] !== undefined) {
            mods[eff.stat] += eff.perRank * rank;
          }
        } else if (eff.type === 'param' && eff.key) {
          const fromRank = eff.fromRank || 1;
          if (rank < fromRank) continue;
          if (eff.perRank !== undefined) {
            const effectiveRank = rank - fromRank + 1;
            let val = (eff.base || 0) + eff.perRank * effectiveRank;
            if (eff.min !== undefined) val = Math.max(val, eff.min);
            if (eff.max !== undefined) val = Math.min(val, eff.max);
            if (mods[eff.key] !== undefined) mods[eff.key] = val;
          } else if (eff.value !== undefined) {
            if (mods[eff.key] !== undefined) mods[eff.key] = eff.value;
          }
        }
      }
    }
  }

  // Apply caps
  if (talentTree.caps) {
    if (talentTree.caps.doubleShotChance !== undefined) {
      mods.doubleShotChance = Math.min(mods.doubleShotChance, talentTree.caps.doubleShotChance);
    }
  }

  return mods;
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
  const effects = {
    1:  { dpsMultiplier: 2.0,  desc: 'Double Shot — 2 projectiles per barrel' },
    2:  { dpsMultiplier: 1.5,  desc: 'Double Chain — chain to 2 targets' },
    3:  { dpsMultiplier: 2.0,  desc: 'Double Matryoshka — x2 dmg big shot + child' },
    4:  { dpsMultiplier: 1.5,  desc: 'Small Repulse — x1.5 dmg + push' },
    5:  { dpsMultiplier: 1.5,  desc: 'Small Vacuum — x1.5 dmg + pull' },
    6:  { dpsMultiplier: round3((3 + 3 * 1.25) / 4), desc: 'Small Combo — shots 1-3: 1 normal; shot 4: 3x1.25 burst (avg x' + round3((3 + 3 * 1.25) / 4) + ')' },
    7:  { dpsMultiplier: 1.5,  desc: 'Arcade Chaos — random mod each shot (avg x1.5)' },
    8:  { dpsMultiplier: 1.0,  desc: 'Small Nuke — x3 dmg every 30s (burst, not sustained)' },
    9:  { dpsMultiplier: 1.0,  desc: 'Small Calming — stun, no dmg bonus' },
    10: { dpsMultiplier: 1.3,  desc: 'Fire Pool — x0.30 DPS ground zone' },
    11: { dpsMultiplier: 1.0,  desc: 'Ice Zone — slow, no direct dmg' },
    12: { dpsMultiplier: 1.35, desc: 'Electro Node — periodic zap x0.35 dmg' },
    13: { dpsMultiplier: 1.5,  desc: 'Laser Mark — marked targets take x2 dmg' },
    14: { dpsMultiplier: 1.15, desc: 'Acid Pool — x0.15 DPS + slow' },
    15: { dpsMultiplier: 3.0,  desc: 'Triple Shot — 3 projectiles' },
    16: { dpsMultiplier: 6.0,  desc: 'Hex Shot — 6 projectiles' },
    17: { dpsMultiplier: 2.0,  desc: 'Triple Chain — chain to 3 targets' },
    18: { dpsMultiplier: 3.5,  desc: 'Hex Chain — chain to 6 targets' },
    19: { dpsMultiplier: 3.0,  desc: 'Triple Matryoshka — 3-tier children' },
    20: { dpsMultiplier: 4.0,  desc: 'Quad Matryoshka — 4-tier children' },
    21: { dpsMultiplier: 1.75, desc: 'Medium Repulse — x1.75 dmg + push' },
    22: { dpsMultiplier: 2.0,  desc: 'Large Repulse — x2 dmg + push' },
    23: { dpsMultiplier: 1.75, desc: 'Medium Vacuum — x1.75 dmg + pull' },
    24: { dpsMultiplier: 2.0,  desc: 'Large Vacuum — x2 dmg + pull' },
    25: { dpsMultiplier: round3((3 + 3 * 1.5) / 4), desc: 'Medium Combo — shots 1-3: 1 normal; shot 4: 3x1.5 burst (avg x' + round3((3 + 3 * 1.5) / 4) + ')' },
    26: { dpsMultiplier: round3((3 + 4 * 2.0) / 4), desc: 'Large Combo — shots 1-3: 1 normal; shot 4: 4x2.0 burst (avg x' + round3((3 + 4 * 2.0) / 4) + ')' },
    27: { dpsMultiplier: 1.0,  desc: 'Medium Nuke — x4 dmg every 30s (burst)' },
    28: { dpsMultiplier: 1.0,  desc: 'Large Nuke — x5 dmg every 30s (burst)' },
    29: { dpsMultiplier: 1.0,  desc: 'Medium Calming — stun, no dmg bonus' },
    30: { dpsMultiplier: 1.0,  desc: 'Large Calming — stun, no dmg bonus' },
  };
  return effects[modId] || { dpsMultiplier: 1.0, desc: 'Unknown mod ' + modId };
}

/* ======== Data Extraction ======== */

/**
 * Zombie HP multiplier — exact formula from game.js zombieHpMultiplier():
 *   dmgScale = dmgMultPerLevel^(lvl-1)
 *   extra = 1 + zombieHpExtraPerLevel * (lvl-1)
 *   return dmgScale * extra
 */
function zombieHpMultiplier(level) {
  const lvl = Math.max(1, level);
  const dmgScale = Math.pow(BAL.dmgMultPerLevel, lvl - 1);
  const extra = 1 + BAL.zombieHpExtraPerLevel * Math.max(0, lvl - 1);
  return dmgScale * extra;
}

function getTankStats(level, opts) {
  opts = opts || {};
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
  let finalDmgMul = dmgMul * (ovr.attackDamageMul || 1);
  let finalAtkSpdMul = atkSpdMul * (ovr.attackSpeedMul || 1);

  // cannon upgrades: row=[lvl, maxUpgrades, appliedDefault, dmgPerUpgrade, spdPerUpgrade, cost]
  const cannonRow = cannon[level - 1];
  const cannonApplied = cannonRow ? (cannonRow[2] || 0) : 0;
  const cannonDmgPerUpgrade = cannonRow ? (cannonRow[3] || 0) : 0;
  const cannonSpdPerUpgrade = cannonRow ? (cannonRow[4] || 0) : 0;
  finalDmgMul *= (1 + cannonApplied * cannonDmgPerUpgrade);
  finalAtkSpdMul *= (1 + cannonApplied * cannonSpdPerUpgrade);

  // Talent modifiers
  const tMods = opts.talentMods || {};
  const talentDmgMul = tMods.damageMul || 1;
  const talentFireRateMul = tMods.fireRateMul || 1;
  const talentAoeMul = tMods.aoeMul || 1;
  const doubleShotChance = tMods.doubleShotChance || 0;
  const tripleShotChance = tMods.tripleShotChance || 0;

  // Average projectiles per shot from talents
  const avgProjectiles = 1 + doubleShotChance + tripleShotChance * 2;

  // Chip modifier
  const chipMod = opts.chipModId ? computeChipEffect(opts.chipModId) : null;
  const chipDpsMul = chipMod ? chipMod.dpsMultiplier : 1;

  const baseDamage = (s.baseDamage + addDmg) * finalDmgMul * talentDmgMul;
  const fireRate = (BAL.fireRateBase + BAL.fireRateAddPerLevel * (level - 1)) * finalAtkSpdMul * talentFireRateMul;
  const fireRateSec = 1 / fireRate;
  const dpsBase = baseDamage * fireRate;
  const dps = dpsBase * avgProjectiles * chipDpsMul;

  return {
    level: level,
    baseDamage: round2(baseDamage),
    fireRate: round3(fireRate),
    fireRateSec: round3(fireRateSec),
    dpsBase: round2(dpsBase),
    dps: round2(dps),
    aoe: round3(aoe * talentAoeMul),
    bulletLevel: bLevel,
    avgProjectiles: round3(avgProjectiles),
    chipDpsMul: round3(chipDpsMul),
    chipDesc: chipMod ? chipMod.desc : null,
    talentDmgMul: round3(talentDmgMul),
    talentFireRateMul: round3(talentFireRateMul),
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

  // Real HP formula from game.js:
  // baseHp = zombieHpBase * zombieHpMultiplier(level)   (no random variance for deterministic sim)
  // hp = baseHp * hpMul
  const levelHpMul = zombieHpMultiplier(level);
  const baseHp = BAL.zombieHpBase * levelHpMul;
  const hp = baseHp * (z.hpMul || 1);

  const attackDamage = (z.attackDamage || 8) * finalDmgMul;
  const atkCooldown = (z.attack && z.attack.attackCooldownSec || 0.35) / finalAtkSpdMul;
  const zombieDps = attackDamage / atkCooldown;
  const moveSpeed = (z.omegaMul || 1) * finalSpdMul;

  return {
    level: level,
    id: z.id,
    hp: round2(hp),
    hpMul: z.hpMul || 1,
    levelHpMul: round2(levelHpMul),
    attackDamage: round2(attackDamage),
    attackCooldownSec: round3(atkCooldown),
    dps: round2(zombieDps),
    moveSpeed: moveSpeed,
    weight: z.weight || 1,
    rewardMul: z.rewardMul || 1
  };
}

function getWallStats(level, opts) {
  const idx = level - 1;
  const w = fence.levels[idx];
  if (!w) return null;
  const tMods = (opts && opts.talentMods) || {};
  const wallHpMul = tMods.wallHpMul || 1;
  const wallArmorAdd = tMods.wallArmorFlat || 0;
  const hp = w.segmentMaxHp * wallHpMul;
  const armor = w.armorFlat + wallArmorAdd;
  return {
    level: level,
    segmentMaxHp: round2(hp),
    armorFlat: armor,
    upgradeCost: w.upgradeCostDamagePoints,
    effectiveHp: round2(hp * (1 + armor / 100))
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
    effectiveRepairPerSec: round4((1 / dron.baseRepairSec) * d.repairSpeedMult)
  };
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

  console.log('Balance Simulator -- Tank Merge Zombie Defense');
  console.log('='.repeat(50));

  // Build simulation options from CLI flags
  const simOpts = {};
  if (opts.talents) {
    const talentRanks = parseTalentSpec(opts.talents);
    simOpts.talentMods = computeTalentMods(talentRanks);
    console.log('\nTalents applied: dmgMul=' + round3(simOpts.talentMods.damageMul) +
      ' fireRateMul=' + round3(simOpts.talentMods.fireRateMul) +
      ' aoeMul=' + round3(simOpts.talentMods.aoeMul) +
      ' rangeMul=' + round3(simOpts.talentMods.rangeMul) +
      ' doubleShotChance=' + round3(simOpts.talentMods.doubleShotChance));
  }
  if (opts.chipModId) {
    simOpts.chipModId = opts.chipModId;
    const chip = computeChipEffect(opts.chipModId);
    console.log('\nChip applied: mod' + opts.chipModId + ' -- ' + chip.desc);
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
