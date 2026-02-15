(function (global) {
  'use strict';

  function createPauseManager(options) {
    var opts = options || {};
    var windowObj = opts.windowObj || (typeof window !== 'undefined' ? window : null);
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};

    var reasons = {
      menuOpen: false,
      tabInactive: false,
    };

    function isPaused() {
      return !!(reasons.menuOpen || reasons.tabInactive);
    }

    function emit(cause) {
      onChange({
        paused: isPaused(),
        reasons: { menuOpen: !!reasons.menuOpen, tabInactive: !!reasons.tabInactive },
        cause: cause || 'unknown',
      });
    }

    function setReason(key, value, cause) {
      var next = !!value;
      if (!Object.prototype.hasOwnProperty.call(reasons, key)) return;
      if (reasons[key] === next) return;
      reasons[key] = next;
      emit(cause || key);
    }

    function setMenuOpen(open) {
      setReason('menuOpen', open, 'menu');
    }

    function setTabInactive(inactive) {
      setReason('tabInactive', inactive, 'tab');
    }

    function onVisibilityChange() {
      if (!documentObj) return;
      var hidden = !!documentObj.hidden || documentObj.visibilityState === 'hidden';
      setTabInactive(hidden);
    }

    function onWindowBlur() {
      setTabInactive(true);
    }

    function onWindowFocus() {
      if (!documentObj || !documentObj.hidden) {
        setTabInactive(false);
      }
    }

    function onPageHide() {
      setTabInactive(true);
    }

    function onPageShow() {
      onWindowFocus();
    }

    function attach() {
      if (documentObj && documentObj.addEventListener) {
        documentObj.addEventListener('visibilitychange', onVisibilityChange);
      }
      if (windowObj && windowObj.addEventListener) {
        windowObj.addEventListener('blur', onWindowBlur);
        windowObj.addEventListener('focus', onWindowFocus);
        windowObj.addEventListener('pagehide', onPageHide);
        windowObj.addEventListener('pageshow', onPageShow);
      }
      onVisibilityChange();
      emit('attach');
    }

    function detach() {
      if (documentObj && documentObj.removeEventListener) {
        documentObj.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (windowObj && windowObj.removeEventListener) {
        windowObj.removeEventListener('blur', onWindowBlur);
        windowObj.removeEventListener('focus', onWindowFocus);
        windowObj.removeEventListener('pagehide', onPageHide);
        windowObj.removeEventListener('pageshow', onPageShow);
      }
    }

    function getReasons() {
      return { menuOpen: !!reasons.menuOpen, tabInactive: !!reasons.tabInactive };
    }

    return {
      attach: attach,
      detach: detach,
      isPaused: isPaused,
      getReasons: getReasons,
      setMenuOpen: setMenuOpen,
      setTabInactive: setTabInactive,
    };
  }

  global.Game = global.Game || {};
  global.Game.PauseManager = {
    createPauseManager: createPauseManager,
  };
})(typeof window !== 'undefined' ? window : this);
