(function (global) {
  'use strict';

  var root = global.Game = global.Game || {};
  var config = root.Config = root.Config || {};

  config.LayoutTuning = {
    trackToHangarGapPx: 0,
    trackToFenceGapPx: 30,
    supercomputerOffsetY: 64,
    /** Единые габариты root-плашек суперкомпьютера. */
    supercomputerTileWidthPx: 256,
    supercomputerTileHeightPx: 256,
    /** Размер (px) иконок root-плашек суперкомпьютера. */
    supercomputerTileIconSizePx: 250,
    /** Ширина/высота иконки оружия в UI (суперкомпьютер, модалки). */
    weaponIconW: 96,
    weaponIconH: 96,
    /** Размер source-кадра спрайта оружия в атласе для UI-иконки. */
    weaponIconSpriteFrameW: 128,
    weaponIconSpriteFrameH: 128,
    /**
     * Количество кадров анимации иконки оружия по уровням L1..L60 (index 0 => L1).
     * Можно редактировать каждое значение отдельно.
     */
    weaponIconAnimFramesByLevel: [
      8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
      8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
      8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
      8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
      8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
      8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
    ],
    /**
     * FPS анимации иконки оружия по уровням L1..L60 (index 0 => L1).
     * Можно редактировать каждое значение отдельно.
     */
    weaponIconAnimFpsByLevel: [
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
    ],
    /**
     * Количество кадров анимации иконки дрона по уровням L1..L10 (index 0 => L1).
     * Можно редактировать каждое значение отдельно.
     */
    droneIconAnimFramesByLevel: [
      4, 4, 4, 4, 4, 4, 4, 4, 4, 4
    ],
    /**
     * FPS анимации иконки дрона по уровням L1..L10 (index 0 => L1).
     * Можно редактировать каждое значение отдельно.
     */
    droneIconAnimFpsByLevel: [
      30, 30, 30, 30, 30, 30, 30, 30, 30, 30
    ],
    zombieFenceOffsetPxBySide: {
      top: 20,
      right: 10,
      bottom: 0,
      left: 10,
    },
  };
})(typeof window !== 'undefined' ? window : this);
