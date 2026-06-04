(function (global) {
  'use strict';

  var TAB_CONFIG = {
    weapons: {
      actionAttr: 'data-guns-action',
      storageKeys: ['baseDamage', 'attackSpeed'],
      renderStats: [
        { statKey: 'attackSpeed', labelKey: 'modsGunsColAttackSpeed' },
        { statKey: 'baseDamage', labelKey: 'modsGunsColDamage' },
      ],
    },
    drones: {
      actionAttr: 'data-dron-action',
      storageKeys: ['moveSpeedPxSec', 'repairSpeedMult', 'costMult'],
      renderStats: [
        { statKey: 'moveSpeedPxSec', labelKey: 'modsDronesColMoveSpeed' },
        { statKey: 'repairSpeedMult', labelKey: 'modsDronesColRepairSpeed' },
        { statKey: 'costMult', labelKey: 'modsDronesColCostMult' },
      ],
    },
    walls: {
      actionAttr: 'data-walls-action',
      storageKeys: ['segmentMaxHp', 'armorFlat'],
      renderStats: [
        { statKey: 'segmentMaxHp', labelKey: 'modsWallsSegmentHpLabel', labelVarKey: 'hp', trimColon: true },
        { statKey: 'armorFlat', labelKey: 'modsWallsArmorLabel', labelVarKey: 'armor', trimColon: true },
      ],
    },
  };

  function cloneStringArray(values) {
    var result = [];
    if (!Array.isArray(values)) return result;
    for (var i = 0; i < values.length; i++) {
      if (typeof values[i] !== 'string' || !values[i]) continue;
      result.push(values[i]);
    }
    return result;
  }

  function cloneRenderStats(stats) {
    var result = [];
    if (!Array.isArray(stats)) return result;
    for (var i = 0; i < stats.length; i++) {
      var source = stats[i];
      if (!source || typeof source.statKey !== 'string' || !source.statKey) continue;
      result.push({
        statKey: source.statKey,
        labelKey: typeof source.labelKey === 'string' ? source.labelKey : '',
        labelVarKey: typeof source.labelVarKey === 'string' ? source.labelVarKey : '',
        trimColon: source.trimColon === true,
      });
    }
    return result;
  }

  // solo-pipeline-yandex-vk#1: single source of truth for per-upgrade stat growth.
  // attackSpeed grows flat additively (+0.01 per upgrade, no percent); segmentMaxHp
  // grows by compounding 1% (×1.01) to current segment HP. UI preview (supercomputerMenu)
  // and runtime apply (game.js) must read this contract instead of duplicating formulas.
  // solo-pipeline-yandex-vk#2 item 4: walls.armorFlat grows by +1% (×1.01) compounding to
  // the current segment armor, but never less than +1 unit per upgrade (floor: 1). Because
  // the floor makes growth path-dependent, game.js applies it iteratively, not via pow().
  var STAT_GROWTH = {
    weapons: {
      attackSpeed: { kind: 'flatAdd', step: 0.01 },
    },
    walls: {
      segmentMaxHp: { kind: 'mulCompound', factor: 1.01 },
      armorFlat: { kind: 'mulCompound', factor: 1.01, floor: 1 },
    },
  };

  function getStatGrowth(tabKey, statKey) {
    if (typeof tabKey !== 'string' || !tabKey) return null;
    if (typeof statKey !== 'string' || !statKey) return null;
    var tab = STAT_GROWTH[tabKey];
    if (!tab) return null;
    var growth = tab[statKey];
    if (!growth) return null;
    var result = { kind: growth.kind };
    if (Number.isFinite(growth.step)) result.step = growth.step;
    if (Number.isFinite(growth.factor)) result.factor = growth.factor;
    if (Number.isFinite(growth.floor)) result.floor = growth.floor;
    return result;
  }

  function getTabConfig(tabKey) {
    if (typeof tabKey !== 'string' || !tabKey) return null;
    return TAB_CONFIG[tabKey] || null;
  }

  function getStorageKeys(tabKey) {
    var config = getTabConfig(tabKey);
    return cloneStringArray(config && config.storageKeys);
  }

  function getRenderStats(tabKey) {
    var config = getTabConfig(tabKey);
    return cloneRenderStats(config && config.renderStats);
  }

  function getActionAttr(tabKey) {
    var config = getTabConfig(tabKey);
    return config && typeof config.actionAttr === 'string' ? config.actionAttr : '';
  }

  function normalizeStatKey(tabKey, statKey) {
    return hasStat(tabKey, statKey) ? statKey : getDefaultRenderStatKey(tabKey);
  }

  function hasStat(tabKey, statKey) {
    var storageKeys = getStorageKeys(tabKey);
    for (var i = 0; i < storageKeys.length; i++) {
      if (storageKeys[i] === statKey) return true;
    }
    return false;
  }

  function getDefaultRenderStatKey(tabKey) {
    var renderStats = getRenderStats(tabKey);
    if (renderStats.length) return renderStats[0].statKey;
    var storageKeys = getStorageKeys(tabKey);
    return storageKeys.length ? storageKeys[0] : '';
  }

  function findStatDescriptor(tabKey, statKey) {
    var renderStats = getRenderStats(tabKey);
    for (var i = 0; i < renderStats.length; i++) {
      if (renderStats[i].statKey === statKey) return renderStats[i];
    }
    return null;
  }

  function getStatLabel(tabKey, statKey, translate) {
    var descriptor = findStatDescriptor(tabKey, statKey);
    var translateFn = typeof translate === 'function'
      ? translate
      : function (key) { return key; };
    if (!descriptor || !descriptor.labelKey) return typeof statKey === 'string' ? statKey : '';
    var label = '';
    if (descriptor.labelVarKey) {
      var vars = {};
      vars[descriptor.labelVarKey] = '';
      label = translateFn(descriptor.labelKey, vars);
    } else {
      label = translateFn(descriptor.labelKey);
    }
    if (descriptor.trimColon && typeof label === 'string') {
      return label.replace(':', '').trim();
    }
    return typeof label === 'string' ? label : '';
  }

  function buildStatControlActionSelector(tabKey, level, statKey, action) {
    var config = getTabConfig(tabKey);
    if (!config) return '';
    var lvl = Number.isFinite(Number(level)) ? Math.max(1, Math.floor(Number(level))) : 1;
    var resolvedStatKey = normalizeStatKey(tabKey, statKey);
    var actionValue = typeof action === 'string' && action ? action : 'plus';
    if (!resolvedStatKey) return '';
    return '#modsTankWallOverlay .scGunsStatControl[data-sc-upgrade-family="' + tabKey + '"][data-level="' + String(lvl) + '"][data-stat-key="' + resolvedStatKey + '"] [' + config.actionAttr + '="' + actionValue + '"]';
  }

  function buildRowActionSelector(tabKey, level, action) {
    var config = getTabConfig(tabKey);
    if (!config) return '';
    var lvl = Number.isFinite(Number(level)) ? Math.max(1, Math.floor(Number(level))) : 1;
    var actionValue = typeof action === 'string' && action ? action : 'toggle';
    return '#modsTankWallOverlay .scGunsTable__row[data-level="' + String(lvl) + '"] [' + config.actionAttr + '="' + actionValue + '"]';
  }

  function buildActionSelector(tabKey, level, statKey, action) {
    var actionValue = typeof action === 'string' && action ? action : 'plus';
    if (actionValue === 'toggle') {
      return buildRowActionSelector(tabKey, level, actionValue);
    }
    return buildStatControlActionSelector(tabKey, level, statKey, actionValue);
  }

  function queryStatControlAction(documentObj, tabKey, level, statKey, action) {
    if (!documentObj || typeof documentObj.querySelector !== 'function') return null;
    var selector = buildStatControlActionSelector(tabKey, level, statKey, action);
    return selector ? documentObj.querySelector(selector) : null;
  }

  function queryAction(documentObj, tabKey, level, statKey, action) {
    if (!documentObj || typeof documentObj.querySelector !== 'function') return null;
    var selector = buildActionSelector(tabKey, level, statKey, action);
    return selector ? documentObj.querySelector(selector) : null;
  }

  global.Game = global.Game || {};
  global.Game.TankWallStatCatalog = {
    getTabConfig: getTabConfig,
    getStatGrowth: getStatGrowth,
    getStorageKeys: getStorageKeys,
    getRenderStats: getRenderStats,
    getActionAttr: getActionAttr,
    hasStat: hasStat,
    normalizeStatKey: normalizeStatKey,
    getDefaultRenderStatKey: getDefaultRenderStatKey,
    getStatLabel: getStatLabel,
    buildActionSelector: buildActionSelector,
    buildRowActionSelector: buildRowActionSelector,
    buildStatControlActionSelector: buildStatControlActionSelector,
    queryAction: queryAction,
    queryStatControlAction: queryStatControlAction,
  };
}(window));