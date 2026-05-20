#!/usr/bin/env node
// solo-pipeline-yandex-vk#1-followup F3 — regression invariant:
// If a helper named `get*` / `apply*` / `compute*` / `on*` is exported via the
// `var api = { ... }` block of `src/systems/talents/talentsV2.js`, then at
// least one of the public dispatchers (onHit, onWallDamage, onUpdate, onRepair,
// onShotFired, onKill, onShotReward, onWaveStart, onWaveEnd, onOverkill,
// onBuyTank, onPurchase, applyRepairCoupon, tickStatuses, renderStatusIcons,
// activateOffenseActive, activateDefenseActive, activateEconomyActive,
// clearRuntimeEffects) must be invoked from `game.js` or `src/**/*.js`.
//
// The audit motivated by `solo-pipeline-yandex-vk#1` discovered that helpers
// (`onWallDamage`, `applyRepairCoupon`) were exported but never reached from
// runtime — same pattern as the `tripleShotChance` bug. This check guards
// against that regression.
//
// Failure mode: any exported public dispatcher (matching the names list above)
// must have at least one callsite `<ident>.<dispatcherName>(` in the scanned
// runtime files. Otherwise the check exits 1.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TALENTS_FILE = path.join(ROOT, 'src', 'systems', 'talents', 'talentsV2.js');
const RUNTIME_FILES = [
  path.join(ROOT, 'game.js'),
];
// Plus every JS file under src/ (excluding talentsV2.js itself).
function collectSrcJs(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSrcJs(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.js') && full !== TALENTS_FILE) {
      out.push(full);
    }
  }
}
collectSrcJs(path.join(ROOT, 'src'), RUNTIME_FILES);

// Dispatcher names that, if exported from talentsV2.js, MUST be called from
// runtime. Helpers that are only consumed internally by these dispatchers do
// NOT need a direct callsite (the dispatcher is the contract surface).
const DISPATCHER_NAMES = new Set([
  'onHit',
  'onWallDamage',
  'onUpdate',
  'onRepair',
  'onShotFired',
  'onKill',
  'onShotReward',
  'onWaveStart',
  'onWaveEnd',
  'onOverkill',
  'onBuyTank',
  'onPurchase',
  'onZombieNearWall',
  'applyRepairCoupon',
  'tickStatuses',
  'renderStatusIcons',
  'activateOffenseActive',
  'activateDefenseActive',
  'activateEconomyActive',
  'clearRuntimeEffects',
]);

// Known-unwired dispatchers — pre-existing backlog from
// `solo-pipeline-yandex-vk#1` audit (26 BROKEN_OR_UNCERTAIN talents). These
// are tracked as F2 follow-up scope, not regressions. Each entry below
// represents a talent family that needs manual wire-up in a future batch.
// If a wire-up lands later, REMOVE the name from this allow-list so the
// invariant locks the new callsite forever.
//
// DO NOT add new names here without an issue / batch reference.
//
// solo-pipeline-yandex-vk#1-followup-2 progress:
//   - onKill: wired @ game.js zombie death FX site (state.coins += _killCoins)
//   - onBuyTank: wired @ game.js performTankPurchaseOnce after hangar check
//   - getFenceSegmentMaxHp now reads wallHpMul (def_wall_hp)
//   - tryRepairFenceSegmentAt now reads repairCostMul + repairEfficiencyMul
//   - Remaining unwired dispatchers below are deferred to a follow-up batch.
const ALLOWED_UNWIRED_TODO = new Set([
  'onShotReward',      // eco_coins_shot_bonus event path — TODO follow-up
  // followup-3: onWaveStart, onWaveEnd, onOverkill, onPurchase — WIRED in game.js
  //   (beginNoRepairAttackWaveEpisode, finalizeNoRepairAttackWaveEpisode,
  //    applyDamageToZombie, applyCannonUpgrade/applyFenceUpgrade/applyDronUpgrade/tryUpgradeFenceLevel).
  'onRepair',          // legacy full onRepair path is INTENTIONAL skip — canonical wire goes via applyRepairCoupon (followup#1) + direct repairCostMul/repairEfficiencyMul reads (followup#2); see user constraint #1.
  'onZombieNearWall',  // def_slow_field proximity event — TODO (def_slow_field core wired via onUpdate; proximity-event variant deferred)
]);

if (!fs.existsSync(TALENTS_FILE)) {
  console.error('[check_talent_helpers] talentsV2.js not found at', TALENTS_FILE);
  process.exit(2);
}

const talentsSrc = fs.readFileSync(TALENTS_FILE, 'utf8');

// Find the `var api = {` ... `}` block and extract exported keys.
const apiMatch = talentsSrc.match(/var\s+api\s*=\s*\{([\s\S]*?)\n\s*\};/);
if (!apiMatch) {
  console.error('[check_talent_helpers] Could not locate `var api = {...};` block in talentsV2.js');
  process.exit(2);
}
const apiBlock = apiMatch[1];
const exportedNames = new Set();
const keyRegex = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm;
let km;
while ((km = keyRegex.exec(apiBlock)) !== null) {
  exportedNames.add(km[1]);
}

// Of exported names, the ones we require runtime callsites for:
const required = [...exportedNames].filter((n) => DISPATCHER_NAMES.has(n));

// Build a search corpus from runtime files.
const runtimeBlobs = [];
for (const f of RUNTIME_FILES) {
  if (!fs.existsSync(f)) continue;
  runtimeBlobs.push({ file: f, src: fs.readFileSync(f, 'utf8') });
}

const violations = [];
const allowedHits = [];
for (const name of required) {
  // Pattern: <something>.<name>(  — must be a method-call form on any identifier.
  const re = new RegExp('\\.\\s*' + name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '\\s*\\(');
  let found = false;
  for (const blob of runtimeBlobs) {
    if (re.test(blob.src)) { found = true; break; }
  }
  if (!found) {
    if (ALLOWED_UNWIRED_TODO.has(name)) {
      allowedHits.push(name);
    } else {
      violations.push(name);
    }
  } else if (ALLOWED_UNWIRED_TODO.has(name)) {
    // Wire-up landed — invariant must be tightened. Force-fail with a hint.
    console.error('[check_talent_helpers] FAIL — dispatcher `' + name + '` is now wired in runtime; remove it from ALLOWED_UNWIRED_TODO to lock the invariant.');
    process.exit(1);
  }
}

if (violations.length > 0) {
  console.error('[check_talent_helpers] FAIL — exported TalentsV2 dispatcher(s) declared but never invoked from runtime:');
  for (const v of violations) console.error('  -', v);
  console.error('');
  console.error('Each exported dispatcher above must be called from game.js or src/**/*.js via `<api>.<name>(...)`. Same pattern as the multishot regression fixed in solo-pipeline-yandex-vk#1: an exported helper that runtime never reaches.');
  process.exit(1);
}

if (allowedHits.length > 0) {
  console.warn('[check_talent_helpers] WARN —', allowedHits.length, 'dispatcher(s) still in ALLOWED_UNWIRED_TODO backlog (F2 follow-up):', allowedHits.join(', '));
}
console.log('[check_talent_helpers] OK —', required.length - allowedHits.length, 'wired,', allowedHits.length, 'TODO-allow-listed,', required.length, 'total exported dispatchers checked.');
process.exit(0);
