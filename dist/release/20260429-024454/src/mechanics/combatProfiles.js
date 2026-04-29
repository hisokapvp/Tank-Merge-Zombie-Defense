(function (global) {
  'use strict';

  var PROJECTILE_KINDS = {
    ap: { kind:'ap', speed: 820, r: 4.0, color:'#ffd36b', glow:'rgba(255,211,107,.25)', trail:'rgba(255,211,107,.12)', aoeBase: 18, aoePerLevel: 2.4, aoeMin: 16, aoeMax: 40 },
    he: { kind:'he', speed: 740, r: 5.6, color:'#ff7a6b', glow:'rgba(255,122,107,.26)', trail:'rgba(255,122,107,.12)', aoeBase: 28, aoePerLevel: 3.2, aoeMin: 24, aoeMax: 58 },
    toxic: { kind:'toxic', speed: 700, r: 5.0, color:'#b8ff3b', glow:'rgba(184,255,59,.22)', trail:'rgba(184,255,59,.10)', aoeBase: 30, aoePerLevel: 3.4, aoeMin: 26, aoeMax: 64, poolLife: 3.6, poolDpsMul: 0.20 },
    tesla: { kind:'tesla', speed: 900, r: 4.6, color:'#8bd3ff', glow:'rgba(139,211,255,.25)', trail:'rgba(139,211,255,.10)', aoeBase: 26, aoePerLevel: 2.8, aoeMin: 26, aoeMax: 66, chainRange: 84, chainJumps: 3, chainMul: 0.45 },
  };

  function projectileProfile(level, bulletCfg) {
    var bulletKind = bulletCfg && typeof bulletCfg.projectileKind === 'string' ? bulletCfg.projectileKind : null;
    if (bulletKind && PROJECTILE_KINDS[bulletKind]) return PROJECTILE_KINDS[bulletKind];

    if (level <= 3) return PROJECTILE_KINDS.ap;
    if (level <= 6) return PROJECTILE_KINDS.he;
    if (level <= 9) return PROJECTILE_KINDS.toxic;
    return PROJECTILE_KINDS.tesla;
  }

  function tankLevelCounts(cells) {
    var counts = new Map();
    var list = Array.isArray(cells) ? cells : [];
    for (var i = 0; i < list.length; i++) {
      var cell = list[i];
      if (!cell || !cell.tank) continue;
      var lvl = cell.tank.level;
      counts.set(lvl, (counts.get(lvl) || 0) + 1);
    }
    return counts;
  }

  function zombieLevelWeights(cells) {
    var counts = tankLevelCounts(cells);
    var levels = Array.from(counts.keys()).sort(function (a, b) { return a - b; });
    if (!levels.length) return [{ level: 1, weight: 1 }];
    var total = levels.reduce(function (sum, lvl) { return sum + (counts.get(lvl) || 0); }, 0);
    if (total <= 0) return [{ level: 1, weight: 1 }];
    return levels.map(function (lvl) {
      return {
        level: lvl,
        weight: (counts.get(lvl) || 0) / total,
      };
    });
  }

  function pickZombieLevel(cells, rng) {
    var rand = typeof rng === 'function' ? rng : Math.random;
    var weights = zombieLevelWeights(cells);
    var total = 0;
    for (var i = 0; i < weights.length; i++) total += weights[i].weight;
    var r = rand() * total;
    for (var j = 0; j < weights.length; j++) {
      r -= weights[j].weight;
      if (r <= 0) return weights[j].level;
    }
    return weights[weights.length - 1].level;
  }

  global.Game = global.Game || {};
  global.Game.CombatProfiles = {
    PROJECTILE_KINDS: PROJECTILE_KINDS,
    projectileProfile: projectileProfile,
    tankLevelCounts: tankLevelCounts,
    zombieLevelWeights: zombieLevelWeights,
    pickZombieLevel: pickZombieLevel,
  };
})(typeof window !== 'undefined' ? window : this);
