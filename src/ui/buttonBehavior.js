(function (global) {
  'use strict';

  var BEHAVIOR_CLASS = 'uiButtonBehavior';
  var PRESSED_CLASS = 'is-pressed';
  var lastHoverSfxAt = -Infinity;

  function getAudioUiConfig() {
    var cfg = global.Game && global.Game.Config && global.Game.Config.AudioUi;
    return cfg || {};
  }

  function asPositiveNumber(value, fallback) {
    var num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function findRuntimePlaySfx() {
    if (typeof global.playSfx === 'function') return global.playSfx;
    if (global.Game && global.Game.AudioRuntime && typeof global.Game.AudioRuntime.playSfx === 'function') {
      return global.Game.AudioRuntime.playSfx;
    }
    return null;
  }

  function findFallbackPlaySfx() {
    if (global.Game && global.Game.Audio && typeof global.Game.Audio.playSfx === 'function') {
      return global.Game.Audio.playSfx;
    }
    if (global.Game && global.Game.AudioSettingsController && typeof global.Game.AudioSettingsController.playSfx === 'function') {
      return global.Game.AudioSettingsController.playSfx;
    }
    return null;
  }

  function playUiSfx(id, volumeMult) {
    var runtimePlaySfx = findRuntimePlaySfx();
    if (runtimePlaySfx) {
      try {
        if (runtimePlaySfx.length >= 2) {
          runtimePlaySfx(id, { volumeMult: volumeMult, channel: 'ui' });
          return;
        }
        runtimePlaySfx(id, { volumeMult: volumeMult });
        return;
      } catch (_) {}
      try {
        runtimePlaySfx(id);
        return;
      } catch (_) {}
    }

    var fallbackPlaySfx = findFallbackPlaySfx();
    if (fallbackPlaySfx) {
      try {
        fallbackPlaySfx(id, { volumeMult: volumeMult });
      } catch (_) {
        try { fallbackPlaySfx(id); } catch (_) {}
      }
    }
  }

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

  function isHidden(el) {
    if (!el || !el.isConnected) return true;
    if (el.hidden) return true;
    if (typeof global.getComputedStyle !== 'function') return false;
    var style = global.getComputedStyle(el);
    if (!style) return false;
    return style.display === 'none' || style.visibility === 'hidden';
  }

  function getDisabledToastText(target) {
    var reason = target && target.getAttribute ? target.getAttribute('data-disabled-reason') : '';
    var i18n = global.Game && global.Game.I18n;
    var t = i18n && typeof i18n.t === 'function' ? i18n.t : null;
    if (reason === 'noSaves') {
      return t ? t('ui.toast.noSaves') : 'Нет сохранений';
    }
    return t ? t('ui.toast.unavailable') : 'Недоступно';
  }

  function showDisabledToast(target) {
    var toastApi = global.Game && global.Game.Toast;
    if (!toastApi || typeof toastApi.show !== 'function') return;
    toastApi.show(getDisabledToastText(target), 1400);
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
    if (!target) return;
    var cfg = getAudioUiConfig();
    var baseMult = asPositiveNumber(cfg.UI_SFX_VOLUME_MULT, 0.5);
    if (isDisabled(target)) {
      var disabledMult = asPositiveNumber(cfg.UI_DISABLED_CLICK_VOLUME_MULT, 1.0);
      playUiSfx('uiClickOnDisable', baseMult * disabledMult);
      showDisabledToast(target);
      return;
    }
    playUiSfx('uiClickOnEnabled', baseMult);
    target.classList.add(PRESSED_CLASS);
  }

  function handlePointerEnter(event) {
    if (event && event.pointerType === 'touch') return;
    var target = event.target && event.target.closest
      ? event.target.closest('.' + BEHAVIOR_CLASS)
      : null;
    if (!target || isDisabled(target) || isHidden(target)) return;

    var relatedButton = event && event.relatedTarget && event.relatedTarget.closest
      ? event.relatedTarget.closest('.' + BEHAVIOR_CLASS)
      : null;
    if (relatedButton && relatedButton === target) return;

    var now = performance.now();
    var cfg = getAudioUiConfig();
    var cooldownMs = Math.max(0, asPositiveNumber(cfg.UI_HOVER_COOLDOWN_MS, 100));
    if (now - lastHoverSfxAt < cooldownMs) return;
    lastHoverSfxAt = now;

    var baseMult = asPositiveNumber(cfg.UI_SFX_VOLUME_MULT, 0.5);
    playUiSfx('uiHover', baseMult);
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
    document.addEventListener('pointerover', handlePointerEnter, true);
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
