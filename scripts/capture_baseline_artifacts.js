/**
 * capture_baseline_artifacts.js — Browser console script to capture baseline artifacts
 * for Phaser migration parity verification.
 *
 * Usage: Copy-paste into browser console while the game is running.
 * Outputs: downloads a JSON file with all captured data.
 *
 * Captures:
 * - All save slots (localStorage saveSlot_v1_*)
 * - Save slots meta (saveSlotsMeta_v1)
 * - Current runtime state snapshot via Game.StateSnapshot (if available)
 * - Render layer order from RenderRegistry
 * - Modal adapter registration state
 * - HUD adapter registration state
 * - Feature flags
 * - Measured FPS (samples 60 frames)
 * - Canvas dimensions and DPR
 * - Language setting
 */
(function () {
  'use strict';

  var artifact = {
    capturedAt: new Date().toISOString(),
    version: 1,
    userAgent: navigator.userAgent,
    canvasSize: null,
    dpr: window.devicePixelRatio || 1,
    language: null,
    featureFlags: null,
    saveSlotsMeta: null,
    saveSlots: {},
    renderLayers: null,
    modalState: null,
    hudState: null,
    stateSnapshot: null,
    fps: null,
  };

  // Canvas info
  var canvas = document.getElementById('gameCanvas') || document.querySelector('canvas');
  if (canvas) {
    artifact.canvasSize = {
      width: canvas.width,
      height: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
    };
  }

  // Language
  var G = window.Game || {};
  if (G.I18n && typeof G.I18n.getLang === 'function') {
    artifact.language = G.I18n.getLang();
  }

  // Feature flags
  if (G.Flags && typeof G.Flags.list === 'function') {
    artifact.featureFlags = G.Flags.list();
  }

  // Save slots
  try {
    artifact.saveSlotsMeta = JSON.parse(localStorage.getItem('saveSlotsMeta_v1'));
  } catch (e) { /* ignore */ }

  for (var i = 0; i < 10; i++) {
    var key = 'saveSlot_v1_' + i;
    var raw = localStorage.getItem(key);
    if (raw) {
      try {
        artifact.saveSlots[key] = JSON.parse(raw);
      } catch (e) {
        artifact.saveSlots[key] = '(parse error)';
      }
    }
  }

  // Render layers
  if (G.RenderRegistry && typeof G.RenderRegistry.getLayers === 'function') {
    artifact.renderLayers = G.RenderRegistry.getLayers();
  }

  // Modal state
  if (G.ModalAdapter && typeof G.ModalAdapter.getModals === 'function') {
    artifact.modalState = G.ModalAdapter.getModals();
  }

  // HUD state
  if (G.HudAdapter && typeof G.HudAdapter.getElements === 'function') {
    artifact.hudState = G.HudAdapter.getElements();
  }

  // State snapshot (if exposing API exists)
  if (G.Debug && typeof G.Debug.getStateSnapshot === 'function') {
    try {
      artifact.stateSnapshot = G.Debug.getStateSnapshot();
    } catch (e) { /* ignore */ }
  }

  // FPS measurement (sample 60 frames then download)
  var fpsFrames = [];
  var fpsRafId = 0;
  var fpsPrev = performance.now();

  function measureFps() {
    var now = performance.now();
    fpsFrames.push(now - fpsPrev);
    fpsPrev = now;
    if (fpsFrames.length < 60) {
      fpsRafId = requestAnimationFrame(measureFps);
    } else {
      var sum = 0;
      for (var j = 0; j < fpsFrames.length; j++) sum += fpsFrames[j];
      var avgMs = sum / fpsFrames.length;
      artifact.fps = {
        avgFrameMs: Math.round(avgMs * 100) / 100,
        avgFps: Math.round(1000 / avgMs * 10) / 10,
        minFrameMs: Math.round(Math.min.apply(null, fpsFrames) * 100) / 100,
        maxFrameMs: Math.round(Math.max.apply(null, fpsFrames) * 100) / 100,
        samples: fpsFrames.length,
      };
      downloadArtifact();
    }
  }

  function downloadArtifact() {
    var blob = new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'baseline_artifacts_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('[BaselineArtifacts] Captured and downloaded. FPS: ' + artifact.fps.avgFps);
  }

  console.log('[BaselineArtifacts] Measuring FPS (60 frames)...');
  fpsRafId = requestAnimationFrame(measureFps);
})();
