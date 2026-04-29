(function (global) {
  'use strict';

  /**
   * Cannon upgrade balance helpers (pure functions).
   *
   * Provides fallback generation, row sanitization and config normalization
   * for cannon-upgrade balance data loaded from assets/balance/cannonUpgrades.json.
   *
   * Exposed as Game.CannonUpgrades.
   */

  var DEFAULT_LEVELS = 60;

  /** Generate procedural fallback balance when JSON is missing. */
  function createFallbackCannonUpgrades(levels) {
    var totalLevels = Number.isFinite(levels) ? Math.max(1, Math.floor(levels)) : DEFAULT_LEVELS;
    var fallback = [];
    for (var i = 0; i < totalLevels; i++) {
      var level = i + 1;
      var costBase = 2 + Math.floor(i * 0.5);
      var costStep = 1 + Math.floor(i * 0.33);
      var damageMulPerUpgrade = Number((0.01 + i * 0.00035).toFixed(5));
      var attackSpeedMulPerUpgrade = Number((0.008 + i * 0.00025).toFixed(5));
      fallback.push([level, costBase, costStep, damageMulPerUpgrade, attackSpeedMulPerUpgrade, 1]);
    }
    return fallback;
  }

  /** Validate and normalise a single row from the JSON. Returns null on invalid data. */
  function sanitizeCannonUpgradeRow(row, index) {
    if (!Array.isArray(row) || (row.length !== 5 && row.length !== 6)) return null;
    var tankLevel = Number(row[0]);
    var costBase = Number(row[1]);
    var costStep = Number(row[2]);
    var damageMulPerUpgrade = Number(row[3]);
    var attackSpeedMulPerUpgrade = Number(row[4]);
    var rawIconFrames = Number(row[5]);
    var iconFrames = Number.isFinite(rawIconFrames) && rawIconFrames >= 1
      ? Math.floor(rawIconFrames)
      : 1;
    if (!Number.isFinite(tankLevel) || tankLevel !== index + 1) return null;
    if (!Number.isFinite(costBase) || !Number.isFinite(costStep)) return null;
    if (!Number.isFinite(damageMulPerUpgrade) || !Number.isFinite(attackSpeedMulPerUpgrade)) return null;
    return [
      tankLevel,
      Math.max(0, Math.floor(costBase)),
      Math.max(0, Math.floor(costStep)),
      Math.max(0, damageMulPerUpgrade),
      Math.max(0, attackSpeedMulPerUpgrade),
      iconFrames,
    ];
  }

  /** Validate the full config array. Returns normalized copy or null on any error. */
  function normalizeCannonUpgradesConfig(raw, levels) {
    var totalLevels = Number.isFinite(levels) ? Math.max(1, Math.floor(levels)) : DEFAULT_LEVELS;
    if (!Array.isArray(raw) || raw.length !== totalLevels) return null;
    var normalized = [];
    for (var i = 0; i < totalLevels; i++) {
      var r = sanitizeCannonUpgradeRow(raw[i], i);
      if (!r) return null;
      normalized.push(r);
    }
    return normalized;
  }

  /** Clamp applied upgrade value to non-negative integer. */
  function normalizeAppliedCannonUpgrade(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
  }

  global.Game = global.Game || {};
  global.Game.CannonUpgrades = {
    DEFAULT_LEVELS: DEFAULT_LEVELS,
    createFallbackCannonUpgrades: createFallbackCannonUpgrades,
    sanitizeCannonUpgradeRow: sanitizeCannonUpgradeRow,
    normalizeCannonUpgradesConfig: normalizeCannonUpgradesConfig,
    normalizeAppliedCannonUpgrade: normalizeAppliedCannonUpgrade,
  };
})(typeof window !== 'undefined' ? window : this);
