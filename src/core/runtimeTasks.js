/**
 * RuntimeTasks — timer/RAF suspend/resume management.
 *
 * Wraps window.setTimeout, setInterval, requestAnimationFrame
 * to support global suspend/resume/clearAll for game lifecycle.
 *
 * Usage:
 *   Game.RuntimeTasks.install();
 *   Game.RuntimeTasks.suspendAll();
 *   Game.RuntimeTasks.resumeAll();
 *   Game.RuntimeTasks.clearAll();
 */
(function (global) {
  'use strict';

  var native = {
    setTimeout: global.setTimeout.bind(global),
    clearTimeout: global.clearTimeout.bind(global),
    setInterval: global.setInterval.bind(global),
    clearInterval: global.clearInterval.bind(global),
    requestAnimationFrame: global.requestAnimationFrame.bind(global),
    cancelAnimationFrame: global.cancelAnimationFrame.bind(global),
  };
  var timeoutIds = new Set();
  var intervalIds = new Set();
  // solo-pipeline-yandex-vk rework R2: rafIds is a Map<id, callback> so that
  // suspendAll() can preserve the callback list and resumeAll() can re-queue
  // them. Previously rafIds was a Set and cancelling them on suspend lost the
  // game's main loop callback permanently — tab-blur froze the game forever.
  var rafIds = new Map();
  var pendingRafCallbacks = [];
  var installed = false;
  var suspended = false;

  function install() {
    if (installed) return;
    installed = true;
    global.setTimeout = function (handler, delay) {
      if (suspended) return 0;
      var args = Array.prototype.slice.call(arguments, 2);
      var id = native.setTimeout(function () {
        timeoutIds.delete(id);
        if (typeof handler === 'function') {
          handler.apply(global, args);
        } else {
          try { (0, eval)(handler); } catch (_) {}
        }
      }, delay);
      timeoutIds.add(id);
      return id;
    };
    global.clearTimeout = function (id) {
      timeoutIds.delete(id);
      return native.clearTimeout(id);
    };
    global.setInterval = function (handler, delay) {
      if (suspended) return 0;
      var args = Array.prototype.slice.call(arguments, 2);
      var id = native.setInterval(function () {
        if (typeof handler === 'function') {
          handler.apply(global, args);
        } else {
          try { (0, eval)(handler); } catch (_) {}
        }
      }, delay);
      intervalIds.add(id);
      return id;
    };
    global.clearInterval = function (id) {
      intervalIds.delete(id);
      return native.clearInterval(id);
    };
    global.requestAnimationFrame = function (callback) {
      // solo-pipeline-yandex-vk rework R2: when suspended, queue the callback
      // for replay on resume instead of dropping it. This keeps the game's
      // main rAF loop alive across tab-blur cycles.
      if (suspended) {
        if (typeof callback === 'function') pendingRafCallbacks.push(callback);
        return 0;
      }
      var id;
      id = native.requestAnimationFrame(function (ts) {
        rafIds.delete(id);
        if (typeof callback === 'function') callback(ts);
      });
      rafIds.set(id, callback);
      return id;
    };
    global.cancelAnimationFrame = function (id) {
      rafIds.delete(id);
      return native.cancelAnimationFrame(id);
    };
  }

  function clearAll() {
    timeoutIds.forEach(function (id) { native.clearTimeout(id); });
    timeoutIds.clear();
    intervalIds.forEach(function (id) { native.clearInterval(id); });
    intervalIds.clear();
    rafIds.forEach(function (_cb, id) { native.cancelAnimationFrame(id); });
    rafIds.clear();
    pendingRafCallbacks.length = 0;
  }

  function suspendAll() {
    if (suspended) return;
    suspended = true;
    // solo-pipeline-yandex-vk#3 (B3) + rework R2: cancel any in-flight RAFs
    // but PRESERVE their callbacks in pendingRafCallbacks so resumeAll() can
    // re-queue them — otherwise the main game loop dies permanently after
    // a single tab-blur cycle.
    rafIds.forEach(function (cb, id) {
      if (typeof cb === 'function') pendingRafCallbacks.push(cb);
      native.cancelAnimationFrame(id);
    });
    rafIds.clear();
  }

  function resumeAll() {
    if (!suspended) return;
    suspended = false;
    // solo-pipeline-yandex-vk rework R2: re-queue any rAF callbacks that were
    // captured during suspendAll(). Use the wrapped requestAnimationFrame so
    // the new ids are tracked in rafIds again.
    if (pendingRafCallbacks.length === 0) return;
    var queue = pendingRafCallbacks.slice();
    pendingRafCallbacks.length = 0;
    for (var i = 0; i < queue.length; i++) {
      try { global.requestAnimationFrame(queue[i]); } catch (_) {}
    }
  }

  // solo-pipeline-yandex-vk#3 (B3): wire visibilitychange so RAF + timers
  // truly suspend when the tab is hidden, even if the user-controlled
  // pauseManager is opted out. Idempotent — installAutoSuspend is safe to
  // call multiple times.
  //
  // solo-pipeline-yandex-vk#rework-2 (R5): removed window 'blur'/'focus'
  // listeners. window.blur fires on transient OS focus shifts (resize,
  // resolution change, alt-tab to chrome decorations, OS overlays), which
  // would suspendAll() and leave canvas black after the resize handler had
  // just cleared it via canvas.width=… reset, while DOM HUD overlays kept
  // showing. visibilitychange (document.hidden) is the canonical signal for
  // "tab actually hidden" and does NOT fire on window-blur-only events.
  var autoSuspendInstalled = false;
  function installAutoSuspend() {
    if (autoSuspendInstalled) return;
    var doc = (typeof global.document !== 'undefined') ? global.document : null;
    if (!doc || typeof doc.addEventListener !== 'function') return;
    autoSuspendInstalled = true;
    doc.addEventListener('visibilitychange', function () {
      var hidden = !!doc.hidden || doc.visibilityState === 'hidden';
      if (hidden) suspendAll(); else resumeAll();
    });
  }

  function isSuspended() { return suspended; }

  global.Game = global.Game || {};
  global.Game.RuntimeTasks = {
    install: install,
    clearAll: clearAll,
    suspendAll: suspendAll,
    resumeAll: resumeAll,
    installAutoSuspend: installAutoSuspend,
    isSuspended: isSuspended,
  };
})(typeof window !== 'undefined' ? window : this);
