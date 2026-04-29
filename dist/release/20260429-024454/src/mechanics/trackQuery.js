/**
 * Единый критерий «танк на трассе».
 * Используется: state.cells[].tank.onTrack; ячейка без tank или tank не onTrack — не на трассе.
 */
(function (global) {
  'use strict';

  /**
   * @param {{ id?: string, onTrack?: boolean } | string} tank — объект танка или tankId
   * @param {{ cells: Array<{ tank?: { id: string, onTrack?: boolean } }> }} state
   * @returns {boolean}
   */
  function isTankOnTrack(tank, state) {
    if (!state || !Array.isArray(state.cells)) return false;
    if (typeof tank === 'string') {
      for (const cell of state.cells) {
        if (cell.tank && cell.tank.id === tank) return !!cell.tank.onTrack;
      }
      return false;
    }
    if (!tank || tank.onTrack !== true) return false;
    for (const cell of state.cells) {
      if (cell.tank === tank) return true;
    }
    return false;
  }

  global.Game = global.Game || {};
  global.Game.TrackQuery = { isTankOnTrack };
})(typeof window !== 'undefined' ? window : this);
