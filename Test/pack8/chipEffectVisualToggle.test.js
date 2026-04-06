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

function createChipEffectsApi(config) {
  function FakeImage() {
    this.complete = true;
    this.naturalWidth = 64;
    this.naturalHeight = 64;
    this.src = '';
  }

  const sandbox = {
    console: console,
    performance: { now: function () { return 0; } },
    Image: FakeImage,
    window: { Game: {} },
  };
  sandbox.window.Image = FakeImage;
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

console.log('\n═══════════════════════════');
console.log('ChipEffectVisualToggle: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);