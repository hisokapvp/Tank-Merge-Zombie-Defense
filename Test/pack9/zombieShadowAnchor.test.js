/**
 * Pack 9 — Zombie shadow anchor-offset verification.
 * Ensures shadow / aura / level-ring positions account for per-type anchor.
 * Run: node Test/pack9/zombieShadowAnchor.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}
function test(name, fn) {
  try { fn(); passCount++; console.log('  \u2713 ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  \u2717 ' + name + ' \u2014 ' + e.message); }
}

const path = require('path');
const root = path.resolve(__dirname, '../..');

// --- load module ---
global.Game = global.Game || {};
global.window = global;
require(path.join(root, 'src/render/zombieRender.js'));
const createController = Game.ZombieRender.createController;

// --- helpers ---
function mockCtx() {
  const calls = [];
  const noop = function () {};
  return {
    calls,
    save: noop,
    restore: noop,
    beginPath: noop,
    fill: noop,
    stroke: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    fillRect: noop,
    scale: noop,
    rotate: noop,
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    translate: function (tx, ty) { calls.push({ fn: 'translate', args: [tx, ty] }); },
    ellipse: function (cx, cy, rx, ry) { calls.push({ fn: 'ellipse', args: [cx, cy, rx, ry] }); },
    arc: function (cx, cy, r) { calls.push({ fn: 'arc', args: [cx, cy, r] }); },
    drawImage: noop,
  };
}

function makeDeps(ctx) {
  return {
    getCtx: function () { return ctx; },
    getZombieSprites: function () {
      return {
        ready: true,
        atlasImg: { naturalWidth: 512, naturalHeight: 512 },
        getAtlasImage: function () { return { naturalWidth: 512, naturalHeight: 512 }; },
      };
    },
    getBalance: function () {
      return {
        zombieScaleMul: 1,
        zombieBobAmp: 0,
        zombieGroundOffset: 0,
        zombieShadowY: 10,
        zombieShadowW: 8,
        zombieShadowH: 4,
      };
    },
    getCenter: function () { return { x: 400, y: 300 }; },
    zombieLevelScale: function () { return 1; },
    getState: function () { return { endgameVisuals: false }; },
    isQualityLow: function () { return false; },
    clamp: function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
    nowSec: function () { return 0; },
    getZombieCorpseFadeOutSec: function () { return 2; },
    shade: function (c) { return c; },
    getZombieDefaultAttackFps: function () { return 8; },
    getZombieBalanceMul: function () { return 1; },
  };
}

function makeZombie(anchor, anchorShadow) {
  return {
    state: 'walk',
    type: {
      id: 'test',
      frame: { x: 0, y: 0, w: 64, h: 64 },
      frames: 4,
      anchor: anchor,
      anchorShadow: anchorShadow || { x: 0, y: 0 },
      scale: 1,
      rotation: 0,
      shadowScale: 1,
    },
    level: 1,
    walkAnimFrame: 0,
    anim: 0,
    theta: 0,
    omega: 1,
  };
}

// --- tests ---
console.log('\n\u2550\u2550 Zombie shadow anchor offset \u2550\u2550');

test('default anchor {0.5, 0.75} produces zero offset', function () {
  var ctx = mockCtx();
  var deps = makeDeps(ctx);
  var ctrl = createController(deps);
  var z = makeZombie({ x: 0.5, y: 0.75 });
  var img = { naturalWidth: 512, naturalHeight: 512 };
  ctrl.drawZombieSprite(100, 200, z, img, false);
  var ellipses = ctx.calls.filter(function (c) { return c.fn === 'ellipse'; });
  assert(ellipses.length >= 1, 'should draw shadow ellipse');
  var shadow = ellipses[0];
  // default anchor → no offset → shadow at (100, 200 + shadowY + groundOffset)
  assert(shadow.args[0] === 100, 'shadow X should be 100 for default anchor, got ' + shadow.args[0]);
  assert(shadow.args[1] === 210, 'shadow Y should be 210 (200+10+0) for default anchor, got ' + shadow.args[1]);
});

test('anchor {0.5, 0.5} shifts shadow down by (0.75-0.5)*64*1 = 16', function () {
  var ctx = mockCtx();
  var deps = makeDeps(ctx);
  var ctrl = createController(deps);
  var z = makeZombie({ x: 0.5, y: 0.5 });
  var img = { naturalWidth: 512, naturalHeight: 512 };
  ctrl.drawZombieSprite(100, 200, z, img, false);
  var ellipses = ctx.calls.filter(function (c) { return c.fn === 'ellipse'; });
  assert(ellipses.length >= 1, 'should draw shadow ellipse');
  var shadow = ellipses[0];
  // anchorOffsetY = (0.75 - 0.5) * 64 * 1 = 16
  assert(shadow.args[0] === 100, 'shadow X should be 100, got ' + shadow.args[0]);
  var expectedY = 200 + 10 + 0 + 16; // y + shadowY + groundOffset + anchorOffsetY
  assert(Math.abs(shadow.args[1] - expectedY) < 0.01,
    'shadow Y should be ' + expectedY + ', got ' + shadow.args[1]);
});

test('anchor {0.3, 0.9} shifts shadow left and up', function () {
  var ctx = mockCtx();
  var deps = makeDeps(ctx);
  var ctrl = createController(deps);
  var z = makeZombie({ x: 0.3, y: 0.9 });
  var img = { naturalWidth: 512, naturalHeight: 512 };
  ctrl.drawZombieSprite(100, 200, z, img, false);
  var ellipses = ctx.calls.filter(function (c) { return c.fn === 'ellipse'; });
  assert(ellipses.length >= 1, 'should draw shadow ellipse');
  var shadow = ellipses[0];
  // anchorOffsetX = (0.5 - 0.3) * 64 * 1 = 12.8
  // anchorOffsetY = (0.75 - 0.9) * 64 * 1 = -9.6
  var expectedX = 100 + 12.8;
  var expectedY = 200 + 10 + 0 + (-9.6);
  assert(Math.abs(shadow.args[0] - expectedX) < 0.01,
    'shadow X should be ' + expectedX + ', got ' + shadow.args[0]);
  assert(Math.abs(shadow.args[1] - expectedY) < 0.01,
    'shadow Y should be ' + expectedY + ', got ' + shadow.args[1]);
});

test('attack animation does not change shadow anchor offset (uses walk frame)', function () {
  var ctx = mockCtx();
  var deps = makeDeps(ctx);
  var ctrl = createController(deps);
  var z = makeZombie({ x: 0.5, y: 0.5 });
  z.attackState = 'attack';
  z.attackAnimTimeSec = 0;
  z.attackFrameRateFps = 8;
  z.type.attack = { x: 0, y: 64, w: 96, h: 96, frames: 4 };
  var img = { naturalWidth: 512, naturalHeight: 512 };
  ctrl.drawZombieSprite(100, 200, z, img, false);
  var ellipses = ctx.calls.filter(function (c) { return c.fn === 'ellipse'; });
  assert(ellipses.length >= 1, 'should draw shadow ellipse');
  var shadow = ellipses[0];
  // Even though attack uses 96x96 frames, anchor offset uses walk frame 64x64
  // anchorOffsetY = (0.75 - 0.5) * 64 * 1 = 16, NOT (0.75 - 0.5) * 96
  var expectedY = 200 + 10 + 0 + 16;
  assert(Math.abs(shadow.args[1] - expectedY) < 0.01,
    'shadow Y should use walk frame dims (' + expectedY + '), got ' + shadow.args[1]);
});

test('dying zombie skips shadow (isDying guard preserved)', function () {
  var ctx = mockCtx();
  var deps = makeDeps(ctx);
  var ctrl = createController(deps);
  var z = makeZombie({ x: 0.5, y: 0.5 });
  z.state = 'dying';
  z.deathProgress = 0.5;
  z.deathTimer = 0;
  z.corpseTimerLeft = 1;
  var img = { naturalWidth: 512, naturalHeight: 512 };
  ctrl.drawZombieSprite(100, 200, z, img, false);
  var ellipses = ctx.calls.filter(function (c) { return c.fn === 'ellipse'; });
  assert(ellipses.length === 0, 'dying zombie should NOT draw shadow ellipse, got ' + ellipses.length);
});

test('fallback path does NOT apply anchor offset (body is not anchor-shifted)', function () {
  var ctx = mockCtx();
  var deps = makeDeps(ctx);
  var ctrl = createController(deps);
  var z = makeZombie({ x: 0.5, y: 0.5 });
  ctrl.drawZombieFallback(100, 200, z);
  var ellipses = ctx.calls.filter(function (c) { return c.fn === 'ellipse'; });
  assert(ellipses.length >= 1, 'should draw shadow ellipse');
  var shadow = ellipses[0];
  // Fallback does not use anchor for body, so shadow should be at base position
  assert(shadow.args[0] === 100, 'fallback shadow X should be 100, got ' + shadow.args[0]);
  assert(shadow.args[1] === 210, 'fallback shadow Y should be 210 (200+10+0), got ' + shadow.args[1]);
});

test('anchor_shadow {0, 5} shifts shadow down by 5*scale', function () {
  var ctx = mockCtx();
  var deps = makeDeps(ctx);
  var ctrl = createController(deps);
  var z = makeZombie({ x: 0.5, y: 0.75 }, { x: 0, y: 5 });
  var img = { naturalWidth: 512, naturalHeight: 512 };
  ctrl.drawZombieSprite(100, 200, z, img, false);
  var ellipses = ctx.calls.filter(function (c) { return c.fn === 'ellipse'; });
  assert(ellipses.length >= 1, 'should draw shadow ellipse');
  var shadow = ellipses[0];
  // anchorOffset = 0 (default anchor), shadowShift = 0 + 5*1 = 5
  assert(shadow.args[0] === 100, 'shadow X should be 100, got ' + shadow.args[0]);
  var expectedY = 200 + 10 + 0 + 0 + 5; // y + shadowY + gnd + anchorOff + shadowShift
  assert(Math.abs(shadow.args[1] - expectedY) < 0.01,
    'shadow Y should be ' + expectedY + ' with anchor_shadow.y=5, got ' + shadow.args[1]);
});

test('anchor_shadow {-3, 0} shifts shadow left by 3*scale', function () {
  var ctx = mockCtx();
  var deps = makeDeps(ctx);
  var ctrl = createController(deps);
  var z = makeZombie({ x: 0.5, y: 0.75 }, { x: -3, y: 0 });
  var img = { naturalWidth: 512, naturalHeight: 512 };
  ctrl.drawZombieSprite(100, 200, z, img, false);
  var ellipses = ctx.calls.filter(function (c) { return c.fn === 'ellipse'; });
  assert(ellipses.length >= 1, 'should draw shadow ellipse');
  var shadow = ellipses[0];
  var expectedX = 100 + 0 + (-3); // x + anchorOffX + shadowShiftX
  assert(Math.abs(shadow.args[0] - expectedX) < 0.01,
    'shadow X should be ' + expectedX + ' with anchor_shadow.x=-3, got ' + shadow.args[0]);
});

test('anchor_shadow combines with anchor offset', function () {
  var ctx = mockCtx();
  var deps = makeDeps(ctx);
  var ctrl = createController(deps);
  var z = makeZombie({ x: 0.5, y: 0.5 }, { x: 2, y: -3 });
  var img = { naturalWidth: 512, naturalHeight: 512 };
  ctrl.drawZombieSprite(100, 200, z, img, false);
  var ellipses = ctx.calls.filter(function (c) { return c.fn === 'ellipse'; });
  assert(ellipses.length >= 1, 'should draw shadow ellipse');
  var shadow = ellipses[0];
  // anchorOffsetX = 0, anchorOffsetY = (0.75-0.5)*64 = 16
  // shadowShiftX = 2*1 = 2, shadowShiftY = -3*1 = -3
  var expectedX = 100 + 0 + 2;
  var expectedY = 200 + 10 + 0 + 16 + (-3);
  assert(Math.abs(shadow.args[0] - expectedX) < 0.01,
    'shadow X should be ' + expectedX + ', got ' + shadow.args[0]);
  assert(Math.abs(shadow.args[1] - expectedY) < 0.01,
    'shadow Y should be ' + expectedY + ', got ' + shadow.args[1]);
});

// --- summary ---
console.log('\n' + '\u2550'.repeat(32));
console.log('RESULTS: ' + passCount + ' passed, ' + failCount + ' failed');
console.log('\u2550'.repeat(32));
if (failures.length) {
  failures.forEach(function (f) { console.log('  FAIL: ' + f.name + ' \u2014 ' + f.error); });
}
process.exit(failCount > 0 ? 1 : 0);
