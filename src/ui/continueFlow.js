/**
 * Логика кнопки «Продолжить»: при отсутствии > 5 минут показывать модалку офлайн-награды.
 */
(function (global) {
  'use strict';

  var OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

  var Game = global.Game;
  var computeOfflineRewards = Game && Game.OfflineProgress ? Game.OfflineProgress.computeOfflineRewards : function () { return { coins: 0, xp: 0, elapsedMsUsed: 0 }; };
  var showOfflineModal = Game && Game.OfflineModal ? Game.OfflineModal.showOfflineRewardsModal : function () {};
  var isTankOnTrack = Game && Game.TrackQuery ? Game.TrackQuery.isTankOnTrack : function () { return false; };

  /**
   * Вычислить elapsed с момента lastSeenAt.
   * @param {number} [lastSeenAt]
   * @returns {number} elapsedMs, >= 0
   */
  function getElapsedMs(lastSeenAt) {
    if (lastSeenAt == null || !Number.isFinite(lastSeenAt)) return 0;
    return Math.max(0, Date.now() - lastSeenAt);
  }

  /**
   * Нужно ли показать модалку офлайн при нажатии «Продолжить».
   * @param {number} [lastSeenAt]
   * @returns {boolean}
   */
  function shouldShowOfflineModal(lastSeenAt) {
    return getElapsedMs(lastSeenAt) > OFFLINE_THRESHOLD_MS;
  }

  /**
   * При нажатии «Продолжить»: если elapsed > 5 мин — показать модалку с наградами; иначе просто закрыть меню.
   * Вызывается из игры с (state, meta, onCloseMenu, onShowOfflineModal).
   * @param {object} state — текущий state (для computeOfflineRewards)
   * @param {{ lastSeenAt?: number }} meta
   * @param {function} onCloseMenu
   * @param {function} onShowOfflineModal — вызвать с { coins, xp, onConfirm }
   */
  function onContinueClick(state, meta, onCloseMenu, onShowOfflineModal) {
    var elapsed = getElapsedMs(meta && meta.lastSeenAt);
    if (elapsed <= OFFLINE_THRESHOLD_MS) {
      onCloseMenu();
      return;
    }
    var rewards = computeOfflineRewards(state, elapsed);
    onCloseMenu();
    if (onShowOfflineModal) onShowOfflineModal({ coins: rewards.coins, xp: rewards.xp });
  }

  global.Game = global.Game || {};
  global.Game.ContinueFlow = {
    getElapsedMs: getElapsedMs,
    shouldShowOfflineModal: shouldShowOfflineModal,
    onContinueClick: onContinueClick,
    OFFLINE_THRESHOLD_MS: OFFLINE_THRESHOLD_MS,
  };
})(typeof window !== 'undefined' ? window : this);
