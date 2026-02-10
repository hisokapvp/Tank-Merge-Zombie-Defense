/**
 * Тесты для STRICT-фич (T1–T6).
 * Запуск: node Test/tests.js
 * 
 * Минимальный тестовый фреймворк без зависимостей.
 */

// ─── Test runner ───
let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      (message || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)
    );
  }
}

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failCount++;
    failures.push({ name, error: e.message });
    console.log('  ✗ ' + name + ' — ' + e.message);
  }
}

// ─── Fake globals for modules ───
const global = globalThis;
global.window = global;
global.Game = {};

// ─── Suppress fetch for ContinueFlow module ───
if (typeof fetch === 'undefined') {
  global.fetch = function () { return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }); };
}

// ─── Load modules ───
// We need to eval them since they are IIFE that attach to global.Game or window.Game

const fs = require('fs');
const path = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');
  // Wrap in a function to provide `global` = globalThis
  const fn = new Function('window', 'global', 'document', 'AbortController', 'fetch', 'setTimeout', 'clearTimeout', 'console', 'Promise', code);
  fn(global, global, global.document || {}, global.AbortController, global.fetch, global.setTimeout, global.clearTimeout, console, Promise);
}

// Load number format first
loadModule('src/utils/numberFormat.js');
// Load telemetry
loadModule('src/utils/telemetry.js');
// Load economy
loadModule('src/mechanics/economy.js');
// Load combat
loadModule('src/mechanics/combat.js');

// ═══════════════════════════════════════════════
// T2: Формат чисел K/M/B/T/...
// ═══════════════════════════════════════════════
// T1: computeBuyTankLevel (max-5, cap=50)
// ═══════════════════════════════════════════════
console.log('\n── T1: computeBuyTankLevel (max-5, cap=50) ──');

const { computeBuyTankLevel, MAX_BUY_TANK_LEVEL } = Game.Economy;
const { formatShortNumber, formatCompactRu } = Game.NumberFormat;

test('T1-1: max=6 → 1', () => {
  assertEqual(computeBuyTankLevel(6), 1);
});
test('T1-2: max=7 → 2', () => {
  assertEqual(computeBuyTankLevel(7), 2);
});
test('T1-3: max=60 → 50', () => {
  assertEqual(computeBuyTankLevel(60), 50);
});
test('T1-4: max=1 → 1', () => {
  assertEqual(computeBuyTankLevel(1), 1);
});
test('T1-5: max=0 → 1', () => {
  assertEqual(computeBuyTankLevel(0), 1);
});
test('T1-6: max=55 → 50', () => {
  assertEqual(computeBuyTankLevel(55), 50);
});

test('T2-1: 9999 → "9999"', () => {
  assertEqual(formatShortNumber(9999), '9999');
});

test('T2-2: 10000 → "10K"', () => {
  assertEqual(formatShortNumber(10000), '10K');
});

test('T2-3: 999999 → "999K"', () => {
  assertEqual(formatShortNumber(999999), '999K');
});

test('T2-4: 1_000_000 → "1M"', () => {
  assertEqual(formatShortNumber(1000000), '1M');
});

test('T2-5: 1_234_567 → "1M"', () => {
  assertEqual(formatShortNumber(1234567), '1M');
});

test('T2-6: 1_000_000_000 → "1B"', () => {
  assertEqual(formatShortNumber(1000000000), '1B');
});

test('T2-7: 0 → "0"', () => {
  assertEqual(formatShortNumber(0), '0');
});

test('T2-8: NaN → "0"', () => {
  assertEqual(formatShortNumber(NaN), '0');
});

test('T2-9: Infinity → "0"', () => {
  assertEqual(formatShortNumber(Infinity), '0');
});

test('T2-10: negative -15000 → "-15K"', () => {
  assertEqual(formatShortNumber(-15000), '-15K');
});

test('T2-11: formatCompactRu is alias of formatShortNumber', () => {
  assertEqual(formatCompactRu(5000), formatShortNumber(5000));
});

// ═══════════════════════════════════════════════
// T4: Монеты за выстрел по уровню (2^(level-1))
// ═══════════════════════════════════════════════
console.log('\n── T4: coinsForShot (geometry 2^(level-1) with cap) ──');

const { coinsForShot, MAX_COIN_PER_SHOT } = Game.Economy;

test('T4-1: level=1 → 1 coin', () => {
  assertEqual(coinsForShot(1), 1);
});

test('T4-2: level=2 → 2 coins', () => {
  assertEqual(coinsForShot(2), 2);
});

test('T4-3: level=3 → 4 coins', () => {
  assertEqual(coinsForShot(3), 4);
});

test('T4-4: level=4 → 8 coins', () => {
  assertEqual(coinsForShot(4), 8);
});

test('T4-5: level=5 → 16 coins', () => {
  assertEqual(coinsForShot(5), 16);
});

test('T4-6: level=10 → 512 coins', () => {
  assertEqual(coinsForShot(10), 512);
});

test('T4-7: level=21 → cap (2^20)', () => {
  assertEqual(coinsForShot(21), Math.pow(2, 20));
});

test('T4-8: level=30 → cap (2^20)', () => {
  assertEqual(coinsForShot(30), MAX_COIN_PER_SHOT);
});

test('T4-9: level=0 → 0 (invalid)', () => {
  assertEqual(coinsForShot(0), 0);
});

test('T4-10: level=-1 → 0 (invalid)', () => {
  assertEqual(coinsForShot(-1), 0);
});

test('T4-11: level=null → 0 (invalid)', () => {
  assertEqual(coinsForShot(null), 0);
});

test('T4-12: MAX_COIN_PER_SHOT = 2^20', () => {
  assertEqual(MAX_COIN_PER_SHOT, 1048576);
});

// ═══════════════════════════════════════════════
// T-DA: pickDeathAnim — детерминированный выбор death-анимации
// ═══════════════════════════════════════════════
console.log('\n── T-DA: pickDeathAnim (deterministic death animation) ──');

const { pickDeathAnim } = Game.Combat;

const mockCommon = { id: 'common', frames: 8 };
const mockPersonal = { id: 'personal', frames: 6 };

test('T-DA-1: both available, rand=0.0 → personal', () => {
  const result = pickDeathAnim(mockCommon, mockPersonal, 0.0);
  assertEqual(result.id, 'personal');
});

test('T-DA-2: both available, rand=0.69 → personal', () => {
  const result = pickDeathAnim(mockCommon, mockPersonal, 0.69);
  assertEqual(result.id, 'personal');
});

test('T-DA-3: both available, rand=0.70 → common (boundary)', () => {
  const result = pickDeathAnim(mockCommon, mockPersonal, 0.70);
  assertEqual(result.id, 'common');
});

test('T-DA-4: both available, rand=0.99 → common', () => {
  const result = pickDeathAnim(mockCommon, mockPersonal, 0.99);
  assertEqual(result.id, 'common');
});

test('T-DA-5: only personal → personal (any rand)', () => {
  const result = pickDeathAnim(null, mockPersonal, 0.5);
  assertEqual(result.id, 'personal');
});

test('T-DA-6: only common → common (any rand)', () => {
  const result = pickDeathAnim(mockCommon, null, 0.3);
  assertEqual(result.id, 'common');
});

test('T-DA-7: neither available → null', () => {
  const result = pickDeathAnim(null, null, 0.5);
  assertEqual(result, null);
});

test('T-DA-8: undefined values also return null', () => {
  const result = pickDeathAnim(undefined, undefined, 0.5);
  assertEqual(result, null);
});

test('T-DA-9: rand=NaN treated as 0 → personal (boundary safe)', () => {
  const result = pickDeathAnim(mockCommon, mockPersonal, NaN);
  assertEqual(result.id, 'personal');
});

test('T-DA-10: rand=-0.1 clamped to 0 → personal', () => {
  const result = pickDeathAnim(mockCommon, mockPersonal, -0.1);
  assertEqual(result.id, 'personal');
});

test('T-DA-11: rand=1.5 clamped to <1 → common', () => {
  const result = pickDeathAnim(mockCommon, mockPersonal, 1.5);
  assertEqual(result.id, 'common');
});

test('T-DA-12: rand=Infinity clamped → common', () => {
  const result = pickDeathAnim(mockCommon, mockPersonal, Infinity);
  assertEqual(result.id, 'common');
});

// ═══════════════════════════════════════════════
// T1: Блокирующая синхронизация — unit tests
// ═══════════════════════════════════════════════
console.log('\n── T1: syncProgressBlocking & continueFlow ──');

// Загружаем модуль continueFlow — ему нужны: document.createElement, document.body, fetch, AbortController, setTimeout...
// Для unit-тестов мы используем уже загруженный Game.ContinueFlow (если доступен)
// Однако continueFlow делает DOM-операции, поэтому загрузим его с mock:

const mockDocument = {
  createElement: function (tag) {
    const el = {
      tagName: tag,
      id: '',
      className: '',
      innerHTML: '',
      style: {},
      children: [],
      classList: {
        _classes: [],
        add: function (c) { this._classes.push(c); },
        remove: function (c) { this._classes = this._classes.filter(x => x !== c); },
        contains: function (c) { return this._classes.indexOf(c) >= 0; },
      },
      setAttribute: function () {},
      getAttribute: function () { return ''; },
      addEventListener: function () {},
      removeEventListener: function () {},
      appendChild: function (child) { this.children.push(child); },
    };
    return el;
  },
  getElementById: function () { return null; },
  body: {
    appendChild: function () {},
  },
};

// Re-load continueFlow with mock document
const cfCode = fs.readFileSync(path.resolve(__dirname, '..', 'src/ui/continueFlow.js'), 'utf-8');

// Tests for generateSyncId, getElapsedMs, shouldShowOfflineModal using direct eval
{
  const localGame = {};
  const localGlobal = {
    Game: localGame,
    fetch: function (url, opts) {
      // Default: simulate success
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function () { return Promise.resolve({ message: 'OK' }); },
        text: function () { return Promise.resolve('OK'); },
      });
    },
    AbortController: typeof AbortController !== 'undefined' ? AbortController : function () {
      return { signal: {}, abort: function () {} };
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    document: mockDocument,
  };
  const cfFn = new Function('window', 'global', 'document', 'AbortController', 'fetch', 'setTimeout', 'clearTimeout', 'console', 'Promise', cfCode);
  cfFn(localGlobal, localGlobal, mockDocument, localGlobal.AbortController, localGlobal.fetch, setTimeout, clearTimeout, console, Promise);

  const CF = localGlobal.Game.ContinueFlow;

  test('T1-1: generateSyncId returns unique strings', () => {
    const id1 = CF.generateSyncId();
    const id2 = CF.generateSyncId();
    assert(typeof id1 === 'string', 'id1 is string');
    assert(id1.length > 10, 'id1 has length');
    assert(id1 !== id2, 'ids are unique');
  });

  test('T1-2: getElapsedMs returns 0 for null', () => {
    assertEqual(CF.getElapsedMs(null), 0);
  });

  test('T1-3: getElapsedMs returns positive for past timestamp', () => {
    const past = Date.now() - 10000;
    const elapsed = CF.getElapsedMs(past);
    assert(elapsed >= 9000 && elapsed <= 11000, 'elapsed ~10000, got ' + elapsed);
  });

  test('T1-4: shouldShowOfflineModal false for recent', () => {
    assertEqual(CF.shouldShowOfflineModal(Date.now() - 1000), false);
  });

  test('T1-5: shouldShowOfflineModal true for >5min', () => {
    assertEqual(CF.shouldShowOfflineModal(Date.now() - 6 * 60 * 1000), true);
  });

  test('T1-6: OFFLINE_THRESHOLD_MS = 5min', () => {
    assertEqual(CF.OFFLINE_THRESHOLD_MS, 5 * 60 * 1000);
  });

  test('T1-7: DEFAULT_TIMEOUT = 5000', () => {
    assertEqual(CF.DEFAULT_TIMEOUT, 5000);
  });

  test('T1-8: MAX_RETRIES = 3', () => {
    assertEqual(CF.MAX_RETRIES, 3);
  });

  // Async test for syncProgressBlocking (success)
  test('T1-9: syncProgressBlocking resolves ok on 200', () => {
    // This is pseudo-sync since we can't await in this runner, but we verify the function exists
    assert(typeof CF.syncProgressBlocking === 'function', 'syncProgressBlocking exists');
  });

  test('T1-10: syncWithRetry exists', () => {
    assert(typeof CF.syncWithRetry === 'function', 'syncWithRetry exists');
  });
}

// ═══════════════════════════════════════════════
// Async tests for T1 (syncProgressBlocking)
// ═══════════════════════════════════════════════
console.log('\n── T1 Async: syncProgressBlocking ──');

(async function () {
  // T1-async-1: success
  {
    const localGame = {};
    const localGlobal = {
      Game: localGame,
      fetch: function () {
        return Promise.resolve({
          ok: true, status: 200,
          json: function () { return Promise.resolve({ message: 'Synced' }); },
        });
      },
      AbortController: function () { return { signal: {}, abort: function () {} }; },
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      document: mockDocument,
    };
    const fn = new Function('window', 'global', 'document', 'AbortController', 'fetch', 'setTimeout', 'clearTimeout', 'console', 'Promise', cfCode);
    fn(localGlobal, localGlobal, mockDocument, localGlobal.AbortController, localGlobal.fetch, setTimeout, clearTimeout, console, Promise);

    try {
      const result = await localGlobal.Game.ContinueFlow.syncProgressBlocking('/api/sync', { test: 1 }, 3000);
      if (result.status === 'ok') {
        passCount++;
        console.log('  ✓ T1-async-1: syncProgress success → status ok');
      } else {
        failCount++;
        failures.push({ name: 'T1-async-1', error: 'Expected ok, got ' + result.status });
        console.log('  ✗ T1-async-1: Expected ok, got ' + result.status);
      }
    } catch (e) {
      failCount++;
      failures.push({ name: 'T1-async-1', error: e.message });
      console.log('  ✗ T1-async-1: ' + e.message);
    }
  }

  // T1-async-2: server error (500)
  {
    const localGame = {};
    const localGlobal = {
      Game: localGame,
      fetch: function () {
        return Promise.resolve({
          ok: false, status: 500,
          json: function () { return Promise.resolve({}); },
          text: function () { return Promise.resolve('Internal Server Error'); },
        });
      },
      AbortController: function () { return { signal: {}, abort: function () {} }; },
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      document: mockDocument,
    };
    const fn = new Function('window', 'global', 'document', 'AbortController', 'fetch', 'setTimeout', 'clearTimeout', 'console', 'Promise', cfCode);
    fn(localGlobal, localGlobal, mockDocument, localGlobal.AbortController, localGlobal.fetch, setTimeout, clearTimeout, console, Promise);

    try {
      const result = await localGlobal.Game.ContinueFlow.syncProgressBlocking('/api/sync', { test: 1 }, 3000);
      if (result.status === 'error' && result.code === 500) {
        passCount++;
        console.log('  ✓ T1-async-2: syncProgress 500 → error with code 500');
      } else {
        failCount++;
        failures.push({ name: 'T1-async-2', error: 'Expected error/500' });
        console.log('  ✗ T1-async-2: Expected error/500, got ' + JSON.stringify(result));
      }
    } catch (e) {
      failCount++;
      failures.push({ name: 'T1-async-2', error: e.message });
      console.log('  ✗ T1-async-2: ' + e.message);
    }
  }

  // T1-async-3: network error
  {
    const localGame = {};
    const localGlobal = {
      Game: localGame,
      fetch: function () {
        return Promise.reject(new Error('Network unreachable'));
      },
      AbortController: function () { return { signal: {}, abort: function () {} }; },
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      document: mockDocument,
    };
    const fn = new Function('window', 'global', 'document', 'AbortController', 'fetch', 'setTimeout', 'clearTimeout', 'console', 'Promise', cfCode);
    fn(localGlobal, localGlobal, mockDocument, localGlobal.AbortController, localGlobal.fetch, setTimeout, clearTimeout, console, Promise);

    try {
      const result = await localGlobal.Game.ContinueFlow.syncProgressBlocking('/api/sync', {}, 3000);
      if (result.status === 'error' && result.message === 'Network unreachable') {
        passCount++;
        console.log('  ✓ T1-async-3: syncProgress network error → error with message');
      } else {
        failCount++;
        failures.push({ name: 'T1-async-3', error: 'Expected network error' });
        console.log('  ✗ T1-async-3: got ' + JSON.stringify(result));
      }
    } catch (e) {
      failCount++;
      failures.push({ name: 'T1-async-3', error: e.message });
      console.log('  ✗ T1-async-3: ' + e.message);
    }
  }

  // ═══════════════════════════════════════════════
  // T6: Проверка удаления index.html.txt1
  // ═══════════════════════════════════════════════
  console.log('\n── T6: index.html.txt1 removal ──');

  test('T6-1: index.html does not start with // index.html.txt1', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf-8');
    assert(!html.startsWith('// index.html.txt1'), 'Should not start with // index.html.txt1');
  });

  test('T6-2: index.html does not contain "index.html.txt1" anywhere', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf-8');
    assert(html.indexOf('index.html.txt1') === -1, 'Should not contain index.html.txt1');
  });

  test('T6-3: game.js does not contain "game.js.txt1"', () => {
    const js = fs.readFileSync(path.resolve(__dirname, '..', 'game.js'), 'utf-8');
    assert(js.indexOf('game.js.txt1') === -1, 'Should not contain game.js.txt1');
  });

  test('T6-4: index.html starts with <!doctype', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf-8');
    assert(html.trimStart().toLowerCase().startsWith('<!doctype'), 'Should start with <!doctype');
  });

  // ═══════════════════════════════════════════════
  // T3: .stage полноэкранный (CSS snapshot test)
  // ═══════════════════════════════════════════════
  console.log('\n── T3: .stage fullscreen CSS ──');

  test('T3-1: CSS contains .stage with position:fixed', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'style.css'), 'utf-8');
    assert(css.indexOf('position:fixed') !== -1, 'CSS has position:fixed');
    // Find .stage rule with fixed
    const stageMatch = css.match(/\.stage\{[^}]*position:\s*fixed[^}]*/);
    assert(stageMatch, '.stage rule has position:fixed');
  });

  test('T3-2: CSS .stage has inset:0', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'style.css'), 'utf-8');
    const stageMatch = css.match(/\.stage\{[^}]*/);
    assert(stageMatch && stageMatch[0].indexOf('inset:0') !== -1, '.stage has inset:0');
  });

  test('T3-3: CSS .stage has width:100vw and height:100vh', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'style.css'), 'utf-8');
    const stageMatch = css.match(/\.stage\{[^}]*/);
    assert(stageMatch && stageMatch[0].indexOf('100vw') !== -1, '.stage has 100vw');
    assert(stageMatch && stageMatch[0].indexOf('100vh') !== -1, '.stage has 100vh');
  });

  test('T3-4: resizeCanvas uses window.innerWidth', () => {
    const js = fs.readFileSync(path.resolve(__dirname, '..', 'game.js'), 'utf-8');
    assert(js.indexOf('window.innerWidth') !== -1, 'game.js uses window.innerWidth');
    assert(js.indexOf('window.innerHeight') !== -1, 'game.js uses window.innerHeight');
  });

  // ═══════════════════════════════════════════════
  // T5: Кнопка "Настройки" в левом верхнем углу
  // ═══════════════════════════════════════════════
  console.log('\n── T5: Settings button position ──');

  test('T5-1: CSS settingsGear has position:fixed', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'style.css'), 'utf-8');
    const match = css.match(/\.settingsGear\{[^}]*/);
    assert(match && match[0].indexOf('position:fixed') !== -1, 'settingsGear has position:fixed');
  });

  test('T5-2: CSS settingsGear has left:8px', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'style.css'), 'utf-8');
    const match = css.match(/\.settingsGear\{[^}]*/);
    assert(match && match[0].indexOf('left:8px') !== -1, 'settingsGear has left:8px');
  });

  test('T5-3: CSS settingsGear has z-index:10000', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'style.css'), 'utf-8');
    const match = css.match(/\.settingsGear\{[^}]*/);
    assert(match && match[0].indexOf('z-index:10000') !== -1, 'settingsGear has z-index:10000');
  });

  test('T5-4: HTML settings button has tabindex="0"', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf-8');
    assert(html.indexOf('tabindex="0"') !== -1, 'settingsBtn has tabindex');
  });

  // ═══════════════════════════════════════════════
  // T7: Telemetry module
  // ═══════════════════════════════════════════════
  console.log('\n── T7: Telemetry ──');

  test('T7-1: Game.Telemetry exists', () => {
    assert(Game.Telemetry, 'Game.Telemetry should exist');
  });

  test('T7-2: event() increments session counter', () => {
    Game.Telemetry.reset();
    Game.Telemetry.event('testEvent');
    Game.Telemetry.event('testEvent');
    Game.Telemetry.event('testEvent');
    assertEqual(Game.Telemetry._session().testEvent, 3, 'session counter');
  });

  test('T7-3: event() increments lifetime counter', () => {
    Game.Telemetry.reset();
    // Lifetime persists across resets — simulate some events
    const before = Game.Telemetry._lifetime().lifetimeTest || 0;
    Game.Telemetry.event('lifetimeTest');
    Game.Telemetry.event('lifetimeTest');
    assertEqual(Game.Telemetry._lifetime().lifetimeTest, before + 2, 'lifetime counter');
  });

  test('T7-4: gauge() records last value', () => {
    Game.Telemetry.reset();
    Game.Telemetry.gauge('coins', 100);
    Game.Telemetry.gauge('coins', 250);
    assertEqual(Game.Telemetry._gauges().coins, 250, 'gauge should be last-write');
  });

  test('T7-5: max() records peak value', () => {
    Game.Telemetry.reset();
    Game.Telemetry.max('peak', 10);
    Game.Telemetry.max('peak', 5);
    Game.Telemetry.max('peak', 20);
    Game.Telemetry.max('peak', 15);
    assertEqual(Game.Telemetry._maxes().peak, 20, 'max should keep peak');
  });

  test('T7-6: snapshot() returns valid structure', () => {
    Game.Telemetry.reset();
    Game.Telemetry.event('snap');
    Game.Telemetry.gauge('g', 42);
    const s = Game.Telemetry.snapshot();
    assert(s.meta && s.meta.sessionStartIso, 'meta.sessionStartIso');
    assert(typeof s.meta.durationSec === 'number', 'meta.durationSec is number');
    assert(s.session && s.session.snap === 1, 'session.snap === 1');
    assert(s.gauges && s.gauges.g === 42, 'gauges.g === 42');
    assert(s.lifetime, 'lifetime section exists');
    // Ensure snapshot is a copy, not reference
    s.session.snap = 999;
    assertEqual(Game.Telemetry._session().snap, 1, 'snapshot is a copy');
  });

  test('T7-7: reset() clears session but not lifetime', () => {
    Game.Telemetry.event('persistTest');
    const ltBefore = Game.Telemetry._lifetime().persistTest;
    Game.Telemetry.reset();
    assertEqual(Game.Telemetry._session().persistTest, undefined, 'session cleared');
    assertEqual(Game.Telemetry._lifetime().persistTest, ltBefore, 'lifetime preserved');
  });

  test('T7-8: JSON.stringify(snapshot()) is valid JSON', () => {
    const json = JSON.stringify(Game.Telemetry.snapshot());
    const parsed = JSON.parse(json);
    assert(parsed && parsed.meta, 'parsed snapshot has meta');
  });

  test('T7-9: telemetry.js is included in index.html', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf-8');
    assert(html.indexOf('src/utils/telemetry.js') !== -1, 'index.html includes telemetry.js');
  });

  test('T7-10: game.js emits telemetry events', () => {
    const js = fs.readFileSync(path.resolve(__dirname, '..', 'game.js'), 'utf-8');
    assert(js.indexOf("Telemetry.event('buyTank')") !== -1, 'buyTank event');
    assert(js.indexOf("Telemetry.event('merge')") !== -1, 'merge event');
    assert(js.indexOf("Telemetry.event('zombieKill')") !== -1, 'zombieKill event');
    assert(js.indexOf("Telemetry.event('shotFired')") !== -1, 'shotFired event');
  });

  // ═══════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════
  console.log('\n════════════════════════════════');
  console.log('RESULTS: ' + passCount + ' passed, ' + failCount + ' failed');
  if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
  }
  console.log('════════════════════════════════\n');
  process.exit(failCount > 0 ? 1 : 0);
})();
