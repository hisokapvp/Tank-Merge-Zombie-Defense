(function (root) {
  'use strict';

  var state = {
    initialized: false,
    initializing: false,
    app: null,
    labState: null,
    registry: null,
    tunables: null,
    sources: null,
    runtimeOriginal: null,
    runtimeCurrent: null,
    repoHandle: null,
    selectedScenarioIds: null,
    activeRootTab: 'assets',
    preOptimizeSnapshot: null,
  };

  function getFindingLabel(key) {
    var labels = {
      singleZombieTtk: 'TTK по одиночной цели',
      packTtk: 'TTK по пачке',
      fenceDamagePerAttackWindow: 'урон по ограде за окно',
      fenceSurvivalSec: 'время выживания ограды',
      progressionPressure: 'давление прогрессии',
      decadeJump: 'скачок между десятками',
      fencePressure: 'давление на ограду',
    };
    return labels[key] || key;
  }

  function getModules() {
    if (!root.BalanceLab || !root.BalanceLab.Shared || !root.BalanceLab.Registry || !root.BalanceLab.Optimizer) {
      return null;
    }
    return {
      Shared: root.BalanceLab.Shared,
      Registry: root.BalanceLab.Registry,
      Optimizer: root.BalanceLab.Optimizer,
    };
  }

  function injectStyles() {
    if (document.getElementById('balanceLabStyles')) return;
    var style = document.createElement('style');
    style.id = 'balanceLabStyles';
    style.textContent = [
      '#balanceLabRootTabs { background:#0f172a; display:flex; flex-wrap:wrap; gap:0; border-bottom:1px solid #20304b; }',
      '#balanceLabRootTabs button { background:transparent; border:none; color:#9cb0cf; padding:12px 18px; cursor:pointer; font-size:13px; border-bottom:2px solid transparent; }',
      '#balanceLabRootTabs button.is-active { color:#fff; border-bottom-color:#53a8b6; }',
      '.balanceLabPanel { display:none; padding:16px 24px 80px; }',
      '.balanceLabPanel.is-active { display:block; }',
      '.balanceLabCard { background:#16213e; border:1px solid #24334d; border-radius:8px; padding:14px; margin-bottom:16px; }',
      '.balanceLabGrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }',
      '.balanceLabMetric { background:#0f3460; border-radius:8px; padding:12px; }',
      '.balanceLabMetric strong { display:block; font-size:22px; color:#fff; margin-top:4px; }',
      '.balanceLabGoalTuningGrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; margin-top:12px; }',
      '.balanceLabGoalTuningCard { background:#0f172a; border:1px solid #24334d; border-radius:8px; padding:12px; }',
      '.balanceLabGoalTuningLabel { display:flex; justify-content:space-between; gap:12px; align-items:center; color:#d7e6ff; font-size:12px; margin-bottom:8px; }',
      '.balanceLabGoalTuningValue { color:#53a8b6; font-weight:700; }',
      '.balanceLabGoalTuningHint { color:#90a0ba; font-size:11px; line-height:1.4; margin-top:8px; }',
      '.balanceLabGoalTuningCard input[type="range"] { width:100%; accent-color:#53a8b6; }',
      '.balanceLabTableWrap { overflow:auto; border:1px solid #22324f; border-radius:8px; }',
      '.balanceLabTable { width:100%; border-collapse:collapse; font-size:12px; min-width:1180px; }',
      '.balanceLabTable th { position:sticky; top:0; background:#0f3460; color:#cfe0ff; padding:6px 8px; text-align:left; }',
      '.balanceLabTable td { border-bottom:1px solid #1f2d44; padding:4px 6px; vertical-align:top; }',
      '.balanceLabTable input, .balanceLabTable select, .balanceLabInlineInput { background:#0d1727; color:#fff; border:1px solid #334767; border-radius:4px; padding:3px 6px; font-size:12px; width:100%; }',
      '.balanceLabInlineInput { width:auto; }',
      '.balanceLabBadge { display:inline-flex; align-items:center; gap:4px; background:#27486a; color:#d9f5ff; padding:2px 7px; border-radius:999px; font-size:11px; }',
      '.balanceLabBadge--locked { background:#5a2b2b; color:#ffd5d5; }',
      '.balanceLabBandChecks { display:grid; grid-template-columns:repeat(3, minmax(80px, 1fr)); gap:4px; }',
      '.balanceLabBandChecks label { display:flex; gap:4px; align-items:center; font-size:11px; color:#b8c6da; }',
      '.balanceLabActions { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0; }',
      '.balanceLabActions button { background:#53a8b6; color:#08111c; border:none; border-radius:6px; padding:8px 12px; cursor:pointer; font-weight:600; }',
      '.balanceLabActions button:disabled { opacity:0.45; cursor:not-allowed; }',
      '.balanceLabActions button.secondary { background:#243b55; color:#fff; }',
      '.balanceLabActions button.warn { background:#ffc107; color:#111; }',
      '.balanceLabCode { background:#0b1220; border:1px solid #22324f; border-radius:8px; padding:12px; color:#d6e2f7; font-family:"Cascadia Code", monospace; font-size:12px; white-space:pre-wrap; max-height:420px; overflow:auto; }',
      '.balanceLabHelp { color:#b9c8dc; font-size:13px; line-height:1.5; }',
      '.balanceLabSmall { color:#90a0ba; font-size:11px; }',
      '.balanceLabList { margin:0; padding-left:18px; }',
      '.balanceLabList li { margin:4px 0; }',
      '.balanceLabCurrentValue { color:#53a8b6; font-variant-numeric:tabular-nums; }',
      '@media (max-width: 900px) { .balanceLabPanel { padding:12px 12px 88px; } .balanceLabTable { min-width:1000px; } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensureShell() {
    if (document.getElementById('balanceLabRootTabs')) return;
    var tabs = document.getElementById('tabs');
    var main = document.querySelector('main');
    if (!tabs || !main) return;

    var rootTabs = document.createElement('nav');
    rootTabs.id = 'balanceLabRootTabs';
    rootTabs.innerHTML = [
      '<button data-root-tab="assets" class="is-active">Ассеты</button>',
      '<button data-root-tab="profiles">Профили</button>',
      '<button data-root-tab="goals">Цели</button>',
      '<button data-root-tab="tunables">Параметры</button>',
      '<button data-root-tab="earnings">Заработок</button>',
      '<button data-root-tab="optimize">Оптимизация</button>',
      '<button data-root-tab="write">Дифф / запись</button>'
    ].join('');

    var assetsPanel = document.createElement('section');
    assetsPanel.id = 'balanceLabPanelAssets';
    assetsPanel.className = 'balanceLabPanel is-active';
    tabs.parentNode.insertBefore(rootTabs, tabs);
    tabs.parentNode.insertBefore(assetsPanel, tabs);
    assetsPanel.appendChild(tabs);
    assetsPanel.appendChild(main);

    ['profiles', 'goals', 'tunables', 'earnings', 'optimize', 'write'].forEach(function (panelKey) {
      var panel = document.createElement('section');
      panel.id = 'balanceLabPanel' + panelKey.charAt(0).toUpperCase() + panelKey.slice(1);
      panel.className = 'balanceLabPanel';
      panel.innerHTML = '<div class="balanceLabCard balanceLabHelp">Загрузка...</div>';
      assetsPanel.parentNode.insertBefore(panel, document.querySelector('.status-bar'));
    });

    rootTabs.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-root-tab]');
      if (!button) return;
      setActiveRootTab(button.getAttribute('data-root-tab'));
    });
  }

  function setActiveRootTab(tabKey) {
    state.activeRootTab = tabKey;
    Array.prototype.forEach.call(document.querySelectorAll('#balanceLabRootTabs button'), function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-root-tab') === tabKey);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.balanceLabPanel'), function (panel) {
      panel.classList.remove('is-active');
    });
    var activePanel = document.getElementById('balanceLabPanel' + tabKey.charAt(0).toUpperCase() + tabKey.slice(1));
    if (activePanel) activePanel.classList.add('is-active');
    if (tabKey === 'optimize') renderOptimizeCharts();
    if (tabKey === 'earnings') renderEarningsPanel();
  }

  function getApp() {
    return root.BalanceEditorApp || null;
  }

  function loadText(path) {
    return fetch(path, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + path);
        return response.text();
      })
      .catch(function () { return ''; });
  }

  function getDataBundle() {
    return state.app && typeof state.app.buildDataBundle === 'function' ? state.app.buildDataBundle() : null;
  }

  function buildOptimizerContext() {
    return {
      edit: getDataBundle(),
      runtimeGame: Object.assign({}, state.runtimeCurrent.runtimeGame),
      runtimeLocked: Object.assign({}, state.runtimeCurrent.runtimeLocked),
    };
  }

  function getVisibleProfileKeys() {
    return ['base'];
  }

  function getVisibleScenarioList() {
    if (!state.labState) return [];
    return getModules().Shared.getScenarioList(state.labState.profiles).filter(function (scenario) {
      return getVisibleProfileKeys().indexOf(scenario.profileKey) !== -1;
    });
  }

  function getScenarioIdList() {
    var visibleScenarioIds = getVisibleScenarioList().map(function (scenario) { return scenario.id; });
    var selectedVisibleIds;

    if (!visibleScenarioIds.length) return [];
    if (Array.isArray(state.selectedScenarioIds) && state.selectedScenarioIds.length) {
      selectedVisibleIds = state.selectedScenarioIds.filter(function (scenarioId) {
        return visibleScenarioIds.indexOf(scenarioId) !== -1;
      });
      if (selectedVisibleIds.length) return selectedVisibleIds;
    }
    return visibleScenarioIds;
  }

  function getRecommendedTunableIds() {
    return ['series.tank.baseDamage', 'series.zombie.health', 'series.bullet.addDamage'];
  }

  function ensureRecommendedTunablesEnabled() {
    var modules = getModules();
    var activated = [];
    getRecommendedTunableIds().forEach(function (id) {
      var item = modules.Registry.getItemById(state.registry, id);
      var tunable = state.tunables[id];
      if (!item || !tunable || item.locked || tunable.enabled) return;
      tunable.enabled = true;
      activated.push(item.label);
    });
    return activated;
  }

  function scopeTunablesToWorstBand(tunableIds) {
    var Shared = getModules().Shared;
    var evaluation = evaluateCurrentMatrix();
    var worstRow = null;
    var band;

    evaluation.rows.forEach(function (row) {
      if (!worstRow || row.evaluation.score > worstRow.evaluation.score) worstRow = row;
    });
    if (!worstRow || !worstRow.scenario || worstRow.evaluation.score <= 0) return null;

    band = Shared.getBandById(worstRow.scenario.bandId);
    (Array.isArray(tunableIds) ? tunableIds : []).forEach(function (id) {
      var tunable = state.tunables[id];
      if (!tunable) return;
      tunable.bands = [worstRow.scenario.bandId];
    });
    return band ? band.label : worstRow.scenario.bandId;
  }

  function describeBandPasses(result) {
    if (!result || !Array.isArray(result.bandPasses) || !result.bandPasses.length) return '';
    return ' Авто-режим прошёл диапазоны: ' + result.bandPasses.map(function (pass) {
      return pass.label || pass.bandId;
    }).join(', ') + '.';
  }

  function getRepresentativeBandLevel(bands) {
    var Shared = getModules().Shared;
    var selectedBands = Array.isArray(bands) && bands.length ? bands : Shared.LEVEL_BANDS.map(function (band) { return band.id; });
    var level = 1;
    selectedBands.forEach(function (bandId) {
      var band = Shared.getBandById(bandId);
      if (band && band.maxLevel > level) level = band.maxLevel;
    });
    return level;
  }

  function describeConcreteOptimizerChange(change) {
    var Shared = getModules().Shared;
    var level = getRepresentativeBandLevel(change && change.bands);
    var before;
    var after;
    var label;

    if (!change || !state.app) return null;

    if (change.id === 'series.tank.baseDamage' || change.id === 'series.tank.baseDamage.anchor') {
      label = 'assets/tanks.json → tank_lvl' + level + '.stats.baseDamage';
      before = Shared.getNestedValue(state.app.DATA.tanks, 'tank_lvl' + level + '.stats.baseDamage');
      after = Shared.getNestedValue(state.app.EDIT.tanks, 'tank_lvl' + level + '.stats.baseDamage');
    } else if (change.id === 'series.zombie.health' || change.id === 'series.zombie.health.anchor') {
      label = 'assets/zombies.json → types[' + (level - 1) + '].Health';
      before = Shared.getNestedValue(state.app.DATA.zombies, 'types[' + (level - 1) + '].Health');
      if (!Number.isFinite(before)) before = Shared.getNestedValue(state.app.DATA.zombies, 'types[' + (level - 1) + '].health');
      after = Shared.getNestedValue(state.app.EDIT.zombies, 'types[' + (level - 1) + '].Health');
      if (!Number.isFinite(after)) after = Shared.getNestedValue(state.app.EDIT.zombies, 'types[' + (level - 1) + '].health');
    } else if (change.id === 'series.zombie.attackDamage') {
      label = 'assets/zombies.json → types[' + (level - 1) + '].attackDamage';
      before = Shared.getNestedValue(state.app.DATA.zombies, 'types[' + (level - 1) + '].attackDamage');
      after = Shared.getNestedValue(state.app.EDIT.zombies, 'types[' + (level - 1) + '].attackDamage');
    } else if (change.id === 'series.zombie.hpMul') {
      label = 'assets/zombies.json → types[' + (level - 1) + '].hpMul';
      before = Shared.getNestedValue(state.app.DATA.zombies, 'types[' + (level - 1) + '].hpMul');
      after = Shared.getNestedValue(state.app.EDIT.zombies, 'types[' + (level - 1) + '].hpMul');
    } else if (change.id === 'series.bullet.addDamage') {
      label = 'assets/bullet.json → bullets.bullet_base.levels[' + (level - 1) + '].addDamage';
      before = Shared.getNestedValue(state.app.DATA.bullet, 'bullets.bullet_base.levels[' + (level - 1) + '].addDamage');
      after = Shared.getNestedValue(state.app.EDIT.bullet, 'bullets.bullet_base.levels[' + (level - 1) + '].addDamage');
    } else if (change.id === 'balance.tank.attackDamageMul') {
      label = 'assets/balance.json → tank.attackDamageMul';
      before = Shared.getNestedValue(state.app.DATA.balance, 'tank.attackDamageMul');
      after = Shared.getNestedValue(state.app.EDIT.balance, 'tank.attackDamageMul');
    } else if (change.id === 'balance.zombie.attackDamageMul') {
      label = 'assets/balance.json → zombie.attackDamageMul';
      before = Shared.getNestedValue(state.app.DATA.balance, 'zombie.attackDamageMul');
      after = Shared.getNestedValue(state.app.EDIT.balance, 'zombie.attackDamageMul');
    }

    if (!label || before === after) return null;
    return { label: label, before: before, after: after };
  }

  function collectConcreteOptimizerChanges() {
    if (!state.labState || !state.labState.optimizerResult || !Array.isArray(state.labState.optimizerResult.changedTunables)) return [];
    return state.labState.optimizerResult.changedTunables.map(describeConcreteOptimizerChange).filter(Boolean);
  }

  function parseRankList(text) {
    return String(text || '')
      .split(',')
      .map(function (value) { return value.trim(); })
      .filter(Boolean)
      .map(function (value) { return parseInt(value, 10); })
      .filter(function (value) { return Number.isFinite(value); });
  }

  function replaceEditState(nextEdit) {
    Object.keys(nextEdit).forEach(function (key) {
      state.app.EDIT[key] = nextEdit[key];
    });
    state.app.renderAll();
  }

  function collectPendingRuntimeValues() {
    var pending = {};
    Object.keys(state.runtimeOriginal.runtimeGame).forEach(function (key) {
      var originalValue = state.runtimeOriginal.runtimeGame[key];
      var currentValue = state.runtimeCurrent.runtimeGame[key];
      var itemId = 'runtime.' + key;
      if (currentValue !== originalValue) pending[itemId] = currentValue;
    });
    return pending;
  }

  function evaluateCurrentMatrix() {
    var Shared = getModules().Shared;
    var rows = Shared.evaluateMatrix(
      Shared.buildRuntimeData(getDataBundle(), state.runtimeCurrent.runtimeGame),
      state.labState.profiles,
      state.labState.goals,
      { selectedScenarioIds: getScenarioIdList() }
    );
    var summary = Shared.summarizeCoverage(rows);
    state.labState.lastEvaluation = { rows: rows, summary: summary };
    return state.labState.lastEvaluation;
  }

  function getGoalTuning() {
    var modules = getModules();
    if (!modules) return { desiredTtk: 5, zombiePressure: 50, progressionPressure: 50 };
    if (!state.labState.goalTuning) state.labState.goalTuning = modules.Shared.createDefaultGoalTuning();
    return state.labState.goalTuning;
  }

  function describeGoalTuningValue(field, value) {
    var modules = getModules();
    var shared = modules && modules.Shared ? modules.Shared : null;
    if (field === 'desiredTtk') {
      var desiredTtk = shared ? shared.safeNumber(value, 5) : Number(value);
      if (!(desiredTtk > 0)) desiredTtk = 5;
      if (desiredTtk >= 8) return 'Долгие бои и высокий TTK';
      if (desiredTtk <= 3) return 'Быстрые убийства и низкий TTK';
      return 'Сбалансированное время убийства';
    }
    var safeValue = Math.max(0, Math.min(100, Math.round(shared ? shared.safeNumber(value, 50) : Number(value) || 50)));
    if (field === 'zombiePressure') {
      if (safeValue >= 75) return 'Зомби чаще продавливают ограду';
      if (safeValue <= 25) return 'Игрок чаще держит волну без риска';
      return 'Умеренное давление на ограду';
    }
    if (safeValue >= 75) return 'Жёсткая прогрессия и дорогие ошибки';
    if (safeValue <= 25) return 'Мягкая прогрессия и быстрый разгон';
    return 'Среднее давление прогрессии';
  }

  function buildGoalTuningSummary(goalTuning) {
    return [
      'TTK ' + goalTuning.desiredTtk + ' c',
      'давление зомби ' + goalTuning.zombiePressure,
      'прогрессия ' + goalTuning.progressionPressure
    ].join(' / ');
  }

  function rebuildGoalsFromTuning(statusText) {
    var modules = getModules();
    state.labState.goals = modules.Shared.createDefaultGoals(getDataBundle(), state.labState.profiles, getGoalTuning());
    state.labState.optimizerResult = null;
    state.preOptimizeSnapshot = null;
    renderGoalsPanel();
    renderOptimizePanel();
    renderWritePanel();
    if (statusText) state.app.setStatus(statusText);
  }

  function renderProfilesPanel() {
    var Shared = getModules().Shared;
    var panel = document.getElementById('balanceLabPanelProfiles');
    var rowsHtml = '';
    Shared.LEVEL_BANDS.forEach(function (band) {
      getVisibleProfileKeys().forEach(function (profileKey) {
        var scenario = state.labState.profiles[band.id][profileKey];
        rowsHtml += '<tr>' +
          '<td>' + band.label + '</td>' +
          '<td>' + Shared.PROFILE_LABELS[profileKey] + '</td>' +
          '<td><input type="number" data-scenario-edit="tankLevel" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + scenario.tankLevel + '"></td>' +
          '<td><input type="number" data-scenario-edit="zombieLevel" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + scenario.zombieLevel + '"></td>' +
          '<td><input type="number" data-scenario-edit="wallLevel" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + scenario.wallLevel + '"></td>' +
          '<td><input type="number" data-scenario-edit="droneLevel" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + scenario.droneLevel + '"></td>' +
          '<td><input type="number" data-scenario-edit="zombieCount" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + scenario.zombieCount + '"></td>' +
          '<td><input type="number" step="0.5" data-scenario-edit="attackWindowSec" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + scenario.attackWindowSec + '"></td>' +
          '<td><input type="number" data-scenario-edit="chipModId" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + (scenario.chipModId || '') + '"></td>' +
          '<td><input data-scenario-edit="talents.offense" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + (scenario.talents.offense || []).join(',') + '"></td>' +
          '<td><input data-scenario-edit="talents.defense" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + (scenario.talents.defense || []).join(',') + '"></td>' +
          '<td><input data-scenario-edit="talents.economy" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + (scenario.talents.economy || []).join(',') + '"></td>' +
          '<td><input type="number" step="0.01" data-scenario-edit="modifiers.tankDamageMul" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + scenario.modifiers.tankDamageMul + '"></td>' +
          '<td><input type="number" step="0.01" data-scenario-edit="modifiers.tankFireRateMul" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + scenario.modifiers.tankFireRateMul + '"></td>' +
          '<td><input type="number" step="0.01" data-scenario-edit="modifiers.zombieHpMul" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + scenario.modifiers.zombieHpMul + '"></td>' +
          '<td><input type="number" step="0.01" data-scenario-edit="modifiers.zombieAttackMul" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + scenario.modifiers.zombieAttackMul + '"></td>' +
          '<td><input type="number" step="0.01" data-scenario-edit="modifiers.wallHpMul" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + scenario.modifiers.wallHpMul + '"></td>' +
          '</tr>';
      });
    });
    panel.innerHTML = [
      '<div class="balanceLabCard balanceLabHelp">Для live balance settings оставлен только профиль «База». Здесь задаются состояния танка, ограды и дрона, таланты, чип и ключевые множители именно для базового сценария каждого диапазона; surrogate-профили «Средний», «Пик» и «Ручной» больше не участвуют в browser optimizer surface.</div>',
      '<div class="balanceLabCard"><div class="balanceLabTableWrap"><table class="balanceLabTable"><thead><tr><th>Диапазон</th><th>Профиль</th><th>Танк</th><th>Зомби</th><th>Ограда</th><th>Дрон</th><th>Кол-во</th><th>Окно</th><th>Чип</th><th>OFF</th><th>DEF</th><th>ECO</th><th>TankMul</th><th>FRMul</th><th>ZHpMul</th><th>ZAtkMul</th><th>WallHpMul</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>'
    ].join('');
  }

  function renderGoalsPanel() {
    var Shared = getModules().Shared;
    var panel = document.getElementById('balanceLabPanelGoals');
    var goalTuning = getGoalTuning();
    function buildGoalTuningCard(field, title) {
      if (field === 'desiredTtk') {
        return '<div class="balanceLabGoalTuningCard">' +
          '<div class="balanceLabGoalTuningLabel"><span>' + title + '</span><span class="balanceLabGoalTuningValue">' + goalTuning[field] + ' c</span></div>' +
          '<input type="number" min="0.01" step="0.01" data-goal-tuning="' + field + '" value="' + goalTuning[field] + '">' +
          '<div class="balanceLabGoalTuningHint">' + describeGoalTuningValue(field, goalTuning[field]) + '</div>' +
        '</div>';
      }
      return '<div class="balanceLabGoalTuningCard">' +
        '<div class="balanceLabGoalTuningLabel"><span>' + title + '</span><span class="balanceLabGoalTuningValue">' + goalTuning[field] + '/100</span></div>' +
        '<input type="range" min="0" max="100" step="1" data-goal-tuning="' + field + '" value="' + goalTuning[field] + '">' +
        '<div class="balanceLabGoalTuningHint">' + describeGoalTuningValue(field, goalTuning[field]) + '</div>' +
      '</div>';
    }
    var rowsHtml = '';
    Shared.LEVEL_BANDS.forEach(function (band) {
      getVisibleProfileKeys().forEach(function (profileKey) {
        var goals = state.labState.goals[band.id][profileKey];
        rowsHtml += '<tr>' +
          '<td>' + band.label + '</td>' +
          '<td>' + Shared.PROFILE_LABELS[profileKey] + '</td>' +
          '<td><input type="number" step="0.01" data-goal-edit="zombieTtkMin" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + goals.zombieTtkMin + '"></td>' +
          '<td><input type="number" step="0.01" data-goal-edit="zombieTtkMax" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + goals.zombieTtkMax + '"></td>' +
          '<td><input type="number" step="0.01" data-goal-edit="packTtkMin" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + goals.packTtkMin + '"></td>' +
          '<td><input type="number" step="0.01" data-goal-edit="packTtkMax" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + goals.packTtkMax + '"></td>' +
          '<td><input type="number" step="0.01" data-goal-edit="fenceDamageMin" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + goals.fenceDamageMin + '"></td>' +
          '<td><input type="number" step="0.01" data-goal-edit="fenceDamageMax" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + goals.fenceDamageMax + '"></td>' +
          '<td><input type="number" step="0.01" data-goal-edit="fenceSurvivalMinSec" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + goals.fenceSurvivalMinSec + '"></td>' +
          '<td><input type="number" step="0.01" data-goal-edit="fenceSurvivalMaxSec" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + goals.fenceSurvivalMaxSec + '"></td>' +
          '<td><input type="number" step="0.01" data-goal-edit="progressionPressureMin" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + goals.progressionPressureMin + '"></td>' +
          '<td><input type="number" step="0.01" data-goal-edit="progressionPressureMax" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + goals.progressionPressureMax + '"></td>' +
          '<td><input type="number" step="0.01" data-goal-edit="decadeJumpScore" data-band-id="' + band.id + '" data-profile-key="' + profileKey + '" value="' + goals.decadeJumpScore + '"></td>' +
          '</tr>';
      });
    });
    panel.innerHTML = [
      '<div class="balanceLabCard"><div class="balanceLabHelp">Ползунки управляют high-level целью optimizer: через них можно быстро выбрать длинный TTK, более опасных зомби или более мягкую прогрессию. Пресеты меняют только slider-state; таблица целей ниже и optimizer обновляются только после явного применения. Browser surface теперь считает только по профилю «База», чтобы goal tuning не конфликтовал с surrogate-профилями. Текущий профиль: ' + buildGoalTuningSummary(goalTuning) + '.</div><div class="balanceLabGoalTuningGrid">' +
        buildGoalTuningCard('desiredTtk', 'Желаемый TTK') +
        buildGoalTuningCard('zombiePressure', 'Шанс зомби продавить игрока') +
        buildGoalTuningCard('progressionPressure', 'Давление прогрессии') +
      '</div><div class="balanceLabActions"><button type="button" class="secondary" data-goal-preset="balanced">Сбалансировано</button><button type="button" class="secondary" data-goal-preset="longTtk">Долгий TTK</button><button type="button" class="secondary" data-goal-preset="zombieThreat">Опасные зомби</button><button type="button" class="secondary" data-goal-preset="softEconomy">Мягкая прогрессия</button><button type="button" id="balanceLabApplyGoalTuningBtn">Применить к таблице целей</button><button type="button" class="secondary" id="balanceLabResetGoalTuningBtn">Сбросить к baseline</button></div></div>',
      '<div class="balanceLabCard balanceLabHelp">Таблица целей задаёт целевые диапазоны для TTK по зомби, TTK по пачке, давления на ограду, окна выживания и давления прогрессии для базового сценария каждого диапазона. decadeJumpScore штрафует слишком плоскую кривую между десятками уровней. После ручных правок таблицы optimizer использует именно эти значения, пока вы снова не примените slider-профиль.</div>',
      '<div class="balanceLabCard"><div class="balanceLabTableWrap"><table class="balanceLabTable"><thead><tr><th>Диапазон</th><th>Профиль</th><th>ZombieTTK min</th><th>ZombieTTK max</th><th>PackTTK min</th><th>PackTTK max</th><th>FenceDmg min</th><th>FenceDmg max</th><th>FenceSurvival min</th><th>FenceSurvival max</th><th>Pressure min</th><th>Pressure max</th><th>Jump</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>'
    ].join('');
  }

  function renderTunablesPanel() {
    var panel = document.getElementById('balanceLabPanelTunables');
    var rowsHtml = '';
    state.registry.forEach(function (item) {
      var tunable = state.tunables[item.id];
      var currentValue = item.mode === 'factor'
        ? 'x' + tunable.value
        : (typeof item.readCurrent === 'function' ? item.readCurrent(buildOptimizerContext()) : tunable.value);
      var bandChecks = (item.bands || []).map(function (bandId) {
        var band = getModules().Shared.getBandById(bandId);
        var checked = tunable.bands.indexOf(bandId) !== -1 ? ' checked' : '';
        return '<label><input type="checkbox" data-tunable-band="' + bandId + '" data-tunable-id="' + item.id + '"' + checked + (item.locked ? ' disabled' : '') + '>' + band.label + '</label>';
      }).join('');
      rowsHtml += '<tr>' +
        '<td><input type="checkbox" data-tunable-toggle="' + item.id + '"' + (tunable.enabled ? ' checked' : '') + (item.locked ? ' disabled' : '') + '></td>' +
        '<td><div>' + item.label + '</div><div class="balanceLabSmall">' + item.metricFamily + '</div></td>' +
        '<td>' + item.group + '</td>' +
        '<td>' + item.sourceFile + '</td>' +
        '<td class="balanceLabCurrentValue">' + currentValue + '</td>' +
        '<td><input type="number" step="0.001" data-tunable-edit="min" data-tunable-id="' + item.id + '" value="' + (tunable.min != null ? tunable.min : '') + '"' + (item.locked ? ' disabled' : '') + '></td>' +
        '<td><input type="number" step="0.001" data-tunable-edit="max" data-tunable-id="' + item.id + '" value="' + (tunable.max != null ? tunable.max : '') + '"' + (item.locked ? ' disabled' : '') + '></td>' +
        '<td><input type="number" step="0.001" data-tunable-edit="step" data-tunable-id="' + item.id + '" value="' + (tunable.step != null ? tunable.step : '') + '"' + (item.locked ? ' disabled' : '') + '></td>' +
        '<td><select data-tunable-edit="directionBias" data-tunable-id="' + item.id + '"' + (item.locked ? ' disabled' : '') + '><option value="up"' + (tunable.directionBias === 'up' ? ' selected' : '') + '>up</option><option value="down"' + (tunable.directionBias === 'down' ? ' selected' : '') + '>down</option><option value="neutral"' + (tunable.directionBias === 'neutral' ? ' selected' : '') + '>neutral</option></select></td>' +
        '<td><div class="balanceLabBandChecks">' + bandChecks + '</div></td>' +
        '<td>' + (item.locked ? '<span class="balanceLabBadge balanceLabBadge--locked">заблокировано</span><div class="balanceLabSmall">' + item.lockedReason + '</div>' : '<span class="balanceLabBadge">разрешено</span>') + '</td>' +
        '</tr>';
    });
    panel.innerHTML = [
      '<div class="balanceLabCard balanceLabHelp">Реестр объединяет JSON-параметры, band-scoped curve scalers и allowlisted runtime-константы. locked world-events поверхности отображаются только для видимости и никогда не попадают в solver/write-path. Для TTK обычно имеет смысл начать с «Кривая базового урона танков», «Кривая явного HP зомби» и при необходимости «Кривая доп. урона снарядов». Anchor-поверхности оставлены для ручного ремонта единичных выбросов и больше не считаются safe auto-default для широкого прогрева диапазонов.</div>',
      '<div class="balanceLabCard"><div class="balanceLabTableWrap"><table class="balanceLabTable"><thead><tr><th>Вкл</th><th>Параметр</th><th>Группа</th><th>Источник</th><th>Текущее</th><th>Min</th><th>Max</th><th>Step</th><th>Bias</th><th>Диапазоны</th><th>Статус</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>'
    ].join('');
  }

  function renderOptimizePanel() {
    var Shared = getModules().Shared;
    var goalTuning = getGoalTuning();
    var enabledTunables = getModules().Registry.getEnabledItems(state.registry, state.tunables);
    var enabledTunablesCount = enabledTunables.length;
    var evaluation = evaluateCurrentMatrix();
    var result = state.labState.optimizerResult;
    var concreteChanges = collectConcreteOptimizerChanges();
    var panel = document.getElementById('balanceLabPanelOptimize');
    var scenarioOptions = getVisibleScenarioList().map(function (scenario) {
      var checked = getScenarioIdList().indexOf(scenario.id) !== -1 ? ' checked' : '';
      return '<label><input type="checkbox" data-scenario-select="' + scenario.id + '"' + checked + '> ' + Shared.getBandById(scenario.bandId).label + ' / ' + Shared.PROFILE_LABELS[scenario.profileKey] + '</label>';
    }).join('');
    var resultTable = evaluation.rows.map(function (row) {
      var afterRow = null;
      if (result) {
        afterRow = result.afterRows.find(function (candidate) { return candidate.scenario.id === row.scenario.id; });
      }
      return '<tr>' +
        '<td>' + Shared.getBandById(row.scenario.bandId).label + '</td>' +
        '<td>' + Shared.PROFILE_LABELS[row.scenario.profileKey] + '</td>' +
        '<td>' + row.metrics.singleZombieTtk + (afterRow ? ' → ' + afterRow.metrics.singleZombieTtk : '') + '</td>' +
        '<td>' + row.metrics.packTtk + (afterRow ? ' → ' + afterRow.metrics.packTtk : '') + '</td>' +
        '<td>' + row.metrics.fenceSurvivalSec + (afterRow ? ' → ' + afterRow.metrics.fenceSurvivalSec : '') + '</td>' +
        '<td>' + row.metrics.progressionPressure + (afterRow ? ' → ' + afterRow.metrics.progressionPressure : '') + '</td>' +
        '<td>' + row.evaluation.score + (afterRow ? ' → ' + afterRow.evaluation.score : '') + '</td>' +
        '<td>' + row.evaluation.failures.map(function (failure) { return getFindingLabel(failure.key); }).join(', ') + '</td>' +
        '</tr>';
    }).join('');
    var explanationList = result
      ? (result.changedTunables.length
        ? '<ul class="balanceLabList">' + result.explanations.map(function (item) {
            return '<li><strong>' + item.label + ':</strong> ' + item.reasons.join('; ') + '</li>';
          }).join('') + '</ul>'
        : '<div class="balanceLabSmall">Оптимизатор завершился без изменений. Попробуйте включить другие параметры или скорректировать сценарии и цели.</div>')
      : '<div class="balanceLabSmall">Пока нет прогона оптимизатора. Сначала выберите параметры и сценарии, затем запустите оптимизацию.</div>';
    var concreteChangeList = result
      ? (concreteChanges.length
        ? '<ul class="balanceLabList">' + concreteChanges.map(function (item) {
            return '<li><strong>' + item.label + ':</strong> ' + item.before + ' → ' + item.after + '</li>';
          }).join('') + '</ul>'
        : '<div class="balanceLabSmall">Нет прямых asset-level изменений для предпросмотра.</div>')
      : '<div class="balanceLabSmall">После прогона здесь появятся конкретные значения из JSON, которые optimizer собирается изменить.</div>';
    panel.innerHTML = [
      '<div class="balanceLabGrid">',
      '<div class="balanceLabMetric"><span>Текущий результат</span><strong>' + evaluation.summary.score + '</strong><div class="balanceLabSmall">покрытие ' + evaluation.summary.coverage + '</div></div>',
      '<div class="balanceLabMetric"><span>Выбранные сценарии</span><strong>' + getScenarioIdList().length + '</strong><div class="balanceLabSmall">строк участвуют в оценке матрицы</div></div>',
      '<div class="balanceLabMetric"><span>Включённые параметры</span><strong>' + enabledTunablesCount + '</strong><div class="balanceLabSmall">отключённые параметры не меняются</div></div>',
      '<div class="balanceLabMetric"><span>Последний прогон</span><strong>' + (result ? result.scoreAfter : '—') + '</strong><div class="balanceLabSmall">риск ' + (result ? result.risk : 'н/д') + '</div></div>',
      '</div>',
      '<div class="balanceLabCard"><div class="balanceLabHelp">Оценка матрицы проходит по выбранным базовым сценариям диапазонов, сравнивает метрики с целями и отдельно штрафует слишком плоские скачки между десятками уровней. Активный high-level goal profile: ' + buildGoalTuningSummary(goalTuning) + '. Оптимизация использует только включённые параметры и не трогает заблокированные поверхности.' + (enabledTunablesCount ? '' : ' Сначала включите хотя бы один параметр во вкладке «Параметры», иначе оптимизация ничего не сможет изменить. Если не хотите разбираться вручную, используйте кнопку авто-режима: она включит серийные TTK-поверхности, прогонит их по диапазонам и сразу откроет запись с готовым diff.') + '</div><div class="balanceLabTableWrap" style="margin-top:12px"><table class="balanceLabTable"><thead><tr><th>Использовать</th></tr></thead><tbody><tr><td><div class="balanceLabBandChecks">' + scenarioOptions + '</div></td></tr></tbody></table></div><div class="balanceLabActions"><button id="balanceLabEvaluateBtn" class="secondary">Оценить матрицу</button><button id="balanceLabOptimizeBtn"' + (enabledTunablesCount ? '' : ' disabled') + '>Запустить оптимизацию</button><button id="balanceLabAutoOptimizeBtn">Автооптимизировать и открыть запись</button><button id="balanceLabResetOptimizeBtn" class="warn">Откатить прогон</button></div></div>',
      '<div class="balanceLabCard"><div class="balanceLabGrid"><div><canvas id="balanceLabChartTtk" class="chart"></canvas></div><div><canvas id="balanceLabChartFence" class="chart"></canvas></div></div></div>',
      '<div class="balanceLabCard"><h3 style="margin-bottom:8px">Покрытие и объяснимость</h3>' + explanationList + '<div class="balanceLabTableWrap" style="margin-top:12px"><table class="balanceLabTable"><thead><tr><th>Диапазон</th><th>Профиль</th><th>TTK зомби</th><th>TTK пачки</th><th>Выживание ограды</th><th>Давление</th><th>Результат</th><th>Проблемы</th></tr></thead><tbody>' + resultTable + '</tbody></table></div></div>',
      '<div class="balanceLabCard"><h3 style="margin-bottom:8px">Что реально изменится в файлах</h3>' + concreteChangeList + '</div>'
    ].join('');
    wireOptimizeActions();
    renderOptimizeCharts();
  }

  function renderOptimizeCharts() {
    if (state.activeRootTab !== 'optimize' || !state.labState || !state.labState.lastEvaluation || !state.app) return;
    var result = state.labState.optimizerResult;
    var beforeRows = state.labState.lastEvaluation.rows;
    var labels = beforeRows.map(function (row) {
      return getModules().Shared.getBandById(row.scenario.bandId).label + ' ' + getModules().Shared.PROFILE_LABELS[row.scenario.profileKey];
    });
    var beforeTtk = beforeRows.map(function (row) { return row.metrics.singleZombieTtk; });
    var beforeFence = beforeRows.map(function (row) { return row.metrics.fenceSurvivalSec; });
    var afterTtk = result ? result.afterRows.map(function (row) { return row.metrics.singleZombieTtk; }) : beforeTtk;
    var afterFence = result ? result.afterRows.map(function (row) { return row.metrics.fenceSurvivalSec; }) : beforeFence;
    state.app.drawLineChart(document.getElementById('balanceLabChartTtk'), labels, [
      { label: 'TTK до оптимизации', data: beforeTtk, color: '#e94560' },
      { label: 'TTK после оптимизации', data: afterTtk, color: '#53a8b6' }
    ], 'TTK зомби по сценариям');
    state.app.drawLineChart(document.getElementById('balanceLabChartFence'), labels, [
      { label: 'Ограда до оптимизации', data: beforeFence, color: '#ffc107' },
      { label: 'Ограда после оптимизации', data: afterFence, color: '#4caf50' }
    ], 'Выживание ограды по сценариям');
  }

  function collectWriteEntries() {
    var Registry = getModules().Registry;
    var Shared = getModules().Shared;
    var entries = [];
    var jsonMap = {
      'assets/tanks.json': { before: state.app.DATA.tanks, after: state.app.EDIT.tanks },
      'assets/zombies.json': { before: state.app.DATA.zombies, after: state.app.EDIT.zombies },
      'assets/fence.json': { before: state.app.DATA.fence, after: state.app.EDIT.fence },
      'assets/dron.json': { before: state.app.DATA.dron, after: state.app.EDIT.dron },
      'assets/bullet.json': { before: state.app.DATA.bullet, after: state.app.EDIT.bullet },
      'assets/balance.json': { before: state.app.DATA.balance, after: state.app.EDIT.balance },
      'assets/chips.json': { before: state.app.DATA.chips, after: state.app.EDIT.chips },
      'assets/balance/cannonUpgrades.json': { before: state.app.DATA.cannon, after: state.app.EDIT.cannon },
      'assets/balance/talentTree_v2.json': { before: state.app.DATA.talents, after: state.app.EDIT.talents }
    };
    Object.keys(jsonMap).forEach(function (filePath) {
      var beforeText = JSON.stringify(jsonMap[filePath].before, null, 2);
      var afterText = JSON.stringify(jsonMap[filePath].after, null, 2);
      if (beforeText === afterText) return;
      entries.push({ path: filePath, type: 'json', before: beforeText, after: afterText });
    });
    var pendingRuntimeValues = collectPendingRuntimeValues();
    var updatedSources = Registry.applyRuntimeValuesToSources(state.sources, state.registry, state.runtimeOriginal, pendingRuntimeValues);
    if (updatedSources['game.js'] && updatedSources['game.js'] !== state.sources['game.js']) {
      entries.push({ path: 'game.js', type: 'js', before: state.sources['game.js'], after: updatedSources['game.js'] });
    }
    return entries.map(function (entry) {
      return Object.assign({}, entry, { diff: Shared.buildTextDiff(entry.before, entry.after) });
    });
  }

  function renderWritePanel() {
    var entries = collectWriteEntries();
    var concreteChanges = collectConcreteOptimizerChanges();
    var panel = document.getElementById('balanceLabPanelWrite');
    var directWriteAvailable = typeof window.showDirectoryPicker === 'function';
    var writeButtonLabel = directWriteAvailable ? 'Записать изменения' : 'Экспортировать writeback bundle';
    var manifest = {
      generatedAt: new Date().toISOString(),
      activeGoalProfile: buildGoalTuningSummary(getGoalTuning()),
      optimizerRunAvailable: !!state.labState.optimizerResult,
      changedFiles: entries.map(function (entry) { return entry.path; }),
      changedTunables: state.labState.optimizerResult ? state.labState.optimizerResult.changedTunables : [],
      lockedConstraints: Object.keys(state.runtimeOriginal.runtimeLocked).map(function (key) {
        return { id: key, value: state.runtimeOriginal.runtimeLocked[key] };
      }),
    };
    panel.innerHTML = [
      '<div class="balanceLabGrid">',
      '<div class="balanceLabMetric"><span>Изменённые файлы</span><strong>' + entries.length + '</strong><div class="balanceLabSmall">только JSON + разрешённый JS</div></div>',
      '<div class="balanceLabMetric"><span>FS Access API</span><strong>' + (directWriteAvailable ? 'готово' : 'fallback') + '</strong><div class="balanceLabSmall">прямая запись в Chromium/Edge или export writeback bundle</div></div>',
      '<div class="balanceLabMetric"><span>Корень репозитория</span><strong>' + (state.repoHandle ? 'выбран' : 'не задан') + '</strong><div class="balanceLabSmall">явно подтверждённый пользователем handle</div></div>',
      '<div class="balanceLabMetric"><span>Заблокированный runtime</span><strong>3</strong><div class="balanceLabSmall">только видим, никогда не записываем</div></div>',
      '</div>',
      '<div class="balanceLabCard"><div class="balanceLabActions"><button id="balanceLabPickRootBtn" class="secondary">Выбрать корень репозитория</button><button id="balanceLabWriteBtn">' + writeButtonLabel + '</button><button id="balanceLabManifestBtn" class="secondary">Экспорт manifest</button><button id="balanceLabPatchBtn" class="secondary">Экспорт patch</button></div><div class="balanceLabHelp">Запись обратно использует только разрешённую карту файлов и preview-only diff. Ползунки и таблица «Цели» сами по себе в игру не пишутся: они только задают target для optimizer. После авто-режима или обычной оптимизации здесь уже лежит готовый write-surface. Если File System Access API недоступен, кнопка записи теперь выгружает полноценный writeback bundle с содержимым изменённых файлов, а не только цифры/summary.</div></div>',
      '<div class="balanceLabCard"><h3 style="margin-bottom:8px">Конкретные значения для записи</h3>' + (concreteChanges.length ? '<ul class="balanceLabList">' + concreteChanges.map(function (item) { return '<li><strong>' + item.label + ':</strong> ' + item.before + ' → ' + item.after + '</li>'; }).join('') + '</ul>' : '<div class="balanceLabSmall">После optimizer-run здесь появятся точные значения из JSON/runtime write surface.</div>') + '</div>',
      '<div class="balanceLabCard"><h3 style="margin-bottom:8px">Предпросмотр</h3><div class="balanceLabCode">' + (entries.length ? entries.map(function (entry) { return '=== ' + entry.path + ' ===\n' + entry.diff; }).join('\n\n') : 'Нет изменений для записи.') + '</div></div>',
      '<div class="balanceLabCard"><h3 style="margin-bottom:8px">Manifest</h3><div class="balanceLabCode">' + JSON.stringify(manifest, null, 2) + '</div></div>'
    ].join('');
    wireWriteActions(entries, manifest);
  }

  function downloadText(name, content, mimeType) {
    var blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function buildWriteBundle(entries, manifest) {
    return {
      generatedAt: new Date().toISOString(),
      manifest: manifest,
      files: entries.map(function (entry) {
        return {
          path: entry.path,
          type: entry.type,
          content: entry.after
        };
      })
    };
  }

  function getDirectoryHandle(rootHandle, parts) {
    return parts.slice(0, -1).reduce(function (promise, part) {
      return promise.then(function (directoryHandle) {
        return directoryHandle.getDirectoryHandle(part, { create: false });
      });
    }, Promise.resolve(rootHandle));
  }

  function writeEntriesToRepo(entries) {
    if (!state.repoHandle) {
      state.app.setStatus('Сначала выберите корень репозитория.');
      return Promise.resolve();
    }
    return entries.reduce(function (promise, entry) {
      return promise.then(function () {
        var parts = entry.path.split('/');
        return getDirectoryHandle(state.repoHandle, parts)
          .then(function (directoryHandle) { return directoryHandle.getFileHandle(parts[parts.length - 1], { create: true }); })
          .then(function (fileHandle) { return fileHandle.createWritable(); })
          .then(function (writable) {
            return writable.write(entry.after).then(function () { return writable.close(); });
          });
      });
    }, Promise.resolve());
  }

  function runOptimization(options) {
    var modules = getModules();
    var enabledTunables = modules.Registry.getEnabledItems(state.registry, state.tunables);
    var autoEnabled = [];
    var autoBandSummary = '';
    var result;
    var concreteChanges;
    var summaryText;

    options = options || {};
    if (!enabledTunables.length && options.autoSeedRecommended) {
      autoEnabled = ensureRecommendedTunablesEnabled();
      enabledTunables = modules.Registry.getEnabledItems(state.registry, state.tunables);
    }
    if (!enabledTunables.length) {
      renderOptimizePanel();
      state.app.setStatus('Сначала включите хотя бы один параметр во вкладке «Параметры». Без этого оптимизация ничего не меняет.');
      return null;
    }

    state.preOptimizeSnapshot = {
      edit: modules.Shared.deepClone(getDataBundle()),
      runtimeGame: Object.assign({}, state.runtimeCurrent.runtimeGame),
    };
    state.labState.optimizerResult = options.autoSeedRecommended
      ? modules.Optimizer.optimizeByBands({
          data: getDataBundle(),
          profiles: state.labState.profiles,
          goals: state.labState.goals,
          registry: state.registry,
          tunableState: state.tunables,
          context: buildOptimizerContext(),
          selectedScenarioIds: getScenarioIdList(),
          focusTunableIds: autoEnabled.length ? getRecommendedTunableIds() : null,
        })
      : modules.Optimizer.optimize({
          data: getDataBundle(),
          profiles: state.labState.profiles,
          goals: state.labState.goals,
          registry: state.registry,
          tunableState: state.tunables,
          context: buildOptimizerContext(),
          selectedScenarioIds: getScenarioIdList(),
        });
    replaceEditState(state.labState.optimizerResult.edit);
    state.runtimeCurrent.runtimeGame = Object.assign({}, state.labState.optimizerResult.runtimeGame);
    state.app.setRuntimeGame(state.runtimeCurrent.runtimeGame);
    renderAllPanels();

    result = state.labState.optimizerResult;
    autoBandSummary = options.autoSeedRecommended ? describeBandPasses(result) : '';
    if (!result.changedTunables.length) {
      setActiveRootTab('optimize');
      state.app.setStatus('Оптимизатор завершён, но не нашёл улучшений для выбранных параметров и сценариев.' + (autoEnabled.length ? ' Автовключены core-поверхности: ' + autoEnabled.join(', ') + '.' : '') + autoBandSummary);
      return result;
    }

    concreteChanges = collectConcreteOptimizerChanges();
    summaryText = concreteChanges.slice(0, 3).map(function (item) {
      return item.label + ' ' + item.before + ' → ' + item.after;
    }).join('; ');
    if (options.openWriteTab) setActiveRootTab('write');
    state.app.setStatus('Оптимизация завершена. Score: ' + result.scoreBefore + ' → ' + result.scoreAfter + '.' + (autoEnabled.length ? ' Автовключены core-поверхности: ' + autoEnabled.join(', ') + '.' : '') + autoBandSummary + (summaryText ? ' Конкретные изменения: ' + summaryText + '.' : '') + (options.openWriteTab ? ' Открыл вкладку записи с готовым diff.' : ''));
    return result;
  }

  function wireOptimizeActions() {
    var evaluateButton = document.getElementById('balanceLabEvaluateBtn');
    var optimizeButton = document.getElementById('balanceLabOptimizeBtn');
    var autoOptimizeButton = document.getElementById('balanceLabAutoOptimizeBtn');
    var resetButton = document.getElementById('balanceLabResetOptimizeBtn');
    if (evaluateButton) {
      evaluateButton.onclick = function () {
        evaluateCurrentMatrix();
        renderOptimizePanel();
      };
    }
    if (optimizeButton) {
      optimizeButton.onclick = function () {
        runOptimization({ autoSeedRecommended: false, openWriteTab: false });
      };
    }
    if (autoOptimizeButton) {
      autoOptimizeButton.onclick = function () {
        runOptimization({ autoSeedRecommended: true, openWriteTab: true });
      };
    }
    if (resetButton) {
      resetButton.onclick = function () {
        if (!state.preOptimizeSnapshot) return;
        replaceEditState(getModules().Shared.deepClone(state.preOptimizeSnapshot.edit));
        state.runtimeCurrent.runtimeGame = Object.assign({}, state.preOptimizeSnapshot.runtimeGame);
        state.app.setRuntimeGame(state.runtimeCurrent.runtimeGame);
        state.labState.optimizerResult = null;
        renderAllPanels();
        state.app.setStatus('Последний прогон оптимизатора откатан.');
      };
    }
  }

  function wireWriteActions(entries, manifest) {
    var pickRootButton = document.getElementById('balanceLabPickRootBtn');
    var writeButton = document.getElementById('balanceLabWriteBtn');
    var manifestButton = document.getElementById('balanceLabManifestBtn');
    var patchButton = document.getElementById('balanceLabPatchBtn');
    if (pickRootButton) {
      pickRootButton.onclick = function () {
        if (typeof window.showDirectoryPicker !== 'function') {
          state.app.setStatus('File System Access API недоступен, используйте экспорт manifest/patch.');
          return;
        }
        window.showDirectoryPicker().then(function (handle) {
          state.repoHandle = handle;
          renderWritePanel();
          state.app.setStatus('Корень репозитория выбран для direct write-back.');
        }).catch(function () {
          state.app.setStatus('Выбор корня репозитория отменён.');
        });
      };
    }
    if (writeButton) {
      writeButton.onclick = function () {
        if (!entries.length) {
          state.app.setStatus('Нет изменений для записи.');
          return;
        }
        if (typeof window.showDirectoryPicker !== 'function') {
          state.app.setStatus('Прямая запись недоступна, экспортирую writeback bundle с полным содержимым файлов.');
          downloadText('balance-lab-writeback.bundle.json', JSON.stringify(buildWriteBundle(entries, manifest), null, 2), 'application/json');
          return;
        }
        writeEntriesToRepo(entries).then(function () {
          state.app.setStatus('Изменения записаны через File System Access API.');
        }).catch(function (error) {
          state.app.setStatus('Ошибка записи: ' + error.message);
        });
      };
    }
    if (manifestButton) {
      manifestButton.onclick = function () {
        downloadText('balance-lab-manifest.json', JSON.stringify(manifest, null, 2), 'application/json');
      };
    }
    if (patchButton) {
      patchButton.onclick = function () {
        var patchText = entries.map(function (entry) { return '=== ' + entry.path + ' ===\n' + entry.diff; }).join('\n\n');
        downloadText('balance-lab.patch', patchText || 'Нет изменений.', 'text/plain;charset=utf-8');
      };
    }
  }

  function renderAllPanels() {
    renderProfilesPanel();
    renderGoalsPanel();
    renderTunablesPanel();
    renderOptimizePanel();
    renderWritePanel();
  }

  var earningsState = {
    levelRewardConfig: null,
    cellCount: 15,
    renderTimer: null,
    loadPromise: null,
  };

  function loadLevelRewardConfigForEarnings() {
    if (earningsState.levelRewardConfig) return Promise.resolve(earningsState.levelRewardConfig);
    if (earningsState.loadPromise) return earningsState.loadPromise;
    earningsState.loadPromise = fetch('../assets/levelreward.json', { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .catch(function () { return null; })
      .then(function (cfg) {
        earningsState.levelRewardConfig = cfg || {};
        earningsState.loadPromise = null;
        return earningsState.levelRewardConfig;
      });
    return earningsState.loadPromise;
  }

  function earningsCoinsPerShot(level) {
    var lvl = Math.max(1, Math.floor(level));
    var cfg = earningsState.levelRewardConfig;
    var block = cfg && cfg.coinsPerShot;
    if (block && block.perLevel) {
      var override = block.perLevel[String(lvl)];
      if (Number.isFinite(override) && override >= 0) return override;
    }
    return Math.min(Math.pow(2, lvl - 1), Math.pow(2, 20));
  }

  function earningsFireRate(level) {
    var lvl = Math.max(1, Math.floor(level));
    var tanksEdit = state.app && state.app.EDIT && state.app.EDIT.tanks;
    var tankCfg = tanksEdit && tanksEdit['tank_lvl' + lvl];
    var attackSpeed = tankCfg && tankCfg.stats && Number(tankCfg.stats.attackSpeed);
    if (Number.isFinite(attackSpeed) && attackSpeed > 0) return attackSpeed;
    return 0.85 + 0.075 * (lvl - 1);
  }

  function formatEarningsNumber(value) {
    if (!Number.isFinite(value)) return '—';
    if (Math.abs(value) >= 1e12) return value.toExponential(3);
    return value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  }

  function renderEarningsPanel() {
    var panel = document.getElementById('balanceLabPanelEarnings');
    if (!panel) return;
    if (!earningsState.levelRewardConfig) {
      panel.innerHTML = '<div class="balanceLabCard balanceLabHelp">Загрузка levelreward.json…</div>';
    }
    loadLevelRewardConfigForEarnings().then(function () {
      if (!panel.isConnected) return;
      drawEarningsTable(panel);
    });
    if (earningsState.levelRewardConfig) drawEarningsTable(panel);
  }

  function drawEarningsTable(panel) {
    var cellCount = Math.max(1, Math.floor(earningsState.cellCount) || 1);
    var perLevelOverride = earningsState.levelRewardConfig
      && earningsState.levelRewardConfig.coinsPerShot
      && earningsState.levelRewardConfig.coinsPerShot.perLevel;
    var formula = (earningsState.levelRewardConfig
      && earningsState.levelRewardConfig.coinsPerShot
      && earningsState.levelRewardConfig.coinsPerShot.formula) || 'default';
    var rows = [];
    var totalAllLevels = 0;
    for (var lvl = 1; lvl <= 60; lvl++) {
      var cps = earningsCoinsPerShot(lvl);
      var fr = earningsFireRate(lvl);
      var perTankMin = cps * fr * 60;
      var totalPerMin = perTankMin * cellCount;
      totalAllLevels += totalPerMin;
      var overrideFlag = perLevelOverride && Number.isFinite(perLevelOverride[String(lvl)])
        ? '<span class="balanceLabBadge">override</span>' : '';
      rows.push('<tr>' +
        '<td>' + lvl + ' ' + overrideFlag + '</td>' +
        '<td>' + formatEarningsNumber(cps) + '</td>' +
        '<td>' + fr.toFixed(3) + '</td>' +
        '<td>' + formatEarningsNumber(perTankMin) + '</td>' +
        '<td>' + formatEarningsNumber(totalPerMin) + '</td>' +
        '</tr>');
    }
    panel.innerHTML = [
      '<div class="balanceLabCard balanceLabHelp">',
        '<div><strong>Формула:</strong> $/min = coinsPerShot(L) × fireRate(L) × 60 × количество_ячеек.</div>',
        '<div class="balanceLabSmall">coinsPerShot читается из <code>assets/levelreward.json → coinsPerShot.perLevel[L]</code>; ',
        'при отсутствии override применяется default формула <code>min(2^(L-1), 2^20)</code> — та же, что в runtime <code>Game.Economy.coinsForShot</code> до множителей. ',
        'fireRate берётся из <code>tank_lvlL.stats.attackSpeed</code> текущего EDIT-состояния, либо fallback <code>0.85 + 0.075·(L-1)</code>. ',
        'Активный formula: <strong>' + formula + '</strong>. Пример в ТЗ «L1=1000, L2=2000» — ожидаемый выход после заполнения <code>perLevel</code>, не hard-coded таблица.</div>',
        '<div class="balanceLabSmall">Вкладка read-only. Для правок используйте <code>assets/levelreward.json</code> напрямую или вкладку «Дифф / запись».</div>',
      '</div>',
      '<div class="balanceLabCard">',
        '<div class="balanceLabActions">',
          '<label style="display:inline-flex;gap:6px;align-items:center;color:#cfe0ff;font-size:12px;">Ячеек на уровень: ',
            '<input type="number" min="1" max="200" step="1" value="' + cellCount + '" data-earnings-cells="1" style="width:72px;">',
          '</label>',
          '<button type="button" class="secondary" data-earnings-refresh="1">Обновить</button>',
          '<button type="button" class="secondary" data-earnings-export="1">Экспорт CSV</button>',
          '<span class="balanceLabSmall">Итого по 60 уровням: <strong>' + formatEarningsNumber(totalAllLevels) + '</strong> $/min</span>',
        '</div>',
        '<div class="balanceLabTableWrap"><table class="balanceLabTable"><thead><tr>',
          '<th>Уровень</th><th>coinsPerShot</th><th>fireRate (в/c)</th><th>$/min на 1 ячейку</th><th>$/min × ' + cellCount + ' ячеек</th>',
        '</tr></thead><tbody>', rows.join(''), '</tbody></table></div>',
      '</div>'
    ].join('');
    wireEarningsActions(panel);
  }

  function wireEarningsActions(panel) {
    var cellsInput = panel.querySelector('[data-earnings-cells]');
    var refreshBtn = panel.querySelector('[data-earnings-refresh]');
    var exportBtn = panel.querySelector('[data-earnings-export]');
    if (cellsInput) {
      cellsInput.addEventListener('input', function () {
        var next = parseInt(cellsInput.value, 10);
        if (Number.isFinite(next) && next >= 1) {
          earningsState.cellCount = next;
          if (earningsState.renderTimer) clearTimeout(earningsState.renderTimer);
          earningsState.renderTimer = setTimeout(function () {
            earningsState.renderTimer = null;
            drawEarningsTable(panel);
          }, 500);
        }
      });
    }
    if (refreshBtn) {
      refreshBtn.onclick = function () {
        earningsState.levelRewardConfig = null;
        renderEarningsPanel();
      };
    }
    if (exportBtn) {
      exportBtn.onclick = function () {
        var lines = ['level,coinsPerShot,fireRate,perCellMin,perGridMin'];
        for (var lvl = 1; lvl <= 60; lvl++) {
          var cps = earningsCoinsPerShot(lvl);
          var fr = earningsFireRate(lvl);
          var perCell = cps * fr * 60;
          var perGrid = perCell * earningsState.cellCount;
          lines.push([lvl, cps, fr.toFixed(4), perCell.toFixed(2), perGrid.toFixed(2)].join(','));
        }
        downloadText('balance-lab-earnings.csv', lines.join('\n'), 'text/csv;charset=utf-8');
      };
    }
  }

  function onProfilesChange(event) {
    var target = event.target;
    var modules = getModules();
    var bandId = target.getAttribute('data-band-id');
    var profileKey = target.getAttribute('data-profile-key');
    var field = target.getAttribute('data-scenario-edit');
    var scenario;
    if (!field || !bandId || !profileKey) return;
    scenario = state.labState.profiles[bandId][profileKey];
    if (field.indexOf('talents.') === 0) {
      scenario.talents[field.split('.')[1]] = parseRankList(target.value);
    } else if (field.indexOf('modifiers.') === 0) {
      scenario.modifiers[field.split('.')[1]] = modules.Shared.safeNumber(target.value, 1);
    } else if (field === 'chipModId') {
      scenario.chipModId = target.value === '' ? null : parseInt(target.value, 10);
    } else {
      scenario[field] = modules.Shared.safeNumber(target.value, scenario[field]);
    }
    renderOptimizePanel();
    renderWritePanel();
  }

  function onGoalsChange(event) {
    var target = event.target;
    var tuningField = target.getAttribute('data-goal-tuning');
    var bandId = target.getAttribute('data-band-id');
    var profileKey = target.getAttribute('data-profile-key');
    var field = target.getAttribute('data-goal-edit');
    if (tuningField) {
      if (tuningField === 'desiredTtk') {
        state.labState.goalTuning[tuningField] = Math.max(0.1, getModules().Shared.safeNumber(target.value, state.labState.goalTuning[tuningField]));
      } else {
        state.labState.goalTuning[tuningField] = Math.max(0, Math.min(100, Math.round(getModules().Shared.safeNumber(target.value, state.labState.goalTuning[tuningField]))));
      }
      renderGoalsPanel();
      return;
    }
    if (!field || !bandId || !profileKey) return;
    state.labState.goals[bandId][profileKey][field] = getModules().Shared.safeNumber(target.value, state.labState.goals[bandId][profileKey][field]);
    state.labState.optimizerResult = null;
    state.preOptimizeSnapshot = null;
    renderOptimizePanel();
    renderWritePanel();
  }

  function onGoalsAction(event) {
    var button = event.target.closest('button');
    var modules = getModules();
    var presetId;
    if (!button) return;
    presetId = button.getAttribute('data-goal-preset');
    if (presetId) {
      state.labState.goalTuning = modules.Shared.getGoalTuningPreset(presetId);
      renderGoalsPanel();
      state.app.setStatus('Пресет целей обновлён. Нажмите «Применить к таблице целей», чтобы перестроить goals и optimizer.');
      return;
    }
    if (button.id === 'balanceLabApplyGoalTuningBtn') {
      rebuildGoalsFromTuning('High-level цели применены к таблице. Matrix/optimizer пересчитаны от нового goal profile.');
      return;
    }
    if (button.id === 'balanceLabResetGoalTuningBtn') {
      state.labState.goalTuning = modules.Shared.createDefaultGoalTuning();
      rebuildGoalsFromTuning('High-level цели сброшены к baseline и заново применены к таблице.');
    }
  }

  function onTunablesChange(event) {
    var target = event.target;
    var tunableId = target.getAttribute('data-tunable-id') || target.getAttribute('data-tunable-toggle');
    var tunable = state.tunables[tunableId];
    if (!tunable) return;
    if (target.hasAttribute('data-tunable-toggle')) {
      tunable.enabled = !!target.checked;
    } else if (target.hasAttribute('data-tunable-edit')) {
      var field = target.getAttribute('data-tunable-edit');
      tunable[field] = field === 'directionBias' ? target.value : getModules().Shared.safeNumber(target.value, tunable[field]);
    } else if (target.hasAttribute('data-tunable-band')) {
      var bandId = target.getAttribute('data-tunable-band');
      var index = tunable.bands.indexOf(bandId);
      if (target.checked && index === -1) tunable.bands.push(bandId);
      if (!target.checked && index !== -1) tunable.bands.splice(index, 1);
    }
    renderOptimizePanel();
    renderWritePanel();
  }

  function onOptimizeSelectionChange(event) {
    var target = event.target;
    var scenarioId = target.getAttribute('data-scenario-select');
    if (!scenarioId) return;
    var selected = getScenarioIdList();
    var index = selected.indexOf(scenarioId);
    if (target.checked && index === -1) selected.push(scenarioId);
    if (!target.checked && index !== -1) selected.splice(index, 1);
    state.selectedScenarioIds = selected;
    renderOptimizePanel();
  }

  function wirePanelDelegation() {
    document.getElementById('balanceLabPanelProfiles').addEventListener('change', onProfilesChange);
    document.getElementById('balanceLabPanelGoals').addEventListener('change', onGoalsChange);
    document.getElementById('balanceLabPanelGoals').addEventListener('click', onGoalsAction);
    document.getElementById('balanceLabPanelTunables').addEventListener('change', onTunablesChange);
    document.getElementById('balanceLabPanelOptimize').addEventListener('change', onOptimizeSelectionChange);
  }

  function init() {
    var modules = getModules();
    if (state.initialized || state.initializing || !modules || !getApp()) return;
    state.initializing = true;
    state.app = getApp();
    injectStyles();
    ensureShell();
    Promise.all([
      loadText('../game.js'),
      loadText('../src/config/worldEvents.js'),
      loadText('../src/systems/worldEventsRuntime.js')
    ]).then(function (responses) {
      state.sources = {
        'game.js': responses[0],
        'src/config/worldEvents.js': responses[1],
        'src/systems/worldEventsRuntime.js': responses[2],
      };
      state.runtimeOriginal = modules.Registry.createRuntimeContext(state.sources);
      state.runtimeCurrent = {
        runtimeGame: Object.assign({}, state.runtimeOriginal.runtimeGame),
        runtimeLocked: Object.assign({}, state.runtimeOriginal.runtimeLocked),
      };
      state.app.setRuntimeGame(state.runtimeCurrent.runtimeGame);
      state.labState = modules.Shared.createDefaultLabState(getDataBundle());
      state.registry = modules.Registry.createRegistry();
      state.tunables = modules.Registry.createTunableState(state.registry, {
        edit: getDataBundle(),
        runtimeGame: state.runtimeCurrent.runtimeGame,
        runtimeLocked: state.runtimeCurrent.runtimeLocked,
      });
      state.selectedScenarioIds = getVisibleScenarioList().map(function (scenario) { return scenario.id; });
      renderAllPanels();
      wirePanelDelegation();
      state.initialized = true;
      state.initializing = false;
      state.app.setStatus('Лаборатория баланса готова: реестр, профили, цели, оптимизатор, дифф и запись активированы.');
    }).catch(function (error) {
      state.initializing = false;
      state.app.setStatus('Лаборатория баланса не смогла загрузить runtime-источники: ' + error.message);
    });
  }

  function onBaseStateChanged() {
    if (!state.initialized) {
      init();
      return;
    }
    renderWritePanel();
    renderOptimizePanel();
  }

  root.addEventListener('balance-editor:state-changed', onBaseStateChanged);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  root.BalanceLab = root.BalanceLab || {};
  root.BalanceLab.Lab = {
    getState: function () { return state; },
    renderAllPanels: renderAllPanels,
  };
}(typeof window !== 'undefined' ? window : this));