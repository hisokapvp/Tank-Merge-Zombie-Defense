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
  var rafIds = new Set();
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
      if (suspended) return 0;
      var id = native.requestAnimationFrame(function (ts) {
        rafIds.delete(id);
        callback(ts);
      });
      rafIds.add(id);
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
    rafIds.forEach(function (id) { native.cancelAnimationFrame(id); });
    rafIds.clear();
  }

  function suspendAll() {
    suspended = true;
  }

  function resumeAll() {
    suspended = false;
  }

  global.Game = global.Game || {};
  global.Game.RuntimeTasks = {
    install: install,
    clearAll: clearAll,
    suspendAll: suspendAll,
    resumeAll: resumeAll,
  };
})(typeof window !== 'undefined' ? window : this);
