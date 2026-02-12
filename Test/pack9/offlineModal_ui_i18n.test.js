/**
 * Pack 9 — Offline modal UI/i18n tests.
 * Run: node Test/pack9/offlineModal_ui_i18n.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || 'assertEqual') + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}
function test(name, fn) {
  try { fn(); passCount++; console.log('  ✓ ' + name); }
  catch (e) { failCount++; failures.push({ name: name, error: e.message }); console.log('  ✗ ' + name + ' — ' + e.message); }
}

const global = globalThis;
global.window = global;

global.Game = {
  NumberFormat: {
    formatShortNumber: function (n) { return 'N' + String(Math.round(n)); }
  }
};

const fs = require('fs');
const path = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', code);
  fn(global, global, {}, console);
}

function createMockCtx() {
  return {
    save: function () {},
    restore: function () {},
    fillRect: function () {},
    fill: function () {},
    stroke: function () {},
    beginPath: function () {},
    moveTo: function () {},
    lineTo: function () {},
    arcTo: function () {},
    closePath: function () {},
    fillText: function () {},
  };
}

loadModule('src/ui/offlineModal.js');

const OfflineModal = global.Game.OfflineModal;

console.log('\n── Pack 9: Offline modal UI/i18n ──');

test('OM-1: resolveT prefers global t', () => {
  const calls = { t: 0, i18n: 0, game: 0 };
  global.t = function (key) { calls.t++; return 'T:' + key; };
  global.Game.I18n = { t: function (key) { calls.i18n++; return 'I:' + key; } };
  global.Game.t = function (key) { calls.game++; return 'G:' + key; };

  OfflineModal.showOfflineRewardsModal({ coins: 1200, xp: 3400 });
  const model = OfflineModal.getUiModel({ w: 800, h: 600 });

  assertEqual(model.title, 'T:offlineOfferTitle');
  assert(calls.t > 0, 'global t called');
  assertEqual(calls.i18n, 0, 'I18n.t not called');
  assertEqual(calls.game, 0, 'Game.t not called');

  delete global.t;
  delete global.Game.I18n;
  delete global.Game.t;
});

test('OM-2: resolveT uses Game.I18n.t when global t missing', () => {
  const calls = { i18n: 0 };
  global.Game.I18n = { t: function (key) { calls.i18n++; return 'I:' + key; } };

  OfflineModal.showOfflineRewardsModal({ coins: 1200, xp: 3400 });
  const model = OfflineModal.getUiModel({ w: 800, h: 600 });

  assertEqual(model.title, 'I:offlineOfferTitle');
  assert(calls.i18n > 0, 'I18n.t called');

  delete global.Game.I18n;
});

test('OM-3: resolveT uses Game.t when others missing', () => {
  const calls = { game: 0 };
  global.Game.t = function (key) { calls.game++; return 'G:' + key; };

  OfflineModal.showOfflineRewardsModal({ coins: 1200, xp: 3400 });
  const model = OfflineModal.getUiModel({ w: 800, h: 600 });

  assertEqual(model.title, 'G:offlineOfferTitle');
  assert(calls.game > 0, 'Game.t called');

  delete global.Game.t;
});

test('OM-4: fallback strings and formatter used when no i18n', () => {
  OfflineModal.showOfflineRewardsModal({ coins: 1200, xp: 3400 });
  const model = OfflineModal.getUiModel({ w: 800, h: 600 });

  assertEqual(model.title, 'Посмотри рекламу и получи упущенное');
  assertEqual(model.coinsText, 'Монет - N1200');
  assertEqual(model.xpText, 'Опыта - N3400');
});

test('OM-5: close button closes without rewards; overlay click blocks', () => {
  let confirmed = 0;
  OfflineModal.showOfflineRewardsModal({
    coins: 10,
    xp: 20,
    onConfirm: function () { confirmed++; }
  });

  const ctx = createMockCtx();
  const viewport = { w: 800, h: 600 };
  OfflineModal.render(ctx, viewport);
  const model = OfflineModal.getUiModel(viewport);

  assert(model.claimRect.w > 0 && model.claimRect.h > 0, 'claimRect valid');
  assert(model.closeRect.w > 0 && model.closeRect.h > 0, 'closeRect valid');

  const outsideHandled = OfflineModal.handleInput({ x: 2, y: 2 });
  assertEqual(outsideHandled, true, 'overlay click consumed');
  assertEqual(confirmed, 0, 'no confirm on overlay click');

  const closePoint = {
    x: model.closeRect.x + model.closeRect.w / 2,
    y: model.closeRect.y + model.closeRect.h / 2
  };
  OfflineModal.handleInput(closePoint);
  assertEqual(OfflineModal.isVisible(), false, 'modal closed');
  assertEqual(confirmed, 0, 'no confirm on close');

  OfflineModal.showOfflineRewardsModal({
    coins: 10,
    xp: 20,
    onConfirm: function () { confirmed++; }
  });
  OfflineModal.render(ctx, viewport);
  const model2 = OfflineModal.getUiModel(viewport);
  const claimPoint = {
    x: model2.claimRect.x + model2.claimRect.w / 2,
    y: model2.claimRect.y + model2.claimRect.h / 2
  };
  OfflineModal.handleInput(claimPoint);
  assertEqual(confirmed, 1, 'confirm on claim');
});

console.log('\n═══════════════════════════');
console.log('OfflineModal UI/i18n: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
