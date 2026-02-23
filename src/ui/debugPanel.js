(function (global) {
  'use strict';

  function initDebugPanel(options) {
    var opts = options || {};
    if (!opts.DebugPanelEnabled) return;

    var state = opts.state;
    var document = opts.document;
    var nowSec = opts.nowSec;
    var DEBUG_PARAM = opts.DEBUG_PARAM || 'debug';
    var DEBUG_MAX_TANK_LEVEL = opts.MAX_TANK_LEVEL || 60;
    var DEBUG_MAX_DRON_LEVEL = opts.MAX_DRON_LEVEL || 10;
    var BAL = opts.BAL;
    var BASE_BAL = opts.BASE_BAL;

    if (!state || !document || typeof nowSec !== 'function') return;

    state.debug = state.debug || {
      log: [],
      targetCellIndex: null,
      talentOverrides: {},
      forceAttackMode: false,
      forceWeather: false,
      collapsed: false,
      previewParticles: [],
      debugStatusActive: false,
      zombieCountCache: { at: 0, text: '' },
    };
    if (typeof state.debug.forceAttackMode !== 'boolean') {
      state.debug.forceAttackMode = typeof state.debug.forceDisableAttackMode === 'boolean'
        ? !state.debug.forceDisableAttackMode
        : false;
    }
    if (typeof state.debug.forceWeather !== 'boolean') {
      state.debug.forceWeather = typeof state.debug.forceDisableWeather === 'boolean'
        ? !state.debug.forceDisableWeather
        : false;
    }

    var main = document.querySelector('.layout');
    if (!main || document.getElementById('debugPanel')) return;

    var debugLog = opts.debugLog || function () {};
    var debugReset = opts.debugReset || function () {};
    var safeDebug = opts.safeDebug || function (fn) { return fn(); };
    var makeTank = opts.makeTank;
    var addDron = opts.addDron;
    var recordTankLevel = opts.recordTankLevel;
    var openDismantleModal = opts.openDismantleModal;
    var setMenuOpen = opts.setMenuOpen;
    var tankLevelCounts = opts.tankLevelCounts;
    var computeAuraBand = opts.computeAuraBand;
    var zombieLevelWeights = opts.zombieLevelWeights;
    var pickZombieLevel = opts.pickZombieLevel;
    var initBoard = opts.initBoard;
    var canUseActive = opts.canUseActive;
    var useActiveAbility = opts.useActiveAbility;
    var initTalentDefs = opts.initTalentDefs;
    var getTalentDefs = opts.getTalentDefs;
    var getAchievementDefinitions = opts.getAchievementDefinitions;
    var debugUnlockAchievementAndClaim = opts.debugUnlockAchievementAndClaim;
    var debugSetTotalMerges = opts.debugSetTotalMerges;
    var debugAdjustTalentPoints = opts.debugAdjustTalentPoints;
    var debugAdjustDamagePoints = opts.debugAdjustDamagePoints;
    var updateUI = opts.updateUI;

    main.classList.add('debugLayout');

    var panel = document.createElement('div');
    panel.id = 'debugPanel';
    panel.className = 'debugPanel';

    var statusList = [
      { id: 'attack', key: 'attackUntil', label: 'Attack +50%' },
      { id: 'speed', key: 'speedUntil', label: 'Speed +35%' },
      { id: 'economy', key: 'economyUntil', label: 'Economy +60%' },
    ];

    panel.innerHTML = '\n    <div class="debugPanelHeader">\n      <span class="debugPanelTitle">Debug (?debug=1)</span>\n      <button type="button" class="debugCollapseBtn" id="debugCollapse">Collapse</button>\n    </div>\n    <div class="debugTabs">\n      <button type="button" class="debugTab active" data-tab="tanks">Tanks</button>\n      <button type="button" class="debugTab" data-tab="effects">Effects</button>\n      <button type="button" class="debugTab" data-tab="updates">Updates</button>\n      <button type="button" class="debugTab" data-tab="logs">Logs&Tools</button>\n    </div>\n    <div class="debugPanelBody">\n      <div id="debugSectionTanks" class="debugSection active">\n        <div class="debugRow">\n          <label class="debugLabel">Tank level (1–' + DEBUG_MAX_TANK_LEVEL + ')</label>\n          <select id="debugTankLevel" class="debugSelect"></select>\n        </div>\n        <button type="button" class="debugBtn" id="debugSpawnTank">Spawn in free slot</button>\n        <div class="debugRow" style="margin-top:8px">\n          <label class="debugLabel">Dron level (1–' + DEBUG_MAX_DRON_LEVEL + ')</label>\n          <select id="debugDronLevel" class="debugSelect"></select>\n        </div>\n        <button type="button" class="debugBtn" id="debugAddDron">Add Dron</button>\n        <div class="debugRow" style="margin-top:8px">\n          <label class="debugLabel">Hangar — select target</label>\n          <div id="debugHangarList"></div>\n        </div>\n        <div id="debugTankComposition" class="debugRow" style="margin-top:6px;font-size:11px"></div>\n        <div id="debugMergePossible" class="debugRow" style="margin-top:4px;font-size:11px"></div>\n        <div id="debugAuraBand" class="debugRow" style="margin-top:4px;font-size:11px"></div>\n        <button type="button" class="debugBtn" id="debugDismantleBtn" style="margin-top:6px">Dismantle selected tank</button>\n        <button type="button" class="debugBtn" id="debugOpenSettings">Open Settings</button>\n      </div>\n      <div id="debugSectionEffects" class="debugSection">\n        <div class="debugRow">\n          <label class="debugLabel">Category</label>\n          <select id="debugEffectCategory" class="debugSelect">\n            <option value="all">All</option>\n            <option value="status">Status</option>\n          </select>\n        </div>\n        <div id="debugEffectList"></div>\n      </div>\n      <div id="debugSectionUpdates" class="debugSection">\n        <div class="debugRow">\n          <label class="debugLabel" for="debugAddTalentPointsInput">Talent points (+)</label>\n          <input type="number" id="debugAddTalentPointsInput" class="debugSelect" min="0" step="1" style="max-width:140px" value="1" />\n          <button type="button" class="debugBtn" id="debugAddTalentPointsApply">Окей</button>\n        </div>\n        <div id="debugTalentPointsValue" class="debugRow" style="font-size:11px;margin-top:4px"></div>\n        <div class="debugRow" style="margin-top:8px">\n          <label class="debugLabel" for="debugAddDamagePointsInput">Damage points (+)</label>\n          <input type="number" id="debugAddDamagePointsInput" class="debugSelect" min="0" step="1" style="max-width:140px" value="1" />\n          <button type="button" class="debugBtn" id="debugAddDamagePointsApply">Окей</button>\n        </div>\n        <div id="debugDamagePointsValue" class="debugRow" style="font-size:11px;margin-top:4px"></div>\n      </div>\n      <div id="debugSectionLogs" class="debugSection">\n        <button type="button" class="debugBtn" id="debugResetBtn">Reset (statuses + VFX)</button>\n        <button type="button" class="debugBtn" id="debugClearLog">Clear log</button>\n        <button type="button" class="debugBtn" id="lessonProgressBtn">Lesson Progress</button>\n        <div id="debugTelemetryMount"></div>\n      </div>\n    </div>\n    <div class="debugLogWrap">\n      <div id="debugLog"></div>\n    </div>\n  ';

    var tankLevelSelect = panel.querySelector('#debugTankLevel');
    for (var l = 1; l <= DEBUG_MAX_TANK_LEVEL; l++) {
      tankLevelSelect.appendChild(new Option('Lv' + l, l));
    }

    var dronLevelSelect = panel.querySelector('#debugDronLevel');
    if (dronLevelSelect) {
      for (var dl = 1; dl <= DEBUG_MAX_DRON_LEVEL; dl++) {
        dronLevelSelect.appendChild(new Option('Lv' + dl, dl));
      }
    }

    panel.querySelectorAll('.debugTab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        panel.querySelectorAll('.debugTab').forEach(function (b) { b.classList.remove('active'); });
        panel.querySelectorAll('.debugSection').forEach(function (s) { s.classList.remove('active'); });
        btn.classList.add('active');
        var tab = btn.dataset.tab;
        var sectionId = 'debugSection' + tab.charAt(0).toUpperCase() + tab.slice(1);
        var section = panel.querySelector('#' + sectionId);
        if (section) section.classList.add('active');
        if (tab === 'tanks') { refreshDebugHangarList(); refreshDebugTankExtras(); }
        if (tab === 'effects') refreshDebugEffectList();
        if (tab === 'updates') refreshDebugUpdatesSection();
        if (tab === 'logs') refreshDebugAchievementsTools();
      });
    });

    var collapseBtn = panel.querySelector('#debugCollapse');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', function () {
        state.debug.collapsed = !state.debug.collapsed;
        panel.classList.toggle('collapsed', state.debug.collapsed);
        collapseBtn.textContent = state.debug.collapsed ? 'Expand' : 'Collapse';
      });
    }

    var spawnBtn = panel.querySelector('#debugSpawnTank');
    if (spawnBtn) {
      spawnBtn.addEventListener('click', function () {
        safeDebug(function () {
          if ((!Array.isArray(state.cells) || !state.cells.length) && typeof initBoard === 'function') {
            initBoard();
          }
          var level = Math.max(1, Math.min(DEBUG_MAX_TANK_LEVEL, Number(panel.querySelector('#debugTankLevel').value) || 1));
          var empty = state.cells.find(function (c) { return !c.tank; });
          if (!empty) {
            debugLog('warn', 'No free hangar slot.');
            return;
          }
          if (typeof makeTank !== 'function') {
            debugLog('error', 'Spawn failed: makeTank() is unavailable.');
            return;
          }
          empty.tank = makeTank(level, false);
          recordTankLevel(level);
          if (typeof updateUI === 'function') updateUI();
          debugLog('info', 'Spawned tank Lv' + level + ' in slot ' + empty.i + '.');
          refreshDebugHangarList();
          refreshDebugTankExtras();
        }, 'Spawn failed ');
      });
    }

    var addDronBtn = panel.querySelector('#debugAddDron');
    if (addDronBtn) {
      addDronBtn.addEventListener('click', function () {
        safeDebug(function () {
          var level = Math.max(1, Math.min(DEBUG_MAX_DRON_LEVEL, Number(panel.querySelector('#debugDronLevel').value) || 1));
          if (typeof addDron !== 'function') {
            debugLog('error', 'Add Dron failed: addDron() is unavailable.');
            return;
          }
          var dron = addDron(level);
          if (!dron) {
            debugLog('warn', 'Add Dron failed.');
            return;
          }
          debugLog('info', 'Added dron Lv' + dron.level + '.');
        }, 'Add Dron failed ');
      });
    }

    var dismantleDebugBtn = panel.querySelector('#debugDismantleBtn');
    if (dismantleDebugBtn) {
      dismantleDebugBtn.addEventListener('click', function () {
        safeDebug(function () {
          var idx = state.debug.targetCellIndex;
          var cell = idx != null && state.cells[idx] ? state.cells[idx] : null;
          if (!(cell && cell.tank)) { debugLog('warn', 'Select a slot with a tank first.'); return; }
          state.selectedHangarCellIndex = idx;
          openDismantleModal();
        }, 'Dismantle failed ');
      });
    }

    var openSettingsBtn = panel.querySelector('#debugOpenSettings');
    if (openSettingsBtn) openSettingsBtn.addEventListener('click', function () { setMenuOpen(true); });

    var effectsSection = panel.querySelector('#debugSectionEffects');
    if (effectsSection) {
      var attackToggleRow = document.createElement('div');
      attackToggleRow.className = 'debugRow';
      attackToggleRow.style.marginTop = '8px';
      attackToggleRow.innerHTML = '<label><input type="checkbox" id="debugForceAttackMode" /> Force attackMode</label>';
      effectsSection.appendChild(attackToggleRow);

      var weatherToggleRow = document.createElement('div');
      weatherToggleRow.className = 'debugRow';
      weatherToggleRow.innerHTML = '<label><input type="checkbox" id="debugForceWeather" /> Force weather</label>';
      effectsSection.appendChild(weatherToggleRow);
    }

    var forceAttackModeEl = panel.querySelector('#debugForceAttackMode');
    if (forceAttackModeEl) {
      forceAttackModeEl.checked = !!state.debug.forceAttackMode;
      forceAttackModeEl.addEventListener('change', function () {
        safeDebug(function () {
          state.debug.forceAttackMode = !!forceAttackModeEl.checked;
          debugLog('info', 'Force attackMode: ' + (state.debug.forceAttackMode ? 'ON' : 'OFF') + '.');
        }, 'Toggle attackMode override failed ');
      });
    }

    var forceWeatherEl = panel.querySelector('#debugForceWeather');
    if (forceWeatherEl) {
      forceWeatherEl.checked = !!state.debug.forceWeather;
      forceWeatherEl.addEventListener('change', function () {
        safeDebug(function () {
          state.debug.forceWeather = !!forceWeatherEl.checked;
          debugLog('info', 'Force weather: ' + (state.debug.forceWeather ? 'ON' : 'OFF') + '.');
        }, 'Toggle weather override failed ');
      });
    }

    function getCurrentTalentPointsForDebug() {
      if (state.player && state.player.talentsV2 && Number.isFinite(state.player.talentsV2.freePoints)) {
        return Math.max(0, Math.floor(state.player.talentsV2.freePoints));
      }
      return Math.max(0, Math.floor(state.player && state.player.freeTalentPointsV2 || 0));
    }

    function getCurrentDamagePointsForDebug() {
      return Math.max(0, Math.floor(state.player && state.player.damagePoints || 0));
    }

    function refreshDebugUpdatesSection() {
      var talentValueEl = panel.querySelector('#debugTalentPointsValue');
      if (talentValueEl) talentValueEl.textContent = 'Current talent points: ' + getCurrentTalentPointsForDebug();
      var damageValueEl = panel.querySelector('#debugDamagePointsValue');
      if (damageValueEl) damageValueEl.textContent = 'Current damage points: ' + getCurrentDamagePointsForDebug();
    }

    var addTalentPointsBtn = panel.querySelector('#debugAddTalentPointsApply');
    if (addTalentPointsBtn) {
      addTalentPointsBtn.addEventListener('click', function () {
        safeDebug(function () {
          var input = panel.querySelector('#debugAddTalentPointsInput');
          var amount = clampDevInt(input ? input.value : 0);
          if (amount <= 0) {
            debugLog('warn', 'Updates: enter positive talent points value.');
            refreshDebugUpdatesSection();
            return;
          }
          if (typeof debugAdjustTalentPoints === 'function') {
            var result = debugAdjustTalentPoints(amount) || {};
            if (result.ok === false) {
              debugLog('error', 'Updates: failed to add talent points.');
              refreshDebugUpdatesSection();
              return;
            }
          } else {
            state.player = state.player || {};
            state.player.talentsV2 = state.player.talentsV2 || { ranksById: {}, freePoints: 0 };
            state.player.talentsV2.freePoints = Math.max(0, Math.floor(state.player.talentsV2.freePoints || 0)) + amount;
            state.player.freeTalentPointsV2 = state.player.talentsV2.freePoints;
          }
          if (typeof updateUI === 'function') updateUI();
          refreshDebugUpdatesSection();
          debugLog('info', 'Updates: +' + amount + ' talent points added.');
        }, 'Add talent points failed ');
      });
    }

    var addDamagePointsBtn = panel.querySelector('#debugAddDamagePointsApply');
    if (addDamagePointsBtn) {
      addDamagePointsBtn.addEventListener('click', function () {
        safeDebug(function () {
          var input = panel.querySelector('#debugAddDamagePointsInput');
          var amount = clampDevInt(input ? input.value : 0);
          if (amount <= 0) {
            debugLog('warn', 'Updates: enter positive damage points value.');
            refreshDebugUpdatesSection();
            return;
          }
          if (typeof debugAdjustDamagePoints === 'function') {
            var result = debugAdjustDamagePoints(amount) || {};
            if (result.ok === false) {
              debugLog('error', 'Updates: failed to add damage points.');
              refreshDebugUpdatesSection();
              return;
            }
          } else {
            state.player = state.player || {};
            state.player.damagePoints = Math.max(0, Math.floor(state.player.damagePoints || 0)) + amount;
          }
          if (typeof updateUI === 'function') updateUI();
          refreshDebugUpdatesSection();
          debugLog('info', 'Updates: +' + amount + ' damage points added.');
        }, 'Add damage points failed ');
      });
    }

    var resetBtn = panel.querySelector('#debugResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', function () { debugReset(); });

    var clearLogBtn = panel.querySelector('#debugClearLog');
    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', function () {
        state.debug.log = [];
        var el = panel.querySelector('#debugLog');
        if (el) el.innerHTML = '';
        debugLog('info', 'Log cleared.');
      });
    }

    var debugAchievementsMount = null;
    var debugAchievementSelect = null;
    var debugTotalMergesInput = null;
    var debugAchievementsState = null;

    function clampDevInt(value) {
      var parsed = Math.floor(Number(value));
      if (!Number.isFinite(parsed) || parsed < 0) return 0;
      if (parsed > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
      return parsed;
    }

    function getAchievementDefsForDebug() {
      if (typeof getAchievementDefinitions !== 'function') return [];
      var defs = getAchievementDefinitions();
      return Array.isArray(defs) ? defs : [];
    }

    function refreshDebugAchievementsTools() {
      var defs = getAchievementDefsForDebug();
      if (debugAchievementSelect) {
        var selectedId = debugAchievementSelect.value;
        debugAchievementSelect.innerHTML = '';
        for (var i = 0; i < defs.length; i++) {
          var def = defs[i];
          debugAchievementSelect.appendChild(new Option(def.id, def.id));
        }
        if (defs.length > 0) {
          var hasSelection = defs.some(function (def) { return def.id === selectedId; });
          debugAchievementSelect.value = hasSelection ? selectedId : defs[0].id;
          debugAchievementSelect.disabled = false;
        } else {
          debugAchievementSelect.disabled = true;
        }
      }

      if (debugTotalMergesInput) {
        var totalMerges = state && state.achievements ? clampDevInt(state.achievements.totalMerges) : 0;
        debugTotalMergesInput.value = String(totalMerges);
      }

      if (debugAchievementsState) {
        var achievements = state && state.achievements ? state.achievements : {};
        var unlocked = achievements.unlocked && typeof achievements.unlocked === 'object'
          ? Object.keys(achievements.unlocked).filter(function (id) { return !!achievements.unlocked[id]; })
          : [];
        unlocked.sort();
        debugAchievementsState.textContent = 'totalMerges=' + clampDevInt(achievements.totalMerges) + '; unlocked: ' + (unlocked.length ? unlocked.join(', ') : 'none');
      }
    }

    function mountDebugAchievementsTools() {
      var logsSection = panel.querySelector('#debugSectionLogs');
      if (!logsSection) return;

      debugAchievementsMount = document.createElement('div');
      debugAchievementsMount.className = 'debugTools';
      debugAchievementsMount.style.marginTop = '10px';
      debugAchievementsMount.innerHTML = [
        '<div class="debugRow"><strong>Achievements (dev)</strong></div>',
        '<div class="debugRow">',
        '  <label class="debugLabel" for="debugAchievementSelect">Achievement id</label>',
        '  <select id="debugAchievementSelect" class="debugSelect"></select>',
        '</div>',
        '<div class="debugRow">',
        '  <button type="button" class="debugBtn" id="debugAchievementUnlock">Unlock + claim reward</button>',
        '</div>',
        '<div class="debugRow" style="margin-top:8px">',
        '  <label class="debugLabel" for="debugTotalMergesInput">totalMerges</label>',
        '  <input type="number" id="debugTotalMergesInput" class="debugSelect" min="0" step="1" style="max-width:140px" />',
        '  <button type="button" class="debugBtn" id="debugSetTotalMerges">Set totalMerges</button>',
        '</div>',
        '<div id="debugAchievementsState" class="debugRow" style="font-size:11px;margin-top:4px"></div>',
      ].join('');

      var telemetryMount = panel.querySelector('#debugTelemetryMount');
      logsSection.insertBefore(debugAchievementsMount, telemetryMount || null);

      debugAchievementSelect = panel.querySelector('#debugAchievementSelect');
      debugTotalMergesInput = panel.querySelector('#debugTotalMergesInput');
      debugAchievementsState = panel.querySelector('#debugAchievementsState');

      var unlockBtn = panel.querySelector('#debugAchievementUnlock');
      if (unlockBtn) {
        unlockBtn.addEventListener('click', function () {
          safeDebug(function () {
            var achievementId = debugAchievementSelect ? String(debugAchievementSelect.value || '') : '';
            if (!achievementId) {
              debugLog('warn', 'Achievements(dev): select achievement id.');
              return;
            }
            var AchievementsApi = global.Game && global.Game.Achievements;
            if (AchievementsApi && typeof AchievementsApi.ensureState === 'function') {
              AchievementsApi.ensureState(state);
            }
            var done = false;
            if (typeof debugUnlockAchievementAndClaim === 'function') {
              done = debugUnlockAchievementAndClaim(achievementId) === true;
            } else {
              state.achievements = state.achievements || { unlocked: {}, totalMerges: 0 };
              state.achievements.unlocked = state.achievements.unlocked || {};
              state.achievements.unlocked[achievementId] = true;
              done = true;
            }
            if (typeof updateUI === 'function') updateUI();
            refreshDebugAchievementsTools();
            debugLog(done ? 'info' : 'warn', done
              ? 'Achievements(dev): unlocked ' + achievementId + '.'
              : 'Achievements(dev): failed to unlock ' + achievementId + '.');
          }, 'Achievements(dev) unlock failed ');
        });
      }

      var setTotalMergesBtn = panel.querySelector('#debugSetTotalMerges');
      if (setTotalMergesBtn) {
        setTotalMergesBtn.addEventListener('click', function () {
          safeDebug(function () {
            var totalMerges = clampDevInt(debugTotalMergesInput ? debugTotalMergesInput.value : 0);
            var unlockedNow = [];
            if (typeof debugSetTotalMerges === 'function') {
              var result = debugSetTotalMerges(totalMerges) || {};
              totalMerges = clampDevInt(result.totalMerges);
              unlockedNow = Array.isArray(result.unlockedNow) ? result.unlockedNow : [];
            } else {
              state.achievements = state.achievements || { unlocked: {}, totalMerges: 0 };
              state.achievements.unlocked = state.achievements.unlocked || {};
              state.achievements.totalMerges = totalMerges;
            }
            if (typeof updateUI === 'function') updateUI();
            refreshDebugAchievementsTools();
            debugLog('info', 'Achievements(dev): totalMerges=' + totalMerges + (unlockedNow.length ? '; unlocked now: ' + unlockedNow.join(', ') : '.'));
          }, 'Achievements(dev) set totalMerges failed ');
        });
      }

      refreshDebugAchievementsTools();
    }

    mountDebugAchievementsTools();

    function refreshDebugHangarList() {
      var container = panel.querySelector('#debugHangarList');
      if (!container) return;
      container.innerHTML = '';
      (state.cells || []).forEach(function (cell, i) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'debugBtn';
        btn.style.marginRight = '4px';
        btn.style.marginBottom = '4px';
        if (cell.tank) {
          btn.textContent = '#' + i + ' Lv' + cell.tank.level;
          btn.addEventListener('click', function () {
            state.debug.targetCellIndex = i;
            debugLog('info', 'Target tank: slot ' + i + ' Lv' + cell.tank.level + '.');
            panel.querySelectorAll('#debugHangarList button').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            refreshDebugTankExtras();
          });
          if (state.debug.targetCellIndex === i) btn.classList.add('active');
        } else {
          btn.textContent = '#' + i + ' empty';
          btn.disabled = true;
        }
        container.appendChild(btn);
      });
      refreshDebugTankExtras();
    }

    function refreshDebugTankExtras() {
      var compEl = panel.querySelector('#debugTankComposition');
      var mergeEl = panel.querySelector('#debugMergePossible');
      var auraEl = panel.querySelector('#debugAuraBand');
      var dismantleBtn = panel.querySelector('#debugDismantleBtn');
      var counts = tankLevelCounts();
      var levels = Array.from(counts.keys()).sort(function (a, b) { return a - b; });
      var total = levels.reduce(function (s, lv) { return s + (counts.get(lv) || 0); }, 0);
      if (compEl) compEl.textContent = total ? 'By level: ' + levels.map(function (lv) { return 'Lv' + lv + ':' + counts.get(lv); }).join(', ') : 'No tanks (excl. unopened crates).';
      var idx = state.debug.targetCellIndex;
      var cell = idx != null && state.cells[idx] ? state.cells[idx] : null;
      var tank = cell && cell.tank;
      if (mergeEl) {
        if (!tank) mergeEl.textContent = 'Merge possible: — (select a tank)';
        else {
          var sameLevel = state.cells.some(function (c) { return c !== cell && c.tank && c.tank.level === tank.level; });
          var atMax = tank.level >= DEBUG_MAX_TANK_LEVEL;
          mergeEl.textContent = 'Merge possible: ' + (sameLevel && !atMax ? 'Yes' : (atMax ? 'No (max level)' : 'No (no same-level tank)'));
        }
      }
      if (auraEl) {
        if (!tank) auraEl.textContent = 'Aura band: —';
        else {
          var band = computeAuraBand(tank.level);
          auraEl.textContent = 'Level ' + tank.level + ' → Aura band: ' + (band == null ? 'none (<10)' : band);
        }
      }
      if (dismantleBtn) dismantleBtn.disabled = !tank || (tank.onTrack === true);
    }


    function refreshDebugEffectList() {
      var container = panel.querySelector('#debugEffectList');
      if (!container) return;
      container.innerHTML = '';
      var catEl = panel.querySelector('#debugEffectCategory');
      var cat = catEl ? catEl.value : 'all';
      var showStatus = cat === 'all' || cat === 'status';
      if (showStatus) {
        statusList.forEach(function (ef) {
          var row = document.createElement('div');
          row.className = 'debugRow';
          var dur = 6;
          row.innerHTML = '<span class="debugLabel">' + ef.label + '</span><button type="button" class="debugBtn debugApplyStatus" data-key="' + ef.key + '">Apply ' + dur + 's</button><button type="button" class="debugBtn debugRemoveStatus" data-key="' + ef.key + '">Remove</button>';
          row.querySelector('.debugApplyStatus').addEventListener('click', function () {
            safeDebug(function () {
              state.activeEffects[ef.key] = nowSec() + dur;
              state.debug.debugStatusActive = true;
              debugLog('info', 'Status: ' + ef.label + ' applied ' + dur + 's.');
            }, 'Apply status failed ');
          });
          row.querySelector('.debugRemoveStatus').addEventListener('click', function () {
            safeDebug(function () {
              state.activeEffects[ef.key] = 0;
              debugLog('info', 'Status: ' + ef.label + ' removed.');
            }, 'Remove status failed ');
          });
          container.appendChild(row);
        });
      }
    }

    var effectCategoryEl = panel.querySelector('#debugEffectCategory');
    if (effectCategoryEl) effectCategoryEl.addEventListener('change', refreshDebugEffectList);


    state.debug.refreshHangarList = refreshDebugHangarList;
    state.debug.refreshTankExtras = refreshDebugTankExtras;
    state.debug.refreshUpdates = refreshDebugUpdatesSection;

    main.insertBefore(panel, main.firstChild);
    refreshDebugHangarList();
    refreshDebugEffectList();
    refreshDebugUpdatesSection();

    if (global.Game && global.Game.Telemetry) {
      var telMount = panel.querySelector('#debugTelemetryMount');
      if (telMount) global.Game.Telemetry.initUI(telMount);
    }

    debugLog('info', 'Debug panel ready. URL param: ' + DEBUG_PARAM + '=1');
  }

  global.Game = global.Game || {};
  global.Game.DebugPanel = {
    initDebugPanel: initDebugPanel,
  };
})(typeof window !== 'undefined' ? window : this);
