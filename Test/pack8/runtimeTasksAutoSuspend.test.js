/**
 * Test/pack8/runtimeTasksAutoSuspend.test.js
 *
 * Solo-pipeline-yandex-vk rework R2: assert that suspendAll/resumeAll cycle
 * preserves rAF callbacks so the game's main loop survives tab-blur events.
 */
'use strict';

var assert = require('assert');
var path = require('path');
var fs = require('fs');

function makeFakeWindow() {
  var rafCallbacks = new Map();
  var nextId = 1;
  var win = {
    document: {
      hidden: false,
      visibilityState: 'visible',
      _listeners: {},
      addEventListener: function (type, cb) {
        win.document._listeners[type] = win.document._listeners[type] || [];
        win.document._listeners[type].push(cb);
      },
    },
    _winListeners: {},
    addEventListener: function (type, cb) {
      win._winListeners[type] = win._winListeners[type] || [];
      win._winListeners[type].push(cb);
    },
    setTimeout: function (cb, ms) { return setTimeout(cb, ms); },
    clearTimeout: function (id) { return clearTimeout(id); },
    setInterval: function (cb, ms) { return setInterval(cb, ms); },
    clearInterval: function (id) { return clearInterval(id); },
    requestAnimationFrame: function (cb) {
      var id = nextId++;
      rafCallbacks.set(id, cb);
      // do not auto-fire; tests will fire manually via win._fireRaf
      return id;
    },
    cancelAnimationFrame: function (id) {
      rafCallbacks.delete(id);
    },
    _fireRaf: function (ts) {
      var pending = Array.from(rafCallbacks.entries());
      rafCallbacks.clear();
      for (var i = 0; i < pending.length; i++) {
        try { pending[i][1](ts); } catch (_) {}
      }
    },
    _pendingRafCount: function () { return rafCallbacks.size; },
  };
  return win;
}

function loadRuntimeTasks(win) {
  var src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'core', 'runtimeTasks.js'),
    'utf8'
  );
  // Replace the closing IIFE call so we can inject our fake window.
  src = src.replace(
    /\}\)\(typeof window !== 'undefined' \? window : this\);\s*$/,
    '})(__fake_global__);'
  );
  var fn = new Function('__fake_global__', src);
  fn(win);
}

function test(name, fn) {
  try {
    fn();
    console.log('  ok ' + name);
  } catch (e) {
    console.log('  FAIL ' + name + ': ' + (e && e.message));
    process.exitCode = 1;
  }
}

console.log('# RUNTIMETASKS-AUTOSUSPEND');

test('suspendAll preserves rAF callback for resume re-queue', function () {
  var win = makeFakeWindow();
  loadRuntimeTasks(win);
  win.Game.RuntimeTasks.install();

  var loopCalls = 0;
  function gameLoop() {
    loopCalls++;
    win.requestAnimationFrame(gameLoop);
  }
  win.requestAnimationFrame(gameLoop);
  assert.strictEqual(win._pendingRafCount(), 1, 'one rAF queued initially');

  // Simulate tab hidden: suspendAll cancels in-flight rAF
  win.Game.RuntimeTasks.suspendAll();
  assert.strictEqual(win._pendingRafCount(), 0, 'native rAFs cancelled on suspend');
  assert.strictEqual(win.Game.RuntimeTasks.isSuspended(), true);

  // Simulate tab visible: resumeAll re-queues the captured callback
  win.Game.RuntimeTasks.resumeAll();
  assert.strictEqual(win.Game.RuntimeTasks.isSuspended(), false);
  assert.strictEqual(win._pendingRafCount(), 1, 'callback re-queued via native rAF');

  // Drive the loop forward — must continue to run
  win._fireRaf(16);
  assert.strictEqual(loopCalls, 1, 'first frame fired after resume');
  win._fireRaf(32);
  assert.strictEqual(loopCalls, 2, 'second frame fired after resume');
});

test('multiple suspend/resume cycles do not duplicate or lose callbacks', function () {
  var win = makeFakeWindow();
  loadRuntimeTasks(win);
  win.Game.RuntimeTasks.install();

  var loopCalls = 0;
  function gameLoop() {
    loopCalls++;
    win.requestAnimationFrame(gameLoop);
  }
  win.requestAnimationFrame(gameLoop);

  // cycle 1
  win.Game.RuntimeTasks.suspendAll();
  win.Game.RuntimeTasks.resumeAll();
  // cycle 2 (no-op resume — should not crash, no extra queue)
  win.Game.RuntimeTasks.resumeAll();
  // cycle 3
  win.Game.RuntimeTasks.suspendAll();
  win.Game.RuntimeTasks.suspendAll(); // double suspend should be idempotent
  win.Game.RuntimeTasks.resumeAll();

  assert.strictEqual(win._pendingRafCount(), 1, 'exactly one rAF queued after multi-cycle');

  win._fireRaf(16);
  assert.strictEqual(loopCalls, 1);
});

test('rAF queued while suspended is captured and replayed on resume', function () {
  var win = makeFakeWindow();
  loadRuntimeTasks(win);
  win.Game.RuntimeTasks.install();

  win.Game.RuntimeTasks.suspendAll();
  var fired = 0;
  win.requestAnimationFrame(function () { fired++; });
  // While suspended, rAF returns 0 and queues callback for resume
  assert.strictEqual(win._pendingRafCount(), 0, 'native rAF not used while suspended');

  win.Game.RuntimeTasks.resumeAll();
  assert.strictEqual(win._pendingRafCount(), 1, 'queued callback re-issued on resume');
  win._fireRaf(0);
  assert.strictEqual(fired, 1);
});

test('installAutoSuspend wires visibilitychange only (blur/focus removed in rework-2/R5)', function () {
  var win = makeFakeWindow();
  loadRuntimeTasks(win);
  win.Game.RuntimeTasks.install();
  win.Game.RuntimeTasks.installAutoSuspend();

  assert.ok(win.document._listeners.visibilitychange, 'visibilitychange listener wired');
  // solo-pipeline-yandex-vk#rework-2 (R5): window.blur fires on transient
  // OS focus shifts (window resize, resolution change, alt-tab to chrome
  // decorations) which would suspendAll() and leave the canvas black after
  // the resize handler reset canvas state. installAutoSuspend MUST NOT
  // wire blur/focus — only visibilitychange.
  assert.ok(!win._winListeners.blur, 'blur listener MUST NOT be wired (R5 regression guard)');
  assert.ok(!win._winListeners.focus, 'focus listener MUST NOT be wired (R5 regression guard)');

  var loopCalls = 0;
  function gameLoop() { loopCalls++; win.requestAnimationFrame(gameLoop); }
  win.requestAnimationFrame(gameLoop);

  // Simulate visibilitychange to hidden → focus restoration
  win.document.hidden = true;
  win.document.visibilityState = 'hidden';
  win.document._listeners.visibilitychange.forEach(function (cb) { cb(); });
  assert.strictEqual(win.Game.RuntimeTasks.isSuspended(), true);

  win.document.hidden = false;
  win.document.visibilityState = 'visible';
  win.document._listeners.visibilitychange.forEach(function (cb) { cb(); });
  assert.strictEqual(win.Game.RuntimeTasks.isSuspended(), false);

  // Loop must continue
  win._fireRaf(16);
  assert.strictEqual(loopCalls, 1, 'loop resumes after visibility cycle');
});

test('window blur/focus do NOT suspend the loop (R5 regression: resize must not blackout canvas)', function () {
  var win = makeFakeWindow();
  loadRuntimeTasks(win);
  win.Game.RuntimeTasks.install();
  win.Game.RuntimeTasks.installAutoSuspend();

  var loopCalls = 0;
  function gameLoop() { loopCalls++; win.requestAnimationFrame(gameLoop); }
  win.requestAnimationFrame(gameLoop);
  assert.strictEqual(win._pendingRafCount(), 1);

  // Simulate transient window blur (e.g. user dragging the window edge to
  // resize, or the OS resolution-change overlay grabbing focus). The tab
  // is still VISIBLE, so the loop must keep running and the canvas must
  // continue to be redrawn.
  if (win._winListeners.blur) {
    win._winListeners.blur.forEach(function (cb) { cb(); });
  }
  assert.strictEqual(win.Game.RuntimeTasks.isSuspended(), false,
    'blur alone (without document.hidden) must NOT suspend the loop');
  assert.strictEqual(win._pendingRafCount(), 1,
    'pending rAF preserved across blur — loop continues, canvas keeps redrawing');

  win._fireRaf(16);
  assert.strictEqual(loopCalls, 1, 'frame fires normally after blur');
});

console.log('# done');
