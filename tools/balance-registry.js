(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./balance-shared.js'));
  } else {
    root.BalanceLab = root.BalanceLab || {};
    root.BalanceLab.Registry = factory(root.BalanceLab.Shared);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Shared) {
  'use strict';

  var ALL_BANDS = Shared.LEVEL_BANDS.map(function (band) { return band.id; });
  var ALL_PROFILES = Shared.PROFILE_KEYS.slice();
  var JS_PATTERNS = {
    'runtime.dmgMultPerLevel': /(dmgMultPerLevel:\s*)([0-9.]+)/,
    'runtime.fireRateBase': /(fireRateBase:\s*)([0-9.]+)/,
    'runtime.fireRateAddPerLevel': /(fireRateAddPerLevel:\s*)([0-9.]+)/,
    'runtime.zombieHpBase': /(zombieHpBase:\s*)([0-9.]+)/,
    'runtime.zombieHpExtraPerLevel': /(zombieHpExtraPerLevel:\s*)([0-9.]+)/,
    'locked.worldEvents.idleWave.betweenWavesSec': /(betweenWavesSec:\s*)([0-9.]+)/,
  };

  function createSeriesScaler(options) {
    return function (ctx, nextValue, config) {
      var factor = Shared.safeNumber(nextValue, 1);
      var bandIds = config && Array.isArray(config.bands) && config.bands.length ? config.bands : ALL_BANDS;
      Shared.forEachBandLevel(bandIds, options.maxLevel, function (level) {
        var currentValue = options.read(ctx.edit, level);
        if (!Number.isFinite(currentValue)) return;
        options.write(ctx.edit, level, Shared.round(currentValue * factor, options.digits || 4));
      });
    };
  }

  function createBandAnchorScaler(options) {
    return function (ctx, nextValue, config) {
      var factor = Shared.safeNumber(nextValue, 1);
      var bandIds = config && Array.isArray(config.bands) && config.bands.length ? config.bands : ALL_BANDS;
      bandIds.forEach(function (bandId) {
        var band = Shared.getBandById(bandId);
        var level;
        var currentValue;
        if (!band) return;
        level = Math.min(options.maxLevel || band.maxLevel, band.maxLevel);
        currentValue = options.read(ctx.edit, level);
        if (!Number.isFinite(currentValue)) return;
        options.write(ctx.edit, level, Shared.round(currentValue * factor, options.digits || 4));
      });
    };
  }

  function createAbsoluteWriter(configKey, path) {
    return function (ctx, nextValue) {
      Shared.setNestedValue(ctx.edit[configKey], path, Shared.round(Shared.safeNumber(nextValue, 1), 4));
    };
  }

  function createJsRuntimeWriter(itemId, key) {
    return function (ctx, nextValue) {
      ctx.runtimePending = ctx.runtimePending || {};
      ctx.runtimePending[itemId] = Shared.round(Shared.safeNumber(nextValue, 0), 6);
      ctx.runtimeGame = ctx.runtimeGame || {};
      ctx.runtimeGame[key] = ctx.runtimePending[itemId];
    };
  }

  function getConfiguredBands(config) {
    return config && Array.isArray(config.bands) && config.bands.length ? config.bands : ALL_BANDS;
  }

  function readExplicitZombieHealth(edit, level) {
    var explicitHealth = Shared.getNestedValue(edit.zombies, 'types[' + (level - 1) + '].Health');
    if (Number.isFinite(explicitHealth) && explicitHealth > 0) return explicitHealth;
    var legacyHealth = Shared.getNestedValue(edit.zombies, 'types[' + (level - 1) + '].health');
    return Number.isFinite(legacyHealth) && legacyHealth > 0 ? legacyHealth : null;
  }

  function getDefinitions() {
    return [
      {
        id: 'balance.tank.attackDamageMul',
        label: 'Множитель урона танка',
        group: 'Глобальные множители',
        metricFamily: 'урон танка',
        sourceFile: 'assets/balance.json',
        mode: 'absolute',
        min: 0.5,
        max: 3,
        step: 0.05,
        directionBias: 'up',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readCurrent: function (ctx) { return Shared.getNestedValue(ctx.edit.balance, 'tank.attackDamageMul'); },
        apply: createAbsoluteWriter('balance', 'tank.attackDamageMul'),
      },
      {
        id: 'balance.tank.attackSpeedMul',
        label: 'Множитель скорострельности танка',
        group: 'Глобальные множители',
        metricFamily: 'скорострельность танка',
        sourceFile: 'assets/balance.json',
        mode: 'absolute',
        min: 0.5,
        max: 3,
        step: 0.05,
        directionBias: 'up',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readCurrent: function (ctx) { return Shared.getNestedValue(ctx.edit.balance, 'tank.attackSpeedMul'); },
        apply: createAbsoluteWriter('balance', 'tank.attackSpeedMul'),
      },
      {
        id: 'series.tank.baseDamage',
        label: 'Кривая базового урона танков',
        group: 'Танки',
        metricFamily: 'урон танка',
        sourceFile: 'assets/tanks.json',
        mode: 'factor',
        min: 0.7,
        max: 1.35,
        emergencyMin: 0.000001,
        emergencyMax: 10,
        step: 0.05,
        directionBias: 'up',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        apply: createSeriesScaler({
          maxLevel: 60,
          digits: 0,
          read: function (edit, level) { return Shared.getNestedValue(edit.tanks, 'tank_lvl' + level + '.stats.baseDamage'); },
          write: function (edit, level, value) { Shared.setNestedValue(edit.tanks, 'tank_lvl' + level + '.stats.baseDamage', Math.max(1, Math.round(value))); },
        }),
      },
      {
        id: 'series.tank.baseDamage.anchor',
        label: 'Якорная точка базового урона танков',
        group: 'Танки',
        metricFamily: 'урон танка',
        sourceFile: 'assets/tanks.json',
        mode: 'factor',
        min: 0.7,
        max: 1.35,
        emergencyMin: 0.00000001,
        emergencyMax: 10,
        sanityMax: 10000,
        step: 0.05,
        directionBias: 'up',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readSanityValues: function (edit, config) {
          return getConfiguredBands(config).map(function (bandId) {
            var band = Shared.getBandById(bandId);
            return band ? Shared.getNestedValue(edit.tanks, 'tank_lvl' + band.maxLevel + '.stats.baseDamage') : null;
          }).filter(function (value) {
            return Number.isFinite(value) && value > 0;
          });
        },
        apply: createBandAnchorScaler({
          maxLevel: 60,
          digits: 0,
          read: function (edit, level) { return Shared.getNestedValue(edit.tanks, 'tank_lvl' + level + '.stats.baseDamage'); },
          write: function (edit, level, value) { Shared.setNestedValue(edit.tanks, 'tank_lvl' + level + '.stats.baseDamage', Math.max(1, Math.round(value))); },
        }),
      },
      {
        id: 'series.bullet.addDamage',
        label: 'Кривая доп. урона снарядов',
        group: 'Снаряды',
        metricFamily: 'урон танка',
        sourceFile: 'assets/bullet.json',
        mode: 'factor',
        min: 0.75,
        max: 1.4,
        emergencyMin: 0.000001,
        emergencyMax: 10,
        step: 0.05,
        directionBias: 'up',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        apply: function (ctx, nextValue) {
          var levels = Shared.getNestedValue(ctx.edit, 'bullet.bullets.bullet_base.levels') || [];
          var factor = Shared.safeNumber(nextValue, 1);
          levels.forEach(function (levelCfg, index) {
            Shared.setNestedValue(ctx.edit, 'bullet.bullets.bullet_base.levels[' + index + '].addDamage', Math.max(0, Math.round(Shared.safeNumber(levelCfg.addDamage, 0) * factor)));
          });
        },
      },
      {
        id: 'balance.zombie.attackDamageMul',
        label: 'Множитель урона зомби',
        group: 'Глобальные множители',
        metricFamily: 'давление зомби',
        sourceFile: 'assets/balance.json',
        mode: 'absolute',
        min: 0.5,
        max: 3,
        step: 0.05,
        directionBias: 'down',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readCurrent: function (ctx) { return Shared.getNestedValue(ctx.edit.balance, 'zombie.attackDamageMul'); },
        apply: createAbsoluteWriter('balance', 'zombie.attackDamageMul'),
      },
      {
        id: 'balance.zombie.attackSpeedMul',
        label: 'Множитель скорости атаки зомби',
        group: 'Глобальные множители',
        metricFamily: 'давление зомби',
        sourceFile: 'assets/balance.json',
        mode: 'absolute',
        min: 0.5,
        max: 3,
        step: 0.05,
        directionBias: 'down',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readCurrent: function (ctx) { return Shared.getNestedValue(ctx.edit.balance, 'zombie.attackSpeedMul'); },
        apply: createAbsoluteWriter('balance', 'zombie.attackSpeedMul'),
      },
      {
        id: 'balance.zombie.speedMul',
        label: 'Множитель скорости зомби',
        group: 'Глобальные множители',
        metricFamily: 'давление зомби',
        sourceFile: 'assets/balance.json',
        mode: 'absolute',
        min: 0.5,
        max: 3,
        step: 0.05,
        directionBias: 'down',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readCurrent: function (ctx) { return Shared.getNestedValue(ctx.edit.balance, 'zombie.speedMul'); },
        apply: createAbsoluteWriter('balance', 'zombie.speedMul'),
      },
      {
        id: 'series.zombie.attackDamage',
        label: 'Кривая урона зомби',
        group: 'Зомби',
        metricFamily: 'давление зомби',
        sourceFile: 'assets/zombies.json',
        mode: 'factor',
        min: 0.7,
        max: 1.35,
        emergencyMin: 0.000001,
        emergencyMax: 10,
        step: 0.05,
        directionBias: 'down',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        apply: createSeriesScaler({
          maxLevel: 60,
          digits: 0,
          read: function (edit, level) { return Shared.getNestedValue(edit.zombies, 'types[' + (level - 1) + '].attackDamage'); },
          write: function (edit, level, value) { Shared.setNestedValue(edit.zombies, 'types[' + (level - 1) + '].attackDamage', Math.max(1, Math.round(value))); },
        }),
      },
      {
        id: 'series.zombie.health',
        label: 'Кривая явного HP зомби',
        group: 'Зомби',
        metricFamily: 'здоровье зомби',
        sourceFile: 'assets/zombies.json',
        mode: 'factor',
        min: 0.7,
        max: 1.35,
        emergencyMin: 0.000001,
        emergencyMax: 1000000,
        step: 0.05,
        directionBias: 'down',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        apply: createSeriesScaler({
          maxLevel: 60,
          digits: 0,
          read: function (edit, level) {
            var explicitHealth = Shared.getNestedValue(edit.zombies, 'types[' + (level - 1) + '].Health');
            if (Number.isFinite(explicitHealth) && explicitHealth > 0) return explicitHealth;
            var legacyHealth = Shared.getNestedValue(edit.zombies, 'types[' + (level - 1) + '].health');
            return Number.isFinite(legacyHealth) && legacyHealth > 0 ? legacyHealth : null;
          },
          write: function (edit, level, value) {
            var explicitPath = 'types[' + (level - 1) + '].Health';
            var legacyPath = 'types[' + (level - 1) + '].health';
            var nextValue = Math.max(1, Math.round(value));
            var explicitHealth = Shared.getNestedValue(edit.zombies, explicitPath);
            var legacyHealth = Shared.getNestedValue(edit.zombies, legacyPath);
            if (Number.isFinite(explicitHealth) && explicitHealth > 0) {
              Shared.setNestedValue(edit.zombies, explicitPath, nextValue);
              return;
            }
            if (Number.isFinite(legacyHealth) && legacyHealth > 0) {
              Shared.setNestedValue(edit.zombies, legacyPath, nextValue);
              return;
            }
            Shared.setNestedValue(edit.zombies, explicitPath, nextValue);
          },
        }),
      },
      {
        id: 'series.zombie.health.anchor',
        label: 'Якорная точка явного HP зомби',
        group: 'Зомби',
        metricFamily: 'здоровье зомби',
        sourceFile: 'assets/zombies.json',
        mode: 'factor',
        min: 0.7,
        max: 1.35,
        emergencyMin: 0.000001,
        emergencyMax: 1000000,
        sanityMax: 9999999,
        step: 0.05,
        directionBias: 'down',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readSanityValues: function (edit, config) {
          return getConfiguredBands(config).map(function (bandId) {
            var band = Shared.getBandById(bandId);
            return band ? readExplicitZombieHealth(edit, band.maxLevel) : null;
          }).filter(function (value) {
            return Number.isFinite(value) && value > 0;
          });
        },
        apply: createBandAnchorScaler({
          maxLevel: 60,
          digits: 0,
          read: function (edit, level) {
            return readExplicitZombieHealth(edit, level);
          },
          write: function (edit, level, value) {
            var explicitPath = 'types[' + (level - 1) + '].Health';
            var legacyPath = 'types[' + (level - 1) + '].health';
            var nextValue = Math.max(1, Math.round(value));
            var explicitHealth = Shared.getNestedValue(edit.zombies, explicitPath);
            var legacyHealth = Shared.getNestedValue(edit.zombies, legacyPath);
            if (Number.isFinite(explicitHealth) && explicitHealth > 0) {
              Shared.setNestedValue(edit.zombies, explicitPath, nextValue);
              return;
            }
            if (Number.isFinite(legacyHealth) && legacyHealth > 0) {
              Shared.setNestedValue(edit.zombies, legacyPath, nextValue);
              return;
            }
            Shared.setNestedValue(edit.zombies, explicitPath, nextValue);
          },
        }),
      },
      {
        id: 'series.zombie.hpMul',
        label: 'Кривая множителя HP зомби',
        group: 'Зомби',
        metricFamily: 'здоровье зомби',
        sourceFile: 'assets/zombies.json',
        mode: 'factor',
        min: 0.7,
        max: 1.35,
        emergencyMin: 0.000001,
        emergencyMax: 1000000,
        step: 0.05,
        directionBias: 'down',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        apply: createSeriesScaler({
          maxLevel: 60,
          digits: 4,
          read: function (edit, level) { return Shared.getNestedValue(edit.zombies, 'types[' + (level - 1) + '].hpMul'); },
          write: function (edit, level, value) { Shared.setNestedValue(edit.zombies, 'types[' + (level - 1) + '].hpMul', Math.max(0.01, Shared.round(value, 4))); },
        }),
      },
      {
        id: 'series.zombie.rewardMul',
        label: 'Кривая награды зомби',
        group: 'Экономика',
        metricFamily: 'награды / экономика',
        sourceFile: 'assets/zombies.json',
        mode: 'factor',
        min: 0.7,
        max: 1.4,
        step: 0.05,
        directionBias: 'up',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        apply: createSeriesScaler({
          maxLevel: 60,
          digits: 4,
          read: function (edit, level) { return Shared.getNestedValue(edit.zombies, 'types[' + (level - 1) + '].rewardMul'); },
          write: function (edit, level, value) { Shared.setNestedValue(edit.zombies, 'types[' + (level - 1) + '].rewardMul', Math.max(0.01, Shared.round(value, 4))); },
        }),
      },
      {
        id: 'series.fence.segmentMaxHp',
        label: 'Кривая HP сегмента стены',
        group: 'Стены',
        metricFamily: 'прочность стены',
        sourceFile: 'assets/fence.json',
        mode: 'factor',
        min: 0.75,
        max: 1.4,
        step: 0.05,
        directionBias: 'up',
        bands: Shared.LEVEL_BANDS.slice(0, 4).map(function (band) { return band.id; }),
        profiles: ALL_PROFILES,
        apply: createSeriesScaler({
          maxLevel: 41,
          digits: 0,
          read: function (edit, level) { return Shared.getNestedValue(edit.fence, 'levels[' + (level - 1) + '].segmentMaxHp'); },
          write: function (edit, level, value) { Shared.setNestedValue(edit.fence, 'levels[' + (level - 1) + '].segmentMaxHp', Math.max(1, Math.round(value))); },
        }),
      },
      {
        id: 'series.fence.armorFlat',
        label: 'Кривая плоской брони стены',
        group: 'Стены',
        metricFamily: 'броня стены',
        sourceFile: 'assets/fence.json',
        mode: 'factor',
        min: 0.75,
        max: 1.4,
        step: 0.05,
        directionBias: 'up',
        bands: Shared.LEVEL_BANDS.slice(0, 4).map(function (band) { return band.id; }),
        profiles: ALL_PROFILES,
        apply: createSeriesScaler({
          maxLevel: 41,
          digits: 4,
          read: function (edit, level) { return Shared.getNestedValue(edit.fence, 'levels[' + (level - 1) + '].armorFlat'); },
          write: function (edit, level, value) { Shared.setNestedValue(edit.fence, 'levels[' + (level - 1) + '].armorFlat', Math.max(0, Shared.round(value, 4))); },
        }),
      },
      {
        id: 'series.drone.repairSpeedMult',
        label: 'Кривая скорости ремонта дронов',
        group: 'Дроны',
        metricFamily: 'скорость ремонта',
        sourceFile: 'assets/dron.json',
        mode: 'factor',
        min: 0.8,
        max: 1.4,
        step: 0.05,
        directionBias: 'up',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        apply: function (ctx, nextValue) {
          var factor = Shared.safeNumber(nextValue, 1);
          Object.keys(ctx.edit.dron.levels || {}).forEach(function (levelKey) {
            var currentValue = Shared.getNestedValue(ctx.edit.dron, 'levels.' + levelKey + '.repairSpeedMult');
            Shared.setNestedValue(ctx.edit.dron, 'levels.' + levelKey + '.repairSpeedMult', Math.max(0.01, Shared.round(currentValue * factor, 4)));
          });
        },
      },
      {
        id: 'series.drone.costMult',
        label: 'Кривая стоимости дронов',
        group: 'Дроны',
        metricFamily: 'экономика',
        sourceFile: 'assets/dron.json',
        mode: 'factor',
        min: 0.8,
        max: 1.3,
        step: 0.05,
        directionBias: 'down',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        apply: function (ctx, nextValue) {
          var factor = Shared.safeNumber(nextValue, 1);
          Object.keys(ctx.edit.dron.levels || {}).forEach(function (levelKey) {
            var currentValue = Shared.getNestedValue(ctx.edit.dron, 'levels.' + levelKey + '.costMult');
            Shared.setNestedValue(ctx.edit.dron, 'levels.' + levelKey + '.costMult', Math.max(0.01, Shared.round(currentValue * factor, 4)));
          });
        },
      },
      {
        id: 'runtime.dmgMultPerLevel',
        label: 'BAL: множитель урона за уровень',
        group: 'Константы runtime',
        metricFamily: 'runtime-кривая',
        sourceFile: 'game.js',
        mode: 'absolute',
        min: 1.05,
        max: 2.2,
        step: 0.01,
        directionBias: 'up',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readCurrent: function (ctx) { return ctx.runtimeGame.dmgMultPerLevel; },
        apply: createJsRuntimeWriter('runtime.dmgMultPerLevel', 'dmgMultPerLevel'),
      },
      {
        id: 'runtime.fireRateBase',
        label: 'BAL: базовая скорострельность',
        group: 'Константы runtime',
        metricFamily: 'runtime-кривая',
        sourceFile: 'game.js',
        mode: 'absolute',
        min: 0.3,
        max: 2,
        step: 0.01,
        directionBias: 'up',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readCurrent: function (ctx) { return ctx.runtimeGame.fireRateBase; },
        apply: createJsRuntimeWriter('runtime.fireRateBase', 'fireRateBase'),
      },
      {
        id: 'runtime.fireRateAddPerLevel',
        label: 'BAL: прирост скорострельности за уровень',
        group: 'Константы runtime',
        metricFamily: 'runtime-кривая',
        sourceFile: 'game.js',
        mode: 'absolute',
        min: 0.01,
        max: 0.25,
        step: 0.005,
        directionBias: 'up',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readCurrent: function (ctx) { return ctx.runtimeGame.fireRateAddPerLevel; },
        apply: createJsRuntimeWriter('runtime.fireRateAddPerLevel', 'fireRateAddPerLevel'),
      },
      {
        id: 'runtime.zombieHpBase',
        label: 'BAL: базовое HP зомби',
        group: 'Константы runtime',
        metricFamily: 'runtime-кривая',
        sourceFile: 'game.js',
        mode: 'absolute',
        min: 10,
        max: 120,
        step: 1,
        directionBias: 'down',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readCurrent: function (ctx) { return ctx.runtimeGame.zombieHpBase; },
        apply: createJsRuntimeWriter('runtime.zombieHpBase', 'zombieHpBase'),
      },
      {
        id: 'runtime.zombieHpExtraPerLevel',
        label: 'BAL: доп. HP зомби за уровень',
        group: 'Константы runtime',
        metricFamily: 'runtime-кривая',
        sourceFile: 'game.js',
        mode: 'absolute',
        min: 0,
        max: 0.5,
        step: 0.01,
        directionBias: 'down',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readCurrent: function (ctx) { return ctx.runtimeGame.zombieHpExtraPerLevel; },
        apply: createJsRuntimeWriter('runtime.zombieHpExtraPerLevel', 'zombieHpExtraPerLevel'),
      },
      {
        id: 'locked.worldEvents.idleWave.betweenWavesSec',
        label: 'Заблокировано: idleWave.betweenWavesSec',
        group: 'Константы runtime',
        metricFamily: 'заблокированный runtime',
        sourceFile: 'src/config/worldEvents.js',
        mode: 'absolute',
        locked: true,
        lockedReason: 'Интервал idle-wave в AttackMode защищён и не должен попадать в solver/write-path.',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readCurrent: function (ctx) { return ctx.runtimeLocked['locked.worldEvents.idleWave.betweenWavesSec']; },
      },
      {
        id: 'locked.worldEvents.waveAttackMul',
        label: 'Заблокировано: zombieWaveAtkMult x1.05',
        group: 'Константы runtime',
        metricFamily: 'заблокированный runtime',
        sourceFile: 'src/systems/worldEventsRuntime.js',
        mode: 'absolute',
        locked: true,
        lockedReason: 'Множитель zombieWaveAtkMult по волнам защищён и должен оставаться x1.05.',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readCurrent: function (ctx) { return ctx.runtimeLocked['locked.worldEvents.waveAttackMul']; },
      },
      {
        id: 'locked.worldEvents.waveHpMul',
        label: 'Заблокировано: zombieWaveHpMult x1.05',
        group: 'Константы runtime',
        metricFamily: 'заблокированный runtime',
        sourceFile: 'src/systems/worldEventsRuntime.js',
        mode: 'absolute',
        locked: true,
        lockedReason: 'Множитель zombieWaveHpMult по волнам защищён и должен оставаться x1.05.',
        bands: ALL_BANDS,
        profiles: ALL_PROFILES,
        readCurrent: function (ctx) { return ctx.runtimeLocked['locked.worldEvents.waveHpMul']; },
      },
    ];
  }

  function readRuntimeValuesFromSources(sources) {
    var values = {
      'runtime.dmgMultPerLevel': Shared.DEFAULT_RUNTIME_CONSTANTS.dmgMultPerLevel,
      'runtime.fireRateBase': Shared.DEFAULT_RUNTIME_CONSTANTS.fireRateBase,
      'runtime.fireRateAddPerLevel': Shared.DEFAULT_RUNTIME_CONSTANTS.fireRateAddPerLevel,
      'runtime.zombieHpBase': Shared.DEFAULT_RUNTIME_CONSTANTS.zombieHpBase,
      'runtime.zombieHpExtraPerLevel': Shared.DEFAULT_RUNTIME_CONSTANTS.zombieHpExtraPerLevel,
      'locked.worldEvents.idleWave.betweenWavesSec': 15,
      'locked.worldEvents.waveAttackMul': 1.05,
      'locked.worldEvents.waveHpMul': 1.05,
    };
    var gameSource = sources && sources['game.js'] ? sources['game.js'] : '';
    var worldCfgSource = sources && sources['src/config/worldEvents.js'] ? sources['src/config/worldEvents.js'] : '';
    var worldRuntimeSource = sources && sources['src/systems/worldEventsRuntime.js'] ? sources['src/systems/worldEventsRuntime.js'] : '';
    Object.keys(JS_PATTERNS).forEach(function (id) {
      var source = id.indexOf('runtime.') === 0 ? gameSource : worldCfgSource;
      if (id.indexOf('wave') !== -1) source = worldRuntimeSource;
      var match = source.match(JS_PATTERNS[id]);
      if (match && match[2] !== undefined) values[id] = Shared.safeNumber(match[2], values[id]);
    });
    var waveMatches = worldRuntimeSource.match(/\*\s*(1\.05)/g) || [];
    if (waveMatches.length >= 2) {
      values['locked.worldEvents.waveAttackMul'] = 1.05;
      values['locked.worldEvents.waveHpMul'] = 1.05;
    }
    return values;
  }

  function createRuntimeContext(sources) {
    var values = readRuntimeValuesFromSources(sources || {});
    return {
      runtimeGame: {
        dmgMultPerLevel: values['runtime.dmgMultPerLevel'],
        fireRateBase: values['runtime.fireRateBase'],
        fireRateAddPerLevel: values['runtime.fireRateAddPerLevel'],
        zombieHpBase: values['runtime.zombieHpBase'],
        zombieHpExtraPerLevel: values['runtime.zombieHpExtraPerLevel'],
      },
      runtimeLocked: {
        'locked.worldEvents.idleWave.betweenWavesSec': values['locked.worldEvents.idleWave.betweenWavesSec'],
        'locked.worldEvents.waveAttackMul': values['locked.worldEvents.waveAttackMul'],
        'locked.worldEvents.waveHpMul': values['locked.worldEvents.waveHpMul'],
      },
      runtimePending: {},
    };
  }

  function createRegistry() {
    return getDefinitions().map(function (item) {
      return Object.assign({}, item, {
        bands: (item.bands || ALL_BANDS).slice(),
        profiles: (item.profiles || ALL_PROFILES).slice(),
      });
    });
  }

  function createTunableState(registry, context) {
    var ctx = context || {};
    var state = {};
    registry.forEach(function (item) {
      var currentValue = item.mode === 'factor'
        ? 1
        : (typeof item.readCurrent === 'function' ? item.readCurrent(ctx) : null);
      state[item.id] = {
        enabled: false,
        min: item.min,
        max: item.max,
        step: item.step,
        value: currentValue,
        bands: (item.bands || ALL_BANDS).slice(),
        directionBias: item.directionBias || 'neutral',
      };
    });
    return state;
  }

  function getItemById(registry, id) {
    var index;
    for (index = 0; index < registry.length; index++) {
      if (registry[index].id === id) return registry[index];
    }
    return null;
  }

  function getEnabledItems(registry, tunableState) {
    return registry.filter(function (item) {
      return !item.locked && tunableState[item.id] && tunableState[item.id].enabled;
    });
  }

  function applyTunable(ctx, item, nextValue, tunableConfig) {
    if (!item || item.locked || typeof item.apply !== 'function') return;
    item.apply(ctx, nextValue, tunableConfig || {});
  }

  function applyRuntimeValuesToSources(sources, registry, originalRuntimeContext, pendingRuntimeValues) {
    var nextSources = Object.assign({}, sources || {});
    registry.forEach(function (item) {
      if (item.locked || item.sourceFile !== 'game.js') return;
      var nextValue = pendingRuntimeValues[item.id];
      var originalValue = originalRuntimeContext.runtimeGame[item.id.replace('runtime.', '')];
      if (!Number.isFinite(nextValue) || nextValue === originalValue) return;
      var pattern = JS_PATTERNS[item.id];
      if (!pattern) return;
      nextSources['game.js'] = (nextSources['game.js'] || '').replace(pattern, '$1' + Shared.formatNumber(nextValue, 6));
    });
    return nextSources;
  }

  return {
    createRegistry: createRegistry,
    createRuntimeContext: createRuntimeContext,
    readRuntimeValuesFromSources: readRuntimeValuesFromSources,
    createTunableState: createTunableState,
    getItemById: getItemById,
    getEnabledItems: getEnabledItems,
    applyTunable: applyTunable,
    applyRuntimeValuesToSources: applyRuntimeValuesToSources,
  };
}));