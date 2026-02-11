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

const root = path.resolve(__dirname, '../..');
const gamePath = path.join(root, 'game.js');
const content = fs.readFileSync(gamePath, 'utf8');

function extractFunctionBody(name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}');
  const match = content.match(re) || content.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\}'));
  return match ? match[1] : null;
}

console.log('\n── Pack 7: Fence corner slots ──');

test('FCS-1: buildSquareFenceSegments defines 4 corners and sides', () => {
  const body = extractFunctionBody('buildSquareFenceSegments');
  assert(!!body, 'buildSquareFenceSegments function found');

  const buildSquareFenceSegments = new Function('halfSide', 'fenceWidth', 'spriteKeys', body);
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
  const segments = buildSquareFenceSegments(halfSide, fenceWidth, spriteKeys);
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
