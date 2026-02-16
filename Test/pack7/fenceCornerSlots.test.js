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
  const segments = buildSquareFenceSegments({
    halfSide,
    fenceWidth,
    spriteKeys,
    getFrame: function () {
      return { w: 128, h: 128, scale: 2, rotation: 0, anchor: { x: 0.5, y: 0.5 } };
    },
  });
  assert(Array.isArray(segments), 'segments array returned');
  assert(segments.length > 0, 'segments not empty');

  const corners = segments.filter(seg => seg.isCorner);
  assert(corners.length === 4, 'four corner slots');

  const cornerPositions = new Set(corners.map(seg => seg.x + ',' + seg.y));
  assert(cornerPositions.has('-100,-100'), 'corner TL');
  assert(cornerPositions.has('100,-100'), 'corner TR');
  assert(cornerPositions.has('100,100'), 'corner BR');
  assert(cornerPositions.has('-100,100'), 'corner BL');

  const byId = new Map(segments.map(seg => [seg.id, seg]));
  const top = segments
    .filter(seg => seg.kind === 'sideTop')
    .sort((a, b) => a.x - b.x);
  const right = segments
    .filter(seg => seg.kind === 'sideRight')
    .sort((a, b) => a.y - b.y);
  const bottom = segments
    .filter(seg => seg.kind === 'sideBottom')
    .sort((a, b) => a.x - b.x);
  const left = segments
    .filter(seg => seg.kind === 'sideLeft')
    .sort((a, b) => a.y - b.y);

  function gap(a, b) {
    return Math.max(0, b - a);
  }

  assert(gap(byId.get('cornerTL').holeAabb.maxX, top[0].holeAabb.minX) <= 1e-6, 'no top-left gap');
  assert(gap(top[top.length - 1].holeAabb.maxX, byId.get('cornerTR').holeAabb.minX) <= 1e-6, 'no top-right gap');
  assert(gap(byId.get('cornerTL').holeAabb.maxY, left[0].holeAabb.minY) <= 1e-6, 'no left-top gap');
  assert(gap(left[left.length - 1].holeAabb.maxY, byId.get('cornerBL').holeAabb.minY) <= 1e-6, 'no left-bottom gap');
  assert(gap(byId.get('cornerTR').holeAabb.maxY, right[0].holeAabb.minY) <= 1e-6, 'no right-top gap');
  assert(gap(right[right.length - 1].holeAabb.maxY, byId.get('cornerBR').holeAabb.minY) <= 1e-6, 'no right-bottom gap');
  assert(gap(byId.get('cornerBL').holeAabb.maxX, bottom[0].holeAabb.minX) <= 1e-6, 'no bottom-left gap');
  assert(gap(bottom[bottom.length - 1].holeAabb.maxX, byId.get('cornerBR').holeAabb.minX) <= 1e-6, 'no bottom-right gap');
});

test('FCS-2: negative cornerInsetPx creates overlap and updates corner AABB position', () => {
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
  const inset = -4;
  const segments = buildSquareFenceSegments({
    halfSide,
    fenceWidth,
    spriteKeys,
    cornerInsetPxOverride: inset,
    getFrame: function () {
      return { w: 128, h: 128, scale: 2, rotation: 0, anchor: { x: 0.5, y: 0.5 } };
    },
  });

  const cornerTL = segments.find(seg => seg.id === 'cornerTL');
  const topFirst = segments
    .filter(seg => seg.kind === 'sideTop')
    .sort((a, b) => a.x - b.x)[0];

  assert(cornerTL.x === -halfSide + Math.abs(inset), 'negative inset shifts corner inward on X');
  assert(cornerTL.y === -halfSide + Math.abs(inset), 'negative inset shifts corner inward on Y');
  assert(cornerTL.holeAabb.maxX > topFirst.holeAabb.minX, 'negative inset creates overlap with top side');
});

console.log('\n═══════════════════════════');
console.log('FenceCornerSlots: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
