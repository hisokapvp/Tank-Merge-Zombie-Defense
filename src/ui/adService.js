/**
 * Rewarded-ad service for the military-aid crate modal («Военная помощь»).
 *
 * `requestRewardedAd()` returns `Promise<{ success: boolean }>` and is the only
 * seam the crate claim flow needs to know about. Two backends:
 *
 *   1. Yandex Games host — real rewarded video through
 *      `ysdk.adv.showRewardedVideo({ callbacks })`. The promise resolves with
 *      `success: true` only when the host fires `onRewarded`, i.e. the player
 *      actually watched the video to the end. Closing the ad early resolves
 *      with `success: false` so the crate claim stays blocked (standard
 *      rewarded semantics).
 *   2. Everywhere else (local dev, VK build, standalone upload) the module
 *      degrades to the original stub: resolve `success` unless a test forces
 *      the failure branch via `window.__AD_ALWAYS_SUCCESS__ = false`.
 *
 * Failure policy (user decision, 2026-09-22): a *technical* failure — the host
 * has no fill, `showRewardedVideo` throws/rejects, the SDK is missing, or the
 * ad never reaches a terminal callback — is **fail-open**. The player still
 * gets the tank instead of losing the box to an infrastructure hiccup. Only a
 * deliberate early close is treated as `success: false`.
 *
 * The capture-phase click gate lives here as well. It covers both rewarded
 * placements with one seam:
 *   - `#crateGet`     — military-aid crate claim («Получить»)
 *   - `#plConfirmYes` — production-storage box-open confirm («Открыть»)
 * It blocks the original click, runs the ad, and re-issues exactly one
 * synthetic click on success. `claimCrateReward()` in game.js and the
 * production-line `openBox` handler therefore never see a click that was not
 * preceded by a completed (or fail-open) ad.
 *
 * Host callbacks are registered defensively (`onOpen` / `onRewarded` /
 * `onClose` / `onError` are all optional on the host side), and a watchdog
 * guarantees the promise always settles — a hanging ad must never lock the
 * claim button forever.
 */
(function (global) {
  'use strict';

  // Watchdog cap: the host normally fires onClose/onError well before this.
  // If nothing terminal ever arrives we settle fail-open and release the gate.
  var AD_WATCHDOG_MS = 120000;
  // Bounded wait for SDK readiness when a click lands before init finished.
  var SDK_READY_TIMEOUT_MS = 2500;

  var rewardedClaimGate = {
    pending: false,
    allowNextClick: false,
  };

  var sdkAdInFlight = false;

  // Every button whose action must be gated behind a completed rewarded video.
  //
  //   #crateGet     — military-aid crate modal («Получить»)
  //   #plConfirmYes — production-storage box-open confirm («Открыть»)
  //
  // Both run through the exact same seam: the raw click is blocked, an ad is
  // requested, and only a successful result lets exactly one synthetic re-click
  // reach the real handler. Adding a placement is a selector-only change.
  var AD_GATED_SELECTORS = ['#crateGet', '#plConfirmYes'];

  function _warn() {
    try {
      if (global.console && typeof global.console.warn === 'function') {
        global.console.warn.apply(global.console, ['[AdService]'].concat([].slice.call(arguments)));
      }
    } catch (_) {}
  }

  /**
   * Set the game's reward-ad pause lock (+ audio duck) around the video.
   * The bridge is owned by game.js (`window.Game._setAdPauseLock`); when it is
   * absent (unit tests, minimal bootstrap) this is a silent no-op.
   */
  function _setAdPauseLock(open) {
    try {
      if (global.Game && typeof global.Game._setAdPauseLock === 'function') {
        global.Game._setAdPauseLock(!!open);
      }
    } catch (_) {}
  }

  /**
   * Resolve the live Yandex SDK handle, waiting (bounded) for `onReady` when
   * the click somehow lands before initialisation finished.
   * @returns {Promise<Object|null>} sdk, or null when unavailable / not Yandex
   */
  function _resolveYsdk() {
    var yandex = global.Game && global.Game.YandexSDK;
    if (!yandex || typeof yandex.getYsdk !== 'function') {
      return Promise.resolve(null);
    }
    var live = yandex.getYsdk();
    if (live) return Promise.resolve(live);
    // Outside the host every ready-path finalizes with a null handle, so this
    // branch only runs while a real host init is still in flight.
    if (typeof yandex.isReady === 'function' && yandex.isReady()) {
      return Promise.resolve(null);
    }
    if (typeof yandex.onReady !== 'function') {
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      var settled = false;
      var timer = global.setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve(null);
      }, SDK_READY_TIMEOUT_MS);
      function finish(sdk) {
        if (settled) return;
        settled = true;
        try { global.clearTimeout(timer); } catch (_) {}
        resolve(sdk || null);
      }
      try {
        yandex.onReady(finish);
      } catch (_) {
        finish(null);
      }
    });
  }

  /**
   * Real Yandex rewarded video.
   * @param {Object} ysdk
   * @returns {Promise<{ success: boolean }>}
   */
  function _requestYandexRewarded(ysdk) {
    return new Promise(function (resolve) {
      var adv = ysdk && ysdk.adv;
      if (!adv || typeof adv.showRewardedVideo !== 'function') {
        // SDK surface without rewarded support → fail-open.
        _warn('ysdk.adv.showRewardedVideo unavailable, granting reward (fail-open)');
        resolve({ success: true });
        return;
      }

      var settled = false;
      var rewarded = false;
      var watchdog = null;

      function settle(success) {
        if (settled) return;
        settled = true;
        if (watchdog) {
          try { global.clearTimeout(watchdog); } catch (_) {}
          watchdog = null;
        }
        sdkAdInFlight = false;
        _setAdPauseLock(false);
        resolve({ success: !!success });
      }

      watchdog = global.setTimeout(function () {
        _warn('rewarded video watchdog fired, granting reward (fail-open)');
        settle(true);
      }, AD_WATCHDOG_MS);

      var callbacks = {
        onOpen: function () {
          // Ad is on screen: pause the simulation and duck game audio.
          _setAdPauseLock(true);
        },
        onRewarded: function () {
          // Host confirmed a full view — the only true-reward signal.
          rewarded = true;
        },
        onClose: function () {
          // Early close → `rewarded` stays false → no reward (fail-closed here).
          settle(rewarded);
        },
        onError: function (err) {
          // Technical failure (no fill, network, host error) → fail-open.
          _warn('rewarded video error, granting reward (fail-open)', err);
          settle(true);
        },
      };

      sdkAdInFlight = true;
      try {
        var maybePromise = adv.showRewardedVideo({ callbacks: callbacks });
        // Some SDK builds return a promise; a rejection is a technical failure.
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch(function (err) {
            _warn('showRewardedVideo rejected, granting reward (fail-open)', err);
            settle(true);
          });
        }
      } catch (err) {
        _warn('showRewardedVideo threw, granting reward (fail-open)', err);
        settle(true);
      }
    });
  }

  /**
   * Non-host stub backend (local dev / VK / standalone builds).
   * Preserved verbatim so existing tests and manual QA keep working:
   * `window.__AD_ALWAYS_SUCCESS__ = false` forces the failure branch.
   * @returns {Promise<{ success: boolean }>}
   */
  function _requestStubRewarded() {
    var forceSuccess = global.__AD_ALWAYS_SUCCESS__;
    var success = forceSuccess !== false;
    return Promise.resolve({ success: success });
  }

  /**
   * @returns {Promise<{ success: boolean }>}
   */
  function requestRewardedAd() {
    // Test hook wins unconditionally so unit tests stay deterministic.
    if (global.__AD_ALWAYS_SUCCESS__ === false) {
      return _requestStubRewarded();
    }
    // A second request while an ad is already on screen would stack host ads.
    if (sdkAdInFlight) {
      _warn('rewarded video already in flight, skipping duplicate request');
      return Promise.resolve({ success: false });
    }
    return _resolveYsdk()
      .then(function (ysdk) {
        return ysdk ? _requestYandexRewarded(ysdk) : _requestStubRewarded();
      })
      .catch(function (err) {
        _warn('rewarded ad resolution failed, granting reward (fail-open)', err);
        return { success: true };
      });
  }

  /**
   * Resolve the gated button a click originated from, or null.
   * @param {EventTarget} target
   * @returns {Element|null}
   */
  function _findGatedButton(target) {
    if (!target || typeof target.closest !== 'function') return null;
    for (var i = 0; i < AD_GATED_SELECTORS.length; i++) {
      var button = target.closest(AD_GATED_SELECTORS[i]);
      if (button) return button;
    }
    return null;
  }

  function installRewardedAdGate() {
    var documentObj = global.document;
    if (!documentObj || installRewardedAdGate._installed) return;
    installRewardedAdGate._installed = true;

    documentObj.addEventListener('click', function (event) {
      var button = _findGatedButton(event.target);
      if (!button) return;

      if (rewardedClaimGate.allowNextClick) {
        rewardedClaimGate.allowNextClick = false;
        return;
      }

      if (rewardedClaimGate.pending || button.disabled) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      rewardedClaimGate.pending = true;
      button.disabled = true;

      Promise.resolve(requestRewardedAd()).then(function (result) {
        rewardedClaimGate.pending = false;
        if (!result || result.success !== true) {
          button.disabled = false;
          return;
        }
        rewardedClaimGate.allowNextClick = true;
        button.disabled = false;
        if (typeof button.click === 'function') button.click();
      }, function () {
        rewardedClaimGate.pending = false;
        button.disabled = false;
      });
    }, true);
  }

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', installRewardedAdGate, { once: true });
    } else {
      installRewardedAdGate();
    }
  }

  global.Game = global.Game || {};
  global.Game.AdService = {
    requestRewardedAd: requestRewardedAd,
    // Diagnostic-only — lets QA assert the gate never stays stuck mid-ad.
    _isAdInFlight: function () { return sdkAdInFlight; },
  };
})(typeof window !== 'undefined' ? window : this);
