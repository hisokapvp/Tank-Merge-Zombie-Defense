/**
 * InputAdapter — unified input abstraction for legacy Canvas and Phaser 3 paths.
 *
 * Phase 2: Abstracts pointer coordinate transforms, drag-vs-tap threshold,
 * and board hit-testing. Supports A/B comparison mode where both legacy
 * and Phaser input transforms run simultaneously and differences are logged.
 *
 * API:
 *   Game.InputAdapter.init(config)
 *   Game.InputAdapter.getPointerPos(evt)           → {x, y}
 *   Game.InputAdapter.cellAt(x, y, cells)           → cell | null
 *   Game.InputAdapter.isDragExceeded(sx, sy, cx, cy) → boolean
 *   Game.InputAdapter.enablePhaserInput(scene)
 *   Game.InputAdapter.setOnPointer(handlers)
 *   Game.InputAdapter.getValidationLog()            → string[]
 *   Game.InputAdapter.destroy()
 */
(function (global) {
  'use strict';

  var DRAG_THRESHOLD_PX = 6;
  var VALIDATION_LOG_MAX = 200;

  var _canvas = null;
  var _getViewSize = null;
  var _phaserScene = null;
  var _abMode = false;
  var _validationLog = [];
  var _onPointerHandlers = null;

  /**
   * Initialize the input adapter.
   * @param {Object} config
   * @param {HTMLCanvasElement} config.canvas       — game canvas element
   * @param {Function}          config.getViewSize  — () => {w, h} logical viewport
   */
  function init(config) {
    config = config || {};
    _canvas = config.canvas || null;
    _getViewSize = typeof config.getViewSize === 'function' ? config.getViewSize : null;
  }

  /**
   * Transform a browser PointerEvent/MouseEvent/TouchEvent into logical canvas coords.
   * Identical math to legacy getPointerPos() in game.js.
   * @param {Event} evt
   * @returns {{ x: number, y: number }}
   */
  function getPointerPos(evt) {
    if (!_canvas || !evt) return { x: 0, y: 0 };
    var r = _canvas.getBoundingClientRect();
    var vs = _getViewSize ? _getViewSize() : { w: _canvas.width, h: _canvas.height };
    var clientX = evt.clientX != null ? evt.clientX
      : (evt.touches && evt.touches[0] ? evt.touches[0].clientX : 0);
    var clientY = evt.clientY != null ? evt.clientY
      : (evt.touches && evt.touches[0] ? evt.touches[0].clientY : 0);
    var x = (clientX - r.left) * (vs.w / r.width);
    var y = (clientY - r.top) * (vs.h / r.height);

    // A/B validation against Phaser pointer if enabled
    if (_abMode && _phaserScene) {
      validateAgainstPhaser(x, y);
    }

    return { x: x, y: y };
  }

  /**
   * AABB board cell hit-test.
   * @param {number} x
   * @param {number} y
   * @param {Array} cells — state.cells array
   * @returns {Object|null}
   */
  function cellAt(x, y, cells) {
    if (!cells) return null;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
    }
    return null;
  }

  /**
   * Check if the drag threshold (6px Euclidean) is exceeded.
   * @param {number} startX
   * @param {number} startY
   * @param {number} currentX
   * @param {number} currentY
   * @returns {boolean}
   */
  function isDragExceeded(startX, startY, currentX, currentY) {
    var dx = currentX - startX;
    var dy = currentY - startY;
    return Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX;
  }

  /**
   * Circular hit-test (for supercomputer, orbit tanks, etc.)
   * @param {number} px — pointer x
   * @param {number} py — pointer y
   * @param {number} cx — center x
   * @param {number} cy — center y
   * @param {number} radius
   * @returns {boolean}
   */
  function hitTestCircle(px, py, cx, cy, radius) {
    var dx = px - cx;
    var dy = py - cy;
    return (dx * dx + dy * dy) <= radius * radius;
  }

  /**
   * Enable Phaser input on a scene for A/B coordinate comparison.
   * When enabled, Phaser pointer coordinates are compared to legacy
   * coordinates and mismatches are logged.
   * @param {Phaser.Scene} scene
   */
  function enablePhaserInput(scene) {
    if (!scene || !scene.input) return;
    _phaserScene = scene;
    _abMode = true;

    scene.input.on('pointerdown', function (pointer) {
      dispatchPhaserEvent('pointerdown', pointer);
    });
    scene.input.on('pointermove', function (pointer) {
      dispatchPhaserEvent('pointermove', pointer);
    });
    scene.input.on('pointerup', function (pointer) {
      dispatchPhaserEvent('pointerup', pointer);
    });

    console.log('[InputAdapter] Phaser A/B input comparison enabled');
  }

  /**
   * Dispatch a Phaser input event to registered handlers.
   * @param {string} type
   * @param {Phaser.Input.Pointer} pointer
   */
  function dispatchPhaserEvent(type, pointer) {
    if (!_onPointerHandlers || !_onPointerHandlers[type]) return;
    _onPointerHandlers[type]({ x: pointer.x, y: pointer.y }, pointer);
  }

  /**
   * Compare legacy coordinates with Phaser's activePointer.
   * @param {number} legacyX
   * @param {number} legacyY
   */
  function validateAgainstPhaser(legacyX, legacyY) {
    if (!_phaserScene || !_phaserScene.input) return;
    var pointer = _phaserScene.input.activePointer;
    if (!pointer) return;
    var phaserX = pointer.x;
    var phaserY = pointer.y;
    var dx = Math.abs(legacyX - phaserX);
    var dy = Math.abs(legacyY - phaserY);
    if (dx > 2 || dy > 2) {
      var msg = '[InputAdapter A/B] Mismatch: legacy(' +
        legacyX.toFixed(1) + ',' + legacyY.toFixed(1) +
        ') phaser(' + phaserX.toFixed(1) + ',' + phaserY.toFixed(1) +
        ') delta(' + dx.toFixed(1) + ',' + dy.toFixed(1) + ')';
      if (_validationLog.length < VALIDATION_LOG_MAX) {
        _validationLog.push(msg);
      }
      if (_validationLog.length <= 10) {
        console.warn(msg);
      }
    }
  }

  /**
   * Register handlers for Phaser-driven pointer events (Phase 2+).
   * @param {Object} handlers — { pointerdown, pointermove, pointerup }
   */
  function setOnPointer(handlers) {
    _onPointerHandlers = handlers || null;
  }

  /**
   * Get the A/B validation log.
   * @returns {string[]}
   */
  function getValidationLog() {
    return _validationLog.slice();
  }

  /**
   * Get current drag threshold value.
   * @returns {number}
   */
  function getDragThreshold() {
    return DRAG_THRESHOLD_PX;
  }

  function destroy() {
    _canvas = null;
    _getViewSize = null;
    _phaserScene = null;
    _abMode = false;
    _validationLog.length = 0;
    _onPointerHandlers = null;
  }

  global.Game = global.Game || {};
  global.Game.InputAdapter = {
    init: init,
    getPointerPos: getPointerPos,
    cellAt: cellAt,
    isDragExceeded: isDragExceeded,
    hitTestCircle: hitTestCircle,
    enablePhaserInput: enablePhaserInput,
    setOnPointer: setOnPointer,
    getValidationLog: getValidationLog,
    getDragThreshold: getDragThreshold,
    destroy: destroy,
  };
}(window));
