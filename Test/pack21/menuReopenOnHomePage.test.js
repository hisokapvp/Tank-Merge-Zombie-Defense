'use strict';

/**
 * Pack 21: the in-game menu always reopens on its home page.
 *
 * Regression guard for a data-loss path reported by the player:
 *
 *   1. open the menu → go to «Загрузка» → load a slot;
 *   2. play for a while;
 *   3. press Escape / open the menu again.
 *
 * Step 3 reopened the overlay on the **load table**, because the sub-view was
 * tracked by CSS classes on elements that were only toggled with `hidden`
 * (`smallMenuRootView.is-hidden` + `smallMenuSaveView.is-active`, and the
 * `.menuActionSelected`/`btnPrimary` highlight on «Загрузка»). The classes
 * survived close/open, so an inattentive second click on «Загрузить» overwrote
 * the live run with the old slot.
 *
 * Fix invariant: the shell normalizes itself to its home page on the **close**
 * path (`UIModals.setMenuOpen` with `open:false` → `resetMenuView`), never on
 * open. Resetting on open would break the intentional "open straight into the
 * save table" flow: critical save-and-exit calls `openSaveView()` *before*
 * `setMenuOpen(true)`, so an open-time reset would bounce the player back to the
 * main view and lose the guided save.
 *
 * Cases:
 *   MMV-1   modals.js resets the sub-view when the overlay closes.
 *   MMV-2   modals.js does NOT reset on open (critical save-view flow survives).
 *   MMV-3   runtime behaviour of `UIModals.setMenuOpen` (spy on resetMenuView).
 *   MMV-4   a missing `resetMenuView` dep is tolerated (older callers).
 *   MMV-5   bootstrap.js publishes `resetMenuView` to game.js.
 *   MMV-6   bootstrap.js `resetMenuView` clears the highlighted action button.
 *   MMV-7   game.js forwards `resetMenuView` into `UIModals.setMenuOpen`.
 *   MMV-8   game.js fallback path (no UIModals) resets too.
 *   MMV-9   big menu normalizes to its root view when closed.
 *   MMV-10  runtime behaviour of `Game.BigMenuRuntime` close normalization.
 *   MMV-11  docs record the home-page invariant.
 *   MMV-12  entry token parity for the touched entry assets.
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  [OK] ' + name);
  } catch (err) {
    failCount++;
    failures.push({ name: name, error: err.message });
    console.log('  [FAIL] ' + name + ' - ' + err.message);
  }
}

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

/** Read a repo file with CRLF normalised to LF so multi-line slicing is stable. */
function readSource(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8').replace(/\r\n/g, '\n');
}

const modalsJs = readSource('src/ui/modals.js');
const bootstrapJs = readSource('src/core/bootstrap.js');
const bigMenuJs = readSource('src/ui/bigMenuRuntime.js');
const gameJs = readSource('game.js');
const indexHtml = readSource('index.html');
const uiDoc = readSource('docs/ai/SYSTEMS/ui.md');

/* ------------------------------------------------------------------ *
 * Sandbox helpers — load a real IIFE module against a fake window.
 * ------------------------------------------------------------------ */

function createSandbox() {
  const sandboxGlobal = {
    console: { warn: function () {}, log: function () {}, error: function () {} },
    JSON: JSON,
    Object: Object,
    Number: Number,
    Math: Math,
    Array: Array,
    Date: Date,
    Error: Error,
    String: String,
    Boolean: Boolean,
    setTimeout: function () { return 0; },
    clearTimeout: function () {},
    setInterval: function () { return 0; },
    clearInterval: function () {},
    addEventListener: function () {},
    removeEventListener: function () {},
    document: null,
  };
  sandboxGlobal.window = sandboxGlobal;
  sandboxGlobal.global = sandboxGlobal;
  sandboxGlobal.Game = {};

  function load(relPath) {
    const code = fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8');
    const fn = new Function('window', 'global', 'document', 'console', code);
    fn(sandboxGlobal, sandboxGlobal, sandboxGlobal.document, sandboxGlobal.console);
  }
  return { global: sandboxGlobal, load: load };
}

/** Minimal element double exposing only the class/attr API the shells use. */
function makeElement(id) {
  const classes = new Set();
  const attrs = {};
  return {
    id: id,
    disabled: false,
    textContent: '',
    style: {},
    children: [],
    classList: {
      add: function (c) { classes.add(c); },
      remove: function (c) { classes.delete(c); },
      contains: function (c) { return classes.has(c); },
      toggle: function (c, force) {
        const next = force === undefined ? !classes.has(c) : !!force;
        if (next) classes.add(c); else classes.delete(c);
        return next;
      },
    },
    setAttribute: function (k, v) { attrs[k] = String(v); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    removeAttribute: function (k) { delete attrs[k]; },
    appendChild: function (child) { this.children.push(child); return child; },
    addEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    contains: function () { return false; },
    _classes: classes,
    _attrs: attrs,
  };
}

/* ------------------------------------------------------------------ *
 * MMV-1..MMV-4 — UIModals.setMenuOpen close-path normalization
 * ------------------------------------------------------------------ */

test('MMV-1: modals.js normalizes the sub-view when the menu overlay closes', function () {
  const fnIdx = modalsJs.indexOf('function setMenuOpen(');
  assert(fnIdx !== -1, 'setMenuOpen present');
  const block = modalsJs.slice(fnIdx, modalsJs.indexOf('global.Game = global.Game || {};', fnIdx));
  assert(block.indexOf('resetMenuView') !== -1, 'close path consults resetMenuView');
  // The reset must sit in the else/close branch, guarded as a function dep.
  const resetIdx = block.indexOf("typeof opts.resetMenuView === 'function'");
  assert(resetIdx !== -1, 'resetMenuView is guarded as an optional dep');
  const openIdx = block.indexOf('a11yOpen(ui.menuOverlay');
  assert(openIdx !== -1 && openIdx < resetIdx, 'reset lives after the open branch');
  assert(block.indexOf('opts.resetMenuView()') !== -1, 'resetMenuView is actually invoked');
});

test('MMV-2: modals.js does not reset the sub-view on open', function () {
  const fnIdx = modalsJs.indexOf('function setMenuOpen(');
  const openIdx = modalsJs.indexOf('if (open) {', fnIdx);
  const elseIdx = modalsJs.indexOf('} else {', openIdx);
  assert(openIdx !== -1 && elseIdx !== -1, 'open/else branches present');
  const openBranch = modalsJs.slice(openIdx, elseIdx);
  assert(openBranch.indexOf('resetMenuView') === -1, 'open branch never resets (critical save view survives)');
});

test('MMV-3: UIModals.setMenuOpen resets on close and not on open (runtime)', function () {
  const sb = createSandbox();
  sb.load('src/ui/modals.js');
  const UIModals = sb.global.Game.UIModals;
  assert(UIModals && typeof UIModals.setMenuOpen === 'function', 'UIModals.setMenuOpen exported');

  const state = { ui: {} };
  const overlay = makeElement('menuOverlay');
  const ui = { menuOverlay: overlay, menuContinue: makeElement('menuContinue') };
  let resets = 0;
  const opts = {
    ui: ui,
    state: state,
    a11yOpen: function () {},
    a11yClose: function () {},
    resetMenuView: function () { resets += 1; },
    updateMenuState: function () {},
  };

  UIModals.setMenuOpen(Object.assign({ open: true }, opts));
  assertEqual(resets, 0, 'opening does not normalize the sub-view');
  assertEqual(overlay.getAttribute('aria-hidden'), 'false', 'overlay opened');

  UIModals.setMenuOpen(Object.assign({ open: false }, opts));
  assertEqual(resets, 1, 'closing normalizes the sub-view');
  assertEqual(overlay.getAttribute('aria-hidden'), 'true', 'overlay closed');

  // A reopened menu therefore lands on the home page by construction.
  UIModals.setMenuOpen(Object.assign({ open: true }, opts));
  assertEqual(resets, 1, 'open still does not reset');
});

test('MMV-4: a caller without resetMenuView still opens and closes safely', function () {
  const sb = createSandbox();
  sb.load('src/ui/modals.js');
  const UIModals = sb.global.Game.UIModals;
  const overlay = makeElement('menuOverlay');
  const opts = {
    ui: { menuOverlay: overlay, menuContinue: makeElement('menuContinue') },
    state: { ui: {} },
    updateMenuState: function () {},
  };
  UIModals.setMenuOpen(Object.assign({ open: true }, opts));
  UIModals.setMenuOpen(Object.assign({ open: false }, opts));
  assertEqual(overlay.getAttribute('aria-hidden'), 'true', 'legacy caller closes without throwing');
});

/* ------------------------------------------------------------------ *
 * MMV-5..MMV-6 — bootstrap.js owns the normalization
 * ------------------------------------------------------------------ */

test('MMV-5: bootstrap.js publishes resetMenuView to game.js', function () {
  assert(bootstrapJs.indexOf('function resetMenuView()') !== -1, 'resetMenuView defined');
  const apiIdx = bootstrapJs.indexOf('opts.onSmallMenuApiReady({');
  assert(apiIdx !== -1, 'small menu API handshake present');
  // The payload itself nests `openSaveView({ ... });`, so close on the handshake
  // terminator rather than on the first `});` inside a nested call.
  const apiEnd = bootstrapJs.indexOf('\n    }', apiIdx);
  assert(apiEnd !== -1, 'handshake terminator found');
  const apiBlock = bootstrapJs.slice(apiIdx, apiEnd);
  assert(apiBlock.indexOf('resetMenuView: resetMenuView') !== -1, 'resetMenuView exposed through the API payload');
  assert(apiBlock.indexOf('openCriticalSaveView') !== -1, 'critical save view still exposed (open-time flow untouched)');
});

test('MMV-6: bootstrap.js resetMenuView returns to the main page and drops the highlighted button', function () {
  const fnIdx = bootstrapJs.indexOf('function resetMenuView()');
  assert(fnIdx !== -1, 'resetMenuView present');
  const block = bootstrapJs.slice(fnIdx, bootstrapJs.indexOf('function openSaveView(', fnIdx));
  assert(block.indexOf('lastActiveButtonIdSmallMenu = null;') !== -1, 'highlighted action button cleared');
  assert(block.indexOf('openMainMenuView();') !== -1, 'main page restored');

  // openMainMenuView is the canonical normalization: root visible, slot views
  // closed, confirm views hidden.
  const mainIdx = bootstrapJs.indexOf('function openMainMenuView()');
  const mainBlock = bootstrapJs.slice(mainIdx, bootstrapJs.indexOf('function openSaveView(', mainIdx));
  assert(mainBlock.indexOf("setSlotViewsOpen('none')") !== -1, 'save/load slot views closed');
  assert(mainBlock.indexOf("setMenuView('main')") !== -1, 'main view selected');
});

/* ------------------------------------------------------------------ *
 * MMV-7..MMV-8 — game.js wiring
 * ------------------------------------------------------------------ */

test('MMV-7: game.js forwards resetMenuView into UIModals.setMenuOpen', function () {
  const fnIdx = gameJs.indexOf('function setMenuOpen(open){');
  assert(fnIdx !== -1, 'setMenuOpen present');
  const block = gameJs.slice(fnIdx, gameJs.indexOf('function updateMenuState()', fnIdx));
  assert(block.indexOf('resetMenuView: resetSmallMenuToMainView') !== -1, 'reset dep passed to the modal adapter');
  assert(gameJs.indexOf('function resetSmallMenuToMainView(){') !== -1, 'delegating helper defined');
  assert(
    gameJs.indexOf("smallMenuRuntimeController.resetMenuView()") !== -1,
    'helper delegates to the small-menu controller'
  );
});

test('MMV-8: game.js fallback path (no UIModals) normalizes the sub-view too', function () {
  const fnIdx = gameJs.indexOf('function setMenuOpen(open){');
  const block = gameJs.slice(fnIdx, gameJs.indexOf('function updateMenuState()', fnIdx));
  const fallbackIdx = block.indexOf("ui.menuOverlay.classList.toggle('hidden', !shouldOpen);");
  assert(fallbackIdx !== -1, 'fallback overlay toggle present');
  const tail = block.slice(fallbackIdx);
  assert(tail.indexOf('resetSmallMenuToMainView();') !== -1, 'fallback close path normalizes');
});

/* ------------------------------------------------------------------ *
 * MMV-9..MMV-10 — big menu parity
 * ------------------------------------------------------------------ */

test('MMV-9: big menu normalizes to its root view when closed', function () {
  const fnIdx = bigMenuJs.indexOf('function setBigMenuOpen(open)');
  assert(fnIdx !== -1, 'setBigMenuOpen present');
  const block = bigMenuJs.slice(fnIdx, bigMenuJs.indexOf('function isBigMenuOpen()', fnIdx));
  assert(block.indexOf('if (!open) {') !== -1, 'close branch present');
  assert(block.indexOf('openBigMenuRootView();') !== -1, 'root view restored on close');
  assert(block.indexOf('runtime.lastActiveButtonIdBigMenu = null;') !== -1, 'highlighted big-menu button cleared');
});

test('MMV-10: Game.BigMenuRuntime close normalization (runtime)', function () {
  const sb = createSandbox();
  sb.load('src/ui/bigMenuRuntime.js');
  const api = sb.global.Game.BigMenuRuntime;
  assert(api && typeof api.createController === 'function', 'createController exported');

  const overlay = makeElement('bigMenuOverlay');
  const rootView = makeElement('bigMenuRootView');
  const loadView = makeElement('bigMenuLoadView');
  const uiBag = {
    bigMenuOverlay: overlay,
    bigMenuRootView: rootView,
    bigMenuLoadView: loadView,
    bigMenuNew: makeElement('bigMenuNew'),
    bigMenuLoad: makeElement('bigMenuLoad'),
    bigMenuSound: makeElement('bigMenuSound'),
    bigMenuLanguage: makeElement('bigMenuLanguage'),
    bigMenuDevs: makeElement('bigMenuDevs'),
  };
  const controller = api.createController({
    getUi: function () { return uiBag; },
    setMenuPauseSource: function () {},
    syncVolumeUIFromSettings: function () {},
    t: function (k) { return k; },
    a11yOpen: function () {},
    a11yClose: function () {},
  });

  controller.setBigMenuOpen(true);
  controller.setBigMenuView('load');
  controller.markBigMenuButtonActive('bigMenuLoad');
  assertEqual(loadView.getAttribute('aria-hidden'), 'false', 'load view active before close');
  assertEqual(rootView.getAttribute('aria-hidden'), 'true', 'root hidden before close');

  controller.setBigMenuOpen(false);

  assertEqual(loadView.getAttribute('aria-hidden'), 'true', 'load view hidden after close');
  assertEqual(rootView.getAttribute('aria-hidden'), 'false', 'root view visible after close');
  assertEqual(rootView.classList.contains('is-hidden'), false, 'root view not marked hidden');
  assertEqual(
    uiBag.bigMenuLoad.classList.contains('menuActionSelected'),
    false,
    'highlighted action button cleared after close'
  );
});

/* ------------------------------------------------------------------ *
 * MMV-11..MMV-12 — documentation + cache-bust contract
 * ------------------------------------------------------------------ */

test('MMV-11: docs/ai/SYSTEMS/ui.md records the home-page invariant', function () {
  // The rule is documented as a dedicated section next to the Escape/menu
  // priority contract, and it names the `resetMenuView` seam so a future reader
  // can trace the invariant to code instead of re-deriving it.
  assert(uiDoc.indexOf('## In-game menu') !== -1, 'ui.md has the dedicated menu section');
  assert(uiDoc.indexOf('resetMenuView') !== -1, 'ui.md names the reset seam for future readers');
  assert(uiDoc.indexOf('setBigMenuOpen(false)') !== -1, 'ui.md records the big-menu parity rule');
  assert(
    uiDoc.indexOf('openCriticalSaveView') !== -1,
    'ui.md records why the reset lives on close, not on open'
  );
});
test('MMV-12: touched entry assets carry the shared entry token', function () {
  const m = indexHtml.match(/var token = '([^']+)'/);
  assert(m, 'entry token present');
  const entry = m[1];
  assert(indexHtml.indexOf('src/core/bootstrap.js?v=' + entry) !== -1, 'bootstrap.js carries the entry token');
  assert(indexHtml.indexOf('src/ui/bigMenuRuntime.js?v=' + entry) !== -1, 'bigMenuRuntime.js carries the entry token');
  assert(indexHtml.indexOf('src/ui/modals.js?v=' + entry) !== -1, 'modals.js carries the entry token');
});

console.log('\n═══════════════════════════');
console.log('Pack 21 (menu reopen home page): ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (f) { console.log('  - ' + f.name + ': ' + f.error); });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
