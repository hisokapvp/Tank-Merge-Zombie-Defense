/**
 * Pack 7 — Fence assets corner/side keys.
 * Run: node Test/pack7/fenceAssetsCornersSides.test.js
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
const fencePath = path.join(root, 'assets', 'fence.json');
const fenceData = JSON.parse(fs.readFileSync(fencePath, 'utf8'));

console.log('\n── Pack 7: Fence assets corner/side keys ──');

test('FAK-1: fence.json has corner + side sprite keys', () => {
  const frames = Array.isArray(fenceData.frames) ? fenceData.frames : [];
  const ids = new Set(frames.map(frame => frame.id));
  const required = [
    'cornerTL', 'cornerTR', 'cornerBR', 'cornerBL',
    'sideTop', 'sideRight', 'sideBottom', 'sideLeft',
  ];

  for (const id of required) {
    assert(ids.has(id), 'missing frame id: ' + id);
  }
});

console.log('\n═══════════════════════════');
console.log('FenceAssetsCornersSides: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
