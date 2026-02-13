(function (global) {
  'use strict';

  var BEHAVIOR_CLASS = 'uiButtonBehavior';
  var PRESSED_CLASS = 'is-pressed';

  function isButtonLike(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === 'BUTTON') return true;
    if (el.classList && el.classList.contains('lessonProgress__fileBtn')) return true;
    return false;
  }

  function isDisabled(el) {
    if (!el) return true;
    if (el.matches && el.matches(':disabled')) return true;
    return el.getAttribute && el.getAttribute('aria-disabled') === 'true';
  }

  function decorateElement(el) {
    if (!isButtonLike(el)) return;
    el.classList.add(BEHAVIOR_CLASS);
  }

  function decorateTree(root) {
    if (!root || root.nodeType !== 1) return;
    if (isButtonLike(root)) decorateElement(root);
    var nodes = root.querySelectorAll('button, .lessonProgress__fileBtn');
    for (var i = 0; i < nodes.length; i++) {
      decorateElement(nodes[i]);
    }
  }

  function clearPressedOnAll() {
    var pressed = document.querySelectorAll('.' + BEHAVIOR_CLASS + '.' + PRESSED_CLASS);
    for (var i = 0; i < pressed.length; i++) {
      pressed[i].classList.remove(PRESSED_CLASS);
    }
  }

  function handlePointerDown(event) {
    var target = event.target && event.target.closest
      ? event.target.closest('.' + BEHAVIOR_CLASS)
      : null;
    if (!target || isDisabled(target)) return;
    target.classList.add(PRESSED_CLASS);
  }

  function handlePointerUp() {
    clearPressedOnAll();
  }

  function handlePointerCancel() {
    clearPressedOnAll();
  }

  function init() {
    decorateTree(document.body);

    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          for (var j = 0; j < m.addedNodes.length; j++) {
            var node = m.addedNodes[j];
            if (node && node.nodeType === 1) decorateTree(node);
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('pointercancel', handlePointerCancel, true);
    document.addEventListener('lostpointercapture', handlePointerCancel, true);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') clearPressedOnAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  global.Game = global.Game || {};
  global.Game.ButtonBehavior = {
    init: init,
    decorateTree: decorateTree,
    decorateElement: decorateElement,
  };
})(typeof window !== 'undefined' ? window : this);
