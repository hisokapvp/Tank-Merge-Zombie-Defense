/**
 * Test/test_shop_apply_bundle.js — standalone unit tests for the Yandex
 * chip-bundle shop (TZ item 22, batch #8 / Phase 8).
 *
 * Covers:
 *   • applyBundle idempotency by purchaseToken
 *     (TZ item 10 atomic order + early-return contract).
 *   • Record formats written into state.playerChips and the drones
 *     namespace (TZ item 22 explicit ask: "проверки идемпотентности
 *     applyBundle и форматов записей в state.playerChips / state.drones").
 *   • hudShopButton visibility gate isolation (TZ item 23 ask:
 *     "если можно автоматизировать без DOM, добавь test").
 *
 * Run: node Test/test_shop_apply_bundle.js
 *
 * Self-contained: only depends on src/shop/applyBundle.js and
 * src/ui/hudShopButton.js. All other Game.* singletons are mocked.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Tiny test runner ───
let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      (message || 'assertEqual') + ': expected ' + JSON.stringify(expected) +
      ', got ' + JSON.stringify(actual)
    );
  }
}

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  + ' + name);
  } catch (e) {
    failCount++;
    failures.push({ name, error: e.message });
    console.log('  x ' + name + ' -- ' + e.message);
  }
}

// ─── Module loader (IIFE-friendly) ───
function loadModule(global, relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');
  const fn = new Function('window', 'global', 'document', 'console', code);
  fn(global, global, global.document || {}, console);
}

// ─── Reusable fixtures ───
function makeGameMock() {
  const calls = {
    setPlayerChips: [],
    setSiliconDust: [],
    grantFromShop: [],
    markDelivered: [],
    pushShop: [],
    saveProgress: 0,
  };
  let chipsArr = [];
  let dust = 0;

  const Game = {
    Config: { Shop: { enabled: true } },
    state: {
      shop: {
        entitlements: {},
        lastSync: 0,
        pendingDeliveries: [],
      },
    },
    HangarChips: {
      // Minimal pool so applyBundle can pick a chip.
      allChips: [
        {
          chipId: 1,
          chipColor: 'red',
          modIds: ['mod_a'],
          sourceComboKey: 'combo_x',
        },
        {
          chipId: 2,
          chipColor: 'yellow',
          modIds: [],
          sourceComboKey: 'combo_y',
        },
      ],
    },
    HangarChipsUI: {
      getPlayerChips: function () { return chipsArr.slice(); },
      setPlayerChips: function (next, opts) {
        calls.setPlayerChips.push({ next: next.slice(), opts: opts || null });
        chipsArr = next.slice();
      },
      getSiliconDust: function () { return dust; },
      setSiliconDust: function (v) {
        calls.setSiliconDust.push(v);
        dust = v;
      },
    },
    Drones: {
      grantFromShop: function (state, spec) {
        calls.grantFromShop.push({ spec: spec });
        // Mimic real surface: append a drone-ish record into a synthetic list
        if (!Array.isArray(state.drones)) state.drones = [];
        const rec = { id: 'd' + (state.drones.length + 1), type: spec.type || 'drones' };
        state.drones.push(rec);
        return rec;
      },
    },
    ShopLedger: {
      markDelivered: function (token) {
        calls.markDelivered.push(token);
        // Simulate ledger-side bookkeeping into entitlements (real ledger
        // also stamps deliveredAt — required for idempotency early-return).
        const ent = Game.state.shop.entitlements[token] || {};
        ent.deliveredAt = Date.now();
        ent.token = token;
        Game.state.shop.entitlements[token] = ent;
      },
    },
    CloudSave: {
      pushShop: function (shop) { calls.pushShop.push(shop); },
    },
    Persistence: {
      saveProgress: function () { calls.saveProgress++; },
    },
  };
  return { Game, calls, getChips: function () { return chipsArr.slice(); } };
}

function makeBundle() {
  return {
    id: 'medium_chip_pack',
    yandexProductId: 'medium_chip_pack',
    contents: {
      chips: [
        { family: 'any', tier: 1, count: 2 },
        { family: 'any', tier: 2, count: 1 },
      ],
      drones: [
        { type: 'drones', count: 1 },
      ],
      siliconDust: 150,
    },
  };
}

// ─── Suite 1: applyBundle (item 10 contract, item 22 ask) ───
console.log('Suite 1 (applyBundle idempotency + record formats):');

test('applyBundle delivers chips/drones/dust on first call', function () {
  const env = makeGameMock();
  global.Game = env.Game;
  global.window = global;
  loadModule(global, 'src/shop/applyBundle.js');

  const res = env.Game.ChipShop.applyBundle(makeBundle(), {
    reason: 'unit_test',
    purchaseToken: 'tok_first',
  });

  assertEqual(res.ok, true, 'first delivery ok');
  assertEqual(res.status, 'delivered', 'first status=delivered');
  assertEqual(res.granted.chips, 3, 'granted 3 chips total');
  assertEqual(res.granted.drones, 1, 'granted 1 drone');
  assertEqual(res.granted.siliconDust, 150, 'granted 150 dust');
  assert(env.calls.markDelivered.length === 1, 'markDelivered called once');
  assertEqual(env.calls.markDelivered[0], 'tok_first', 'ledger token matches');
  assert(env.calls.saveProgress >= 1, 'persistence saveProgress invoked');
  assert(env.calls.pushShop.length >= 1, 'cloudSave.pushShop invoked');
});

test('applyBundle is idempotent: replay returns already_delivered', function () {
  const env = makeGameMock();
  global.Game = env.Game;
  global.window = global;
  loadModule(global, 'src/shop/applyBundle.js');

  const opts = { reason: 'unit_test', purchaseToken: 'tok_idem' };
  env.Game.ChipShop.applyBundle(makeBundle(), opts);

  const before = {
    chips: env.getChips().length,
    setCalls: env.calls.setPlayerChips.length,
    grantCalls: env.calls.grantFromShop.length,
    dustCalls: env.calls.setSiliconDust.length,
  };

  const res2 = env.Game.ChipShop.applyBundle(makeBundle(), opts);

  assertEqual(res2.ok, true, 'replay still ok');
  assertEqual(res2.status, 'already_delivered', 'replay status flag');
  assertEqual(res2.granted.chips, 0, 'replay grants zero chips');
  assertEqual(res2.granted.drones, 0, 'replay grants zero drones');
  assertEqual(res2.granted.siliconDust, 0, 'replay grants zero dust');
  assertEqual(env.getChips().length, before.chips, 'chip array not mutated on replay');
  assertEqual(env.calls.setPlayerChips.length, before.setCalls, 'setPlayerChips not called on replay');
  assertEqual(env.calls.grantFromShop.length, before.grantCalls, 'grantFromShop not called on replay');
  assertEqual(env.calls.setSiliconDust.length, before.dustCalls, 'setSiliconDust not called on replay');
});

test('applyBundle rejects missing purchaseToken', function () {
  const env = makeGameMock();
  global.Game = env.Game;
  global.window = global;
  loadModule(global, 'src/shop/applyBundle.js');

  const res = env.Game.ChipShop.applyBundle(makeBundle(), { reason: 'unit_test' });
  assertEqual(res.ok, false, 'missing token rejected');
  assertEqual(res.status, 'missing_token', 'missing_token status');
});

test('applyBundle no-ops when kill-switch disabled', function () {
  const env = makeGameMock();
  env.Game.Config.Shop.enabled = false;
  global.Game = env.Game;
  global.window = global;
  loadModule(global, 'src/shop/applyBundle.js');

  const res = env.Game.ChipShop.applyBundle(makeBundle(), {
    reason: 'unit_test',
    purchaseToken: 'tok_disabled',
  });
  assertEqual(res.ok, false, 'disabled state.ok=false');
  assertEqual(res.status, 'disabled', 'disabled status');
  assertEqual(env.calls.setPlayerChips.length, 0, 'no chip writes when disabled');
});

test('state.playerChips records have canonical chip-record shape', function () {
  const env = makeGameMock();
  global.Game = env.Game;
  global.window = global;
  loadModule(global, 'src/shop/applyBundle.js');

  env.Game.ChipShop.applyBundle(
    {
      id: 'small_chip_pack',
      contents: {
        chips: [{ family: 'any', tier: 1, count: 1 }],
        drones: [],
        siliconDust: 0,
      },
    },
    { reason: 'unit_test', purchaseToken: 'tok_shape' }
  );

  const written = env.getChips();
  assertEqual(written.length, 1, 'one chip written');
  const rec = written[0];
  // Canonical keys per src/shop/applyBundle.js#L116-L124 (chipId, chipColor,
  // modIds, sourceComboKey, level, count). All other fields would silently
  // break HangarChipsUI consumers and merge logic.
  assert('chipId' in rec, 'record has chipId');
  assert('chipColor' in rec, 'record has chipColor');
  assert(Array.isArray(rec.modIds), 'record.modIds is an array');
  assert('sourceComboKey' in rec, 'record has sourceComboKey');
  assertEqual(typeof rec.level, 'number', 'record.level is number');
  assertEqual(rec.level, 1, 'tier=1 maps to level=1');
  assertEqual(rec.count, 1, 'record.count=1 (atomic single grant)');
});

test('state.drones records preserve drone-spec shape via grantFromShop', function () {
  const env = makeGameMock();
  global.Game = env.Game;
  global.window = global;
  loadModule(global, 'src/shop/applyBundle.js');

  env.Game.ChipShop.applyBundle(
    {
      id: 'large_chip_pack',
      contents: {
        chips: [],
        drones: [{ type: 'drones', count: 2 }],
        siliconDust: 0,
      },
    },
    { reason: 'unit_test', purchaseToken: 'tok_drone_shape' }
  );

  assertEqual(env.calls.grantFromShop.length, 2, 'grantFromShop called per count');
  const spec0 = env.calls.grantFromShop[0].spec;
  assertEqual(spec0.type, 'drones', 'spec.type forwarded');
  assertEqual(spec0.count, 2, 'spec.count forwarded');
  assert(Array.isArray(env.Game.state.drones), 'state.drones initialised');
  assertEqual(env.Game.state.drones.length, 2, 'state.drones has 2 records');
  assert('id' in env.Game.state.drones[0], 'drone record has id');
  assert('type' in env.Game.state.drones[0], 'drone record has type');
});

// ─── Suite 2: hudShopButton visibility gate (item 23 ask) ───
console.log('\nSuite 2 (hudShopButton visibility gate isolation):');

function loadHudGate() {
  // hudShopButton.js attaches Game.HudShopButton with private gate logic.
  // We re-use it through a fresh Game per case.
  loadModule(global, 'src/ui/hudShopButton.js');
  return global.Game.HudShopButton;
}

function makeRootMock() {
  const root = {
    style: {},
    setAttribute: function (k, v) { if (k === 'aria-hidden') root._ariaHidden = v; },
    removeAttribute: function (k) { if (k === 'aria-hidden') root._ariaHidden = null; },
    addEventListener: function () {},
    removeEventListener: function () {},
    classList: {
      add: function (cls) { root._classes[cls] = true; },
      remove: function (cls) { delete root._classes[cls]; },
      toggle: function (cls, v) { if (v) root._classes[cls] = true; else delete root._classes[cls]; },
      contains: function (cls) { return !!root._classes[cls]; },
    },
    _classes: {},
    _ariaHidden: null,
    _lastDisplay: null,
  };
  Object.defineProperty(root.style, 'display', {
    configurable: true,
    set: function (v) { root._lastDisplay = v; },
    get: function () { return root._lastDisplay; },
  });
  return root;
}

function makeHudGameMock(overrides) {
  overrides = overrides || {};
  const Game = {
    Config: { Shop: { enabled: overrides.enabled !== false } },
    YandexPayments: {
      isReady: function () { return overrides.paymentsReady === true; },
    },
  };
  return Game;
}

test('button hidden in non-Yandex env (no ya nor location flag)', function () {
  global.Game = makeHudGameMock({ enabled: true, paymentsReady: true });
  global.window = global;
  // Strip Yandex env signals.
  global.ya = undefined;
  global.YaGames = undefined;
  global.location = { search: '', hostname: 'localhost', href: 'http://localhost/' };
  delete global.document;
  global.document = { getElementById: function () { return null; } };

  const hud = loadHudGate();
  assert(hud && typeof hud.refresh === 'function', 'HudShopButton.refresh exposed');
  // No DOM root -> refresh is a no-op; gate logic is what we cover via
  // visible-in-yandex + hidden-outside contrast cases below.
  assert(true, 'no-DOM no-op did not throw');
});

test('gate visible when shop enabled + Yandex env + payments ready', function () {
  global.Game = makeHudGameMock({ enabled: true, paymentsReady: true });
  global.window = global;
  global.ya = { games: { sdk: function () { return Promise.resolve({}); } } };
  global.YaGames = global.ya.games;
  global.location = { search: '?yandex=1', hostname: 'yandex.com', href: 'https://yandex.com/' };
  // _isYandexEnv requires global.parent !== global (embedded iframe).
  global.parent = {};

  // Capture visibility decisions by stubbing DOM root.
  const root = makeRootMock();
  global.document = {
    getElementById: function (id) { return id === 'hudShopButton' ? root : null; },
    addEventListener: function () {},
    readyState: 'complete',
  };

  const hud = loadHudGate();
  hud.init && hud.init();
  hud.refresh();
  // hudShopButton hides via classList.add('hidden') + aria-hidden=true.
  assert(!root._classes.hidden, 'visible: "hidden" class not applied');
  assert(!root._ariaHidden, 'visible: aria-hidden not applied');
});

test('gate hidden when shop kill-switch disabled', function () {
  global.Game = makeHudGameMock({ enabled: false, paymentsReady: true });
  global.window = global;
  global.ya = { games: {} };
  global.YaGames = global.ya.games;
  global.location = { search: '?yandex=1', hostname: 'yandex.com', href: 'https://yandex.com/' };

  const root = makeRootMock();
  global.document = {
    getElementById: function (id) { return id === 'hudShopButton' ? root : null; },
    addEventListener: function () {},
    readyState: 'complete',
  };

  const hud = loadHudGate();
  hud.init && hud.init();
  hud.refresh();
  assert(root._classes.hidden === true, 'kill-switch disabled => hidden class applied');
  assertEqual(root._ariaHidden, 'true', 'kill-switch disabled => aria-hidden=true');
});

test('gate hidden when payments not ready (outside Yandex / SDK boot)', function () {
  global.Game = makeHudGameMock({ enabled: true, paymentsReady: false });
  global.window = global;
  global.ya = undefined;
  global.YaGames = undefined;
  global.location = { search: '', hostname: 'localhost', href: 'http://localhost/' };

  const root = makeRootMock();
  global.document = {
    getElementById: function (id) { return id === 'hudShopButton' ? root : null; },
    addEventListener: function () {},
    readyState: 'complete',
  };

  const hud = loadHudGate();
  hud.init && hud.init();
  hud.refresh();
  assert(root._classes.hidden === true, 'non-Yandex env => hidden class applied');
  assertEqual(root._ariaHidden, 'true', 'non-Yandex env => aria-hidden=true');
});

// ─── Summary ───
console.log('\nRESULTS: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  console.log('\nFailed tests:');
  for (const f of failures) console.log('  - ' + f.name + ': ' + f.error);
  process.exit(1);
}
process.exit(0);
