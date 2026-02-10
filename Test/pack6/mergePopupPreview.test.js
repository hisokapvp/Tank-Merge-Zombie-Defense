/**
 * Pack 6 — Merge popup preview tests.
 * Run: node Test/pack6/mergePopupPreview.test.js
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
function test(name, fn) {
  try { fn(); passCount++; console.log('  ✓ ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  ✗ ' + name + ' — ' + e.message); }
}

const global = globalThis;
global.window = global;

let flagState = { bodyFlag: false };

global.Game = {
  Flags: {
    get: (name) => !!flagState[name]
  }
};

global.TankSprites = {
  config: {
    body: { src: 'tanks/body_default.png', frame: { w: 10, h: 10 }, frames: 1 },
    bodies: {
      body_a: { src: 'tanks/body_a.png', frame: { w: 10, h: 10 }, frames: 1 },
      body_b: { src: 'tanks/body_b.png', frame: { w: 10, h: 10 }, frames: 1 }
    },
    cannons: [
      { id: 'c1', minLevel: 1, src: 'tanks/c1.png', frame: { w: 10, h: 10 }, frames: 4, animSpeed: 4, fireFrame: 1, muzzle: { x: 10, y: 0 } },
      { id: 'c2', minLevel: 5, src: 'tanks/c2.png', frame: { w: 10, h: 10 }, frames: 4, animSpeed: 4, fireFrame: 1, muzzle: { x: 10, y: 0 } }
    ],
    auras: {
      aura_a: { src: 'tanks/aura.png', frameWidth: 10, frameHeight: 10, frames: [{ x: 0, y: 0 }], animation: { frameRate: 1 } }
    },
    levels: [
      {
        bodyVariant: { variants: ['body_b', 'body_a'], default: 'body_b', flag: 'bodyFlag' },
        cannonVariant: 'c1',
        auraVariant: 'aura_a'
      },
      {
        cannonVariant: 'c1'
      },
      {
        bodyVariant: 'body_a',
        cannonVariant: 'missing',
        auraVariant: 2
      }
    ]
  },
  cache: new Map([
    ['assets/tanks/body_default.png', {}],
    ['assets/tanks/body_a.png', {}],
    ['assets/tanks/body_b.png', {}],
    ['assets/tanks/c1.png', {}],
    ['assets/tanks/c2.png', {}],
    ['assets/tanks/aura.png', {}]
  ])
};

const fs = require('fs');
const path = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', code);
  fn(global, global, {}, console);
}

loadModule('src/utils/tankConfig.js');
loadModule('src/render/tankPortrait.js');
loadModule('src/ui/mergePreview/mergePreviewModel.js');

const TankConfig = global.Game.TankConfig;
const MergePreviewModel = global.Game.MergePreviewModel;

console.log('\n── Pack 6: Merge popup preview ──');

test('MPV-1: default variant used when flag is off', () => {
  flagState.bodyFlag = false;
  const spec = TankConfig.getTankVisualSpec(1);
  assertEqual(spec.bodyVariant, 'body_b');
});

test('MPV-2: flagged variant used when flag is on', () => {
  flagState.bodyFlag = true;
  const spec = TankConfig.getTankVisualSpec(1);
  assertEqual(spec.bodyVariant, 'body_a');
});

test('MPV-3: cannon fallback uses minLevel when variant missing', () => {
  const spec = TankConfig.getTankVisualSpec(3);
  assertEqual(spec.cannonVariant, 'c1');
});

test('MPV-4: aura band preserved for numeric variant', () => {
  const spec = TankConfig.getTankVisualSpec(3);
  assertEqual(spec.auraBand, 2);
});

test('MPV-5: preview model updates and emits shots', () => {
  const model = MergePreviewModel.createModel();
  MergePreviewModel.reset(model, { level: 3 });
  MergePreviewModel.setLayout(model, 200, 120);
  MergePreviewModel.setTankPositions(model, model.layout.leftX, model.layout.rightX, model.layout.centerX, model.layout.centerY);
  MergePreviewModel.update(model, 0.3);
  const hasShot = model.shots.some(s => s.active);
  assert(hasShot, 'shots active');
});

console.log('\n═══════════════════════════');
console.log('MergePopupPreview: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
