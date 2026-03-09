(function (global) {
  'use strict';

  var MIN_FONT_PX = 12;
  var SKIP_SELECTOR = [
    '.levelModal__close',
    '.crateModal__close',
    '.modalClose',
    '.chipCraftSlotRemove',
    '.lessonProgress__close',
    '[data-font-floor-ignore="true"]'
  ].join(', ');

  function clampFontString(value) {
    var text = String(value || '');
    return text.replace(/(\d+(?:\.\d+)?)px/gi, function (_, num) {
      var parsed = Number(num);
      if (!Number.isFinite(parsed)) return _;
      return String(Math.max(MIN_FONT_PX, parsed)) + 'px';
    });
  }

  function installCanvasFontFloor() {
    var proto = global.CanvasRenderingContext2D && global.CanvasRenderingContext2D.prototype;
    if (!proto || proto.__fontFloorInstalled) return;
    var descriptor = Object.getOwnPropertyDescriptor(proto, 'font');
    if (!descriptor || typeof descriptor.get !== 'function' || typeof descriptor.set !== 'function' || descriptor.configurable === false) {
      return;
    }
    Object.defineProperty(proto, 'font', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: function () {
        return descriptor.get.call(this);
      },
      set: function (value) {
        descriptor.set.call(this, clampFontString(value));
      }
    });
    proto.__fontFloorInstalled = true;
  }

  function isElementNode(node) {
    return !!node && node.nodeType === 1;
  }

  function shouldSkipElement(element) {
    return !element || typeof element.matches !== 'function' || element.matches(SKIP_SELECTOR);
  }

  function getComputedFontPx(element) {
    if (!element || !global.getComputedStyle) return 0;
    var computed = global.getComputedStyle(element);
    var size = Number.parseFloat(computed && computed.fontSize ? computed.fontSize : '0');
    return Number.isFinite(size) ? size : 0;
  }

  function enforceElementFloor(element) {
    if (!isElementNode(element) || shouldSkipElement(element)) return;
    var sizePx = getComputedFontPx(element);
    if (sizePx > 0 && sizePx < MIN_FONT_PX) {
      element.style.fontSize = MIN_FONT_PX + 'px';
    }
  }

  function walkAndEnforce(root) {
    if (!isElementNode(root)) return;
    enforceElementFloor(root);
    var descendants = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (var i = 0; i < descendants.length; i++) {
      enforceElementFloor(descendants[i]);
    }
  }

  function createScheduler() {
    var queued = [];
    var scheduled = false;

    function flush() {
      scheduled = false;
      while (queued.length) {
        walkAndEnforce(queued.shift());
      }
    }

    return function schedule(root) {
      if (!isElementNode(root)) return;
      queued.push(root);
      if (scheduled) return;
      scheduled = true;
      if (typeof global.requestAnimationFrame === 'function') {
        global.requestAnimationFrame(flush);
      } else {
        global.setTimeout(flush, 16);
      }
    };
  }

  function installDomFontFloor() {
    if (!global.document || !global.document.body) return;
    var schedule = createScheduler();
    schedule(global.document.body);

    if (typeof global.MutationObserver === 'undefined') return;
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        if (mutation.type === 'childList') {
          for (var ai = 0; ai < mutation.addedNodes.length; ai++) {
            var added = mutation.addedNodes[ai];
            if (isElementNode(added)) schedule(added);
          }
        } else if (mutation.type === 'attributes' && isElementNode(mutation.target)) {
          schedule(mutation.target);
        }
      }
    });

    observer.observe(global.document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  installCanvasFontFloor();
  installDomFontFloor();

  global.Game = global.Game || {};
  global.Game.FontFloor = {
    MIN_FONT_PX: MIN_FONT_PX,
    clampFontString: clampFontString,
    enforceElementFloor: enforceElementFloor
  };
})(typeof window !== 'undefined' ? window : this);
