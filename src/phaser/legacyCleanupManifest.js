/**
 * LegacyCleanupManifest — tracks legacy code paths for removal after Phaser switch.
 *
 * Phase 4: Provides an inventory of all conditional legacy branches, dead code
 * paths, and DOM-only UI elements that can be safely removed once the Phaser
 * rendering path is confirmed as the sole runtime engine.
 *
 * Each entry describes:
 * - What legacy code can be removed
 * - Where it lives (file + description)
 * - Prerequisite: which Phaser replacement must be confirmed working
 * - Cleanup status
 *
 * API:
 *   Game.LegacyCleanupManifest.getEntries()     → Array
 *   Game.LegacyCleanupManifest.getByStatus(s)   → Array
 *   Game.LegacyCleanupManifest.getSummary()      → Object
 *   Game.LegacyCleanupManifest.markDone(id)      → boolean
 *   Game.LegacyCleanupManifest.reset()
 */
(function (global) {
  'use strict';

  /**
   * @typedef {Object} CleanupEntry
   * @property {string} id           — unique ID
   * @property {string} category     — 'render'|'input'|'ui'|'audio'|'loop'|'infra'
   * @property {string} description  — human-readable description
   * @property {string} file         — primary file location
   * @property {string} prerequisite — what must work before removal
   * @property {string} status       — 'pending'|'done'
   */

  /** @type {CleanupEntry[]} */
  var ENTRIES = [
    // ─── Loop ────────────────────────────────────────────────
    {
      id: 'loop.legacyRaf',
      category: 'loop',
      description: 'Legacy requestAnimationFrame loop (scheduleMainLoop / mainLoopRafId)',
      file: 'game.js',
      prerequisite: 'Phaser drives RAF via PhaserBridge.stepFn',
      status: 'pending',
    },
    {
      id: 'loop.phaserLoopFlag',
      category: 'loop',
      description: 'phaserLoopActive flag and conditional in scheduleMainLoop()',
      file: 'game.js',
      prerequisite: 'Phaser is sole loop driver',
      status: 'pending',
    },

    // ─── Render ──────────────────────────────────────────────
    {
      id: 'render.legacyIfBlocks',
      category: 'render',
      description: 'if (_RR.isLegacy(id)) branches in draw() — 18 layers',
      file: 'game.js',
      prerequisite: 'All 18 layers confirmed working in Phaser mode via ParityGate',
      status: 'pending',
    },
    {
      id: 'render.registryBothMode',
      category: 'render',
      description: 'RenderRegistry "both" mode support and dual draw calls',
      file: 'src/phaser/renderRegistry.js',
      prerequisite: 'No layers use "both" mode in production',
      status: 'pending',
    },
    {
      id: 'render.delegationDrawFns',
      category: 'render',
      description: 'setDrawFn() on delegation layers (FenceBase, Board, etc.)',
      file: 'src/phaser/layers/*Layer.js',
      prerequisite: 'Delegation replaced by native Phaser GameObjects',
      status: 'pending',
    },
    {
      id: 'render.dprTransform',
      category: 'render',
      description: 'DPR ctx.setTransform restore at top of draw()',
      file: 'game.js',
      prerequisite: 'Phaser handles DPR via its own scale manager',
      status: 'pending',
    },

    // ─── Input ───────────────────────────────────────────────
    {
      id: 'input.legacyPointerEvents',
      category: 'input',
      description: 'Legacy canvas pointer event listeners (pointerdown/move/up)',
      file: 'game.js',
      prerequisite: 'Phaser InputAdapter confirmed matching via InputComparisonHarness',
      status: 'pending',
    },
    {
      id: 'input.comparisonHarness',
      category: 'input',
      description: 'InputComparisonHarness module (A/B only)',
      file: 'src/phaser/inputComparisonHarness.js',
      prerequisite: 'A/B comparison no longer needed',
      status: 'pending',
    },

    // ─── UI / DOM ────────────────────────────────────────────
    {
      id: 'ui.domModals',
      category: 'ui',
      description: 'DOM modal overlays (#menuOverlay, #bigMenuOverlay, etc.)',
      file: 'index.html, style.css',
      prerequisite: 'All modals confirmed working in Phaser-only mode',
      status: 'pending',
    },
    {
      id: 'ui.domHud',
      category: 'ui',
      description: 'DOM HUD elements (#coins, #zcount, #xpBar, etc.)',
      file: 'index.html',
      prerequisite: 'HudScene confirmed rendering all HUD data correctly',
      status: 'pending',
    },
    {
      id: 'ui.modalAdapterDomPath',
      category: 'ui',
      description: 'ModalAdapter DOM open/close branches (classList.add/remove)',
      file: 'src/phaser/modalAdapter.js',
      prerequisite: 'All modals running in Phaser-only mode',
      status: 'pending',
    },
    {
      id: 'ui.hudAdapterDomPath',
      category: 'ui',
      description: 'HudAdapter DOM update branches (el.textContent, style.width)',
      file: 'src/phaser/hudAdapter.js',
      prerequisite: 'HUD in Phaser-only mode',
      status: 'pending',
    },

    // ─── Audio ───────────────────────────────────────────────
    {
      id: 'audio.legacyPools',
      category: 'audio',
      description: 'Legacy HTML5 Audio pool (sfxPoolRuntime)',
      file: 'game.js',
      prerequisite: 'PhaserAudioAdapter confirmed working for all SFX',
      status: 'pending',
    },

    // ─── Infrastructure ──────────────────────────────────────
    {
      id: 'infra.engineAdapterLegacyPath',
      category: 'infra',
      description: 'EngineAdapter legacy branch and legacy ctx storage',
      file: 'src/core/engineAdapter.js',
      prerequisite: 'Phaser is sole engine',
      status: 'pending',
    },
    {
      id: 'infra.featureFlag',
      category: 'infra',
      description: 'usePhaser feature flag (no longer needed when Phaser is default)',
      file: 'src/flags/flags.js',
      prerequisite: 'Full rollout confirmed, flag can be hardcoded or removed',
      status: 'pending',
    },
    {
      id: 'infra.parityModules',
      category: 'infra',
      description: 'ParityHarness, ParityGate, RolloutController (migration tooling)',
      file: 'src/phaser/parityHarness.js, parityGate.js, rolloutController.js',
      prerequisite: 'Migration complete, no longer needed',
      status: 'pending',
    },
    {
      id: 'infra.clearBeforeRender',
      category: 'infra',
      description: 'clearBeforeRender: false workaround in PhaserBootstrap',
      file: 'src/phaser/phaserBootstrap.js',
      prerequisite: 'Legacy Canvas 2D no longer shares the canvas',
      status: 'pending',
    },
  ];

  function getEntries() {
    return ENTRIES.map(function (e) {
      return {
        id: e.id,
        category: e.category,
        description: e.description,
        file: e.file,
        prerequisite: e.prerequisite,
        status: e.status,
      };
    });
  }

  function getByStatus(status) {
    return ENTRIES.filter(function (e) { return e.status === status; })
      .map(function (e) {
        return {
          id: e.id,
          category: e.category,
          description: e.description,
          file: e.file,
          prerequisite: e.prerequisite,
          status: e.status,
        };
      });
  }

  function getSummary() {
    var pending = 0;
    var done = 0;
    var categories = {};
    for (var i = 0; i < ENTRIES.length; i++) {
      var e = ENTRIES[i];
      if (e.status === 'done') done++;
      else pending++;
      if (!categories[e.category]) categories[e.category] = { pending: 0, done: 0 };
      categories[e.category][e.status === 'done' ? 'done' : 'pending']++;
    }
    return {
      total: ENTRIES.length,
      pending: pending,
      done: done,
      progress: ENTRIES.length > 0 ? Math.round((done / ENTRIES.length) * 100) : 0,
      categories: categories,
    };
  }

  function markDone(id) {
    // Guard: refuse to mark cleanup items done unless ParityGate has passed
    var gate = (typeof window !== 'undefined' ? window : global).Game &&
               (typeof window !== 'undefined' ? window : global).Game.ParityGate;
    if (gate && typeof gate.getLastResult === 'function') {
      var gateResult = gate.getLastResult();
      if (!gateResult || !gateResult.pass) {
        console.warn('[LegacyCleanupManifest] Cannot mark "' + id +
          '" done — ParityGate has not passed yet');
        return false;
      }
    }

    for (var i = 0; i < ENTRIES.length; i++) {
      if (ENTRIES[i].id === id) {
        ENTRIES[i].status = 'done';
        return true;
      }
    }
    return false;
  }

  function reset() {
    for (var i = 0; i < ENTRIES.length; i++) {
      ENTRIES[i].status = 'pending';
    }
  }

  // ─── Export ────────────────────────────────────────────────────

  global.Game = global.Game || {};
  global.Game.LegacyCleanupManifest = {
    getEntries: getEntries,
    getByStatus: getByStatus,
    getSummary: getSummary,
    markDone: markDone,
    reset: reset,
  };

})(typeof window !== 'undefined' ? window : this);
