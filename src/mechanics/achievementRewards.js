(function (global) {
  'use strict';

  var DAMAGE_PROGRESS_PER_POINT = 10000;

  function normalizeCounter(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)));
  }

  function normalizeDamageProgress(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
  }

  function getAchievementsApi() {
    return global.Game && global.Game.Achievements ? global.Game.Achievements : null;
  }

  function ensureRewardedState(state) {
    if (!state || typeof state !== 'object') return null;
    if (!state.achievements || typeof state.achievements !== 'object') {
      state.achievements = {};
    }
    if (!state.achievements.rewarded || typeof state.achievements.rewarded !== 'object') {
      state.achievements.rewarded = {};
    }
    return state.achievements.rewarded;
  }

  function hasRewardGranted(state, achievementId) {
    if (!state || typeof achievementId !== 'string' || !achievementId) return false;
    var achievementsApi = getAchievementsApi();
    if (achievementsApi && typeof achievementsApi.hasRewardGranted === 'function') {
      return !!achievementsApi.hasRewardGranted(state, achievementId);
    }
    var rewarded = ensureRewardedState(state);
    return !!(rewarded && rewarded[achievementId]);
  }

  function markRewardGranted(state, achievementId) {
    if (!state || typeof achievementId !== 'string' || !achievementId) return false;
    var achievementsApi = getAchievementsApi();
    var metadata = arguments.length > 2 ? arguments[2] : null;
    if (achievementsApi && typeof achievementsApi.markRewardGranted === 'function') {
      return !!achievementsApi.markRewardGranted(state, achievementId, metadata);
    }
    var rewarded = ensureRewardedState(state);
    if (!rewarded) return false;
    rewarded[achievementId] = true;
    if (achievementsApi && typeof achievementsApi.appendRewardHistory === 'function') {
      achievementsApi.appendRewardHistory(state, achievementId, metadata || null);
    }
    return true;
  }

  function getHangarChipsUi() {
    return global.Game && global.Game.HangarChipsUI ? global.Game.HangarChipsUI : null;
  }

  function getRandomAchievementFragmentId(randomFn) {
    var pick = typeof randomFn === 'function' ? randomFn : Math.random;
    return Math.floor(pick() * 14) + 1;
  }

  function getRandomAchievementChipDef(randomFn) {
    var pick = typeof randomFn === 'function' ? randomFn : Math.random;
    var hangarChips = global.Game && global.Game.HangarChips ? global.Game.HangarChips : null;
    var pool = hangarChips && Array.isArray(hangarChips.allChips) ? hangarChips.allChips : null;
    if (!pool || pool.length <= 0) return null;
    return pool[Math.floor(pick() * pool.length)] || null;
  }

  function grantAchievementRandomChips(count, randomFn) {
    var chipsUi = getHangarChipsUi();
    var total = normalizeCounter(count);
    if (!chipsUi || typeof chipsUi.addPlayerChip !== 'function' || total <= 0) return false;
    for (var i = 0; i < total; i++) {
      var chipDef = getRandomAchievementChipDef(randomFn);
      if (!chipDef) return false;
      chipsUi.addPlayerChip(chipDef, 1);
    }
    return true;
  }

  function grantAchievementRandomFragments(count, randomFn) {
    var chipsUi = getHangarChipsUi();
    var total = normalizeCounter(count);
    if (!chipsUi || typeof chipsUi.addPlayerFragment !== 'function' || total <= 0) return false;
    for (var i = 0; i < total; i++) {
      chipsUi.addPlayerFragment(getRandomAchievementFragmentId(randomFn), 1);
    }
    return true;
  }

  function grantAchievementDust(amount) {
    var chipsUi = getHangarChipsUi();
    var total = normalizeCounter(amount);
    if (!chipsUi || typeof chipsUi.getSiliconDust !== 'function' || typeof chipsUi.setSiliconDust !== 'function' || total <= 0) {
      return false;
    }
    var currentDust = normalizeCounter(chipsUi.getSiliconDust());
    chipsUi.setSiliconDust(currentDust + total);
    return true;
  }

  function grantAchievementUpgradePoints(state, count) {
    var total = normalizeCounter(count);
    if (!state || total <= 0) return false;
    if (!state.player || typeof state.player !== 'object') state.player = {};
    if (!state.player.talentsV2 || typeof state.player.talentsV2 !== 'object') {
      state.player.talentsV2 = { ranksById: {}, freePoints: 0 };
    }
    state.player.talentsV2.freePoints = normalizeCounter(state.player.talentsV2.freePoints + total);
    state.player.freeTalentPointsV2 = state.player.talentsV2.freePoints;
    var tv2 = global.Game && global.Game.TalentsV2;
    if (tv2 && typeof tv2.setFreePoints === 'function') {
      tv2.setFreePoints(state.player.talentsV2.freePoints);
    }
    return true;
  }

  function grantAchievementDamageProgress(state, amount) {
    var total = normalizeDamageProgress(amount);
    if (!state || total <= 0) return false;
    if (!state.player || typeof state.player !== 'object') state.player = {};
    var spentPoints = normalizeCounter(state.damagePointsSpent);
    var currentProgress = normalizeDamageProgress(state.totalDamageDealtRaw);
    var remainder = currentProgress % DAMAGE_PROGRESS_PER_POINT;
    var totalDamagePoints = Math.floor(currentProgress / DAMAGE_PROGRESS_PER_POINT);
    totalDamagePoints += Math.floor(total / DAMAGE_PROGRESS_PER_POINT);
    state.totalDamageDealtRaw = totalDamagePoints * DAMAGE_PROGRESS_PER_POINT + remainder + (total % DAMAGE_PROGRESS_PER_POINT);
    state.player.damagePoints = Math.max(0, Math.floor(state.totalDamageDealtRaw / DAMAGE_PROGRESS_PER_POINT) - spentPoints);
    return true;
  }

  function grantAchievementDamagePoints(state, count) {
    var total = normalizeCounter(count);
    if (total <= 0) return false;
    return grantAchievementDamageProgress(state, total * DAMAGE_PROGRESS_PER_POINT);
  }

  /* ── Canonical reward mode → granter lookup table ─────── */
  var REWARD_TABLE = {
    /* chip_crafting family */
    chipCombinatorUpgrade1Dust50: { type: 'composite', items: [{ type: 'upgradePoints', amount: 1 }, { type: 'dust', amount: 50 }], i18nKey: 'achievementRewardChipCombinatorUpgrade1Dust50' },
    chipCreatorDust10:            { type: 'dust', amount: 10, i18nKey: 'achievementRewardChipCreatorDust10' },
    /* power_reserve family */
    powerReserveDust15Fragments3:  { type: 'composite', items: [{ type: 'dust', amount: 15 }, { type: 'fragments', amount: 3 }], i18nKey: 'achievementRewardPowerReserve1' },
    powerReserveRandomChips3Upgrade1: { type: 'composite', items: [{ type: 'randomChips', amount: 3 }, { type: 'upgradePoints', amount: 1 }], i18nKey: 'achievementRewardPowerReserve2' },
    powerReserveUpgrade3Damage100000: { type: 'composite', items: [{ type: 'upgradePoints', amount: 3 }, { type: 'damagePoints', amount: 100000 }], i18nKey: 'achievementRewardPowerReserve3' },
    /* fence_mechanic family */
    fenceMechanicCoins75:        { type: 'coins',          amount: 75,    i18nKey: 'achievementRewardFenceMechanicCoins75' },
    fenceMechanicDust5:          { type: 'dust',           amount: 5,     i18nKey: 'achievementRewardFenceMechanicDust5' },
    fenceMechanicFragment1:      { type: 'fragments',      amount: 1,     i18nKey: 'achievementRewardFenceMechanicFragment1' },
    fenceMechanicRandomChips2:   { type: 'randomChips',    amount: 2,     i18nKey: 'achievementRewardFenceMechanicChips2' },
    fenceMechanicUpgradePoint1:  { type: 'upgradePoints',  amount: 1,     i18nKey: 'achievementRewardFenceMechanicUpgradePoint1' },
    /* duty_shift family */
    dutyShiftUpgradePoint1:      { type: 'upgradePoints',  amount: 1,     i18nKey: 'achievementRewardDutyShiftUpgradePoint1' },
    dutyShiftDamage20000:        { type: 'damagePoints',   amount: 20000, i18nKey: 'achievementRewardDutyShiftDamage20000' },
    dutyShiftUpgradePoints2:     { type: 'upgradePoints',  amount: 2,     i18nKey: 'achievementRewardDutyShiftUpgradePoints2' },
    /* drone_brigadier family */
    droneBrigadierDrones2L2:     { type: 'drones',         amount: 2, level: 2, i18nKey: 'achievementRewardDroneBrigadier1' },
    droneBrigadierDrones3L5Upgrade3: { type: 'composite', items: [{ type: 'drones', amount: 3, level: 5 }, { type: 'upgradePoints', amount: 3 }], i18nKey: 'achievementRewardDroneBrigadier2' },
    /* optimizer family */
    optimizerUpgrade2Drones2L2:  { type: 'composite', items: [{ type: 'upgradePoints', amount: 2 }, { type: 'drones', amount: 2, level: 2 }], i18nKey: 'achievementRewardOptimizer1' },
    optimizerChips10Damage100000:{ type: 'composite', items: [{ type: 'randomChips', amount: 10 }, { type: 'damagePoints', amount: 100000 }], i18nKey: 'achievementRewardOptimizer2' },
    optimizerUpgrade5Drones3L5:  { type: 'composite', items: [{ type: 'upgradePoints', amount: 5 }, { type: 'drones', amount: 3, level: 5 }], i18nKey: 'achievementRewardOptimizer3' },
    /* track_cleanup family */
    trackCleanupDamagePoints50:  { type: 'damagePoints',   amount: 50,    i18nKey: 'achievementRewardTrackCleanupDamagePoints50' },
    trackCleanupFragments2:      { type: 'fragments',      amount: 2,     i18nKey: 'achievementRewardTrackCleanupFragments2' },
    trackCleanupUpgradePoint1:   { type: 'upgradePoints',  amount: 1,     i18nKey: 'achievementRewardTrackCleanupUpgradePoint1' },
    trackCleanupRandomChips5:    { type: 'randomChips',    amount: 5,     i18nKey: 'achievementRewardTrackCleanupChips5' },
    trackCleanupUpgradePoints3:  { type: 'upgradePoints',  amount: 3,     i18nKey: 'achievementRewardTrackCleanupUpgradePoints3' },
    /* new_technology family (self-managed in achievements.js) */
    newTechnologyFragments2:     { type: 'fragments',      amount: 2,     i18nKey: 'achievementRewardNewTechnologyFragments2' },
    newTechnologyDust20:         { type: 'dust',           amount: 20,    i18nKey: 'achievementRewardNewTechnologyDust20' },
    newTechnologyRandomChips2:   { type: 'randomChips',    amount: 2,     i18nKey: 'achievementRewardNewTechnologyChips2' },
    newTechnologyUpgradePoints3: { type: 'upgradePoints',  amount: 3,     i18nKey: 'achievementRewardNewTechnologyUpgradePoints3' },
    /* creator family (autoMerge — granted via game.js UI wiring, not granter functions) */
    buy2:                        { type: 'autoMerge',      amount: 2,     i18nKey: 'achievementRewardCreate2' },
    buy5:                        { type: 'autoMerge',      amount: 5,     i18nKey: 'achievementRewardCreate5' },
    buyMax:                      { type: 'autoMerge',      amount: 0,     i18nKey: 'achievementRewardCreateMax' },
    autoMergeBasic:              { type: 'autoMerge',      amount: 0,     i18nKey: 'achievementRewardAutoMergeBasic' },
    autoMergeAdvanced:           { type: 'autoMerge',      amount: 0,     i18nKey: 'achievementRewardAutoMergeAdvanced' },
    autoMergeExpert:             { type: 'autoMerge',      amount: 0,     i18nKey: 'achievementRewardAutoMergeExpert' },
    /* stable_income family */
    stableIncomeDamage100:       { type: 'damagePoints',   amount: 100,     i18nKey: 'achievementRewardStableIncomeDamage100' },
    stableIncomeDamage1000:      { type: 'damagePoints',   amount: 1000,    i18nKey: 'achievementRewardStableIncomeDamage1000' },
    stableIncomeDamage5000:      { type: 'damagePoints',   amount: 5000,    i18nKey: 'achievementRewardStableIncomeDamage5000' },
    stableIncomeDamage20000:     { type: 'damagePoints',   amount: 20000,   i18nKey: 'achievementRewardStableIncomeDamage20000' },
    stableIncomeDamage100000:    { type: 'damagePoints',   amount: 100000,  i18nKey: 'achievementRewardStableIncomeDamage100000' },
    stableIncomeDamage500M:      { type: 'damagePoints',   amount: 500000000, i18nKey: 'achievementRewardStableIncomeDamage500M' },
    stableIncomeUpgradePoints10: { type: 'upgradePoints',  amount: 10,      i18nKey: 'achievementRewardStableIncomeUpgradePoints10' },
    /* early_capital family */
    earlyCapitalFragments2:        { type: 'fragments',     amount: 2,       i18nKey: 'achievementRewardEarlyCapitalFragments2' },
    earlyCapitalChips2:            { type: 'randomChips',   amount: 2,       i18nKey: 'achievementRewardEarlyCapitalChips2' },
    earlyCapitalDamage10000:       { type: 'damagePoints',  amount: 10000,   i18nKey: 'achievementRewardEarlyCapitalDamage10000' },
    earlyCapitalFragments20:       { type: 'fragments',     amount: 20,      i18nKey: 'achievementRewardEarlyCapitalFragments20' },
    earlyCapitalUpgrade3Drones5L2: { type: 'composite', items: [{ type: 'upgradePoints', amount: 3 }, { type: 'drones', amount: 5, level: 2 }], i18nKey: 'achievementRewardEarlyCapitalUpgrade3Drones5L2' },
    /* tough_perimeter family */
    toughPerimeterUpgradePoint1: { type: 'upgradePoints',  amount: 1,       i18nKey: 'achievementRewardToughPerimeterUpgradePoint1' },
    /* hangar_master family (composite rewards) */
    hangarMasterFragmentDust10:     { type: 'composite', items: [{ type: 'fragments', amount: 1 }, { type: 'dust', amount: 10 }], i18nKey: 'achievementRewardHangarMaster1' },
    hangarMasterChips2Damage5000:   { type: 'composite', items: [{ type: 'randomChips', amount: 2 }, { type: 'damagePoints', amount: 5000 }], i18nKey: 'achievementRewardHangarMaster2' },
    hangarMasterUpgradeDrone1:      { type: 'composite', items: [{ type: 'upgradePoints', amount: 1 }, { type: 'drones', amount: 1, level: 1 }], i18nKey: 'achievementRewardHangarMaster3' },
    hangarMasterDamage50000Chips5:  { type: 'composite', items: [{ type: 'damagePoints', amount: 50000 }, { type: 'randomChips', amount: 5 }], i18nKey: 'achievementRewardHangarMaster4' },
    hangarMasterUpgrade3Drones2L5:  { type: 'composite', items: [{ type: 'upgradePoints', amount: 3 }, { type: 'drones', amount: 2, level: 5 }], i18nKey: 'achievementRewardHangarMaster5' },
    /* defense_order family */
    defenseOrderFragments2:         { type: 'fragments',      amount: 2,       i18nKey: 'achievementRewardDefenseOrder1' },
    defenseOrderChips2:             { type: 'randomChips',    amount: 2,       i18nKey: 'achievementRewardDefenseOrder2' },
    defenseOrderUpgrade1Drone1L1:   { type: 'composite', items: [{ type: 'upgradePoints', amount: 1 }, { type: 'drones', amount: 1, level: 1 }], i18nKey: 'achievementRewardDefenseOrder3' },
    defenseOrderUpgrade3Drones3L3:  { type: 'composite', items: [{ type: 'upgradePoints', amount: 3 }, { type: 'drones', amount: 3, level: 3 }], i18nKey: 'achievementRewardDefenseOrder4' },
    defenseOrderUpgrade5Chips15:    { type: 'composite', items: [{ type: 'upgradePoints', amount: 5 }, { type: 'randomChips', amount: 15 }], i18nKey: 'achievementRewardDefenseOrder5' },
    /* first_elite family */
    firstEliteDamage500:            { type: 'damagePoints',   amount: 500,     i18nKey: 'achievementRewardFirstElite1' },
    firstEliteUpgradePoint1:        { type: 'upgradePoints',  amount: 1,       i18nKey: 'achievementRewardFirstElite2' },
    firstEliteDamage5000Chips2:     { type: 'composite', items: [{ type: 'damagePoints', amount: 5000 }, { type: 'randomChips', amount: 2 }], i18nKey: 'achievementRewardFirstElite3' },
    firstEliteUpgrade2Drone1L3:     { type: 'composite', items: [{ type: 'upgradePoints', amount: 2 }, { type: 'drones', amount: 1, level: 3 }], i18nKey: 'achievementRewardFirstElite4' },
    firstEliteUpgrade3Drones2L5:    { type: 'composite', items: [{ type: 'upgradePoints', amount: 3 }, { type: 'drones', amount: 2, level: 5 }], i18nKey: 'achievementRewardFirstElite5' },
    firstEliteUpgrade5Damage50000:  { type: 'composite', items: [{ type: 'upgradePoints', amount: 5 }, { type: 'damagePoints', amount: 50000 }], i18nKey: 'achievementRewardFirstElite6' },
  };

  var ATOMIC_REWARD_MODES = {
    chipCombinatorUpgrade1Dust50: true,
    chipCreatorDust10: true,
    powerReserveDust15Fragments3: true,
    powerReserveRandomChips3Upgrade1: true,
    powerReserveUpgrade3Damage100000: true,
    droneBrigadierDrones2L2: true,
    droneBrigadierDrones3L5Upgrade3: true,
    optimizerUpgrade2Drones2L2: true,
    optimizerChips10Damage100000: true,
    optimizerUpgrade5Drones3L5: true,
  };

  function cloneSerializable(value) {
    if (value === null || typeof value !== 'object') return value;
    return JSON.parse(JSON.stringify(value));
  }

  function createAtomicSnapshot(state) {
    var chipsUi = getHangarChipsUi();
    var snapshot = {
      coins: normalizeCounter(state && state.coins),
      totalDamageDealtRaw: normalizeDamageProgress(state && state.totalDamageDealtRaw),
      damagePointsSpent: normalizeCounter(state && state.damagePointsSpent),
      playerDamagePoints: normalizeCounter(state && state.player && state.player.damagePoints),
      freePoints: normalizeCounter(state && state.player && state.player.talentsV2 && state.player.talentsV2.freePoints),
      freePointsMirror: normalizeCounter(state && state.player && state.player.freeTalentPointsV2),
      rewarded: cloneSerializable(state && state.achievements && state.achievements.rewarded),
      rewardHistory: cloneSerializable(state && state.achievements && state.achievements.rewardHistory),
      siliconDust: chipsUi && typeof chipsUi.getSiliconDust === 'function' ? normalizeCounter(chipsUi.getSiliconDust()) : null,
      playerFragments: chipsUi && typeof chipsUi.getPlayerFragments === 'function' ? cloneSerializable(chipsUi.getPlayerFragments()) : null,
      playerChips: chipsUi && typeof chipsUi.getPlayerChips === 'function' ? cloneSerializable(chipsUi.getPlayerChips()) : null,
    };
    return snapshot;
  }

  function restoreAtomicSnapshot(state, snapshot) {
    if (!state || !snapshot || typeof snapshot !== 'object') return;
    state.coins = snapshot.coins;
    state.totalDamageDealtRaw = snapshot.totalDamageDealtRaw;
    state.damagePointsSpent = snapshot.damagePointsSpent;
    if (!state.player || typeof state.player !== 'object') state.player = {};
    state.player.damagePoints = snapshot.playerDamagePoints;
    if (!state.player.talentsV2 || typeof state.player.talentsV2 !== 'object') {
      state.player.talentsV2 = { ranksById: {}, freePoints: 0 };
    }
    state.player.talentsV2.freePoints = snapshot.freePoints;
    state.player.freeTalentPointsV2 = snapshot.freePointsMirror;

    if (!state.achievements || typeof state.achievements !== 'object') state.achievements = {};
    state.achievements.rewarded = snapshot.rewarded && typeof snapshot.rewarded === 'object' ? snapshot.rewarded : {};
    state.achievements.rewardHistory = Array.isArray(snapshot.rewardHistory) ? snapshot.rewardHistory : [];

    var chipsUi = getHangarChipsUi();
    if (chipsUi && snapshot.siliconDust !== null && typeof chipsUi.setSiliconDust === 'function') {
      chipsUi.setSiliconDust(snapshot.siliconDust);
    }
    if (chipsUi && snapshot.playerFragments && typeof chipsUi.setPlayerFragments === 'function') {
      chipsUi.setPlayerFragments(snapshot.playerFragments);
    }
    if (chipsUi && snapshot.playerChips && typeof chipsUi.setPlayerChips === 'function') {
      chipsUi.setPlayerChips(snapshot.playerChips, { reason: 'achievement.rollback' });
    }

    var tv2 = global.Game && global.Game.TalentsV2;
    if (tv2 && typeof tv2.setFreePoints === 'function') {
      tv2.setFreePoints(state.player.talentsV2.freePoints);
    }
  }

  function grantAchievementDrones(count, level, state) {
    var addDronFn = global.Game && typeof global.Game._productionLineAddDron === 'function'
      ? global.Game._productionLineAddDron : null;
    var total = normalizeCounter(count);
    var droneLevel = normalizeCounter(level) || 1;
    if (total <= 0) return false;
    var placed = 0;
    for (var i = 0; i < total; i++) {
      var drone = addDronFn ? addDronFn(droneLevel) : null;
      if (drone) { placed++; continue; }
      /* Main drone slots full — try underground hangar */
      var UH = global.Game && global.Game.UndergroundHangar;
      if (UH && typeof UH.ensureStateShape === 'function' && state) {
        UH.ensureStateShape(state);
        var ugh = state.undergroundHangar;
        if (ugh && Array.isArray(ugh.cells)) {
          var freeIdx = null;
          for (var ci = 0; ci < ugh.cells.length; ci++) {
            var cell = ugh.cells[ci];
            if (cell && !cell.tank && !cell.drone) { freeIdx = ci; break; }
          }
          if (freeIdx !== null) {
            ugh.cells[freeIdx].drone = { level: droneLevel, mode: 'standby' };
            placed++;
            continue;
          }
        }
      }
      /* Both hangars full — defer reward */
      if (state) {
        if (!Array.isArray(state.achievements.deferredRewards)) {
          state.achievements.deferredRewards = [];
        }
        state.achievements.deferredRewards.push({ type: 'drones', amount: 1, level: droneLevel });
      }
    }
    return placed > 0 || (state && Array.isArray(state.achievements.deferredRewards) && state.achievements.deferredRewards.length > 0);
  }

  function grantSubItem(state, sub, randomFn) {
    if (!sub || typeof sub.type !== 'string') return false;
    if (sub.type === 'coins') { state.coins = normalizeCounter(state.coins) + sub.amount; return true; }
    if (sub.type === 'dust') return grantAchievementDust(sub.amount);
    if (sub.type === 'fragments') return grantAchievementRandomFragments(sub.amount, randomFn);
    if (sub.type === 'randomChips') return grantAchievementRandomChips(sub.amount, randomFn);
    if (sub.type === 'upgradePoints') return grantAchievementUpgradePoints(state, sub.amount);
    if (sub.type === 'damagePoints') return grantAchievementDamagePoints(state, sub.amount);
    if (sub.type === 'drones') return grantAchievementDrones(sub.amount, sub.level, state);
    return false;
  }

  function grantByTable(state, rewardMode, randomFn) {
    var entry = REWARD_TABLE[rewardMode];
    if (!entry) return false;
    if (entry.type === 'composite' && Array.isArray(entry.items)) {
      var allOk = true;
      for (var ci = 0; ci < entry.items.length; ci++) {
        if (!grantSubItem(state, entry.items[ci], randomFn)) allOk = false;
      }
      return allOk;
    }
    if (entry.type === 'coins') {
      state.coins = normalizeCounter(state.coins) + entry.amount;
      return true;
    }
    if (entry.type === 'dust') return grantAchievementDust(entry.amount);
    if (entry.type === 'fragments') return grantAchievementRandomFragments(entry.amount, randomFn);
    if (entry.type === 'randomChips') return grantAchievementRandomChips(entry.amount, randomFn);
    if (entry.type === 'upgradePoints') return grantAchievementUpgradePoints(state, entry.amount);
    if (entry.type === 'damagePoints') return grantAchievementDamagePoints(state, entry.amount);
    return false;
  }

  function grant(state, definition, options) {
    var def = definition && typeof definition === 'object' ? definition : null;
    if (!state || !def || typeof def.id !== 'string' || typeof def.rewardMode !== 'string') return false;
    if (hasRewardGranted(state, def.id)) return false;

    var opts = options && typeof options === 'object' ? options : null;
    var randomFn = opts && typeof opts.random === 'function' ? opts.random : Math.random;
    var useAtomicGrant = !!ATOMIC_REWARD_MODES[def.rewardMode];
    var snapshot = useAtomicGrant ? createAtomicSnapshot(state) : null;
    var granted = grantByTable(state, def.rewardMode, randomFn);

    if (!granted && useAtomicGrant) {
      restoreAtomicSnapshot(state, snapshot);
      return false;
    }

    if (!granted) return false;
    return markRewardGranted(state, def.id, {
      rewardMode: def.rewardMode,
      status: 'granted',
    });
  }

  function claimDeferredRewards(state) {
    if (!state || !state.achievements || !Array.isArray(state.achievements.deferredRewards)) return 0;
    var remaining = [];
    var claimed = 0;
    for (var i = 0; i < state.achievements.deferredRewards.length; i++) {
      var item = state.achievements.deferredRewards[i];
      if (!item || item.type !== 'drones') { remaining.push(item); continue; }
      var droneLevel = normalizeCounter(item.level) || 1;
      var addDronFn = global.Game && typeof global.Game._productionLineAddDron === 'function'
        ? global.Game._productionLineAddDron : null;
      var drone = addDronFn ? addDronFn(droneLevel) : null;
      if (drone) { claimed++; continue; }
      /* Try underground hangar */
      var UH = global.Game && global.Game.UndergroundHangar;
      if (UH && typeof UH.ensureStateShape === 'function') UH.ensureStateShape(state);
      var ugh = state.undergroundHangar;
      if (ugh && Array.isArray(ugh.cells)) {
        var freeIdx = null;
        for (var ci = 0; ci < ugh.cells.length; ci++) {
          var cell = ugh.cells[ci];
          if (cell && !cell.tank && !cell.drone) { freeIdx = ci; break; }
        }
        if (freeIdx !== null) {
          ugh.cells[freeIdx].drone = { level: droneLevel, mode: 'standby' };
          claimed++;
          continue;
        }
      }
      remaining.push(item);
    }
    state.achievements.deferredRewards = remaining;
    return claimed;
  }

  global.Game = global.Game || {};
  global.Game.AchievementRewards = {
    grant: grant,
    claimDeferredRewards: claimDeferredRewards,
    REWARD_TABLE: REWARD_TABLE,
  };
})(typeof window !== 'undefined' ? window : this);