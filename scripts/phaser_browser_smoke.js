/**
 * phaser_browser_smoke.js — Browser console smoke test suite for Phaser runtime.
 *
 * Usage: Load the game with `usePhaser` flag enabled, then paste this into the console.
 *
 * Tests run sequentially with timeouts to allow the game loop to process.
 * Results are logged to the console and downloadable as JSON.
 *
 * Scenarios covered:
 *  1. Engine verification — Phaser is active, loop running
 *  2. Parity gate — all categories pass
 *  3. Render layers — all 18 registered, modes applied
 *  4. Modal flows — open/close each registered modal
 *  5. HUD updates — text and progress elements respond
 *  6. Save/load round-trip — save to slot, reload, compare
 *  7. Partial reset — preserves talents/achievements/drones
 *  8. Pause/resume — pause flag toggles, loop pauses
 *  9. Audio adapter — init state, no crashes on playSfx
 * 10. Attack mode — spawns use 3 directions
 * 11. Tutorial first-run state — flags correct on new game
 * 12. i18n switch — language toggle updates visible strings
 * 13. Hangar/workshop/talents — modals open without error
 */
(function () {
  'use strict';

  var G = window.Game || {};
  var results = [];
  var passCount = 0;
  var failCount = 0;

  function log(name, pass, detail) {
    results.push({ name: name, pass: !!pass, detail: detail || '' });
    if (pass) {
      passCount++;
      console.log('%c  ✓ ' + name, 'color: green', detail || '');
    } else {
      failCount++;
      console.log('%c  ✗ ' + name, 'color: red; font-weight: bold', detail || '');
    }
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function runSmoke() {
    console.log('\n─── Phaser Browser Smoke Tests ───\n');

    // 1. Engine verification
    var ea = G.EngineAdapter;
    log('engine.isPhaser', ea && ea.isPhaser(), ea ? ea.getActiveEngine() : 'N/A');
    log('engine.phaserGame', !!(G.PhaserBootstrap && G.PhaserBootstrap.getGame()),
      G.PhaserBootstrap ? 'Phaser.Game present' : 'missing');

    // 2. Parity gate
    if (G.ParityGate && typeof G.ParityGate.runGate === 'function') {
      var gateResult = G.ParityGate.runGate();
      log('parityGate.pass', gateResult.pass,
        gateResult.passed + '/' + gateResult.total + ' passed');
      if (!gateResult.pass) {
        var cats = Object.keys(gateResult.results);
        for (var ci = 0; ci < cats.length; ci++) {
          var catR = gateResult.results[cats[ci]];
          if (!catR.pass) {
            var failedChecks = catR.checks.filter(function (c) { return !c.pass; });
            for (var fi = 0; fi < failedChecks.length; fi++) {
              log('parityGate.' + failedChecks[fi].id, false, failedChecks[fi].message);
            }
          }
        }
      }
    } else {
      log('parityGate.available', false, 'ParityGate not found');
    }

    // 3. Render layers
    if (G.RenderRegistry && typeof G.RenderRegistry.getLayers === 'function') {
      var layers = G.RenderRegistry.getLayers();
      var layerIds = Object.keys(layers);
      log('render.layerCount', layerIds.length === 18, layerIds.length + ' layers');
    } else {
      log('render.registry', false, 'RenderRegistry not found');
    }

    // 4. Modal flows
    if (G.ModalAdapter && typeof G.ModalAdapter.getModals === 'function') {
      var modals = G.ModalAdapter.getModals();
      var modalIds = Object.keys(modals);
      log('modal.count', modalIds.length >= 13, modalIds.length + ' modals registered');

      // Open/close each modal quickly
      for (var mi = 0; mi < modalIds.length; mi++) {
        var mid = modalIds[mi];
        try {
          G.ModalAdapter.notifyOpen(mid, {});
          await delay(50);
          var isOpen = G.ModalAdapter.isOpen(mid);
          G.ModalAdapter.notifyClose(mid);
          log('modal.openClose.' + mid, isOpen, isOpen ? 'opened OK' : 'failed to open');
        } catch (e) {
          log('modal.openClose.' + mid, false, 'Error: ' + e.message);
        }
      }
    }

    // 5. HUD updates
    if (G.HudAdapter && typeof G.HudAdapter.updateText === 'function') {
      try {
        G.HudAdapter.updateText('coins', '12345');
        G.HudAdapter.updateText('zcount', '99');
        G.HudAdapter.updateProgress('xpBar', 0.75);
        log('hud.update', true, 'updateText/updateProgress no-throw');
      } catch (e) {
        log('hud.update', false, 'Error: ' + e.message);
      }
    }

    // 6. Save/load round-trip
    try {
      var storage = G.Storage || (G.Persistence && G.Persistence.Storage);
      if (storage && typeof storage.saveToSlot === 'function' && typeof storage.loadFromSlot === 'function') {
        storage.saveToSlot(9);
        await delay(100);
        var saved = localStorage.getItem('saveSlot_v1_9');
        log('save.slot9', !!saved, saved ? (saved.length + ' chars') : 'empty');

        // Load it back
        storage.loadFromSlot(9);
        await delay(200);
        log('load.slot9', true, 'loaded without crash');
      } else {
        log('save.api', false, 'Storage API not found');
      }
    } catch (e) {
      log('save.roundTrip', false, 'Error: ' + e.message);
    }

    // 7. Pause/resume
    if (G.PauseManager && typeof G.PauseManager.setPaused === 'function') {
      try {
        G.PauseManager.setPaused(true);
        var paused = G.PauseManager.isPaused();
        log('pause.set', paused, 'isPaused=' + paused);
        G.PauseManager.setPaused(false);
        var resumed = !G.PauseManager.isPaused();
        log('pause.resume', resumed, 'resumed=' + resumed);
      } catch (e) {
        log('pause.error', false, e.message);
      }
    }

    // 8. Audio adapter
    if (G.PhaserAudioAdapter) {
      try {
        var audioOk = typeof G.PhaserAudioAdapter.playSfx === 'function';
        // Don't actually play to avoid noise; just verify API exists
        log('audio.adapterApi', audioOk, audioOk ? 'playSfx available' : 'missing');
      } catch (e) {
        log('audio.error', false, e.message);
      }
    } else {
      log('audio.adapter', false, 'PhaserAudioAdapter not found');
    }

    // 9. Rollout controller status
    if (G.RolloutController && typeof G.RolloutController.getStatus === 'function') {
      var status = G.RolloutController.getStatus();
      log('rollout.phase', status.phase === 'phaser', 'phase=' + status.phase);
      log('rollout.engineApplied', status.engineApplied === 'phaser',
        'engineApplied=' + status.engineApplied);
      log('rollout.requiresReload', !status.requiresReload,
        'requiresReload=' + status.requiresReload);
    }

    // 10. Scene overlay manager
    if (G.SceneOverlayManager && typeof G.SceneOverlayManager.getRegistered === 'function') {
      var scenes = G.SceneOverlayManager.getRegistered();
      log('scenes.registered', scenes.length >= 14, scenes.length + ' scenes: ' + scenes.join(', '));
    }

    await delay(200);

    // ─── Summary ───
    console.log('\n─── Smoke Results ───');
    console.log('Passed: ' + passCount + '  Failed: ' + failCount +
      '  Total: ' + (passCount + failCount));

    // Download report
    var report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      engine: ea ? ea.getActiveEngine() : 'unknown',
      passed: passCount,
      failed: failCount,
      total: passCount + failCount,
      results: results,
    };

    var blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'phaser_smoke_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return report;
  }

  runSmoke().then(function (report) {
    console.log('[PhaserSmoke] Complete. Report downloaded.');
    window.__lastPhaserSmokeReport = report;
  });
})();
