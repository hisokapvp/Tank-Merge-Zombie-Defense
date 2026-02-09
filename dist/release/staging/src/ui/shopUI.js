/**
 * Состояние кнопки «Купить танк»: disabled при отсутствии свободных ячеек (hasFreeCell).
 */
(function (global) {
  'use strict';

  var Game = global.Game;
  var hasFreeCell = Game && Game.Garage ? Game.Garage.hasFreeCell : function () { return true; };

  /**
   * Обновить состояние кнопки покупки: disabled при нет свободных ячеек или недостатке монет.
   * @param {object} state
   * @param {number} cost
   * @param {HTMLButtonElement} [buyButton]
   */
  function updateBuyButtonState(state, cost, buyButton) {
    if (!buyButton) return;
    var free = hasFreeCell(state);
    var canAfford = state && state.coins >= cost;
    buyButton.disabled = !free || !canAfford;
  }

  global.Game = global.Game || {};
  global.Game.ShopUI = { updateBuyButtonState: updateBuyButtonState };
})(typeof window !== 'undefined' ? window : this);
