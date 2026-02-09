/**
 * Расчёт офлайн-наград (монеты, опыт) по elapsed и только по танкам на трассе.
 */
(function (global) {
  'use strict';

  var Game = global.Game;
  var isTankOnTrack = Game && Game.TrackQuery ? Game.TrackQuery.isTankOnTrack : function () { return false; };

  /** Максимальное время офлайна для расчёта (мс), например 12 часов */
  var OFFLINE_CAP_MS = 12 * 60 * 60 * 1000;

  /** Базовые скорости для приближённого расчёта (монеты/сек и опыт/сек на один танк на трассе) */
  var COINS_PER_SEC_PER_TANK = 0.5;
  var XP_PER_SEC_PER_TANK = 0.3;

  /**
   * Вычислить офлайн-награды. Учитываются только танки на трассе (isTankOnTrack).
   * @param {object} state — состояние на момент ухода (должно содержать cells, player)
   * @param {number} elapsedMs — время отсутствия (мс)
   * @returns {{ coins: number, xp: number, elapsedMsUsed: number }}
   */
  function computeOfflineRewards(state, elapsedMs) {
    var elapsed = Math.max(0, Number(elapsedMs) || 0);
    var elapsedCapped = Math.min(elapsed, OFFLINE_CAP_MS);
    var coins = 0;
    var xp = 0;

    if (!state || !Array.isArray(state.cells)) {
      return { coins: 0, xp: 0, elapsedMsUsed: 0 };
    }

    var countOnTrack = 0;
    for (var i = 0; i < state.cells.length; i++) {
      var cell = state.cells[i];
      if (cell.tank && isTankOnTrack(cell.tank, state)) countOnTrack++;
    }

    if (countOnTrack === 0) {
      return { coins: 0, xp: 0, elapsedMsUsed: 0 };
    }

    var sec = elapsedCapped / 1000;
    coins = Math.floor(COINS_PER_SEC_PER_TANK * countOnTrack * sec);
    xp = Math.floor(XP_PER_SEC_PER_TANK * countOnTrack * sec);
    coins = Math.max(0, coins);
    xp = Math.max(0, xp);

    return { coins: coins, xp: xp, elapsedMsUsed: elapsedCapped };
  }

  global.Game = global.Game || {};
  global.Game.OfflineProgress = {
    computeOfflineRewards: computeOfflineRewards,
    OFFLINE_CAP_MS: OFFLINE_CAP_MS,
  };
})(typeof window !== 'undefined' ? window : this);
