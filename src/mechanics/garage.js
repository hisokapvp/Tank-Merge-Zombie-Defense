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

  function countFreeCells(state) {
    if (!state || !Array.isArray(state.cells)) return 0;
    var count = 0;
    for (var i = 0; i < state.cells.length; i++) {
      if (isCellAvailableForTank(state.cells[i], state)) count += 1;
    }
    return count;
  }

  function findFreeCells(state, n) {
    if (!state || !Array.isArray(state.cells)) return [];
    var need = Math.max(0, Math.floor(Number(n) || 0));
    if (need <= 0) return [];
    var found = [];
    for (var i = 0; i < state.cells.length; i++) {
      var cell = state.cells[i];
      if (isCellAvailableForTank(cell, state)) {
        found.push(cell.i);
        if (found.length >= need) break;
      }
    }
    return found;
  }

  function getUiSfxVolumeMult() {
    var cfg = global.Game && global.Game.Config && global.Game.Config.AudioUi;
    var value = Number(cfg && cfg.UI_SFX_VOLUME_MULT);
    return Number.isFinite(value) && value > 0 ? value : 0.5;
  }

  function shouldPlayTrackSfx(opts) {
    if (opts && typeof opts.playSfx === 'boolean') return opts.playSfx;
    var cause = opts && typeof opts.cause === 'string' ? opts.cause : 'system';
    return cause === 'user';
  }

  function playTrackSfx(id) {
    if (!id) return;
    var play = global.playSfx;
    if (typeof play !== 'function') return;
    play(id, { volumeMult: getUiSfxVolumeMult(), channel: 'ui' });
  }

  function setTankOnTrack(tank, nextOnTrack, opts) {
    if (!tank || typeof tank !== 'object') return false;
    var prevOnTrack = !!tank.onTrack;
    var next = !!nextOnTrack;
    if (prevOnTrack === next) return false;

    tank.onTrack = next;
    if (!shouldPlayTrackSfx(opts)) return true;
    playTrackSfx(next ? 'tankToTrack' : 'tankToHangar');
    return true;
  }

  global.Game = global.Game || {};
  global.Game.Garage = {
    isCellAvailableForTank,
    findFreeCell,
    hasFreeCell,
    countFreeCells,
    findFreeCells,
    setTankOnTrack,
  };
})(typeof window !== 'undefined' ? window : this);
