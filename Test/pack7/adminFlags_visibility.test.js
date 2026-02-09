/**
 * Pack 7 — AdminFlags visibility (devOnly).
 * Run: node Test/pack7/adminFlags_visibility.test.js
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

global.Option = function (text, value) {
  this.text = text;
  this.value = value;
  return this;
};

function makeDocument() {
  const elements = {};
  function Element(tag) {
    this.tag = tag;
    this.children = [];
    this.style = {};
    this.className = '';
    this.textContent = '';
    this.innerHTML = '';
    this._id = '';
    Object.defineProperty(this, 'id', {
      get() { return this._id; },
      set(v) { this._id = v; if (v) elements[v] = this; }
    });
  }
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

console.log('\n── Pack 7: AdminFlags visibility ──');

function setupFlags() {
  global.Game = {
    Flags: {
      list: () => [],
      getUserId: () => 'u_test',
      clearOverrides: () => {},
      setOverride: () => {},
    },
  };
}

test('AF-1: devOnly false in prod host', () => {
  global.document = makeDocument();
  setupFlags();
  global.location = { hostname: 'example.com', protocol: 'https:', search: '?debug=1' };
  const panel = global.document.createElement('div');
  panel.id = 'debugSectionLogs';
  loadModule('src/ui/adminFlags.js');
  assertEqual(global.Game.AdminFlags.isDevOnly(), false, 'isDevOnly false');
  global.Game.AdminFlags.init();
  assertEqual(global.document.getElementById('adminFlags'), null, 'adminFlags not created');
});

test('AF-2: devOnly true on localhost', () => {
  global.document = makeDocument();
  setupFlags();
  global.location = { hostname: 'localhost', protocol: 'http:', search: '?debug=1' };
  const panel = global.document.createElement('div');
  panel.id = 'debugSectionLogs';
  loadModule('src/ui/adminFlags.js');
  assertEqual(global.Game.AdminFlags.isDevOnly(), true, 'isDevOnly true');
  global.Game.AdminFlags.init();
  assert(!!global.document.getElementById('adminFlags'), 'adminFlags created');
});

console.log('\n═══════════════════════════');
console.log('AdminFlags visibility: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
