/**
 * Game.Events — lightweight in-proc event emitter с rAF-coalescing.
 *
 * Канонические события:
 *  - `playerChips.changed` с payload `{ reason: 'mutate'|'restore'|'craft'|'merge'|'tech'|..., changedIds?: string[], prevSnapshot?: Array }`.
 *  - `chips.crafted` с payload `{ changedIds?: string[] }` — emit'ится после canonical setPlayerChips({reason:'craft'}) (TZ batch12 item 7).
 *  - `tech.studyCompleted` с payload `{ techId: number }` — emit'ится из `Game.Achievements.recordModifierTechUnlock` при первом учёте tech.
 *  - `drone.acquired` с payload `{ totalDrones: number }` — emit'ится из `addDron` (game.js) после успешного DronesApi.addDron.
 *
 * Правила:
 *  - НЕ используем DOM `CustomEvent` на window — DOM dispatch overhead в Phaser overlay недопустим (P3.5).
 *  - Несколько emit одного event-type в рамках одного tick → один coalesced emit на следующий rAF (P3.2).
 *  - Canonical emit идёт только из `Game.State.setPlayerChips(...)` (audit всех callsites — P3.3).
 *  - Listener'ы должны detach'ться при close/unmount UI (P3.7), иначе leak.
 *  - Payload передаёт только ids/diff/snapshot, canonical chips array через ссылку НЕ шарим (P3.4).
 */
(function (global) {
  'use strict';

  var listeners = Object.create(null);
  var pendingEmit = Object.create(null); // eventName -> last payload (coalesced)
  var rafScheduled = false;

  function safeCall(fn, payload, eventName) {
    try {
      fn(payload);
    } catch (err) {
      if (global.console && typeof global.console.error === 'function') {
        try { global.console.error('[Game.Events] listener error for ' + eventName, err); } catch (_) {}
      }
    }
  }

  function dispatchPending() {
    rafScheduled = false;
    var names = Object.keys(pendingEmit);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var payload = pendingEmit[name];
      delete pendingEmit[name];
      var subs = listeners[name];
      if (!subs || !subs.length) continue;
      // Копия массива — listener может отписаться внутри обработчика.
      var copy = subs.slice();
      for (var j = 0; j < copy.length; j++) {
        safeCall(copy[j], payload, name);
      }
    }
  }

  function schedule() {
    if (rafScheduled) return;
    rafScheduled = true;
    var raf = (typeof global !== 'undefined' && global.requestAnimationFrame)
      ? global.requestAnimationFrame.bind(global)
      : function (cb) { return setTimeout(cb, 16); };
    raf(dispatchPending);
  }

  /**
   * Подписка на событие.
   * @param {string} eventName
   * @param {Function} fn
   * @returns {Function} unsubscribe
   */
  function on(eventName, fn) {
    if (typeof eventName !== 'string' || typeof fn !== 'function') return function () {};
    if (!listeners[eventName]) listeners[eventName] = [];
    listeners[eventName].push(fn);
    return function off() {
      var subs = listeners[eventName];
      if (!subs) return;
      var idx = subs.indexOf(fn);
      if (idx !== -1) subs.splice(idx, 1);
    };
  }

  function off(eventName, fn) {
    var subs = listeners[eventName];
    if (!subs) return;
    var idx = subs.indexOf(fn);
    if (idx !== -1) subs.splice(idx, 1);
  }

  /**
   * Эмитит событие с rAF-coalescing: несколько emit в одном tick → один callback.
   * Payload merge правило: последний emit выигрывает (last-write-wins); если нужно аккумулирование,
   * caller сам мержит до передачи в emit.
   * @param {string} eventName
   * @param {*} payload
   */
  function emit(eventName, payload) {
    if (typeof eventName !== 'string') return;
    pendingEmit[eventName] = payload;
    schedule();
  }

  /**
   * Синхронный emit (без coalescing). Используется редко — например, для lifecycle-critical notify.
   */
  function emitSync(eventName, payload) {
    if (typeof eventName !== 'string') return;
    var subs = listeners[eventName];
    if (!subs || !subs.length) return;
    var copy = subs.slice();
    for (var j = 0; j < copy.length; j++) safeCall(copy[j], payload, eventName);
  }

  function listenerCount(eventName) {
    var subs = listeners[eventName];
    return subs ? subs.length : 0;
  }

  global.Game = global.Game || {};
  global.Game.Events = {
    on: on,
    off: off,
    emit: emit,
    emitSync: emitSync,
    listenerCount: listenerCount,
  };
}(typeof window !== 'undefined' ? window : this));
