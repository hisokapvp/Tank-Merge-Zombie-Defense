/**
 * A11y helpers — focus management and modal keyboard support.
 */
(function (global) {
  'use strict';

  var modalState = new WeakMap();
  var openStack = [];
  var listenerActive = false;

  function getFocusable(root) {
    if (!root || !root.querySelectorAll) return [];
    var nodes = root.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    return Array.prototype.slice.call(nodes);
  }

  function trapTab(modalEl, evt) {
    var focusable = getFocusable(modalEl);
    if (!focusable.length) {
      modalEl.setAttribute('tabindex', '-1');
      modalEl.focus();
      evt.preventDefault();
      return;
    }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    var active = global.document && global.document.activeElement;
    if (evt.shiftKey && active === first) {
      last.focus();
      evt.preventDefault();
    } else if (!evt.shiftKey && active === last) {
      first.focus();
      evt.preventDefault();
    }
  }

  function handleKeydown(evt) {
    if (!openStack.length) return;
    var modalEl = openStack[openStack.length - 1];
    var state = modalState.get(modalEl) || {};
    if (evt.key === 'Escape' && typeof state.onClose === 'function') {
      evt.preventDefault();
      state.onClose();
      return;
    }
    if (evt.key === 'Tab') {
      trapTab(modalEl, evt);
    }
  }

  function ensureListener() {
    if (listenerActive) return;
    if (!global.document || !global.document.addEventListener) return;
    listenerActive = true;
    global.document.addEventListener('keydown', handleKeydown);
  }

  function removeListener() {
    if (!listenerActive) return;
    if (!global.document || !global.document.removeEventListener) return;
    listenerActive = false;
    global.document.removeEventListener('keydown', handleKeydown);
  }

  function registerModal(modalEl, opts) {
    if (!modalEl) return;
    var state = modalState.get(modalEl) || {};
    if (opts) {
      if (opts.onClose) state.onClose = opts.onClose;
      if (opts.initialFocus) state.initialFocus = opts.initialFocus;
    }
    modalState.set(modalEl, state);
  }

  function openModal(modalEl, opts) {
    if (!modalEl) return;
    var state = modalState.get(modalEl) || {};
    if (opts) {
      if (opts.onClose) state.onClose = opts.onClose;
      if (opts.initialFocus) state.initialFocus = opts.initialFocus;
    }
    state.returnFocus = global.document && global.document.activeElement;
    modalState.set(modalEl, state);

    if (openStack.indexOf(modalEl) === -1) openStack.push(modalEl);
    ensureListener();

    var focusTarget = state.initialFocus || modalEl.querySelector('[data-a11y-initial]');
    if (!focusTarget) {
      var focusables = getFocusable(modalEl);
      focusTarget = focusables.length ? focusables[0] : modalEl;
    }
    if (focusTarget && focusTarget.focus) {
      requestAnimationFrame(function () {
        focusTarget.focus();
      });
    }
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    var idx = openStack.lastIndexOf(modalEl);
    if (idx >= 0) openStack.splice(idx, 1);
    var state = modalState.get(modalEl) || {};
    if (state.returnFocus && state.returnFocus.focus) {
      state.returnFocus.focus();
    }
    if (!openStack.length) removeListener();
  }

  global.Game = global.Game || {};
  global.Game.A11y = {
    registerModal: registerModal,
    openModal: openModal,
    closeModal: closeModal
  };
})(typeof window !== 'undefined' ? window : this);
