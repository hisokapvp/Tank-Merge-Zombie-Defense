/**
 * Pack 8 — Chip effect visual toggle checks.
 * Run: node Test/pack8/chipEffectVisualToggle.test.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

const root = path.resolve(__dirname, '../..');
const chipEffectsSource = fs.readFileSync(path.join(root, 'src', 'mechanics', 'chipEffects.js'), 'utf8');
const chipsConfig = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'chips.json'), 'utf8'));

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createChipEffectsApi(config, gameOverrides, options) {
  function FakeImage() {
    this.complete = true;
    this.naturalWidth = 64;
    this.naturalHeight = 64;
    this.src = '';
  }

  const game = Object.assign({}, gameOverrides || {});
  const randomValue = options && Number.isFinite(options.randomValue) ? options.randomValue : 0;
  const clockRef = options && options.clockRef ? options.clockRef : { now: 0 };
  const customMath = Object.create(Math);
  customMath.random = function () { return randomValue; };

  const sandbox = {
    console: console,
    Math: customMath,
    performance: { now: function () { return clockRef.now; } },
    setTimeout: function (fn) { fn(); return 0; },
    clearTimeout: function () {},
    Image: FakeImage,
    window: { Game: game },
  };
  sandbox.window.Image = FakeImage;
  sandbox.window.Math = customMath;
  sandbox.window.performance = sandbox.performance;
  vm.runInNewContext(chipEffectsSource, sandbox, { filename: 'chipEffects.js' });
  const api = sandbox.window.Game.ChipEffects;
  api.loadChipsCfg(config);
  return api;
}

console.log('\n── Pack 8: Chip effect visual toggle ──');

test('CFX-1: effect.enabled=false disables only code visual overlay while acid gameplay and effectSprite stay active', () => {
  const cfg = deepClone(chipsConfig);
  cfg.modifiers['14'].effect.enabled = false;
  const api = createChipEffectsApi(cfg);
  const decals = [];
  api.applyImpactEffects({
    shotMods: { acidPool: true },
    x: 120,
    y: 160,
    b: { dmg: 200 },
    zombies: [],
    getZombiePos: function () { return { x: 0, y: 0 }; },
    addDecal: function (decal) { decals.push(decal); },
  });

  assertEqual(decals.length, 1, 'acid pool gameplay decal is still created when effect.enabled=false');
  assertEqual(decals[0].codeVisualEnabled, false, 'code-driven visual overlay is disabled on the created decal');
  assertEqual(decals[0].r, cfg.modifiers['14'].effect.poolRadius, 'gameplay radius still comes from effect config');
  assertEqual(decals[0].life, cfg.modifiers['14'].effect.poolLife, 'gameplay lifetime still comes from effect config');
  assertEqual(decals[0].dps, 200 * cfg.modifiers['14'].effect.poolDpsMul, 'gameplay DPS still comes from effect config');
  assert(api.getModEffectSprite(14) && api.getModEffectSprite(14).src, 'effectSprite override remains available even when lingering effect is disabled');
});

test('CFX-2: effect.enabled=true keeps lingering acid visuals available', () => {
  const cfg = deepClone(chipsConfig);
  cfg.modifiers['14'].effect.enabled = true;
  const api = createChipEffectsApi(cfg);
  const decals = [];
  api.applyImpactEffects({
    shotMods: { acidPool: true },
    x: 120,
    y: 160,
    b: { dmg: 200 },
    zombies: [],
    getZombiePos: function () { return { x: 0, y: 0 }; },
    addDecal: function (decal) { decals.push(decal); },
  });

  assertEqual(decals.length, 1, 'acid pool decal is created');
  assert(decals[0].effectSprite && decals[0].effectSprite.src, 'visual sprite stays available when effect.enabled=true');
  assertEqual(decals[0].codeVisualEnabled, true, 'code-driven overlay stays enabled when effect.enabled=true');
  assertEqual(decals[0].color, cfg.modifiers['14'].effect.color, 'configured visual color stays active');
  assertEqual(decals[0].r, cfg.modifiers['14'].effect.poolRadius, 'gameplay radius still comes from effect config');
  assertEqual(decals[0].life, cfg.modifiers['14'].effect.poolLife, 'gameplay lifetime still comes from effect config');
  assertEqual(decals[0].dps, 200 * cfg.modifiers['14'].effect.poolDpsMul, 'gameplay DPS still comes from effect config');
});

test('CFX-3: chain children keep lingering carryover and remaining cascade queue', () => {
  const api = createChipEffectsApi(deepClone(chipsConfig));
  const spawns = [];
  const zombies = [{ id: 2, state: 'alive', px: 260, py: 160 }];

  api.applyImpactEffects({
    shotMods: {
      chainJumps: 1,
      firePool: true,
      activeModIds: [2, 10],
      pendingCascadeMods: [{ modId: 1 }],
      pendingYellowMods: [{ modId: 10 }],
      cellIndex: 0,
    },
    x: 120,
    y: 160,
    b: { dmg: 200, aoe: 50, level: 1, prof: {}, bulletCfg: {}, effectIntensity: 1, shotId: 1, tank: {} },
    zombies: zombies,
    getZombiePos: function (zombie) { return { x: zombie.px, y: zombie.py }; },
    addDecal: function () {},
    spawnProjectile: function (projectile) { spawns.push(projectile); },
  });

  const chainChild = spawns.find(function (projectile) { return projectile.isChainChild; });
  assert(chainChild, 'chain child projectile is spawned');
  assert(chainChild.chipShotMods, 'chain child keeps chipShotMods');
  assertEqual(chainChild.chipShotMods.firePool, true, 'chain child keeps fire pool carryover');
  assertEqual(chainChild.chipShotMods.pendingCascadeMods.length, 1, 'chain child keeps remaining cascade queue');
  assertEqual(chainChild.chipShotMods.pendingCascadeMods[0].modId, 1, 'chain child keeps the same pending cascade modifier');
  assertEqual(chainChild.chipShotMods.pendingYellowMods.length, 1, 'chain child keeps deferred yellow modifiers');
});

test('CFX-4: matryoshka children keep lingering carryover and pending cascade modifiers', () => {
  const api = createChipEffectsApi(deepClone(chipsConfig));
  const spawns = [];
  const zombies = [{ id: 3, state: 'alive', px: 190, py: 160 }];

  api.applyImpactEffects({
    shotMods: {
      isMatryoshka: true,
      matryoshkaDmgMul: 2,
      matryoshkaSizeMul: 1.25,
      firePool: true,
      activeModIds: [3, 10],
      pendingCascadeMods: [{ modId: 7 }],
      pendingYellowMods: [{ modId: 10 }],
      cellIndex: 0,
    },
    x: 120,
    y: 160,
    b: { dmg: 200, aoe: 50, level: 1, prof: {}, bulletCfg: {}, effectIntensity: 1, shotId: 1, tank: {} },
    zombies: zombies,
    getZombiePos: function (zombie) { return { x: zombie.px, y: zombie.py }; },
    addDecal: function () {},
    spawnProjectile: function (projectile) { spawns.push(projectile); },
  });

  const matryoshkaChild = spawns.find(function (projectile) { return projectile.isMatryoshkaChild; });
  assert(matryoshkaChild, 'matryoshka child projectile is spawned');
  assert(matryoshkaChild.chipShotMods, 'matryoshka child keeps chipShotMods');
  assertEqual(matryoshkaChild.chipShotMods.firePool, true, 'matryoshka child keeps fire pool carryover');
  assertEqual(matryoshkaChild.chipShotMods.pendingCascadeMods.length, 1, 'matryoshka child keeps remaining cascade queue');
  assertEqual(matryoshkaChild.chipShotMods.pendingCascadeMods[0].modId, 7, 'matryoshka child keeps pending arcade cascade');
});

test('CFX-5: Arcade secondary no longer overrides level-0 multishot', () => {
  const api = createChipEffectsApi(deepClone(chipsConfig), {
    HangarChipsUI: {
      getCells: function () {
        return [{ activeModifiers: [{ modId: 1, order: 0 }, { modId: 7, order: 1 }] }];
      }
    }
  });

  const result = api.applyShotModifiers({ cellIndex: 0, tank: {}, stats: {}, targets: [], sx: 0, sy: 0 });

  assert(result, 'shot modifiers result exists');
  assertEqual(result.extraProjectiles, 1, 'level-0 multishot still applies immediately');
  assertEqual(result.pendingCascadeMods.length, 1, 'arcade stays deferred as cascade modifier');
  assertEqual(result.pendingCascadeMods[0].modId, 7, 'deferred cascade modifier remains arcade');
});

test('CFX-6: Arcade as main modifier is deferred before secondary cascade modifiers', () => {
  const api = createChipEffectsApi(deepClone(chipsConfig), {
    HangarChipsUI: {
      getCells: function () {
        return [{ activeModifiers: [{ modId: 7, order: 0 }, { modId: 1, order: 1 }] }];
      }
    }
  });

  const result = api.applyShotModifiers({ cellIndex: 0, tank: {}, stats: {}, targets: [], sx: 0, sy: 0 });

  assert(result, 'shot modifiers result exists');
  assertEqual(result.extraProjectiles, 0, 'arcade no longer replaces the base shot at fire time');
  assertEqual(result.pendingCascadeMods.length, 2, 'arcade main keeps secondary cascade modifier behind it');
  assertEqual(result.pendingCascadeMods[0].modId, 7, 'arcade runs first in deferred cascade order');
  assertEqual(result.pendingCascadeMods[1].modId, 1, 'secondary modifier remains queued after arcade');
});

test('CFX-7: Arcade main preserves random-mod context before secondary cascade on child shots', () => {
  const api = createChipEffectsApi(deepClone(chipsConfig), {
    HangarChipsUI: {
      getCells: function () {
        return [{ activeModifiers: [{ modId: 7, order: 0 }, { modId: 1, order: 1 }] }];
      }
    }
  }, { randomValue: 0 });

  const shotMods = api.applyShotModifiers({ cellIndex: 0, tank: {}, stats: {}, targets: [], sx: 0, sy: 0 });
  const spawns = [];
  const zombies = [{ id: 9, state: 'alive', px: 240, py: 160 }];

  api.applyImpactEffects({
    shotMods,
    x: 120,
    y: 160,
    b: { dmg: 200, aoe: 50, level: 1, prof: {}, bulletCfg: {}, effectIntensity: 1, shotId: 1, tank: {} },
    zombies: zombies,
    getZombiePos: function (zombie) { return { x: zombie.px, y: zombie.py }; },
    addDecal: function () {},
    spawnProjectile: function (projectile) { spawns.push(projectile); },
  });

  assert(spawns.length > 0, 'arcade impact spawns child projectiles');
  assert(spawns[0].chipShotMods, 'arcade child keeps chipShotMods');
  assertEqual(spawns[0].chipShotMods.activeModIds[0], 1, 'deterministic arcade roll resolves to multishot first');
  assert(spawns[0].chipShotMods.activeModIds.indexOf(7) !== -1, 'arcade child keeps arcade source marker in activeModIds');
  assertEqual(spawns[0].chipShotMods.pendingCascadeMods.length, 1, 'secondary cascade stays queued for arcade child shots');
  assertEqual(spawns[0].chipShotMods.pendingCascadeMods[0].modId, 1, 'secondary multishot still triggers after arcade child explosion');
});

test('CFX-8: Arcade combo resolves directly into combo burst instead of accumulator shots', () => {
  const api = createChipEffectsApi(deepClone(chipsConfig), {
    HangarChipsUI: {
      getCells: function () {
        return [{ activeModifiers: [{ modId: 7, order: 0 }] }];
      }
    }
  }, { randomValue: 0.7 });

  const shotMods = api.applyShotModifiers({ cellIndex: 0, tank: {}, stats: {}, targets: [], sx: 0, sy: 0 });
  const spawns = [];
  const zombies = [
    { id: 11, state: 'alive', px: 240, py: 160 },
    { id: 12, state: 'alive', px: 280, py: 170 },
    { id: 13, state: 'alive', px: 320, py: 180 }
  ];

  api.applyImpactEffects({
    shotMods,
    x: 120,
    y: 160,
    b: { dmg: 200, aoe: 50, level: 1, prof: {}, bulletCfg: {}, bulletCfgBase: {}, effectIntensity: 1, shotId: 1, tank: {} },
    zombies: zombies,
    getZombiePos: function (zombie) { return { x: zombie.px, y: zombie.py }; },
    addDecal: function () {},
    spawnProjectile: function (projectile) { spawns.push(projectile); },
  });

  assertEqual(spawns.length, 3, 'arcade combo spawns the direct combo burst payload immediately');
  assertEqual(spawns[0].chipShotMods.activeModIds[0], 6, 'arcade combo child resolves to combo modifier visuals/runtime');
  assertEqual(spawns[0].chipShotMods.comboShots, 3, 'combo child keeps burst payload instead of accumulator state');
  assert(spawns[0].chipShotMods.activeModIds.indexOf(7) !== -1, 'combo child keeps arcade source marker');
});

test('CFX-9: merged bullet cfg prefers resolved arcade modifier visuals over Arcade Chaos atlas', () => {
  const api = createChipEffectsApi(deepClone(chipsConfig));
  const baseBulletCfg = {
    bulletSprite: { src: 'bullet_base.png' },
    impactSprite: { src: 'impact_base.png' }
  };

  const comboCfg = api.mergeBulletCfgOverride(baseBulletCfg, { activeModIds: [6, 7], isNuke: false }, { activeModIds: [6, 7], isNuke: false });
  const nukeCfg = api.mergeBulletCfgOverride(baseBulletCfg, { activeModIds: [8, 7], isNuke: false }, { activeModIds: [8, 7], isNuke: false });

  assertEqual(comboCfg.bulletSprite.src, 'bullet_combo.png', 'combo-resolved arcade child uses combo bullet sprite');
  assertEqual(comboCfg.impactSprite.src, 'impact_combo.png', 'combo-resolved arcade child uses combo impact sprite');
  assertEqual(nukeCfg.bulletSprite.src, 'bullet_nuke.png', 'nuke-resolved arcade child uses nuclear bullet sprite');
  assertEqual(nukeCfg.impactSprite.src, 'impact_nuke.png', 'non-proc nuke-resolved arcade child keeps normal impact sprite');
});

test('CFX-10: Arcade resolves the latest unlocked technology tier before spawning child shots', () => {
  const api = createChipEffectsApi(deepClone(chipsConfig), {
    HangarChips: {
      resolveLatestTechModId: function (modId) {
        if (modId === 8) return 28;
        return modId;
      }
    },
    HangarChipsUI: {
      getCells: function () {
        return [{ activeModifiers: [{ modId: 7, order: 0 }] }];
      }
    }
  }, { randomValue: 0.8 });

  const shotMods = api.applyShotModifiers({ cellIndex: 0, tank: {}, stats: {}, targets: [], sx: 0, sy: 0 });
  const spawns = [];
  const zombies = [{ id: 21, state: 'alive', px: 260, py: 160 }];

  api.applyImpactEffects({
    shotMods,
    x: 120,
    y: 160,
    b: { dmg: 200, aoe: 50, level: 1, prof: {}, bulletCfg: {}, bulletCfgBase: {}, effectIntensity: 1, shotId: 1, tank: {} },
    zombies: zombies,
    getZombiePos: function (zombie) { return { x: zombie.px, y: zombie.py }; },
    addDecal: function () {},
    spawnProjectile: function (projectile) { spawns.push(projectile); },
  });

  assert(spawns.length > 0, 'arcade nuke tech tier still spawns child projectiles');
  assertEqual(spawns[0].chipShotMods.activeModIds[0], 28, 'arcade child resolves to the highest unlocked nuclear tier');
  assert(spawns[0].chipShotMods.activeModIds.indexOf(7) !== -1, 'tech-tier arcade child still keeps arcade source marker');
});

test('CFX-11: calming tiers use 0.5 / 0.75 / 1.0 second suppression windows', () => {
  const api = createChipEffectsApi(deepClone(chipsConfig), {
    HangarChipsUI: {
      getCells: function () {
        return [{ activeModifiers: [{ modId: 9, order: 0 }] }];
      }
    }
  });
  const small = api.applyShotModifiers({ cellIndex: 0, tank: {}, stats: {}, targets: [], sx: 0, sy: 0 });
  assertEqual(small.calmDuration, 0.5, 'tier I calming uses 0.5 seconds');

  const api2 = createChipEffectsApi(deepClone(chipsConfig), {
    HangarChipsUI: {
      getCells: function () {
        return [{ activeModifiers: [{ modId: 29, order: 0 }] }];
      }
    }
  });
  const medium = api2.applyShotModifiers({ cellIndex: 0, tank: {}, stats: {}, targets: [], sx: 0, sy: 0 });
  assertEqual(medium.calmDuration, 0.75, 'tier II calming uses 0.75 seconds');

  const api3 = createChipEffectsApi(deepClone(chipsConfig), {
    HangarChipsUI: {
      getCells: function () {
        return [{ activeModifiers: [{ modId: 30, order: 0 }] }];
      }
    }
  });
  const large = api3.applyShotModifiers({ cellIndex: 0, tank: {}, stats: {}, targets: [], sx: 0, sy: 0 });
  assertEqual(large.calmDuration, 1.0, 'tier III calming uses 1 second');
});

test('CFX-12: calming counts successful debuffs per zombie and grants 30-second immunity after 10 hits', () => {
  const clockRef = { now: 0 };
  const api = createChipEffectsApi(deepClone(chipsConfig), null, { clockRef: clockRef });
  const zombie = { id: 42, state: 'alive', attackState: 'attack', px: 120, py: 160, calmUntil: 0, calmHitCount: 0, calmImmuneUntil: 0, calmRecoveryPendingAttack: false };

  function applyCalm(nowMs) {
    clockRef.now = nowMs;
    api.applyImpactEffects({
      shotMods: { isCalming: true, calmDuration: 1.0, calmRadius: 40 },
      x: 120,
      y: 160,
      b: { dmg: 50, aoe: 40 },
      zombies: [zombie],
      getZombiePos: function (targetZombie) { return { x: targetZombie.px, y: targetZombie.py }; },
      addDecal: function () {},
    });
  }

  for (let index = 1; index <= 10; index++) {
    zombie.calmRecoveryPendingAttack = false;
    applyCalm(index * 1000);
  }

  const calmUntilAfterTenthHit = zombie.calmUntil;
  assertEqual(zombie.calmHitCount, 0, 'counter resets after the 10th successful calming hit');
  assertEqual(zombie.calmImmuneUntil, 40, '10 successful calming hits grant 30 seconds of immunity');

  applyCalm(11000);
  assertEqual(zombie.calmUntil, calmUntilAfterTenthHit, 'immune zombie ignores calming hits until immunity expires');

  zombie.calmRecoveryPendingAttack = false;
  applyCalm(41000);
  assert(zombie.calmUntil > calmUntilAfterTenthHit, 'calming can affect the zombie again after immunity ends');
  assertEqual(zombie.calmHitCount, 1, 'counter restarts after immunity expires');
});

test('CFX-13: calming hits do not stack or refresh while the zombie is already suppressed', () => {
  const clockRef = { now: 0 };
  const api = createChipEffectsApi(deepClone(chipsConfig), null, { clockRef: clockRef });
  const zombie = { id: 77, state: 'alive', attackState: 'attack', px: 120, py: 160, calmUntil: 0, calmHitCount: 0, calmImmuneUntil: 0, calmRecoveryPendingAttack: false };

  function applyCalm(nowMs) {
    clockRef.now = nowMs;
    api.applyImpactEffects({
      shotMods: { isCalming: true, calmDuration: 1.0, calmRadius: 40 },
      x: 120,
      y: 160,
      b: { dmg: 50, aoe: 40 },
      zombies: [zombie],
      getZombiePos: function (targetZombie) { return { x: targetZombie.px, y: targetZombie.py }; },
      addDecal: function () {},
    });
  }

  applyCalm(1000);
  const firstCalmUntil = zombie.calmUntil;
  const firstHitCount = zombie.calmHitCount;

  applyCalm(1200);

  assertEqual(zombie.calmUntil, firstCalmUntil, 'second calming hit inside active window does not refresh calmUntil');
  assertEqual(zombie.calmHitCount, firstHitCount, 'second calming hit inside active window is ignored until the zombie lands its next attack');
});

test('CFX-14: calming stays blocked after calmUntil ends until the zombie lands its next attack', () => {
  const clockRef = { now: 0 };
  const api = createChipEffectsApi(deepClone(chipsConfig), null, { clockRef: clockRef });
  const zombie = { id: 88, state: 'alive', attackState: 'attack', px: 120, py: 160, calmUntil: 0, calmHitCount: 0, calmImmuneUntil: 0, calmRecoveryPendingAttack: false };

  function applyCalm(nowMs) {
    clockRef.now = nowMs;
    api.applyImpactEffects({
      shotMods: { isCalming: true, calmDuration: 1.0, calmRadius: 40 },
      x: 120,
      y: 160,
      b: { dmg: 50, aoe: 40 },
      zombies: [zombie],
      getZombiePos: function (targetZombie) { return { x: targetZombie.px, y: targetZombie.py }; },
      addDecal: function () {},
    });
  }

  applyCalm(1000);
  const firstCalmUntil = zombie.calmUntil;

  applyCalm(2200);

  assertEqual(zombie.calmUntil, firstCalmUntil, 'new calming hit is still ignored after calmUntil if the zombie has not attacked again yet');
  assertEqual(zombie.calmHitCount, 1, 'counter does not advance again until the zombie completes another real attack');
});

test('CFX-15: calming does not suppress zombies that are only walking and not attacking yet', () => {
  const clockRef = { now: 0 };
  const api = createChipEffectsApi(deepClone(chipsConfig), null, { clockRef: clockRef });
  const zombie = { id: 99, state: 'alive', attackState: 'walk', px: 120, py: 160, calmUntil: 0, calmHitCount: 0, calmImmuneUntil: 0, calmRecoveryPendingAttack: false };

  clockRef.now = 1000;
  api.applyImpactEffects({
    shotMods: { isCalming: true, calmDuration: 0.5, calmRadius: 40 },
    x: 120,
    y: 160,
    b: { dmg: 50, aoe: 40 },
    zombies: [zombie],
    getZombiePos: function (targetZombie) { return { x: targetZombie.px, y: targetZombie.py }; },
    addDecal: function () {},
  });

  assertEqual(zombie.calmUntil, 0, 'walking zombie does not receive a future calm window');
  assertEqual(zombie.calmHitCount, 0, 'walking zombie does not consume calm hit counter');
});

console.log('\n═══════════════════════════');
console.log('ChipEffectVisualToggle: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);