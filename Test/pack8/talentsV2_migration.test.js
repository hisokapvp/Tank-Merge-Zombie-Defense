/**
 * Pack 8: Talents v1 -> v2 migration tests.
 * Run: node Test/pack8/talentsV2_migration.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

async function test(name, fn) {
  try {
    await fn();
    passCount++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failCount++;
    failures.push({ name, error: e && e.message ? e.message : String(e) });
    console.log('  ✗ ' + name + ' — ' + (e && e.message ? e.message : String(e)));
  }
}

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TREE = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../..', 'assets/balance/talentTree_v2.json'), 'utf8'));
const TALENTS_CODE = fs.readFileSync(path.resolve(__dirname, '../..', 'src/systems/talents/talentsV2.js'), 'utf8');

const LEGACY_INDEX = {
  'Калибр': 0,
  'Разгон урона': 11,
  'Огневой поток': 14,
  'Премия за убийство': 37,
};

function buildAppliedRanks(ranksByName) {
  const out = Array(51).fill(0);
  const names = Object.keys(ranksByName || {});
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (!Object.prototype.hasOwnProperty.call(LEGACY_INDEX, name)) continue;
    out[LEGACY_INDEX[name]] = ranksByName[name];
  }
  return out;
}

function createApiAndInit(saveRoot) {
  const sandbox = {
    window: { location: { protocol: 'file:', hostname: 'localhost', search: '' }, Game: {} },
    fetch: null,
    console,
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(TALENTS_CODE, sandbox);
  const api = sandbox.window.Game.TalentsV2;

  let saveCalls = 0;
  return api.init({
    loadSaveFn: function () { return saveRoot; },
    saveFn: function (patch) {
      saveCalls++;
      const next = patch && typeof patch === 'object' ? patch : {};
      saveRoot.player = saveRoot.player && typeof saveRoot.player === 'object' ? saveRoot.player : {};
      saveRoot.talentsVersion = next.talentsVersion;
      saveRoot.talentsV2 = next.talentsV2;
      saveRoot.freeTalentPointsV2 = next.freeTalentPointsV2;
      saveRoot.player.talentsVersion = next.talentsVersion;
      saveRoot.player.talentsV2 = next.talentsV2;
      saveRoot.player.freeTalentPointsV2 = next.freeTalentPointsV2;
    },
    assetLoader: function () { return TREE; },
    nowMsFn: function () { return 0; },
  }).then(function () {
    return { api, saveCallsRef: function () { return saveCalls; } };
  });
}

console.log('\n── Pack 8: Talents v1 -> v2 migration ──');

(async function run() {
  await test('P8-M1: legacy save without talentsVersion migrates and sets version=2', async function () {
    const save = {
      profileId: 'legacy-player',
      player: {
        talentPoints: 2,
        talentsApplied: buildAppliedRanks({
          'Калибр': 3,
          'Огневой поток': 4,
          'Разгон урона': 4,
        }),
      },
    };

    const { api, saveCallsRef } = await createApiAndInit(save);
    const ranks = api.getRanks();

    assertEqual(save.player.talentsVersion, 2, 'player.talentsVersion migrated to 2');
    assertEqual(save.talentsVersion, 2, 'root talentsVersion migrated to 2');
    assertEqual(ranks.off_caliber, 5, 'duplicate mapped ranks are clamped by maxRank');
    assertEqual(api.getFreePoints(), 4, 'unknown legacy rank refunded into free points');
    assertEqual(save.profileId, 'legacy-player', 'non-talent save fields are preserved');
    assert(saveCallsRef() >= 1, 'migration is persisted immediately');
  });

  await test('P8-M2: unknown legacy named talents do not crash and are refunded', async function () {
    const save = {
      player: {
        talentPoints: 1,
        talentsV1: [
          { name: 'Несуществующий талант', rank: 3, bought: true },
        ],
      },
    };

    const { api } = await createApiAndInit(save);
    const ranks = api.getRanks();

    assertEqual(Object.keys(ranks).length, 0, 'unknown name does not create mapped ranks');
    assertEqual(api.getFreePoints(), 4, 'unknown talent rank is refunded');
    assertEqual(save.player.talentsVersion, 2, 'migration marks save as v2');
  });

  await test('P8-M3: ensureMinRank for "Премия за убийство" gives rank >= 3', async function () {
    const save = {
      player: {
        talentsByName: {
          'Премия за убийство': true,
        },
      },
    };

    const { api } = await createApiAndInit(save);
    const ranks = api.getRanks();

    assert((ranks.eco_coins_kill_bonus || 0) >= 3, 'eco_coins_kill_bonus rank is at least 3');
  });

  await test('P8-M4: migration is idempotent when talentsVersion=2', async function () {
    const save = {
      player: {
        talentsVersion: 2,
        talentsV2: {
          ranksById: { off_caliber: 2, eco_xp_bonus: 1 },
          freePoints: 7,
        },
        freeTalentPointsV2: 7,
      },
    };

    const { api, saveCallsRef } = await createApiAndInit(save);
    const ranks = api.getRanks();

    assertEqual(ranks.off_caliber, 2, 'existing v2 ranks remain unchanged');
    assertEqual(ranks.eco_xp_bonus, 1, 'existing v2 ranks remain unchanged (2)');
    assertEqual(api.getFreePoints(), 7, 'existing free points remain unchanged');
    assertEqual(saveCallsRef(), 0, 'no migration save call for v2 payload');
  });

  await test('P8-M5: fail-soft rank parsing uses rank=1 when name exists and rank invalid', async function () {
    const save = {
      player: {
        talentsV1: [
          { name: 'Калибр', rank: 'NaN-rank-value' },
        ],
      },
    };

    const { api } = await createApiAndInit(save);
    const ranks = api.getRanks();

    assertEqual(ranks.off_caliber, 1, 'invalid rank is normalized to 1 for known name');
  });

  console.log('\n═══════════════════════════');
  console.log('Pack8 TalentsMigration: ' + passCount + ' passed, ' + failCount + ' failed');
  if (failures.length) {
    failures.forEach(function (f) {
      console.log('  - ' + f.name + ': ' + f.error);
    });
  }
  console.log('═══════════════════════════\n');
  process.exit(failCount > 0 ? 1 : 0);
})();
