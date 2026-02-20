/**
 * Pack 7 — AdminDamagePoints visibility and controls.
 * Run: node Test/pack7/adminDamagePoints_visibility.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || 'assertEqual') + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}
function test(name, fn) {
  try { fn(); passCount++; console.log('  ✓ ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  ✗ ' + name + ' — ' + e.message); }
}

const global = globalThis;
global.window = global;

function makeDocument() {
  const elements = {};
  function Element(tag) {
    this.tag = tag;
    this.children = [];
    this.style = {};
    this.className = '';
    this.textContent = '';
    this.innerHTML = '';
    this.type = '';
    this.value = '';
    this.step = '';
    this._id = '';
    Object.defineProperty(this, 'id', {
      get() { return this._id; },
      set(v) { this._id = v; if (v) elements[v] = this; }
    });
  }
  Element.prototype.addEventListener = function (event, f) {
    this._listeners = this._listeners || {};
    this._listeners[event] = f;
  };
  Element.prototype.appendChild = function (child) {
    this.children.push(child);
  };
  Element.prototype.querySelector = function (sel) {
    if (sel && sel[0] === '#') {
      return findById(this, sel.slice(1));
    }
    return null;
  };
  function findById(root, id) {
    if (!root) return null;
    if (root.id === id) return root;
    for (let i = 0; i < root.children.length; i++) {
      const found = findById(root.children[i], id);
      if (found) return found;
    }
    return null;
  }
  return {
    createElement: (tag) => new Element(tag),
    getElementById: (id) => elements[id] || null,
    _elements: elements,
  };
}

const fs = require('fs');
const path = require('path');

function loadModule(relPath) {
  const code = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf8');
  const fn = new Function('window', 'global', 'document', 'console', code);
  fn(global, global, global.document || {}, console);
}

console.log('\n── Pack 7: AdminDamagePoints visibility ──');

function click(el) {
  if (!el || !el._listeners || typeof el._listeners.click !== 'function') {
    throw new Error('No click listener');
  }
  el._listeners.click();
}

test('ADP-1: shown on prod host when debug=1', () => {
  global.document = makeDocument();
  global.location = { hostname: 'example.com', protocol: 'https:', search: '?debug=1' };
  global.Game = {
    getDamagePoints: () => 10,
    debugAdjustDamagePoints: () => ({ ok: true }),
  };
  const panel = global.document.createElement('div');
  panel.id = 'debugSectionLogs';
  loadModule('src/ui/adminDamagePoints.js');
  global.Game.AdminDamagePoints.init();
  assert(!!global.document.getElementById('adminDamagePoints'), 'adminDamagePoints created');
});

test('ADP-2: shown on localhost and controls update value with clamp', () => {
  global.document = makeDocument();
  global.location = { hostname: 'localhost', protocol: 'http:', search: '?debug=1' };
  let points = 5;
  global.Game = {
    getDamagePoints: () => points,
    debugAdjustDamagePoints: (delta) => {
      const d = Number.isFinite(delta) ? delta : 0;
      points = Math.max(0, points + d);
      return { ok: true, damagePoints: points };
    },
  };
  const panel = global.document.createElement('div');
  panel.id = 'debugSectionLogs';

  loadModule('src/ui/adminDamagePoints.js');
  global.Game.AdminDamagePoints.init();

  const root = global.document.getElementById('adminDamagePoints');
  const input = global.document.getElementById('adminDamagePointsInput');
  const addBtn = global.document.getElementById('adminDamagePointsAdd');
  const subBtn = global.document.getElementById('adminDamagePointsSub');
  const value = global.document.getElementById('adminDamagePointsValue');

  assert(!!root, 'adminDamagePoints created');
  assert(!!input && input.type === 'number', 'number input exists');
  assert(!!addBtn && !!subBtn, 'buttons exist');
  assert(value.textContent.indexOf('5') >= 0, 'initial value rendered');

  input.value = '3.8';
  click(addBtn);
  assertEqual(points, 8, '+Add applies floor(delta)');

  input.value = '100';
  click(subBtn);
  assertEqual(points, 0, '-Add clamps to zero');

  input.value = '';
  click(addBtn);
  assertEqual(points, 0, 'invalid input does not change value');
});

console.log('\n═══════════════════════════');
console.log('AdminDamagePoints visibility: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
