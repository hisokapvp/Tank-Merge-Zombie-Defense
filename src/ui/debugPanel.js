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
    var getWaveInfo = typeof opts.getWaveInfo === 'function' ? opts.getWaveInfo : null;
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

    panel.innerHTML = '\n    <div class="debugPanelHeader">\n      <span class="debugPanelTitle">Debug (?debug=1)</span>\n      <button type="button" class="debugCollapseBtn" id="debugCollapse">Collapse</button>\n    </div>\n    <div class="debugTabs">\n      <button type="button" class="debugTab active" data-tab="tanks">Tanks</button>\n      <button type="button" class="debugTab" data-tab="effects">Effects</button>\n      <button type="button" class="debugTab" data-tab="updates">Updates</button>\n      <button type="button" class="debugTab" data-tab="waveInfo">wave info</button>\n      <button type="button" class="debugTab" data-tab="logs">Logs&Tools</button>\n      <button type="button" class="debugTab" data-tab="chips">Chips</button>\n      <button type="button" class="debugTab" data-tab="perf">Perf</button>\n    </div>\n    <div class="debugPanelBody">\n      <div id="debugSectionTanks" class="debugSection active">\n        <div class="debugRow">\n          <label class="debugLabel">Tank level (1–' + DEBUG_MAX_TANK_LEVEL + ')</label>\n          <select id="debugTankLevel" class="debugSelect"></select>\n        </div>\n        <button type="button" class="debugBtn" id="debugSpawnTank">Spawn in free slot</button>\n        <div class="debugRow" style="margin-top:8px">\n          <label class="debugLabel">Dron level (1–' + DEBUG_MAX_DRON_LEVEL + ')</label>\n          <select id="debugDronLevel" class="debugSelect"></select>\n        </div>\n        <button type="button" class="debugBtn" id="debugAddDron">Add Dron</button>\n        <div class="debugRow" style="margin-top:8px">\n          <label class="debugLabel">Hangar — select target</label>\n          <div id="debugHangarList"></div>\n        </div>\n        <div id="debugTankComposition" class="debugRow" style="margin-top:6px;font-size:11px"></div>\n        <div id="debugMergePossible" class="debugRow" style="margin-top:4px;font-size:11px"></div>\n        <div id="debugAuraBand" class="debugRow" style="margin-top:4px;font-size:11px"></div>\n        <button type="button" class="debugBtn" id="debugDismantleBtn" style="margin-top:6px">Dismantle selected tank</button>\n        <button type="button" class="debugBtn" id="debugOpenSettings">Open Settings</button>\n      </div>\n      <div id="debugSectionEffects" class="debugSection">\n        <div class="debugRow">\n          <label class="debugLabel">Category</label>\n          <select id="debugEffectCategory" class="debugSelect">\n            <option value="all">All</option>\n            <option value="status">Status</option>\n          </select>\n        </div>\n        <div id="debugEffectList"></div>\n      </div>\n      <div id="debugSectionUpdates" class="debugSection">\n        <div class="debugRow">\n          <label class="debugLabel" for="debugAddTalentPointsInput">Talent points (+)</label>\n          <input type="number" id="debugAddTalentPointsInput" class="debugSelect" min="0" step="1" style="max-width:140px" value="1" />\n          <button type="button" class="debugBtn" id="debugAddTalentPointsApply">Окей</button>\n        </div>\n        <div id="debugTalentPointsValue" class="debugRow" style="font-size:11px;margin-top:4px"></div>\n        <div class="debugRow" style="margin-top:8px">\n          <label class="debugLabel" for="debugAddDamagePointsInput">Damage points (+)</label>\n          <input type="number" id="debugAddDamagePointsInput" class="debugSelect" min="0" step="1" style="max-width:140px" value="1" />\n          <button type="button" class="debugBtn" id="debugAddDamagePointsApply">Окей</button>\n        </div>\n        <div id="debugDamagePointsValue" class="debugRow" style="font-size:11px;margin-top:4px"></div>\n        <hr style="border-color:#444;margin:10px 0">\n        <div class="debugRow"><strong style="color:#fdd835">Learn Technology (instant)</strong></div>\n        <div class="debugRow" style="margin-top:6px">\n          <label class="debugLabel" for="debugLearnTechSelect">Technology</label>\n          <select id="debugLearnTechSelect" class="debugSelect" style="max-width:200px"></select>\n        </div>\n        <button type="button" class="debugBtn" id="debugLearnTechApply" style="margin-top:6px">Learn selected tech</button>\n        <div id="debugLearnTechStatus" class="debugRow" style="font-size:11px;margin-top:4px"></div>\n      </div>\n      <div id="debugSectionWaveInfo" class="debugSection">\n        <div class="debugRow"><span class="debugLabel" style="margin-bottom:6px">wave info</span></div>\n        <div id="debugWaveInfoTable" class="debugRow" style="font-size:11px;line-height:1.5"></div>\n      </div>\n      <div id="debugSectionLogs" class="debugSection">\n        <div id="debugTelemetryMount"></div>\n      </div>\n      <div id="debugSectionChips" class="debugSection">\n        <div class="debugRow">\n          <label class="debugLabel">Cell index (0–15)</label>\n          <select id="debugChipCell" class="debugSelect"></select>\n        </div>\n        <div class="debugRow" style="margin-top:6px">\n          <label class="debugLabel">Slot</label>\n          <select id="debugChipSlot" class="debugSelect">\n            <option value="red-0">Red 0 (top)</option>\n            <option value="red-1">Red 1 (bottom)</option>\n            <option value="yellow-0">Yellow 0 (TL)</option>\n            <option value="yellow-1">Yellow 1 (TR)</option>\n            <option value="yellow-2">Yellow 2 (BL)</option>\n            <option value="yellow-3">Yellow 3 (BR)</option>\n          </select>\n        </div>\n        <div class="debugRow" style="margin-top:6px">\n          <label class="debugLabel">Chip key (e.g. 1-2-3)</label>\n          <input type="text" id="debugChipKey" class="debugSelect" placeholder="1-2-3" style="max-width:120px" />\n        </div>\n        <button type="button" class="debugBtn" id="debugChipInstall" style="margin-top:6px">Install chip</button>\n        <button type="button" class="debugBtn" id="debugChipRemove" style="margin-top:4px">Remove chip from slot</button>\n        <button type="button" class="debugBtn" id="debugChipClear" style="margin-top:4px">Clear entire cell</button>\n        <div id="debugChipStatus" class="debugRow" style="margin-top:8px;font-size:11px;line-height:1.5"></div>\n        <hr style="border-color:#444;margin:10px 0">\n        <div class="debugRow"><strong style="color:#4af626">Inventory</strong></div>\n        <div class="debugRow" style="margin-top:6px">\n          <label class="debugLabel">Chip key</label>\n          <input type="text" id="debugInvChipKey" class="debugSelect" placeholder="1-2-3" style="max-width:120px" />\n        </div>\n        <div class="debugRow" style="margin-top:4px">\n          <label class="debugLabel">Level</label>\n          <input type="number" id="debugInvChipLevel" class="debugSelect" min="1" step="1" value="1" style="max-width:80px" />\n        </div>\n        <div class="debugRow" style="margin-top:4px">\n          <label class="debugLabel">Count</label>\n          <input type="number" id="debugInvChipCount" class="debugSelect" min="1" step="1" value="1" style="max-width:80px" />\n        </div>\n        <button type="button" class="debugBtn" id="debugInvAddChip" style="margin-top:6px">Add chip to inventory</button>\n        <div class="debugRow" style="margin-top:4px">\n          <label class="debugLabel">Quick add (random)</label>\n          <input type="number" id="debugInvQuickCount" class="debugSelect" min="1" step="1" value="10" style="max-width:80px" />\n          <button type="button" class="debugBtn" id="debugInvQuickAdd" style="margin-left:4px">Add random</button>\n        </div>\n        <div id="debugInvStatus" class="debugRow" style="margin-top:6px;font-size:11px;line-height:1.5"></div>\n        <hr style="border-color:#444;margin:10px 0">\n        <div class="debugRow"><strong style="color:#e53935">Fragments (куски чипов)</strong></div>\n        <div class="debugRow" style="margin-top:6px">\n          <label class="debugLabel">Fragment modId (1–30)</label>\n          <input type="number" id="debugFragModId" class="debugSelect" min="1" max="30" step="1" value="1" style="max-width:80px" />\n        </div>\n        <div class="debugRow" style="margin-top:4px">\n          <label class="debugLabel">Count</label>\n          <input type="number" id="debugFragCount" class="debugSelect" min="1" step="1" value="3" style="max-width:80px" />\n        </div>\n        <button type="button" class="debugBtn" id="debugFragAdd" style="margin-top:6px">Add fragment to inventory</button>\n        <div class="debugRow" style="margin-top:4px">\n          <label class="debugLabel">Quick add (random)</label>\n          <input type="number" id="debugFragQuickCount" class="debugSelect" min="1" step="1" value="10" style="max-width:80px" />\n          <button type="button" class="debugBtn" id="debugFragQuickAdd" style="margin-left:4px">Add random frags</button>\n        </div>\n        <div id="debugFragStatus" class="debugRow" style="margin-top:6px;font-size:11px;line-height:1.5"></div>\n      </div>\n    </div>\n    <div class="debugLogWrap">\n      <div id="debugLog"></div>\n    </div>\n  ';

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
        if (tab === 'waveInfo') refreshDebugWaveInfo();
        if (tab === 'logs') refreshDebugAchievementsTools();
        if (tab === 'chips') refreshDebugChipsSection();
        if (tab === 'perf') refreshDebugPerfSection();
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

      /* Task 6: Populate tech select dropdown */
      var techSelect = panel.querySelector('#debugLearnTechSelect');
      var techStatusEl = panel.querySelector('#debugLearnTechStatus');
      if (techSelect) {
        var HC = global.Game && global.Game.HangarChips;
        var prevValue = techSelect.value;
        techSelect.innerHTML = '';
        if (HC && HC.TECH_TREE) {
          var treeKeys = Object.keys(HC.TECH_TREE);
          var techCount = 0;
          for (var tk = 0; tk < treeKeys.length; tk++) {
            var chain = HC.TECH_TREE[Number(treeKeys[tk])];
            for (var ci = 0; ci < chain.length; ci++) {
              var tech = chain[ci];
              var isUnlocked = HC.isTechUnlocked(tech.modId);
              var label = (HC.MOD_NAMES_RU ? (HC.MOD_NAMES_RU[tech.modId] || tech.modId) : tech.modId) +
                ' (id:' + tech.modId + ')' +
                (isUnlocked ? ' [DONE]' : '');
              var opt = new Option(label, tech.modId);
              if (isUnlocked) opt.style.color = '#4af626';
              techSelect.appendChild(opt);
              techCount++;
            }
          }
          if (prevValue && techSelect.querySelector('option[value="' + prevValue + '"]')) {
            techSelect.value = prevValue;
          }
          techSelect.disabled = techCount === 0;
        } else {
          techSelect.appendChild(new Option('HangarChips not loaded', ''));
          techSelect.disabled = true;
        }
      }
      if (techStatusEl) {
        var HC2 = global.Game && global.Game.HangarChips;
        if (HC2 && HC2.TECH_TREE) {
          var unlocked = [];
          var keys2 = Object.keys(HC2.TECH_TREE);
          for (var t2 = 0; t2 < keys2.length; t2++) {
            var ch2 = HC2.TECH_TREE[Number(keys2[t2])];
            for (var c2 = 0; c2 < ch2.length; c2++) {
              if (HC2.isTechUnlocked(ch2[c2].modId)) unlocked.push(ch2[c2].modId);
            }
          }
          techStatusEl.textContent = 'Unlocked techs: ' + (unlocked.length ? unlocked.join(', ') : 'none');
        } else {
          techStatusEl.textContent = 'Tech tree not loaded';
        }
      }
    }

    function formatWaveSec(value) {
      var n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return '0.0s';
      return (Math.round(n * 10) / 10).toFixed(1) + 's';
    }

    function refreshDebugWaveInfo() {
      var table = panel.querySelector('#debugWaveInfoTable');
      if (!table) return;
      var info = getWaveInfo ? getWaveInfo() : null;
      if (!info || typeof info !== 'object') {
        table.textContent = 'Wave info unavailable.';
        return;
      }
      table.innerHTML = [
        '<div><strong>Wave:</strong> ' + Math.max(0, Math.floor(Number(info.waveNumber) || 0)) + '</div>',
        '<div><strong>Safe waves:</strong> ' + Math.max(0, Math.floor(Number(info.safeWaves) || 0)) + '</div>',
        '<div><strong>Attack active:</strong> ' + (info.attackActive ? 'yes' : 'no') + '</div>',
        '<div><strong>Next attack in:</strong> ' + formatWaveSec(info.nextAttackInSec) + '</div>',
        '<div><strong>Attack ends in:</strong> ' + formatWaveSec(info.attackEndsInSec) + '</div>',
        '<div><strong>Zombie atk mult:</strong> ' + (Math.round((Number(info.zombieWaveAtkMult) || 0) * 1000) / 1000) + '</div>',
        '<div><strong>Zombies alive:</strong> ' + Math.max(0, Math.floor(Number(info.zombiesAlive) || 0)) + '</div>',
      ].join('');
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

    /* Task 6: Learn Technology button handler */
    var learnTechBtn = panel.querySelector('#debugLearnTechApply');
    if (learnTechBtn) {
      learnTechBtn.addEventListener('click', function () {
        safeDebug(function () {
          var techSelect = panel.querySelector('#debugLearnTechSelect');
          var modId = techSelect ? parseInt(techSelect.value, 10) : NaN;
          if (!Number.isFinite(modId)) {
            debugLog('warn', 'Updates: select a technology to learn.');
            return;
          }
          var HC = global.Game && global.Game.HangarChips;
          var UI = global.Game && global.Game.HangarChipsUI;
          if (!HC) { debugLog('error', 'HangarChips module not loaded.'); return; }
          if (HC.isTechUnlocked(modId)) {
            debugLog('warn', 'Updates: technology ' + modId + ' is already unlocked.');
            refreshDebugUpdatesSection();
            return;
          }
          /* Force-unlock: skip prerequisites */
          var chips = UI ? UI.getPlayerChips() : [];
          var cells = UI ? UI.getCells() : [];
          var fragments = UI && typeof UI.getPlayerFragments === 'function' ? UI.getPlayerFragments() : [];
          var result = HC.unlockTechnology(modId, chips, cells, fragments);
          if (result && result.ok) {
            debugLog('info', 'Updates: technology ' + modId + ' learned (forced via debug).');
            if (UI && typeof UI.render === 'function') UI.render();
            else {
              if (UI && typeof UI.renderTechUnlockPanel === 'function') UI.renderTechUnlockPanel();
              if (UI && typeof UI.renderChipUpgradeGrid === 'function') UI.renderChipUpgradeGrid();
            }
          } else {
            /* If unlockTechnology requires prereqs, try a manual override */
            if (HC._debugForceUnlockTech) {
              HC._debugForceUnlockTech(modId);
              debugLog('info', 'Updates: technology ' + modId + ' force-unlocked via debug override.');
            } else {
              debugLog('warn', 'Updates: failed to learn technology ' + modId + '. Reason: ' + (result ? result.error : 'unknown'));
            }
          }
          if (typeof updateUI === 'function') updateUI();
          refreshDebugUpdatesSection();
        }, 'Learn technology failed ');
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

    /* ---- Chips debug section ---- */
    var debugChipCellSelect = panel.querySelector('#debugChipCell');
    if (debugChipCellSelect) {
      for (var ci = 0; ci < 16; ci++) {
        debugChipCellSelect.appendChild(new Option('Cell ' + ci, ci));
      }
    }

    function refreshDebugChipsSection() {
      var statusEl = panel.querySelector('#debugChipStatus');
      if (!statusEl) return;
      var HC = global.Game && global.Game.HangarChips;
      if (!HC) { statusEl.textContent = 'HangarChips module not loaded'; return; }
      var cellIdx = Number((debugChipCellSelect || {}).value || 0);
      var cells = state.hangarCells;
      if (!cells || !cells[cellIdx]) {
        statusEl.innerHTML = '<b>Cell ' + cellIdx + ':</b> empty (no state)';
        return;
      }
      var cs = cells[cellIdx];
      var lines = ['<b>Cell ' + cellIdx + ' state:</b>'];
      var slotNames = ['red-0', 'red-1', 'yellow-0', 'yellow-1', 'yellow-2', 'yellow-3'];
      for (var si = 0; si < slotNames.length; si++) {
        var sn = slotNames[si];
        var chip = cs.slots[sn];
        if (chip) {
          lines.push(sn + ': [' + chip.mods.join('-') + '] ' + chip.type);
        } else {
          lines.push(sn + ': —');
        }
      }
      var active = HC.calculateActiveModifiers(cs);
      if (active && active.length) {
        lines.push('<b>Active mods:</b> ' + active.map(function(m){ return m.id + '(' + m.source + ')'; }).join(', '));
      } else {
        lines.push('<b>Active mods:</b> none');
      }
      statusEl.innerHTML = lines.join('<br>');
    }

    var debugChipInstallBtn = panel.querySelector('#debugChipInstall');
    if (debugChipInstallBtn) {
      debugChipInstallBtn.addEventListener('click', function () {
        var HC = global.Game && global.Game.HangarChips;
        if (!HC) { debugLog('error', 'HangarChips not loaded'); return; }
        var cellIdx = Number((debugChipCellSelect || {}).value || 0);
        var slotVal = (panel.querySelector('#debugChipSlot') || {}).value || 'red-0';
        var keyVal = (panel.querySelector('#debugChipKey') || {}).value || '';
        if (!keyVal) { debugLog('warn', 'Enter chip key (e.g. 1-2-3)'); return; }
        var parts = keyVal.split('-').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) { debugLog('error', 'Invalid chip key format'); return; }
        var slotParts = slotVal.split('-');
        var slotType = slotParts[0];
        var slotId = Number(slotParts[1]);
        if (!state.hangarCells) { state.hangarCells = HC.createHangarCellsState(); }
        var result = HC.installChip(state.hangarCells, cellIdx, slotType, slotId, { mods: parts, type: slotType, key: keyVal });
        if (result.ok) {
          debugLog('info', 'Chip ' + keyVal + ' installed in cell ' + cellIdx + ' slot ' + slotVal);
        } else {
          debugLog('warn', 'Install failed: ' + (result.error || 'unknown'));
        }
        refreshDebugChipsSection();
        if (typeof updateUI === 'function') updateUI();
      });
    }

    var debugChipRemoveBtn = panel.querySelector('#debugChipRemove');
    if (debugChipRemoveBtn) {
      debugChipRemoveBtn.addEventListener('click', function () {
        var HC = global.Game && global.Game.HangarChips;
        if (!HC) { debugLog('error', 'HangarChips not loaded'); return; }
        var cellIdx = Number((debugChipCellSelect || {}).value || 0);
        var slotVal = (panel.querySelector('#debugChipSlot') || {}).value || 'red-0';
        if (!state.hangarCells || !state.hangarCells[cellIdx]) {
          debugLog('warn', 'Cell ' + cellIdx + ' has no state'); return;
        }
        var slotParts = slotVal.split('-');
        var result = HC.removeChip(state.hangarCells, cellIdx, slotParts[0], Number(slotParts[1]));
        if (result.ok) {
          debugLog('info', 'Removed chip from cell ' + cellIdx + ' slot ' + slotVal);
        } else {
          debugLog('warn', 'Remove failed: ' + (result.error || 'unknown'));
        }
        refreshDebugChipsSection();
        if (typeof updateUI === 'function') updateUI();
      });
    }

    var debugChipClearBtn = panel.querySelector('#debugChipClear');
    if (debugChipClearBtn) {
      debugChipClearBtn.addEventListener('click', function () {
        var HC = global.Game && global.Game.HangarChips;
        if (!HC) return;
        var cellIdx = Number((debugChipCellSelect || {}).value || 0);
        if (!state.hangarCells || !state.hangarCells[cellIdx]) {
          debugLog('warn', 'Cell ' + cellIdx + ' has no state'); return;
        }
        state.hangarCells[cellIdx].slots = {};
        state.hangarCells[cellIdx].activeMods = [];
        debugLog('info', 'Cleared all chips from cell ' + cellIdx);
        refreshDebugChipsSection();
        if (typeof updateUI === 'function') updateUI();
      });
    }

    /* ---- Inventory debug controls ---- */
    var debugInvAddBtn = panel.querySelector('#debugInvAddChip');
    if (debugInvAddBtn) {
      debugInvAddBtn.addEventListener('click', function () {
        safeDebug(function () {
          var HC = global.Game && global.Game.HangarChips;
          var UI = global.Game && global.Game.HangarChipsUI;
          if (!HC || !UI) { debugLog('error', 'HangarChips/UI not loaded'); return; }
          var keyVal = (panel.querySelector('#debugInvChipKey') || {}).value || '';
          if (!keyVal) { debugLog('warn', 'Enter chip key (e.g. 1-2-3)'); return; }
          var chipDef = HC.getChipByKey(HC.allChips, keyVal);
          if (!chipDef) { debugLog('error', 'Chip not found: ' + keyVal); return; }
          var level = Math.max(1, Number(panel.querySelector('#debugInvChipLevel').value) || 1);
          var count = Math.max(1, Number(panel.querySelector('#debugInvChipCount').value) || 1);
          for (var ci = 0; ci < count; ci++) UI.addPlayerChip(chipDef, level);
          debugLog('info', 'Added ' + count + '× chip [' + keyVal + '] Lv' + level + ' to inventory.');
          refreshDebugInvStatus();
          if (typeof updateUI === 'function') updateUI();
        }, 'Add chip to inventory failed ');
      });
    }

    var debugInvQuickAddBtn = panel.querySelector('#debugInvQuickAdd');
    if (debugInvQuickAddBtn) {
      debugInvQuickAddBtn.addEventListener('click', function () {
        safeDebug(function () {
          var HC = global.Game && global.Game.HangarChips;
          var UI = global.Game && global.Game.HangarChipsUI;
          if (!HC || !UI) { debugLog('error', 'HangarChips/UI not loaded'); return; }
          var count = Math.max(1, Math.min(100, Number(panel.querySelector('#debugInvQuickCount').value) || 10));
          var pool = HC.allChips;
          for (var qi = 0; qi < count; qi++) {
            var rnd = pool[Math.floor(Math.random() * pool.length)];
            UI.addPlayerChip(rnd, 1);
          }
          debugLog('info', 'Added ' + count + ' random chips to inventory.');
          refreshDebugInvStatus();
          if (typeof updateUI === 'function') updateUI();
        }, 'Quick add chips failed ');
      });
    }

    function refreshDebugInvStatus() {
      var statusEl = panel.querySelector('#debugInvStatus');
      if (!statusEl) return;
      var UI = global.Game && global.Game.HangarChipsUI;
      if (!UI) { statusEl.textContent = 'HangarChipsUI not loaded'; return; }
      var chips = UI.getPlayerChips();
      var total = 0;
      for (var i = 0; i < chips.length; i++) total += chips[i].count;
      statusEl.innerHTML = '<b>Inventory:</b> ' + chips.length + ' entries, ' + total + ' chips total';
    }

    function refreshDebugFragStatus() {
      var statusEl = panel.querySelector('#debugFragStatus');
      if (!statusEl) return;
      var UI = global.Game && global.Game.HangarChipsUI;
      if (!UI) { statusEl.textContent = 'HangarChipsUI not loaded'; return; }
      var frags = UI.getPlayerFragments();
      var total = 0;
      for (var i = 0; i < frags.length; i++) total += frags[i].count;
      var lines = ['<b>Fragments:</b> ' + frags.length + ' types, ' + total + ' total'];
      for (var j = 0; j < frags.length; j++) {
        lines.push('  modId ' + frags[j].fragmentId + ': ×' + frags[j].count);
      }
      statusEl.innerHTML = lines.join('<br>');
    }

    /* ---- Fragment inventory debug controls ---- */
    var debugFragAddBtn = panel.querySelector('#debugFragAdd');
    if (debugFragAddBtn) {
      debugFragAddBtn.addEventListener('click', function () {
        safeDebug(function () {
          var UI = global.Game && global.Game.HangarChipsUI;
          if (!UI) { debugLog('error', 'HangarChipsUI not loaded'); return; }
          var modId = Math.max(1, Math.min(30, Number(panel.querySelector('#debugFragModId').value) || 1));
          var count = Math.max(1, Number(panel.querySelector('#debugFragCount').value) || 1);
          UI.addPlayerFragment(modId, count);
          debugLog('info', 'Added ' + count + '× fragment modId=' + modId + ' to inventory.');
          refreshDebugFragStatus();
          if (typeof updateUI === 'function') updateUI();
        }, 'Add fragment failed ');
      });
    }

    var debugFragQuickAddBtn = panel.querySelector('#debugFragQuickAdd');
    if (debugFragQuickAddBtn) {
      debugFragQuickAddBtn.addEventListener('click', function () {
        safeDebug(function () {
          var UI = global.Game && global.Game.HangarChipsUI;
          var HC = global.Game && global.Game.HangarChips;
          if (!UI || !HC) { debugLog('error', 'HangarChips/UI not loaded'); return; }
          var count = Math.max(1, Math.min(100, Number(panel.querySelector('#debugFragQuickCount').value) || 10));
          var ids = HC.ALL_FRAGMENT_IDS || [];
          if (!ids.length) { for (var m = 1; m <= 30; m++) ids.push(m); }
          for (var qi = 0; qi < count; qi++) {
            var rndId = ids[Math.floor(Math.random() * ids.length)];
            UI.addPlayerFragment(rndId, 1);
          }
          debugLog('info', 'Added ' + count + ' random fragments to inventory.');
          refreshDebugFragStatus();
          if (typeof updateUI === 'function') updateUI();
        }, 'Quick add fragments failed ');
      });
    }

    if (debugChipCellSelect) {
      debugChipCellSelect.addEventListener('change', refreshDebugChipsSection);
    }

    // perf-capture-tool: live readout for the Perf tab (reads Game.PerfCapture).
    function refreshDebugPerfSection() {
      var P = global.Game && global.Game.PerfCapture;
      var section = panel.querySelector('#debugSectionPerf');
      if (!section) return;
      var pre = section.querySelector('#debugPerfReadout');
      if (pre) {
        pre.textContent = (P && typeof P.getStatusText === 'function')
          ? P.getStatusText()
          : 'Game.PerfCapture is not loaded (check src/perf/perfCapture.js script tag).';
      }
      var startB = section.querySelector('#debugPerfStart');
      var stopB = section.querySelector('#debugPerfStop');
      if (P && startB && stopB && typeof P.isCapturing === 'function') {
        var cap = !!P.isCapturing();
        startB.disabled = cap;
        stopB.disabled = !cap;
      }
    }

    // perf-capture-tool: build the Perf section + wire Game.PerfCapture controls.
    var perfBody = panel.querySelector('.debugPanelBody');
    if (perfBody && !panel.querySelector('#debugSectionPerf')) {
      var perfSection = document.createElement('div');
      perfSection.id = 'debugSectionPerf';
      perfSection.className = 'debugSection';
      perfSection.innerHTML = [
        '<div class="debugRow"><span class="debugLabel">Real-time perf capture</span></div>',
        '<div class="debugRow" style="font-size:11px;line-height:1.4;opacity:.85">',
        'Press Start, reproduce the lag, then Stop. "Copy AI report" puts a Markdown + JSON',
        ' payload on the clipboard for an AI agent; "Download JSON" saves the same data.',
        ' A minimal corner overlay shows FPS / frame ms / top phases while capturing.',
        '</div>',
        '<div class="debugRow" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">',
        '<button type="button" class="debugBtn" id="debugPerfStart">Start</button>',
        '<button type="button" class="debugBtn" id="debugPerfStop">Stop</button>',
        '<button type="button" class="debugBtn" id="debugPerfReset">Reset</button>',
        '</div>',
        '<div class="debugRow" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">',
        '<button type="button" class="debugBtn" id="debugPerfCopy">Copy AI report</button>',
        '<button type="button" class="debugBtn" id="debugPerfDownload">Download JSON</button>',
        '</div>',
        '<div class="debugRow" style="margin-top:6px">',
        '<label style="font-size:11px"><input type="checkbox" id="debugPerfUserTiming" /> DevTools timeline (performance.measure)</label>',
        '</div>',
        '<pre id="debugPerfReadout" style="margin-top:6px;font-size:11px;line-height:1.35;white-space:pre-wrap;max-height:240px;overflow:auto;background:rgba(0,0,0,.25);padding:6px;border-radius:4px"></pre>'
      ].join('');
      perfBody.appendChild(perfSection);

      var perfStartBtn = perfSection.querySelector('#debugPerfStart');
      if (perfStartBtn) perfStartBtn.addEventListener('click', function () {
        safeDebug(function () {
          var P = global.Game && global.Game.PerfCapture;
          if (!P) { debugLog('error', 'PerfCapture not loaded.'); return; }
          P.start();
          debugLog('info', 'Perf capture started.');
          refreshDebugPerfSection();
        }, 'Perf start failed ');
      });

      var perfStopBtn = perfSection.querySelector('#debugPerfStop');
      if (perfStopBtn) perfStopBtn.addEventListener('click', function () {
        safeDebug(function () {
          var P = global.Game && global.Game.PerfCapture;
          if (!P) { debugLog('error', 'PerfCapture not loaded.'); return; }
          P.stop();
          debugLog('info', 'Perf capture stopped.');
          refreshDebugPerfSection();
        }, 'Perf stop failed ');
      });

      var perfResetBtn = perfSection.querySelector('#debugPerfReset');
      if (perfResetBtn) perfResetBtn.addEventListener('click', function () {
        safeDebug(function () {
          var P = global.Game && global.Game.PerfCapture;
          if (!P) { debugLog('error', 'PerfCapture not loaded.'); return; }
          P.reset();
          debugLog('info', 'Perf capture reset.');
          refreshDebugPerfSection();
        }, 'Perf reset failed ');
      });

      var perfCopyBtn = perfSection.querySelector('#debugPerfCopy');
      if (perfCopyBtn) perfCopyBtn.addEventListener('click', function () {
        safeDebug(function () {
          var P = global.Game && global.Game.PerfCapture;
          if (!P) { debugLog('error', 'PerfCapture not loaded.'); return; }
          var payload = P.copyReport();
          debugLog('info', 'AI report copied to clipboard (' + (payload ? payload.length : 0) + ' chars).');
        }, 'Perf copy failed ');
      });

      var perfDownloadBtn = perfSection.querySelector('#debugPerfDownload');
      if (perfDownloadBtn) perfDownloadBtn.addEventListener('click', function () {
        safeDebug(function () {
          var P = global.Game && global.Game.PerfCapture;
          if (!P) { debugLog('error', 'PerfCapture not loaded.'); return; }
          P.downloadJson();
          debugLog('info', 'Perf JSON download triggered.');
        }, 'Perf download failed ');
      });

      var perfUserTiming = perfSection.querySelector('#debugPerfUserTiming');
      if (perfUserTiming) perfUserTiming.addEventListener('change', function () {
        safeDebug(function () {
          var P = global.Game && global.Game.PerfCapture;
          if (P && typeof P.setUserTiming === 'function') P.setUserTiming(!!perfUserTiming.checked);
        }, 'Perf timeline toggle failed ');
      });

      if (typeof global.setInterval === 'function') {
        global.setInterval(function () {
          var sec = panel.querySelector('#debugSectionPerf');
          if (!sec || !sec.classList.contains('active')) return;
          refreshDebugPerfSection();
        }, 400);
      }
    }

    state.debug.refreshHangarList = refreshDebugHangarList;
    state.debug.refreshTankExtras = refreshDebugTankExtras;
    state.debug.refreshUpdates = refreshDebugUpdatesSection;
    state.debug.refreshZombieCounts = refreshDebugWaveInfo;
    state.debug.refreshChips = refreshDebugChipsSection;

    main.insertBefore(panel, main.firstChild);
    refreshDebugHangarList();
    refreshDebugEffectList();
    refreshDebugUpdatesSection();
    refreshDebugWaveInfo();

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
