(function (global) {
  'use strict';

  var TOUCH_DRAG_HOST_ATTR = 'data-input-drag-host';

  function isTouchPointerEvent(evt) {
    return !!(evt && evt.pointerType === 'touch');
  }

  function preventTouchPointerDefault(evt) {
    if (!isTouchPointerEvent(evt) || evt.cancelable !== true) return false;
    evt.preventDefault();
    return true;
  }

  function installDocumentContextMenuGuard(docObj) {
    var doc = docObj || global.document;
    if (!doc || doc.__tmzdContextMenuGuardInstalled || global.__tmzdContextMenuGuardInstalled) return false;
    doc.addEventListener('contextmenu', function (evt) {
      if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
    }, true);
    doc.__tmzdContextMenuGuardInstalled = true;
    global.__tmzdContextMenuGuardInstalled = true;
    return true;
  }

  function markTouchDragHost(element) {
    if (!element || typeof element.setAttribute !== 'function') return false;
    element.setAttribute(TOUCH_DRAG_HOST_ATTR, 'true');
    return true;
  }

  function markTouchDragHosts(target, selector) {
    var marked = 0;
    var index;
    var nodes;
    if (!target) return marked;
    if (selector && typeof target.querySelectorAll === 'function') {
      nodes = target.querySelectorAll(selector);
      for (index = 0; index < nodes.length; index++) {
        if (markTouchDragHost(nodes[index])) marked++;
      }
      return marked;
    }
    if (typeof target.length === 'number' && typeof target.querySelectorAll !== 'function' && typeof target.setAttribute !== 'function') {
      for (index = 0; index < target.length; index++) {
        if (markTouchDragHost(target[index])) marked++;
      }
      return marked;
    }
    return markTouchDragHost(target) ? 1 : 0;
  }

  global.Game = global.Game || {};
  global.Game.InputGuards = {
    TOUCH_DRAG_HOST_ATTR: TOUCH_DRAG_HOST_ATTR,
    isTouchPointerEvent: isTouchPointerEvent,
    preventTouchPointerDefault: preventTouchPointerDefault,
    installDocumentContextMenuGuard: installDocumentContextMenuGuard,
    markTouchDragHost: markTouchDragHost,
    markTouchDragHosts: markTouchDragHosts,
  };
}(window));