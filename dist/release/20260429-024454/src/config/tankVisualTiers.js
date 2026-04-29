/**
 * Tier-Visual-Registry — single source of truth for tier-band based visual effects on tanks.
 *
 * batch solo-pipeline-yandex-vk#1 (items 1, 2, P1): Chip-count-based auras (aura1/aura2/aura3)
 * are now restricted to the top tier band (levels 56-60). For all lower levels, the aura keys
 * are absent from assets/tanks.json and TankSprites.pickAura() returns null gracefully.
 *
 * Future expansion: add more tier bands or effect flags here rather than editing each tank_lvlN.
 */
(function (global) {
  'use strict';

  var TIER_BANDS = [
    { id: 'T1',  levels: [1,  10], effects: { chipAura: false } },
    { id: 'T2',  levels: [11, 20], effects: { chipAura: false } },
    { id: 'T3',  levels: [21, 30], effects: { chipAura: false } },
    { id: 'T4',  levels: [31, 40], effects: { chipAura: false } },
    { id: 'T5',  levels: [41, 50], effects: { chipAura: false } },
    { id: 'T6a', levels: [51, 55], effects: { chipAura: false } },
    { id: 'T6b', levels: [56, 60], effects: { chipAura: true  } }
  ];

  function bandForLevel(level) {
    var L = Math.max(1, Math.floor(level || 1));
    for (var i = 0; i < TIER_BANDS.length; i++) {
      var b = TIER_BANDS[i];
      if (L >= b.levels[0] && L <= b.levels[1]) return b;
    }
    return TIER_BANDS[TIER_BANDS.length - 1];
  }

  function hasEffect(level, effectKey) {
    var band = bandForLevel(level);
    return !!(band && band.effects && band.effects[effectKey]);
  }

  global.Game = global.Game || {};
  global.Game.TankVisualTiers = {
    TIER_BANDS: TIER_BANDS,
    bandForLevel: bandForLevel,
    hasEffect: hasEffect,
  };
})(typeof window !== 'undefined' ? window : this);
