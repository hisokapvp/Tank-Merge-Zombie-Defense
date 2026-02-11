/**
 * Pack 6 — Zombie road/path visuals removed.
 * Run: node Test/pack6/zombieRoad_visuals_removed.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}
function test(name, fn) {
  try { fn(); passCount++; console.log('  \u2713 ' + name); }
  catch (e) { failCount++; failures.push({ name, error: e.message }); console.log('  \u2717 ' + name + ' \u2014 ' + e.message); }
}

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

function collectJsFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push.apply(files, collectJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function scanFile(filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const windowText = line + ' ' + (lines[i + 1] || '');
    const hasCtx = /ctx\./i.test(windowText);
    const hasZombie = /zombie/i.test(windowText);
    const hasRoute = /(path|road|waypoint|track)/i.test(windowText);
    if (hasCtx && hasZombie && hasRoute) {
      hits.push({ line: i + 1, text: line.trim() });
    }
  }
  return { rel, hits };
}

console.log('\n\u2500\u2500 Pack 6: Zombie road/path visuals removed \u2500\u2500');

test('ZRV-1: no zombie path/road/waypoint/track canvas drawing remains', () => {
  const gameJs = path.join(root, 'game.js');
  const srcDir = path.join(root, 'src');
  const srcFiles = collectJsFiles(srcDir);
  const files = [gameJs].concat(srcFiles);

  const findings = [];
  for (const filePath of files) {
    const result = scanFile(filePath);
    if (result.hits.length) findings.push(result);
  }

  if (findings.length) {
    const details = findings.map(f => {
      const lines = f.hits.map(h => '  - ' + f.rel + ':' + h.line + ' ' + h.text).join('\n');
      return lines;
    }).join('\n');
    throw new Error('canvas path visuals found:\n' + details);
  }

  assert(findings.length === 0, 'no matching canvas draw lines');
});

// Summary
console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
console.log('ZombieRoadVisualsRemoved: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');
process.exit(failCount > 0 ? 1 : 0);
