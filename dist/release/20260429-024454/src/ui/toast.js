(function (global) {
  'use strict';

  var TOAST_ID = 'uiToast';
  var VISIBLE_CLASS = 'is-visible';
  var timer = null;

  function ensureToastNode() {
    if (!global.document || !global.document.body) return null;
    var existing = global.document.getElementById(TOAST_ID);
    if (existing) return existing;
    var node = global.document.createElement('div');
    node.id = TOAST_ID;
    node.className = 'uiToast';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.setAttribute('aria-atomic', 'true');
    node.setAttribute('aria-hidden', 'true');
    global.document.body.appendChild(node);
    return node;
  }

  function hide(node) {
    if (!node) return;
    node.classList.remove(VISIBLE_CLASS);
    node.setAttribute('aria-hidden', 'true');
  }

  function show(text, durationMs) {
    var node = ensureToastNode();
    if (!node) return;
    var message = typeof text === 'string' ? text.trim() : '';
    if (!message) return;
    var duration = Number(durationMs);
    if (!Number.isFinite(duration)) duration = 1400;
    duration = Math.max(1000, Math.min(2000, Math.floor(duration)));

    node.textContent = message;
    node.classList.add(VISIBLE_CLASS);
    node.setAttribute('aria-hidden', 'false');

    if (timer != null) {
      global.clearTimeout(timer);
      timer = null;
    }
    timer = global.setTimeout(function () {
      hide(node);
      timer = null;
    }, duration);
  }

  global.Game = global.Game || {};
  global.Game.Toast = {
    show: show,
  };
})(typeof window !== 'undefined' ? window : this);
