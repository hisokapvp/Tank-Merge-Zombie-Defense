/**
 * Заглушка rewarded ad. requestRewardedAd() возвращает Promise<{ success: boolean }>.
 * Для тестов: window.__AD_ALWAYS_SUCCESS__ = false/true.
 */
(function (global) {
  'use strict';

  /**
   * @returns {Promise<{ success: boolean }>}
   */
  function requestRewardedAd() {
    var forceSuccess = global.__AD_ALWAYS_SUCCESS__;
    var success = forceSuccess !== false;
    return Promise.resolve({ success: success });
  }

  global.Game = global.Game || {};
  global.Game.AdService = { requestRewardedAd: requestRewardedAd };
})(typeof window !== 'undefined' ? window : this);
