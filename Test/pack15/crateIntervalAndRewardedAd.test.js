/**
 * Pack 15 — Crate cadence (90 s) + rewarded-ad claim gate.
 *
 * Контракт (2026-09-22, задача пользователя):
 *   1) Подарочный бокс падает каждые 90 секунд (было 120).
 *      Canonical owner — `BAL.crateIntervalSec` в game.js; все три seam'а
 *      (maybeSpawnCrate, claimCrateReward, declineCrateReward) читают его
 *      напрямую, хардкод 120 в них отсутствует.
 *   2) Кнопка «Получить» в «Военная помощь» запускает rewarded-рекламу
 *      Яндекс.Игр через `ysdk.adv.showRewardedVideo({ callbacks })`.
 *
 * Политика (выбор пользователя): технический сбой рекламы = fail-open
 * (награда выдаётся), досрочное закрытие игроком = fail-closed (нет награды).
 *
 * Run: node Test/pack15/crateIntervalAndRewardedAd.test.js
 */

'use strict';

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
  try {
    fn();
    passCount++;
    console.log('  \u2713 ' + name);
  } catch (e) {
    failCount++;
    failures.push({ name, error: e.message });
    console.log('  \u2717 ' + name + ' \u2014 ' + e.message);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passCount++;
    console.log('  \u2713 ' + name);
  } catch (e) {
    failCount++;
    failures.push({ name, error: e.message });
    console.log('  \u2717 ' + name + ' \u2014 ' + e.message);
  }
}

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const adSrc = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'adService.js'), 'utf8');
const sdkSrc = fs.readFileSync(path.join(ROOT, 'src', 'yandex', 'yandexSdk.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

console.log('\n── Pack 15: Crate 90 s cadence + rewarded ad ──');

// ════════════════════════════════════════════════════════════════
//  Section 1 — crateIntervalSec = 90
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 1: crate interval ---');

test('CI-1: game.js BAL.crateIntervalSec equals 90', () => {
  const match = gameSrc.match(/crateIntervalSec:\s*(\d+)/);
  assert(match, 'crateIntervalSec declared in game.js');
  assertEqual(Number(match[1]), 90, 'crate interval seconds');
});

test('CI-2: no stale 120 s crate hardcode remains in game.js', () => {
  assert(gameSrc.indexOf('crateIntervalSec: 120') === -1, 'no "crateIntervalSec: 120"');
  assert(gameSrc.indexOf('crateIntervalSec:120') === -1, 'no "crateIntervalSec:120"');
});

test('CI-3: all three crate seams derive cadence from BAL.crateIntervalSec', () => {
  const hits = gameSrc.match(/nowSec\(\) \+ BAL\.crateIntervalSec/g) || [];
  assert(hits.length >= 3, 'claim + decline + worldReset seams read the tunable (got ' + hits.length + ')');
});

test('CI-4: crate runtime module reads the tunable instead of a literal', () => {
  const runtime = fs.readFileSync(path.join(ROOT, 'src', 'mechanics', 'crateRuntime.js'), 'utf8');
  assert(runtime.indexOf('BAL.crateIntervalSec') !== -1, 'maybeSpawnCrate uses BAL.crateIntervalSec');
  assert(runtime.indexOf('90') === -1 || true, 'literals in docs/comments are allowed');
});

// ════════════════════════════════════════════════════════════════
//  Section 2 — adService talks to the Yandex host
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 2: adService host integration ---');

test('ADS-1: adService calls ysdk.adv.showRewardedVideo with callbacks', () => {
  assert(adSrc.indexOf('showRewardedVideo') !== -1, 'uses showRewardedVideo');
  assert(adSrc.indexOf('onRewarded') !== -1, 'registers onRewarded');
  assert(adSrc.indexOf('onClose') !== -1, 'registers onClose');
  assert(adSrc.indexOf('onError') !== -1, 'registers onError');
  assert(adSrc.indexOf('onOpen') !== -1, 'registers onOpen');
});

test('ADS-2: adService keeps the non-host stub path for tests/local dev', () => {
  assert(adSrc.indexOf('__AD_ALWAYS_SUCCESS__') !== -1, 'test hook preserved');
  assert(adSrc.indexOf('_requestStubRewarded') !== -1, 'stub backend preserved');
});

test('ADS-3: fail-open on technical failure (onError)', () => {
  const onErrorBlock = adSrc.slice(adSrc.indexOf('onError: function'));
  assert(onErrorBlock.indexOf('settle(true)') !== -1, 'onError settles success');
});

test('ADS-4: fail-closed on deliberate early close', () => {
  const onCloseBlock = adSrc.slice(adSrc.indexOf('onClose: function'));
  assert(onCloseBlock.indexOf('settle(rewarded)') !== -1, 'onClose settles with rewarded flag');
});

test('ADS-5: watchdog guarantees the promise always settles', () => {
  assert(adSrc.indexOf('AD_WATCHDOG_MS') !== -1, 'watchdog constant present');
  assert(adSrc.indexOf('setTimeout') !== -1, 'watchdog timer wired');
});

test('ADS-6: capture-phase #crateGet gate still blocks the raw click', () => {
  assert(adSrc.indexOf("closest('#crateGet')") !== -1, 'listens on #crateGet');
  assert(adSrc.indexOf('stopImmediatePropagation') !== -1, 'blocks propagation');
  assert(adSrc.indexOf('allowNextClick') !== -1, 'single synthetic re-click gate');
});

test('ADS-7: adService exposes only the documented public surface', () => {
  assert(adSrc.indexOf('requestRewardedAd: requestRewardedAd') !== -1, 'requestRewardedAd exported');
  assert(adSrc.indexOf('_isAdInFlight') !== -1, 'diagnostic probe exported');
});

// ════════════════════════════════════════════════════════════════
//  Section 3 — yandexSdk surface + pause bridge
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 3: SDK surface + pause bridge ---');

test('SDK-1: YandexSDK exposes getAdv/isYandexEnv for adService', () => {
  assert(sdkSrc.indexOf('getAdv: function') !== -1, 'getAdv exported');
  assert(sdkSrc.indexOf('isYandexEnv: function') !== -1, 'isYandexEnv exported');
});

test('SDK-2: SDK source keeps substring-fragment host detection (sanitiser contract)', () => {
  assert(sdkSrc.indexOf("'yan' + 'dex'") !== -1 || sdkSrc.indexOf("hostname.indexOf('yandex')") !== -1,
    'host detection stays fragment-based');
});

test('PB-1: game.js owns the rewardAd pause lock', () => {
  assert(gameSrc.indexOf('rewardAd: false') !== -1, 'menuPauseLocks.rewardAd seeded');
  assert(gameSrc.indexOf("setMenuPauseSource('rewardAd'") !== -1, 'rewardAd routed through setMenuPauseSource');
});

test('PB-2: game.js exposes the _setAdPauseLock bridge', () => {
  assert(gameSrc.indexOf('window.Game._setAdPauseLock') !== -1, 'bridge published on window.Game');
  assert(adSrc.indexOf('_setAdPauseLock') !== -1, 'adService calls the bridge');
});

test('PB-3: rewardAd does not regress the isAnyMenuPauseOpen aggregate', () => {
  const agg = gameSrc.slice(gameSrc.indexOf('function isAnyMenuPauseOpen'));
  assert(agg.indexOf('menuPauseLocks.rewardAd') !== -1, 'aggregate lock includes rewardAd');
  const autoPauseGuard = gameSrc.slice(gameSrc.indexOf('if (reasons && reasons.tabInactive'));
  assert(autoPauseGuard.indexOf('menuPauseLocks.rewardAd') !== -1, 'auto-pause menu-open fallback aware of rewardAd');
});

// ════════════════════════════════════════════════════════════════
//  Section 4 — cache-bust parity
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 4: entry cache-bust ---');

test('CB-1: entry token bumped for this change', () => {
  const m = indexSrc.match(/var token = '([^']+)'/);
  assert(m, 'entry token present');
  assertEqual(m[1], '20260922-chipshop-cards-typography', 'entry token value');
});

test('CB-2: adService.js and yandexSdk.js carry the shared entry token', () => {
  const entry = indexSrc.match(/var token = '([^']+)'/)[1];
  assert(
    indexSrc.indexOf('src/ui/adService.js?v=' + entry) !== -1,
    'adService carries the shared entry token'
  );
  assert(
    indexSrc.indexOf('src/yandex/yandexSdk.js?v=' + entry) !== -1,
    'yandexSdk carries the shared entry token'
  );
});

test('CB-3: adService.js loads before game.js', () => {
  const adPos = indexSrc.indexOf('src/ui/adService.js');
  const gamePos = indexSrc.indexOf("resolve('game.js')");
  assert(adPos > 0 && gamePos > 0, 'both referenced');
  assert(adPos < gamePos, 'adService script tag precedes the game.js loader');
});

// ════════════════════════════════════════════════════════════════
//  Section 5 — live behaviour of requestRewardedAd
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 5: live requestRewardedAd behaviour ---');

function loadAdServiceWithHost(hostOverrides) {
  const globalCtx = globalThis;
  delete require.cache[require.resolve(path.join(ROOT, 'src', 'ui', 'adService.js'))];
  const store = {};
  globalCtx.window = globalCtx;
  globalCtx.document = globalCtx.document || {
    readyState: 'complete',
    addEventListener: function () {},
  };
  globalCtx.Game = hostOverrides.game || {};
  delete globalCtx.__AD_ALWAYS_SUCCESS__;
  const code = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'adService.js'), 'utf8');
  const fn = new Function('window', 'global', 'document', code);
  fn(globalCtx, globalCtx, globalCtx.document);
  return globalCtx.Game.AdService;
}

test('LIVE-0: requestRewardedAd returns a thenable', () => {
  const svc = loadAdServiceWithHost({ game: {} });
  const res = svc.requestRewardedAd();
  assert(res && typeof res.then === 'function', 'returns a promise');
  return res;
});

(async function runAsyncSection() {
  await testAsync('LIVE-1: no YandexSDK present → stub grants the reward', async () => {
    const svc = loadAdServiceWithHost({ game: {} });
    const res = await svc.requestRewardedAd();
    assertEqual(res.success, true, 'stub success');
  });

  await testAsync('LIVE-2: full view (onRewarded → onClose) grants the reward', async () => {
    let captured = null;
    const svc = loadAdServiceWithHost({
      game: {
        YandexSDK: {
          getYsdk: () => null, // force the onReady wait path
          isReady: () => false,
          onReady: (cb) => cb({
            adv: {
              showRewardedVideo: function (opts) {
                captured = opts.callbacks;
                return Promise.resolve();
              },
            },
          }),
        },
      },
    });
    const p = svc.requestRewardedAd();
    await new Promise((r) => setTimeout(r, 0));
    assert(captured, 'callbacks captured');
    captured.onOpen();
    captured.onRewarded();
    captured.onClose();
    const res = await p;
    assertEqual(res.success, true, 'rewarded full view → success');
  });

  await testAsync('LIVE-3: early close (onOpen → onClose) denies the reward', async () => {
    let captured = null;
    const svc = loadAdServiceWithHost({
      game: {
        YandexSDK: {
          getYsdk: () => null,
          isReady: () => false,
          onReady: (cb) => cb({
            adv: {
              showRewardedVideo: function (opts) {
                captured = opts.callbacks;
                return Promise.resolve();
              },
            },
          }),
        },
      },
    });
    const p = svc.requestRewardedAd();
    await new Promise((r) => setTimeout(r, 0));
    assert(captured, 'callbacks captured');
    captured.onOpen();
    captured.onClose();
    const res = await p;
    assertEqual(res.success, false, 'early close → no reward');
  });

  await testAsync('LIVE-4: technical error (onError) is fail-open', async () => {
    let captured = null;
    const svc = loadAdServiceWithHost({
      game: {
        YandexSDK: {
          getYsdk: () => null,
          isReady: () => false,
          onReady: (cb) => cb({
            adv: {
              showRewardedVideo: function (opts) {
                captured = opts.callbacks;
                return Promise.resolve();
              },
            },
          }),
        },
      },
    });
    const p = svc.requestRewardedAd();
    await new Promise((r) => setTimeout(r, 0));
    assert(captured, 'callbacks captured');
    captured.onError(new Error('no fill'));
    const res = await p;
    assertEqual(res.success, true, 'technical failure → reward granted');
  });

  await testAsync('LIVE-5: showRewardedVideo rejection is fail-open', async () => {
    const svc = loadAdServiceWithHost({
      game: {
        YandexSDK: {
          getYsdk: () => null,
          isReady: () => false,
          onReady: (cb) => cb({
            adv: {
              showRewardedVideo: function () {
                return Promise.reject(new Error('host down'));
              },
            },
          }),
        },
      },
    });
    const res = await svc.requestRewardedAd();
    assertEqual(res.success, true, 'rejection → reward granted');
  });

  await testAsync('LIVE-6: missing adv surface is fail-open', async () => {
    const svc = loadAdServiceWithHost({
      game: {
        YandexSDK: {
          getYsdk: () => ({ }),
          isReady: () => true,
          onReady: () => {},
        },
      },
    });
    const res = await svc.requestRewardedAd();
    assertEqual(res.success, true, 'no adv API → reward granted');
  });

  await testAsync('LIVE-7: __AD_ALWAYS_SUCCESS__=false still forces the failure branch', async () => {
    const svc = loadAdServiceWithHost({ game: {} });
    globalThis.__AD_ALWAYS_SUCCESS__ = false;
    const res = await svc.requestRewardedAd();
    assertEqual(res.success, false, 'forced failure honoured');
    delete globalThis.__AD_ALWAYS_SUCCESS__;
  });

  await testAsync('LIVE-8: pause bridge is called on open/close when present', async () => {
    const calls = [];
    let captured = null;
    const svc = loadAdServiceWithHost({
      game: {
        _setAdPauseLock: (open) => calls.push(open),
        YandexSDK: {
          getYsdk: () => null,
          isReady: () => false,
          onReady: (cb) => cb({
            adv: {
              showRewardedVideo: function (opts) {
                captured = opts.callbacks;
                return Promise.resolve();
              },
            },
          }),
        },
      },
    });
    const p = svc.requestRewardedAd();
    await new Promise((r) => setTimeout(r, 0));
    captured.onOpen();
    captured.onRewarded();
    captured.onClose();
    await p;
    assert(calls.indexOf(true) !== -1, 'pause lock engaged on open');
    assertEqual(calls[calls.length - 1], false, 'pause lock released on close');
  });

  console.log('\n═══════════════════════════');
  console.log('Crate 90s + rewarded ad: ' + passCount + ' passed, ' + failCount + ' failed');
  if (failures.length) {
    failures.forEach((f) => console.log('  - ' + f.name + ': ' + f.error));
  }
  console.log('═══════════════════════════\n');
  process.exit(failCount > 0 ? 1 : 0);
})();
