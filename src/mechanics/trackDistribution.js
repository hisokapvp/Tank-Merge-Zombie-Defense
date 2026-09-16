/**
 * TrackDistribution — единое равномерное распределение танков по треку.
 *
 * Контракт: танки, находящиеся на треке (`tank.onTrack === true`), делят
 * полный круг на равные сектора независимо от уровня танка и от того, в
 * каких ячейках ангара они стоят. Порядок танков детерминирован и
 * стабилен: по возрастанию индекса ячейки (`cell.i`).
 *
 * Позиция танка на орбите = общая фаза трека (`cell.orbitPhase`, одинаковая
 * для всех танков) + угловое смещение слота. Поэтому расстояние между
 * соседними танками всегда равно 360° / N, а скорость вращения одинакова
 * для всех уровней.
 *
 * Zero-alloc контракт: `computeSlotPlacement` принимает необязательный
 * `out`-объект, чтобы hot-path (step/draw) не аллоцировал результат.
 */
(function (global) {
  'use strict';

  var TWO_PI = Math.PI * 2;

  /**
   * @param {{ onTrack?: boolean } | null | undefined} tank
   * @returns {boolean}
   */
  function isOnTrackTank(tank) {
    return !!(tank && tank.onTrack === true);
  }

  /**
   * Количество танков на треке.
   * @param {Array<{ i?: number, tank?: object }> | null} cells
   * @returns {number}
   */
  function countOnTrackTanks(cells) {
    if (!Array.isArray(cells)) return 0;
    var count = 0;
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell && isOnTrackTank(cell.tank)) count++;
    }
    return count;
  }

  /**
   * Индекс слота ячейки среди танков на треке и общее число таких танков.
   *
   * Индекс = количество танков на треке с `cell.i` меньше, чем у целевой
   * ячейки. Это даёт стабильный порядок по возрастанию `cell.i`.
   *
   * @param {Array<{ i?: number, tank?: object }> | null} cells
   * @param {number} cellIndex
   * @param {{ index: number, count: number } | null} [out]
   * @returns {{ index: number, count: number }} `index = -1`, если ячейка не на треке.
   */
  function computeSlotPlacement(cells, cellIndex, out) {
    var result = out || { index: -1, count: 0 };
    result.index = -1;
    result.count = 0;
    if (!Array.isArray(cells) || !Number.isFinite(cellIndex)) return result;

    var count = 0;
    var slotIndex = 0;
    var selfOnTrack = false;
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (!cell || !isOnTrackTank(cell.tank)) continue;
      count++;
      var index = Number.isFinite(cell.i) ? cell.i : i;
      if (index < cellIndex) slotIndex++;
      else if (index === cellIndex) selfOnTrack = true;
    }

    result.count = count;
    if (!selfOnTrack || count <= 0) return result;
    result.index = slotIndex;
    return result;
  }

  /**
   * Угловое смещение слота: `index / count * 360°`.
   * @param {number} index
   * @param {number} count
   * @returns {number} радианы
   */
  function computeSlotOffsetRad(index, count) {
    if (!Number.isFinite(index) || index < 0) return 0;
    var total = Number.isFinite(count) ? Math.floor(count) : 0;
    if (total <= 0) return 0;
    return (index / total) * TWO_PI;
  }

  /**
   * Нормализация угла/фазы в диапазон `[0, 2π)`.
   * @param {number} rad
   * @returns {number}
   */
  function normalizePhase(rad) {
    if (!Number.isFinite(rad)) return 0;
    var wrapped = rad % TWO_PI;
    return wrapped < 0 ? wrapped + TWO_PI : wrapped;
  }

  global.Game = global.Game || {};
  global.Game.TrackDistribution = {
    TWO_PI: TWO_PI,
    isOnTrackTank: isOnTrackTank,
    countOnTrackTanks: countOnTrackTanks,
    computeSlotPlacement: computeSlotPlacement,
    computeSlotOffsetRad: computeSlotOffsetRad,
    normalizePhase: normalizePhase,
  };
})(typeof window !== 'undefined' ? window : this);