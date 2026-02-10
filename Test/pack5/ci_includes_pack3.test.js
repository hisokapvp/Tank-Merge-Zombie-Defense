/**
 * Pack 5 (CI guard) — ensure Pack 3 zombie test is in CI.
 * Run: node Test/pack5/ci_includes_pack3.test.js
 */

const fs = require('fs');
const path = require('path');

const ciScriptPath = path.resolve(__dirname, '..', '..', 'ci', 'run_tests.sh');
const ciScript = fs.readFileSync(ciScriptPath, 'utf-8');
const requiredLine = 'Test/pack3/zombieSpawnAliveOnly.test.js';

if (!ciScript.includes(requiredLine)) {
  console.error('FAILED: ci/run_tests.sh missing ' + requiredLine);
  process.exit(1);
}

console.log('PASSED: ci/run_tests.sh includes ' + requiredLine);
