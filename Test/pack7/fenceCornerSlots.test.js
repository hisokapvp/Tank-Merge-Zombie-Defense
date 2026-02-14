/**
 * Pack 7 — Fence corner slots and side spacing.
 * Run: node Test/pack7/fenceCornerSlots.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}
function test(name, fn) {
  try { fn(); passCount++; console.log('  \u2713 ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  \u2717 ' + name + ' — ' + e.message); }
}

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const fenceLayoutPath = path.join(root, 'src', 'render', 'fenceLayout.js');
const content = fs.readFileSync(fenceLayoutPath, 'utf8');

const sandbox = {
  window: {},
  console,
  Math,
  Number,
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(content, sandbox, { filename: 'fenceLayout.js' });

console.log('\n── Pack 7: Fence corner slots ──');

test('FCS-1: buildSquareFenceSegments defines 4 corners and sides', () => {
  const buildSquareFenceSegments = sandbox.window.Game
    && sandbox.window.Game.FenceLayout
    && sandbox.window.Game.FenceLayout.buildSquareFenceSegments;
  assert(typeof buildSquareFenceSegments === 'function', 'buildSquareFenceSegments function found');
  const spriteKeys = {
    cornerTL: 'cornerTL',
    cornerTR: 'cornerTR',
    cornerBR: 'cornerBR',
    cornerBL: 'cornerBL',
    sideTop: 'sideTop',
    sideRight: 'sideRight',
    sideBottom: 'sideBottom',
    sideLeft: 'sideLeft',
  };

  const halfSide = 100;
  const fenceWidth = 20;
  const segments = buildSquareFenceSegments({ halfSide, fenceWidth, spriteKeys });
  assert(Array.isArray(segments), 'segments array returned');
  assert(segments.length > 0, 'segments not empty');

  const corners = segments.filter(seg => seg.isCorner);
  assert(corners.length === 4, 'four corner slots');

  const cornerPositions = new Set(corners.map(seg => seg.x + ',' + seg.y));
  assert(cornerPositions.has('-100,-100'), 'corner TL');
  assert(cornerPositions.has('100,-100'), 'corner TR');
  assert(cornerPositions.has('100,100'), 'corner BR');
  assert(cornerPositions.has('-100,100'), 'corner BL');

  const inset = Math.max(4, fenceWidth * 0.65) - 1e-6;
  for (const seg of segments) {
    if (seg.isCorner) continue;
    const atCorner = Math.abs(seg.x) === halfSide && Math.abs(seg.y) === halfSide;
    assert(!atCorner, 'side segment does not overlap corner');

    if (Math.abs(seg.x) === halfSide) {
      assert(Math.abs(seg.y) <= halfSide - inset, 'vertical side inset from corners');
    }
    if (Math.abs(seg.y) === halfSide) {
      assert(Math.abs(seg.x) <= halfSide - inset, 'horizontal side inset from corners');
    }
  }
});

console.log('\n═══════════════════════════');
console.log('FenceCornerSlots: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
