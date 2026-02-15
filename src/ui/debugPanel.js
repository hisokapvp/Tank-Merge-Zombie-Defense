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
    var recordTankLevel = opts.recordTankLevel;
    var openDismantleModal = opts.openDismantleModal;
    var setMenuOpen = opts.setMenuOpen;
    var tankLevelCounts = opts.tankLevelCounts;
    var computeAuraBand = opts.computeAuraBand;
    var zombieLevelWeights = opts.zombieLevelWeights;
    var pickZombieLevel = opts.pickZombieLevel;
    var initBoard = opts.initBoard;
    var burst = opts.burst;
    var playSfx = opts.playSfx;
    var canUseActive = opts.canUseActive;
    var useActiveAbility = opts.useActiveAbility;
    var initTalentDefs = opts.initTalentDefs;
    var getTalentDefs = opts.getTalentDefs;
    var center = opts.center;
    var updateUI = opts.updateUI;

    main.classList.add('debugLayout');

    var panel = document.createElement('div');
    panel.id = 'debugPanel';
    panel.className = 'debugPanel';

    var activeNames = ['Шквал (Attack)', 'Перегрев (Speed)', 'Золотой час (Economy)'];
    var vfxList = [
      { id: 'burst', label: 'Burst center' },
      { id: 'particle_burst', label: 'Particle burst' },
      { id: 'impact_ring', label: 'Impact ring' },
      { id: 'decal_pool', label: 'Decal pool' },
    ];
    var statusList = [
      { id: 'attack', key: 'attackUntil', label: 'Attack +50%' },
      { id: 'speed', key: 'speedUntil', label: 'Speed +35%' },
      { id: 'economy', key: 'economyUntil', label: 'Economy +60%' },
    ];

    panel.innerHTML = '\n    <div class="debugPanelHeader">\n      <span class="debugPanelTitle">Debug (?debug=1)</span>\n      <button type="button" class="debugCollapseBtn" id="debugCollapse">Collapse</button>\n    </div>\n    <div class="debugTabs">\n      <button type="button" class="debugTab active" data-tab="tanks">Tanks</button>\n      <button type="button" class="debugTab" data-tab="zombies">Zombies</button>\n      <button type="button" class="debugTab" data-tab="roads">Roads/Hangar</button>\n      <button type="button" class="debugTab" data-tab="effects">Effects</button>\n      <button type="button" class="debugTab" data-tab="actives">Actives</button>\n      <button type="button" class="debugTab" data-tab="talents">Talents</button>\n      <button type="button" class="debugTab" data-tab="logs">Logs&Tools</button>\n    </div>\n    <div class="debugPanelBody">\n      <div id="debugSectionTanks" class="debugSection active">\n        <div class="debugRow">\n          <label class="debugLabel">Tank level (1–' + DEBUG_MAX_TANK_LEVEL + ')</label>\n          <select id="debugTankLevel" class="debugSelect"></select>\n        </div>\n        <button type="button" class="debugBtn" id="debugSpawnTank">Spawn in free slot</button>\n        <div class="debugRow" style="margin-top:8px">\n          <label class="debugLabel">Hangar — select target</label>\n          <div id="debugHangarList"></div>\n        </div>\n        <div id="debugTankComposition" class="debugRow" style="margin-top:6px;font-size:11px"></div>\n        <div id="debugMergePossible" class="debugRow" style="margin-top:4px;font-size:11px"></div>\n        <div id="debugAuraBand" class="debugRow" style="margin-top:4px;font-size:11px"></div>\n        <button type="button" class="debugBtn" id="debugDismantleBtn" style="margin-top:6px">Dismantle selected tank</button>\n        <button type="button" class="debugBtn" id="debugOpenSettings">Open Settings</button>\n      </div>\n      <div id="debugSectionZombies" class="debugSection">\n        <div id="debugZombieCounts" class="debugRow" style="font-size:11px;margin-bottom:6px"></div>\n        <div id="debugZombieWeights" class="debugRow" style="font-size:11px;margin-bottom:6px"></div>\n        <div class="debugRow">\n          <button type="button" class="debugBtn debugSimSpawns" data-n="100">Simulate 100 spawns</button>\n          <button type="button" class="debugBtn debugSimSpawns" data-n="1000">Simulate 1000 spawns</button>\n        </div>\n        <div id="debugSimResults" class="debugRow" style="font-size:11px;margin-top:6px;white-space:pre-wrap;max-height:120px;overflow:auto"></div>\n      </div>\n      <div id="debugSectionRoads" class="debugSection">\n        <div class="debugRow"><label class="debugLabel">Zombie track radius</label><input type="range" id="debugZombieRadius" min="200" max="450" step="5" /><span id="debugZombieRadiusVal"></span></div>\n        <div class="debugRow"><label class="debugLabel">Tank orbit radius</label><input type="range" id="debugTankRadius" min="150" max="320" step="5" /><span id="debugTankRadiusVal"></span></div>\n        <div class="debugRow"><label class="debugLabel">Cell width</label><input type="range" id="debugCellW" min="30" max="70" step="2" /><span id="debugCellWVal"></span></div>\n        <div class="debugRow"><label class="debugLabel">Cell height</label><input type="range" id="debugCellH" min="22" max="50" step="2" /><span id="debugCellHVal"></span></div>\n        <div class="debugRow" style="margin-top:8px">\n          <button type="button" class="debugBtn" id="debugApplyRoads">Apply</button>\n          <button type="button" class="debugBtn" id="debugResetRoads">Reset to defaults</button>\n        </div>\n        <div id="debugRoadsNote" class="debugRow" style="font-size:10px;color:var(--muted);margin-top:4px"></div>\n      </div>\n      <div id="debugSectionEffects" class="debugSection">\n        <div class="debugRow">\n          <label class="debugLabel">Category</label>\n          <select id="debugEffectCategory" class="debugSelect">\n            <option value="all">All</option>\n            <option value="vfx">VFX</option>\n            <option value="status">Status</option>\n          </select>\n        </div>\n        <div id="debugEffectList"></div>\n        <div class="debugTools" style="margin-top:8px">\n          <button type="button" class="debugBtn" id="debugStopAllVfx">Stop all preview VFX</button>\n          <button type="button" class="debugBtn danger" id="debugClearStatuses">Clear debug statuses</button>\n        </div>\n      </div>\n      <div id="debugSectionActives" class="debugSection">\n        <div class="debugRow">\n          <label class="debugLabel">Target: selected tank (info only)</label>\n        </div>\n        <div class="debugRow">\n          <label><input type="checkbox" id="debugBypass" checked /> Bypass cooldown/cost</label>\n        </div>\n        <div id="debugActivesList"></div>\n      </div>\n      <div id="debugSectionTalents" class="debugSection">\n        <div id="debugTalentsList"></div>\n        <button type="button" class="debugBtn" id="debugClearOverrides">Clear talent overrides</button>\n      </div>\n      <div id="debugSectionLogs" class="debugSection">\n        <button type="button" class="debugBtn" id="debugResetBtn">Reset (overrides + statuses + VFX)</button>\n        <button type="button" class="debugBtn" id="debugClearLog">Clear log</button>\n        <button type="button" class="debugBtn" id="lessonProgressBtn">Lesson Progress</button>\n        <div id="debugTelemetryMount"></div>\n      </div>\n    </div>\n    <div class="debugLogWrap">\n      <div id="debugLog"></div>\n    </div>\n  ';

    var tankLevelSelect = panel.querySelector('#debugTankLevel');
    for (var l = 1; l <= DEBUG_MAX_TANK_LEVEL; l++) {
      tankLevelSelect.appendChild(new Option('Lv' + l, l));
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
        if (tab === 'zombies') { refreshDebugZombieWeights(); refreshDebugZombieCounts(); }
        if (tab === 'roads') refreshDebugRoadsSliders();
        if (tab === 'actives') refreshDebugActivesList();
        if (tab === 'talents') refreshDebugTalentsList();
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

    var stopVfxBtn = panel.querySelector('#debugStopAllVfx');
    if (stopVfxBtn) {
      stopVfxBtn.addEventListener('click', function () {
        safeDebug(function () {
          state.particles = state.particles.filter(function (p) { return !p.debugPreview; });
          state.impacts = state.impacts.filter(function (fx) { return !fx.debugPreview; });
          state.decals = state.decals.filter(function (d) { return !d.debugPreview; });
          debugLog('info', 'Stopped all preview VFX.');
        }, 'Stop VFX failed ');
      });
    }

    var clearStatusBtn = panel.querySelector('#debugClearStatuses');
    if (clearStatusBtn) {
      clearStatusBtn.addEventListener('click', function () {
        safeDebug(function () {
          state.debug.debugStatusActive = false;
          state.activeEffects.attackUntil = 0;
          state.activeEffects.speedUntil = 0;
          state.activeEffects.economyUntil = 0;
          debugLog('info', 'Cleared debug statuses.');
        }, 'Clear statuses failed ');
      });
    }

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

    var clearOverridesBtn = panel.querySelector('#debugClearOverrides');
    if (clearOverridesBtn) {
      clearOverridesBtn.addEventListener('click', function () {
        safeDebug(function () {
          state.debug.talentOverrides = {};
          state.player.modsDirty = true;
          debugLog('info', 'Cleared talent overrides.');
          refreshDebugTalentsList();
        }, 'Clear overrides failed ');
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

    function refreshDebugZombieWeights() {
      var el = panel.querySelector('#debugZombieWeights');
      if (!el) return;
      var weights = zombieLevelWeights();
      el.textContent = weights.length ? 'Weights: ' + weights.map(function (w) { return 'Lv' + w.level + ' ' + (w.weight * 100).toFixed(1) + '%'; }).join(', ') : 'No tanks → fallback Lv1 100%';
    }

    function refreshDebugZombieCounts() {
      var el = panel.querySelector('#debugZombieCounts');
      if (!el) return;
      var now = nowSec();
      var cache = state.debug.zombieCountCache || { at: 0, text: '' };
      if (!cache.at || (now - cache.at) >= 0.5) {
        var zombies = state.zombies || [];
        var dying = 0;
        for (var i = 0; i < zombies.length; i++) if (zombies[i].state === 'dying') dying++;
        var total = zombies.length;
        var alive = total - dying;
        var target = BAL.zombieCountTarget;
        cache.at = now;
        cache.text = 'Alive: ' + alive + ' | Dying: ' + dying + ' | Target: ' + target + ' | Total: ' + total;
        state.debug.zombieCountCache = cache;
      }
      el.textContent = cache.text || ('Alive: 0 | Dying: 0 | Target: ' + BAL.zombieCountTarget + ' | Total: 0');
    }

    function refreshDebugRoadsSliders() {
      var rZ = panel.querySelector('#debugZombieRadius');
      var rT = panel.querySelector('#debugTankRadius');
      var cW = panel.querySelector('#debugCellW');
      var cH = panel.querySelector('#debugCellH');
      var vZ = panel.querySelector('#debugZombieRadiusVal');
      var vT = panel.querySelector('#debugTankRadiusVal');
      var vW = panel.querySelector('#debugCellWVal');
      var vH = panel.querySelector('#debugCellHVal');
      if (rZ) { rZ.value = BAL.zombieTrackRadius; if (vZ) vZ.textContent = BAL.zombieTrackRadius; }
      if (rT) { rT.value = BAL.tankOrbitRadius; if (vT) vT.textContent = BAL.tankOrbitRadius; }
      if (cW) { cW.value = BAL.cellW; if (vW) vW.textContent = BAL.cellW; }
      if (cH) { cH.value = BAL.cellH; if (vH) vH.textContent = BAL.cellH; }
    }

    panel.querySelectorAll('.debugSimSpawns').forEach(function (btn) {
      btn.addEventListener('click', function () {
        safeDebug(function () {
          var n = Number(btn.dataset.n) || 100;
          var counts = {};
          for (var i = 0; i < n; i++) {
            var lvl = pickZombieLevel();
            counts[lvl] = (counts[lvl] || 0) + 1;
          }
          var levels = Object.keys(counts).map(Number).sort(function (a, b) { return a - b; });
          var lines = levels.map(function (lv) { return 'Lv' + lv + ': ' + counts[lv] + ' (' + (counts[lv] / n * 100).toFixed(1) + '%)'; });
          var el = panel.querySelector('#debugSimResults');
          if (el) el.textContent = 'Simulated ' + n + ' spawns:\n' + lines.join('\n');
          debugLog('info', 'Simulated ' + n + ' zombie spawns.');
        }, 'Simulate failed ');
      });
    });

    ['debugZombieRadius', 'debugTankRadius', 'debugCellW', 'debugCellH'].forEach(function (id) {
      var input = panel.querySelector('#' + id);
      var valEl = panel.querySelector('#' + id + 'Val');
      if (input && valEl) input.addEventListener('input', function () { valEl.textContent = input.value; });
    });

    var applyRoadsBtn = panel.querySelector('#debugApplyRoads');
    if (applyRoadsBtn) {
      applyRoadsBtn.addEventListener('click', function () {
        safeDebug(function () {
          var rZ = panel.querySelector('#debugZombieRadius');
          var rT = panel.querySelector('#debugTankRadius');
          var cW = panel.querySelector('#debugCellW');
          var cH = panel.querySelector('#debugCellH');
          if (rZ) BAL.zombieTrackRadius = Number(rZ.value);
          if (rT) BAL.tankOrbitRadius = Number(rT.value);
          if (cW) BAL.cellW = Number(cW.value);
          if (cH) BAL.cellH = Number(cH.value);
          initBoard();
          var note = panel.querySelector('#debugRoadsNote');
          if (note) note.textContent = 'Applied. Resize may override; reload for persistent defaults.';
          debugLog('info', 'Roads/hangar applied.');
        }, 'Apply failed ');
      });
    }

    var resetRoadsBtn = panel.querySelector('#debugResetRoads');
    if (resetRoadsBtn) {
      resetRoadsBtn.addEventListener('click', function () {
        safeDebug(function () {
          BAL.zombieTrackRadius = BASE_BAL.zombieTrackRadius;
          BAL.tankOrbitRadius = BASE_BAL.tankOrbitRadius;
          BAL.cellW = BASE_BAL.cellW;
          BAL.cellH = BASE_BAL.cellH;
          BAL.cellGap = BASE_BAL.cellGap;
          BAL.boardPad = BASE_BAL.boardPad;
          initBoard();
          refreshDebugRoadsSliders();
          var note = panel.querySelector('#debugRoadsNote');
          if (note) note.textContent = '';
          debugLog('info', 'Roads/hangar reset to defaults.');
        }, 'Reset failed ');
      });
    }

    function refreshDebugEffectList() {
      var container = panel.querySelector('#debugEffectList');
      if (!container) return;
      container.innerHTML = '';
      var catEl = panel.querySelector('#debugEffectCategory');
      var cat = catEl ? catEl.value : 'all';
      var showVfx = cat === 'all' || cat === 'vfx';
      var showStatus = cat === 'all' || cat === 'status';
      if (showVfx) {
        vfxList.forEach(function (ef) {
          var row = document.createElement('div');
          row.className = 'debugRow';
          row.innerHTML = '<span class="debugLabel">' + ef.label + '</span><button type="button" class="debugBtn debugPlayVfx" data-id="' + ef.id + '">Play once</button>';
          row.querySelector('button').addEventListener('click', function () {
            safeDebug(function () {
              var x = center.x + (Math.random() - 0.5) * 80;
              var y = center.y + (Math.random() - 0.5) * 80;
              if (ef.id === 'burst') {
                burst(x, y, 12, 'rgba(255,180,120,.25)');
                debugLog('info', 'VFX: Burst at center.');
              } else if (ef.id === 'particle_burst') {
                for (var i = 0; i < 8; i++) {
                  var p = { x: x, y: y, r: 2, color: 'rgba(200,255,180,.4)', life: 0.4, max: 0.4, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, debugPreview: true };
                  state.particles.push(p);
                }
                debugLog('info', 'VFX: Particle burst.');
              } else if (ef.id === 'impact_ring') {
                state.impacts.push({ x: x, y: y, r: 0, maxR: 40, life: 0.3, max: 0.3, kind: 'he', debugPreview: true });
                debugLog('info', 'VFX: Impact ring.');
              } else if (ef.id === 'decal_pool') {
                state.decals.push({ kind: 'pool', x: x, y: y, r: 25, life: 5, max: 5, dps: 0, color: 'rgba(125,255,178,.14)', debugPreview: true });
                debugLog('info', 'VFX: Decal pool.');
              }
            }, 'VFX failed ');
          });
          container.appendChild(row);
        });
      }
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

    function refreshDebugActivesList() {
      var container = panel.querySelector('#debugActivesList');
      if (!container) return;
      container.innerHTML = '';
      initTalentDefs();
      [0, 1, 2].forEach(function (branch) {
        var row = document.createElement('div');
        row.className = 'debugRow';
        var name = activeNames[branch] || ('Active ' + branch);
        row.innerHTML = '<span class="debugLabel">' + name + '</span><button type="button" class="debugBtn debugActivateActive" data-branch="' + branch + '">Activate</button>';
        row.querySelector('button').addEventListener('click', function () {
          safeDebug(function () {
            var bypassEl = panel.querySelector('#debugBypass');
            var bypass = bypassEl && bypassEl.checked;
            if (bypass) {
              var now = nowSec();
              state.player.activeCooldowns[branch] = now;
              if (branch === 0) state.activeEffects.attackUntil = now + 6;
              else if (branch === 1) state.activeEffects.speedUntil = now + 6;
              else if (branch === 2) state.activeEffects.economyUntil = now + 6;
              playSfx('activeAbility');
              burst(center.x, center.y, 60, branch === 0 ? 'rgba(255,120,90,.2)' : branch === 1 ? 'rgba(125,255,178,.22)' : 'rgba(255,215,125,.22)');
              state.debug.debugStatusActive = true;
              debugLog('info', 'Active ' + name + ' (bypass) activated.');
            } else {
              if (!canUseActive(branch)) {
                debugLog('warn', 'Active ' + name + ': cannot use (cooldown or not unlocked).');
                return;
              }
              useActiveAbility(branch);
              debugLog('info', 'Active ' + name + ' activated.');
            }
          }, 'Activate failed ');
        });
        container.appendChild(row);
      });
    }

    function refreshDebugTalentsList() {
      var container = panel.querySelector('#debugTalentsList');
      if (!container) return;
      container.innerHTML = '';
      initTalentDefs();
      var TALENT_DEFS = getTalentDefs();
      TALENT_DEFS.forEach(function (def, i) {
        var row = document.createElement('div');
        row.className = 'debugRow';
        var current = state.debug.talentOverrides[i] || 'normal';
        row.innerHTML = '<span class="debugLabel" title="' + def.desc + '">' + def.name + '</span><select class="debugSelect debugTalentOverride" data-talent="' + i + '" style="width:auto;display:inline-block;margin-left:4px"><option value="normal" ' + (current === 'normal' ? 'selected' : '') + '>Normal</option><option value="on" ' + (current === 'on' ? 'selected' : '') + '>Force ON</option><option value="off" ' + (current === 'off' ? 'selected' : '') + '>Force OFF</option></select>';
        row.querySelector('select').addEventListener('change', function (e) {
          var v = e.target.value;
          if (v === 'normal') delete state.debug.talentOverrides[i];
          else state.debug.talentOverrides[i] = v;
          state.player.modsDirty = true;
          debugLog('info', 'Talent ' + def.name + ': ' + v + '.');
        });
        container.appendChild(row);
      });
    }

    state.debug.refreshHangarList = refreshDebugHangarList;
    state.debug.refreshTankExtras = refreshDebugTankExtras;
    state.debug.refreshZombieWeights = refreshDebugZombieWeights;
    state.debug.refreshZombieCounts = refreshDebugZombieCounts;
    state.debug.refreshRoadsSliders = refreshDebugRoadsSliders;

    main.insertBefore(panel, main.firstChild);
    refreshDebugHangarList();
    refreshDebugEffectList();
    refreshDebugActivesList();
    refreshDebugTalentsList();

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
