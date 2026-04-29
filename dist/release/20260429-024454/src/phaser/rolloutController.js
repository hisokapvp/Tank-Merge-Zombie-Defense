/**
 * RolloutController — manages safe Phaser migration rollout.
 *
 * Phase 4: Provides API for switching between legacy and Phaser at runtime,
 * with safety checks, rollback capability, and progress tracking.
 *
 * Rollout progression:
 *   1. off      — legacy only (usePhaser=false)
 *   2. shadow   — Phaser boots but doesn't render (A/B comparison only)
 *   3. overlay  — Phaser renders in 'both' mode alongside legacy
 *   4. phaser   — Phaser is primary, legacy stripped (usePhaser=true)
 *
 * API:
 *   Game.RolloutController.init(config)
 *   Game.RolloutController.getPhase()             → string
 *   Game.RolloutController.setPhase(phase)         → boolean
 *   Game.RolloutController.canAdvance()             → { ready, blockers }
 *   Game.RolloutController.advance()                → boolean
 *   Game.RolloutController.rollback()               → boolean
 *   Game.RolloutController.switchToPhaser()          → boolean
 *   Game.RolloutController.switchToLegacy()          → boolean
 *   Game.RolloutController.setAllLayerModes(mode)    → void
 *   Game.RolloutController.setAllModalModes(mode)    → void
 *   Game.RolloutController.setAllHudModes(mode)      → void
 *   Game.RolloutController.getStatus()               → Object
 *   Game.RolloutController.destroy()
 */
(function (global) {
  'use strict';

  var PHASES = ['off', 'shadow', 'overlay', 'phaser'];
  var _currentPhase = 'off';
  var _initialized = false;
  var _phaseHistory = [];
  var _engineApplied = 'off'; // tracks which phase the live engine actually matches

  function init(config) {
    config = config || {};
    _initialized = true;
    _phaseHistory = [];

    // Determine initial phase from current flag state
    var flags = global.Game && global.Game.Flags;
    var ea = global.Game && global.Game.EngineAdapter;
    if (flags && typeof flags.get === 'function' && flags.get('usePhaser')) {
      _currentPhase = 'phaser';
    } else if (ea && ea.isPhaser()) {
      _currentPhase = 'phaser';
    } else {
      _currentPhase = 'off';
    }

    // At init, the live engine matches the current phase
    _engineApplied = _currentPhase;

    _phaseHistory.push({ phase: _currentPhase, time: Date.now() });
    console.log('[RolloutController] Initialized — phase: ' + _currentPhase);
  }

  function getPhase() { return _currentPhase; }

  /**
   * Set rollout phase directly.
   * Applies mode propagation (layers/modals/hud) immediately.
   * Engine switch may require a page reload — check requiresReload().
   * @param {string} phase — 'off'|'shadow'|'overlay'|'phaser'
   * @returns {boolean} success
   */
  function setPhase(phase) {
    if (PHASES.indexOf(phase) === -1) return false;

    var prevPhase = _currentPhase;
    _currentPhase = phase;
    _phaseHistory.push({ phase: phase, from: prevPhase, time: Date.now() });

    _applyPhase(phase);

    // Persist desired phase in flag for next load
    var flags = global.Game && global.Game.Flags;
    if (flags && typeof flags.setOverride === 'function') {
      flags.setOverride('usePhaser', phase === 'phaser');
    }

    console.log('[RolloutController] Phase changed: ' + prevPhase + ' → ' + phase +
      (requiresReload() ? ' (reload required for engine switch)' : ''));
    return true;
  }

  /**
   * Check whether the current phase requires a page reload to activate.
   * Switching between off/shadow/overlay can be done live (same legacy engine).
   * Switching to/from 'phaser' from a non-phaser engine (or vice versa) needs reload.
   * @returns {boolean}
   */
  function requiresReload() {
    var isEngineLegacy = _engineApplied !== 'phaser';
    var isPhasePhaser = _currentPhase === 'phaser';
    var isPhaseLegacy = _currentPhase !== 'phaser';

    // Need reload when phase wants Phaser but engine is legacy, or vice versa
    return (isPhasePhaser && isEngineLegacy) || (isPhaseLegacy && !isEngineLegacy);
  }

  /**
   * Get the currently applied engine phase (what the live runtime was bootstrapped with).
   * @returns {string} 'off'|'shadow'|'overlay'|'phaser'
   */
  function getEngineApplied() {
    return _engineApplied;
  }

  /**
   * Perform a controlled reload to apply the engine matching the current phase.
   * Sets the flag in localStorage and triggers location.reload().
   * @returns {boolean} false if no reload needed
   */
  function applyEngine() {
    if (!requiresReload()) {
      // Phase transition doesn't need engine switch — already applied
      _engineApplied = _currentPhase;
      return false;
    }

    // Persist the phase flag so the reloaded page picks it up
    var flags = global.Game && global.Game.Flags;
    if (flags && typeof flags.setOverride === 'function') {
      flags.setOverride('usePhaser', _currentPhase === 'phaser');
    }

    console.log('[RolloutController] Applying engine switch via reload: ' +
      _engineApplied + ' → ' + _currentPhase);

    if (typeof global.location !== 'undefined' && typeof global.location.reload === 'function') {
      global.location.reload();
    }

    return true;
  }

  /**
   * Check if it's safe to advance to the next phase.
   * @returns {{ ready: boolean, blockers: string[], requiresReload: boolean }}
   */
  function canAdvance() {
    var blockers = [];
    var nextIdx = PHASES.indexOf(_currentPhase) + 1;

    if (nextIdx >= PHASES.length) {
      blockers.push('Already at final phase: ' + _currentPhase);
      return { ready: false, blockers: blockers, requiresReload: false };
    }

    var nextPhase = PHASES[nextIdx];

    // Check ParityGate before advancing to 'phaser'
    if (nextPhase === 'phaser') {
      var gate = global.Game && global.Game.ParityGate;
      if (gate && typeof gate.getLastResult === 'function') {
        var result = gate.getLastResult();
        if (!result) {
          blockers.push('ParityGate has not been run yet');
        } else if (!result.pass) {
          blockers.push('ParityGate failed: ' + result.failed + ' checks failed');
        }
      } else {
        blockers.push('ParityGate module not available');
      }

      // Check that scene wiring is done
      if (gate && typeof gate.isSceneReady === 'function' && !gate.isSceneReady()) {
        blockers.push('Phaser scene not ready — deferred wiring incomplete');
      }
    }

    // Check that EngineAdapter exists
    var ea = global.Game && global.Game.EngineAdapter;
    if (!ea) {
      blockers.push('EngineAdapter not initialized');
    }

    // Signal whether the advance will require a page reload
    var needsReload = false;
    var isEngineLegacy = _engineApplied !== 'phaser';
    if (nextPhase === 'phaser' && isEngineLegacy) needsReload = true;
    if (nextPhase !== 'phaser' && !isEngineLegacy) needsReload = true;

    return { ready: blockers.length === 0, blockers: blockers, requiresReload: needsReload };
  }

  /**
   * Advance to the next rollout phase.
   * @returns {boolean} success
   */
  function advance() {
    var check = canAdvance();
    if (!check.ready) {
      console.warn('[RolloutController] Cannot advance:', check.blockers.join('; '));
      return false;
    }

    var nextIdx = PHASES.indexOf(_currentPhase) + 1;
    if (nextIdx >= PHASES.length) return false;

    return setPhase(PHASES[nextIdx]);
  }

  /**
   * Roll back to the previous phase.
   * @returns {boolean} success
   */
  function rollback() {
    var prevIdx = PHASES.indexOf(_currentPhase) - 1;
    if (prevIdx < 0) {
      console.warn('[RolloutController] Already at phase: off');
      return false;
    }
    return setPhase(PHASES[prevIdx]);
  }

  /**
   * Convenience: switch directly to Phaser as primary engine.
   * Sets phase to 'phaser' and triggers reload if engine needs switching.
   * @returns {boolean} true if phase was set (reload may follow)
   */
  function switchToPhaser() {
    var ok = setPhase('phaser');
    if (ok && requiresReload()) {
      applyEngine();
    }
    return ok;
  }

  /**
   * Convenience: switch back to legacy engine.
   * Sets phase to 'off' and triggers reload if engine needs switching.
   * @returns {boolean} true if phase was set (reload may follow)
   */
  function switchToLegacy() {
    var ok = setPhase('off');
    if (ok && requiresReload()) {
      applyEngine();
    }
    return ok;
  }

  /**
   * Set all render layer modes to the given mode.
   * @param {'legacy'|'phaser'|'both'} mode
   */
  function setAllLayerModes(mode) {
    var rr = global.Game && global.Game.RenderRegistry;
    if (!rr || typeof rr.getLayers !== 'function') return;
    var layers = rr.getLayers();
    var ids = Object.keys(layers);
    for (var i = 0; i < ids.length; i++) {
      rr.setLayerMode(ids[i], mode);
    }
  }

  /**
   * Set all modal modes to the given mode.
   * @param {'dom'|'phaser'|'both'} mode
   */
  function setAllModalModes(mode) {
    var ma = global.Game && global.Game.ModalAdapter;
    if (!ma || typeof ma.getModals !== 'function') return;
    var modals = ma.getModals();
    var ids = Object.keys(modals);
    for (var i = 0; i < ids.length; i++) {
      ma.setMode(ids[i], mode);
    }
  }

  /**
   * Set all HUD element modes to the given mode.
   * @param {'dom'|'phaser'|'both'} mode
   */
  function setAllHudModes(mode) {
    var ha = global.Game && global.Game.HudAdapter;
    if (!ha || typeof ha.getElements !== 'function') return;
    var elements = ha.getElements();
    var ids = Object.keys(elements);
    for (var i = 0; i < ids.length; i++) {
      ha.setMode(ids[i], mode);
    }
  }

  /**
   * Get detailed rollout status.
   * @returns {Object}
   */
  function getStatus() {
    var ea = global.Game && global.Game.EngineAdapter;
    return {
      phase: _currentPhase,
      phaseIndex: PHASES.indexOf(_currentPhase),
      totalPhases: PHASES.length,
      phases: PHASES.slice(),
      engineApplied: _engineApplied,
      engine: ea ? ea.getActiveEngine() : 'unknown',
      isPhaser: ea ? ea.isPhaser() : false,
      requiresReload: requiresReload(),
      history: _phaseHistory.slice(),
    };
  }

  // ─── Internal phase application ────────────────────────────────

  function _applyPhase(phase) {
    switch (phase) {
      case 'off':
        setAllLayerModes('legacy');
        setAllModalModes('dom');
        setAllHudModes('dom');
        break;

      case 'shadow':
        // Phaser boots but only runs A/B comparison, no visible output
        setAllLayerModes('legacy');
        setAllModalModes('dom');
        setAllHudModes('dom');
        break;

      case 'overlay':
        // Both paths render — visual A/B comparison
        setAllLayerModes('both');
        setAllModalModes('both');
        setAllHudModes('both');
        break;

      case 'phaser':
        // Phaser is primary
        setAllLayerModes('phaser');
        setAllModalModes('phaser');
        setAllHudModes('phaser');
        break;
    }
  }

  function destroy() {
    _initialized = false;
    _currentPhase = 'off';
    _engineApplied = 'off';
    _phaseHistory = [];
  }

  // ─── Export ────────────────────────────────────────────────────

  global.Game = global.Game || {};
  global.Game.RolloutController = {
    init: init,
    getPhase: getPhase,
    setPhase: setPhase,
    canAdvance: canAdvance,
    advance: advance,
    rollback: rollback,
    switchToPhaser: switchToPhaser,
    switchToLegacy: switchToLegacy,
    requiresReload: requiresReload,
    getEngineApplied: getEngineApplied,
    applyEngine: applyEngine,
    setAllLayerModes: setAllLayerModes,
    setAllModalModes: setAllModalModes,
    setAllHudModes: setAllHudModes,
    getStatus: getStatus,
    destroy: destroy,
  };

})(typeof window !== 'undefined' ? window : this);
