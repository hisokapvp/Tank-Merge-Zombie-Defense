/**
 * Заглушка rewarded ad. requestRewardedAd() возвращает Promise<{ success: boolean }>.
 * Для тестов: window.__AD_ALWAYS_SUCCESS__ = false/true.
 */
(function (global) {
  'use strict';

  var crateClaimGate = {
    pending: false,
    allowNextClick: false,
  };

  /**
   * @returns {Promise<{ success: boolean }>}
   */
  function requestRewardedAd() {
    var forceSuccess = global.__AD_ALWAYS_SUCCESS__;
    var success = forceSuccess !== false;
    return Promise.resolve({ success: success });
  }

  function installCrateRewardStub() {
    var documentObj = global.document;
    if (!documentObj || installCrateRewardStub._installed) return;
    installCrateRewardStub._installed = true;

    documentObj.addEventListener('click', function (event) {
      var target = event.target;
      var button = target && typeof target.closest === 'function'
        ? target.closest('#crateGet')
        : null;
      if (!button) return;

      if (crateClaimGate.allowNextClick) {
        crateClaimGate.allowNextClick = false;
        return;
      }

      if (crateClaimGate.pending || button.disabled) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      crateClaimGate.pending = true;
      button.disabled = true;

      Promise.resolve(requestRewardedAd()).then(function (result) {
        crateClaimGate.pending = false;
        if (!result || result.success !== true) {
          button.disabled = false;
          return;
        }
        crateClaimGate.allowNextClick = true;
        button.disabled = false;
        if (typeof button.click === 'function') button.click();
      }, function () {
        crateClaimGate.pending = false;
        button.disabled = false;
      });
    }, true);
  }

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', installCrateRewardStub, { once: true });
    } else {
      installCrateRewardStub();
    }
  }

  global.Game = global.Game || {};
  global.Game.AdService = { requestRewardedAd: requestRewardedAd };
})(typeof window !== 'undefined' ? window : this);
