/**
 * Правила размещения в ячейках: свободная ячейка = без танка и не занята ящиком.
 */
(function (global) {
  'use strict';

  /**
   * Ячейка доступна для танка: нет танка и нет ящика в этой ячейке.
   * @param {{ i: number, tank?: object }} cell
   * @param {{ crate?: { cellIndex: number } }} state
   */
  function isCellAvailableForTank(cell, state) {
    if (!cell) return false;
    if (cell.tank) return false;
    if (state.crate && state.crate.cellIndex === cell.i) return false;
    return true;
  }

  /**
   * Первая свободная ячейка (для покупки танка).
   * @param {{ cells: Array<{ i: number, tank?: object }>, crate?: { cellIndex: number } }} state
   * @returns {number | null} index ячейки или null
   */
  function findFreeCell(state) {
    if (!state || !Array.isArray(state.cells)) return null;
    for (const cell of state.cells) {
      if (isCellAvailableForTank(cell, state)) return cell.i;
    }
    return null;
  }

  /**
   * Есть ли хотя бы одна ячейка для размещения танка (покупка / награда).
   */
  function hasFreeCell(state) {
    return findFreeCell(state) !== null;
  }

  global.Game = global.Game || {};
  global.Game.Garage = {
    isCellAvailableForTank,
    findFreeCell,
    hasFreeCell,
  };
})(typeof window !== 'undefined' ? window : this);
