/* Smoke test for Storage Worker I/II/III achievements (batch2). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { console };
sandbox.global = sandbox;
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.Math = Math;
sandbox.Number = Number;
sandbox.Array = Array;
sandbox.Object = Object;
sandbox.JSON = JSON;
sandbox.Date = Date;
vm.createContext(sandbox);

function load(rel) {
  const code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  vm.runInContext(code, sandbox, { filename: rel });
}

// Stub Game.AchievementRewards.grant minimally — actual rewards module needs hangarChipsUI etc.
// We'll provide a stub before achievements.js loads (recalculateUnlocks calls grantSelfManagedReward).
load('src/mechanics/achievementRewards.js');
load('src/mechanics/achievements.js');

const Ach = sandbox.Game.Achievements;
if (!Ach) throw new Error('Game.Achievements not exported');
if (typeof Ach.recordProductionStorageSnapshot !== 'function') throw new Error('recordProductionStorageSnapshot missing');

const REWARD = sandbox.Game.AchievementRewards.REWARD_TABLE;
['storageWorker1Chips3Drone1L3','storageWorker2Chips5Drone2L4','storageWorker3Upgrade5Chips10']
  .forEach(k => { if (!REWARD[k]) throw new Error('missing REWARD_TABLE entry: '+k); });

const defs = Ach.getDefinitions();
const sw = defs.filter(d => d.familyId === 'storage_worker');
if (sw.length !== 3) throw new Error('Expected 3 storage_worker defs, got '+sw.length);
const byId = Object.fromEntries(sw.map(d => [d.id, d]));
['storage_worker_1','storage_worker_2','storage_worker_3'].forEach(id => {
  if (!byId[id]) throw new Error('missing def: '+id);
  if (byId[id].progressType !== 'productionStorageSnapshot') throw new Error('wrong progressType: '+id);
});
if (byId.storage_worker_1.target !== 9) throw new Error('SW1 target');
if (byId.storage_worker_2.target !== 6 || byId.storage_worker_2.progressLevel !== 2) throw new Error('SW2 target/level');
if (byId.storage_worker_3.target !== 3 || byId.storage_worker_3.progressLevel !== 4) throw new Error('SW3 target/level');

// State with 9 level-1 boxes → SW1 unlocks
const state = { productionLine: { storage: [] }, achievements: {}, stats: {} };
for (let i = 0; i < 9; i++) state.productionLine.storage.push({ level: 1 });
Ach.recordProductionStorageSnapshot(state);
const s = state.achievements;
if (!s.unlocked.storage_worker_1) throw new Error('SW1 not unlocked at peak=9');
if (s.unlocked.storage_worker_2) throw new Error('SW2 must NOT unlock with level1 only');
if (s.counters.productionStorageSnapshot.total !== 9) throw new Error('total counter');

// Now drain to 0, verify peak holds (monotonic)
state.productionLine.storage = [];
Ach.recordProductionStorageSnapshot(state);
if (s.counters.productionStorageSnapshot.total !== 9) throw new Error('peak monotonic broken');

// Replace storage with 6 level-2 boxes → SW2 unlocks
state.productionLine.storage = [];
for (let i = 0; i < 6; i++) state.productionLine.storage.push({ level: 2 });
Ach.recordProductionStorageSnapshot(state);
if (!s.unlocked.storage_worker_2) throw new Error('SW2 not unlocked at peak=6 lvl>=2');
if (s.unlocked.storage_worker_3) throw new Error('SW3 must NOT unlock with level2 only');

// Replace storage with 3 level-4 boxes → SW3 unlocks
state.productionLine.storage = [];
for (let i = 0; i < 3; i++) state.productionLine.storage.push({ level: 4 });
Ach.recordProductionStorageSnapshot(state);
if (!s.unlocked.storage_worker_3) throw new Error('SW3 not unlocked at peak=3 lvl>=4');

// getProgressValue with def passes progressLevel filter
const v1 = Ach.getProgressValue(state, 'productionStorageSnapshot', byId.storage_worker_1);
const v2 = Ach.getProgressValue(state, 'productionStorageSnapshot', byId.storage_worker_2);
const v3 = Ach.getProgressValue(state, 'productionStorageSnapshot', byId.storage_worker_3);
if (v1 < 9) throw new Error('progress total wrong: '+v1);
if (v2 < 6) throw new Error('progress lvl2 wrong: '+v2);
if (v3 < 3) throw new Error('progress lvl4 wrong: '+v3);

// i18n keys exist in both locales
const ru = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src/i18n/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src/i18n/en.json'), 'utf8'));
['achievementStorageWorker1','achievementStorageWorker2','achievementStorageWorker3',
 'achievementStorageWorker1Desc','achievementStorageWorker2Desc','achievementStorageWorker3Desc',
 'achievementRewardStorageWorker1','achievementRewardStorageWorker2','achievementRewardStorageWorker3']
  .forEach(k => {
    if (!ru[k]) throw new Error('ru.json missing '+k);
    if (!en[k]) throw new Error('en.json missing '+k);
  });

console.log('OK: storage_worker smoke test passed');
console.log('counters:', JSON.stringify(s.counters.productionStorageSnapshot));
console.log('unlocked:', Object.keys(s.unlocked).filter(k => k.startsWith('storage_worker')));
