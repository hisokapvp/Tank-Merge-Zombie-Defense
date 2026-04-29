(function (global) {
  'use strict';

  var MIN_FONT_PX = 10;
  var CLAMP_ATTR = 'data-font-floor-clamped';
  var ORIGINAL_VALUE_ATTR = 'data-font-floor-original-font-size';
  var ORIGINAL_PRIORITY_ATTR = 'data-font-floor-original-font-priority';
  var INTERNAL_STYLE_MUTATIONS_KEY = '__fontFloorInternalStyleMutations';
  var SKIP_SELECTORS = [
    '.levelModal__close',
    '.crateModal__close',
    '.modalClose',
    '.chipCraftSlotRemove',
    '.lessonProgress__close',
    '[data-font-floor-ignore="true"]'
  ];
  var SKIP_SELECTOR = SKIP_SELECTORS.join(', ');
  var _schedulerMetrics = null;

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

  function isClampedElement(element) {
    return !!element && !!element.getAttribute && element.getAttribute(CLAMP_ATTR) === 'true';
  }

  function shouldSkipElement(element) {
    if (!element || typeof element.matches !== 'function') return true;
    if (element.matches(SKIP_SELECTOR)) return true;
    return typeof element.closest === 'function' && !!element.closest(SKIP_SELECTOR);
  }

  function rememberInlineFontState(element) {
    if (!element || !element.style || isClampedElement(element)) return;
    element.setAttribute(CLAMP_ATTR, 'true');
    element.setAttribute(ORIGINAL_VALUE_ATTR, element.style.getPropertyValue('font-size') || '');
    element.setAttribute(ORIGINAL_PRIORITY_ATTR, element.style.getPropertyPriority('font-size') || '');
  }

  function markInternalStyleMutation(element) {
    if (!element) return;
    var pending = Number(element[INTERNAL_STYLE_MUTATIONS_KEY]) || 0;
    element[INTERNAL_STYLE_MUTATIONS_KEY] = pending + 1;
  }

  function consumeInternalStyleMutation(element) {
    if (!element) return false;
    var pending = Number(element[INTERNAL_STYLE_MUTATIONS_KEY]) || 0;
    if (pending <= 0) return false;
    if (pending === 1) {
      try {
        delete element[INTERNAL_STYLE_MUTATIONS_KEY];
      } catch (err) {
        element[INTERNAL_STYLE_MUTATIONS_KEY] = 0;
      }
      return true;
    }
    element[INTERNAL_STYLE_MUTATIONS_KEY] = pending - 1;
    return true;
  }

  function setElementFontSize(element, value, priority) {
    if (!element || !element.style) return;
    markInternalStyleMutation(element);
    element.style.setProperty('font-size', value, priority || '');
  }

  function removeElementFontSize(element) {
    if (!element || !element.style) return;
    markInternalStyleMutation(element);
    element.style.removeProperty('font-size');
  }

  function restoreInlineFontState(element) {
    if (!element || !element.style || !isClampedElement(element)) return;
    var originalValue = element.getAttribute(ORIGINAL_VALUE_ATTR) || '';
    var originalPriority = element.getAttribute(ORIGINAL_PRIORITY_ATTR) || '';
    if (originalValue) {
      setElementFontSize(element, originalValue, originalPriority);
      return;
    }
    removeElementFontSize(element);
  }

  function clearClampMetadata(element) {
    if (!element || !element.removeAttribute) return;
    element.removeAttribute(CLAMP_ATTR);
    element.removeAttribute(ORIGINAL_VALUE_ATTR);
    element.removeAttribute(ORIGINAL_PRIORITY_ATTR);
  }

  function applyElementFloor(element) {
    if (!element || !element.style) return;
    rememberInlineFontState(element);
    setElementFontSize(element, MIN_FONT_PX + 'px');
  }

  function getComputedFontPx(element) {
    if (!element || !global.getComputedStyle) return 0;
    var computed = global.getComputedStyle(element);
    var size = Number.parseFloat(computed && computed.fontSize ? computed.fontSize : '0');
    return Number.isFinite(size) ? size : 0;
  }

  function enforceElementFloor(element) {
    if (!isElementNode(element)) return;
    var hadClamp = isClampedElement(element);
    if (shouldSkipElement(element)) {
      if (hadClamp) {
        restoreInlineFontState(element);
        clearClampMetadata(element);
      }
      return;
    }
    if (hadClamp) restoreInlineFontState(element);
    var sizePx = getComputedFontPx(element);
    if (sizePx > 0 && sizePx < MIN_FONT_PX) {
      applyElementFloor(element);
      return;
    }
    if (hadClamp) {
      if (sizePx <= 0) {
        applyElementFloor(element);
        return;
      }
      clearClampMetadata(element);
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

  function updateSchedulerQueueMetrics(metrics, queueLength) {
    if (!metrics) return;
    metrics.queueSize = queueLength;
    if (queueLength > metrics.maxQueueSize) metrics.maxQueueSize = queueLength;
  }

  function createScheduler() {
    var queued = [];
    var scheduled = false;
    var metrics = {
      queueSize: 0,
      maxQueueSize: 0,
      flushCount: 0,
      lastFlushSize: 0
    };

    function flush() {
      scheduled = false;
      metrics.flushCount += 1;
      metrics.lastFlushSize = queued.length;
      while (queued.length) {
        walkAndEnforce(queued.shift());
        updateSchedulerQueueMetrics(metrics, queued.length);
      }
    }

    function schedule(root) {
      if (!isElementNode(root)) return;
      queued.push(root);
      updateSchedulerQueueMetrics(metrics, queued.length);
      if (scheduled) return;
      scheduled = true;
      if (typeof global.requestAnimationFrame === 'function') {
        global.requestAnimationFrame(flush);
      } else {
        global.setTimeout(flush, 16);
      }
    }

    schedule.metrics = metrics;
    return schedule;
  }

  function getSchedulerMetrics() {
    if (!_schedulerMetrics) {
      return {
        queueSize: 0,
        maxQueueSize: 0,
        flushCount: 0,
        lastFlushSize: 0
      };
    }
    return {
      queueSize: _schedulerMetrics.queueSize,
      maxQueueSize: _schedulerMetrics.maxQueueSize,
      flushCount: _schedulerMetrics.flushCount,
      lastFlushSize: _schedulerMetrics.lastFlushSize
    };
  }

  function installDomFontFloor() {
    if (!global.document || !global.document.body) return;
    var schedule = createScheduler();
    _schedulerMetrics = schedule.metrics;
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
          if (mutation.attributeName === 'style' && consumeInternalStyleMutation(mutation.target)) {
            continue;
          }
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
    SKIP_SELECTORS: SKIP_SELECTORS.slice(),
    clampFontString: clampFontString,
    enforceElementFloor: enforceElementFloor,
    getSchedulerMetrics: getSchedulerMetrics
  };
})(typeof window !== 'undefined' ? window : this);
