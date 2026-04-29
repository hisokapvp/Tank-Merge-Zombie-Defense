/**
 * Game.Events — minimal pub/sub bus.
 *
 * Solo-pipeline-yandex-vk#1 step-1-2: canonical sink for runtime telemetry
 * topics (perf.budget.exceeded, drone.acquired, …). Listeners register via
 * `on(topic, fn)` and receive every `emit(topic, payload)` synchronously.
 *
 * Hot-path invariant: `emit` returns immediately when the topic has no
 * subscribers (no Map lookup churn beyond a single `.get`). Errors thrown by
 * listeners are caught so a single bad consumer never breaks the bus.
 */
(function (global) {
  'use strict';

  var listeners = Object.create(null);

  function on(topic, fn) {
    if (typeof topic !== 'string' || typeof fn !== 'function') return function () {};
    var bucket = listeners[topic];
    if (!bucket) { bucket = []; listeners[topic] = bucket; }
    bucket.push(fn);
    return function off() {
      var arr = listeners[topic];
      if (!arr) return;
      var i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    };
  }

  function off(topic, fn) {
    var arr = listeners[topic];
    if (!arr) return;
    if (!fn) { listeners[topic] = []; return; }
    var i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }

  function emit(topic, payload) {
    var arr = listeners[topic];
    if (!arr || !arr.length) return;
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](payload); }
      catch (err) { try { console && console.warn && console.warn('[Game.Events] listener error for ' + topic + ':', err); } catch (_) {} }
    }
  }

  function clear(topic) {
    if (topic) listeners[topic] = [];
    else listeners = Object.create(null);
  }

  global.Game = global.Game || {};
  // Preserve any pre-existing Game.Events override (test harness).
  if (!global.Game.Events) {
    global.Game.Events = { on: on, off: off, emit: emit, clear: clear };
  }
})(typeof window !== 'undefined' ? window : this);
