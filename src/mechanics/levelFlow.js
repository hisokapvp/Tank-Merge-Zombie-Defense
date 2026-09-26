(function (global) {
  'use strict';

  var DAMAGE_PROGRESS_PER_POINT = 10000;
  var SUPERCOMPUTER_LEVEL_TWO_DAMAGE_POINTS_REWARD = 5;
  /* Порог альтернативного получения уровня по убийствам (kill-level).
     Осознанно НЕ совпадает с HUD-счётчиком state.kills: это отдельный
     per-level счётчик supercomputer.levelKills. */
  var DEFAULT_KILL_LEVEL_THRESHOLD = 500000;

  /* Bonus upgrade points for milestone levels */
  var LEVEL_BONUS_UPGRADE_POINTS = {
    5: 2, 10: 5, 15: 2, 20: 5, 25: 2, 30: 5,
    35: 2, 40: 5, 45: 2, 50: 5, 55: 2, 60: 5,
  };

  /**
   * Resolve effective upgrade-point milestones from LevelRewardConfig (if loaded)
   * or fall back to the hardcoded LEVEL_BONUS_UPGRADE_POINTS table.
   */
  function resolveMilestones(cfg) {
    if (cfg && cfg.upgradePoints && cfg.upgradePoints.milestones && typeof cfg.upgradePoints.milestones === 'object') {
      var out = {};
      var keys = Object.keys(cfg.upgradePoints.milestones);
      for (var i = 0; i < keys.length; i++) {
        var lvl = Number(keys[i]);
        var pts = Number(cfg.upgradePoints.milestones[keys[i]]);
        if (Number.isFinite(lvl) && lvl > 0 && Number.isFinite(pts) && pts > 0) {
          out[Math.floor(lvl)] = Math.floor(pts);
        }
      }
      return out;
    }
    return LEVEL_BONUS_UPGRADE_POINTS;
  }

  /**
   * Resolve damage-point rewards by level from LevelRewardConfig or fallback.
   */
  function resolveDamagePointRewards(cfg) {
    if (cfg && cfg.damagePoints && typeof cfg.damagePoints === 'object') {
      var out = {};
      var keys = Object.keys(cfg.damagePoints);
      for (var i = 0; i < keys.length; i++) {
        var lvl = Number(keys[i]);
        var pts = Number(cfg.damagePoints[keys[i]]);
        if (Number.isFinite(lvl) && lvl > 0 && Number.isFinite(pts) && pts > 0) {
          out[Math.floor(lvl)] = Math.floor(pts);
        }
      }
      return out;
    }
    return { 2: SUPERCOMPUTER_LEVEL_TWO_DAMAGE_POINTS_REWARD };
  }

  /**
   * Resolve base upgrade points per level-up from config or fallback (1).
   */
  function resolveBaseUpgradePoints(cfg) {
    if (cfg && cfg.upgradePoints && Number.isFinite(cfg.upgradePoints.basePerLevel) && cfg.upgradePoints.basePerLevel >= 0) {
      return Math.floor(cfg.upgradePoints.basePerLevel);
    }
    return 1;
  }

  function createLevelFlow(options) {
    var opts = options || {};
    var state = opts.state;
    var ui = opts.ui;
    var BAL = opts.BAL;
    var t = opts.t || function (k) { return k; };
    var UIModals = opts.UIModals || null;
    var a11yOpen = opts.a11yOpen;
    var a11yClose = opts.a11yClose;
    var nowSec = opts.nowSec || function () { return 0; };
    var saveProgress = opts.saveProgress || function () {};
    var updateUI = opts.updateUI || function () {};
    var refreshTanksPowerTier = opts.refreshTanksPowerTier || function () {};
    var playSfx = opts.playSfx || function () {};
    var showCenterNotification = opts.showCenterNotification || function () {};
    var xpNeededForLevel = opts.xpNeededForLevel || function () { return 500; };
    var levelGoldReward = opts.levelGoldReward || function () { return 0; };
    /* Альтернативный путь получения уровня: накопленные убийства.
       Счётчик живёт в supercomputer.levelKills (НЕ state.kills, который
       выводится в HUD/терминале) и сбрасывается после КАЖДОГО полученного
       уровня — и по XP, и по убийствам. См. grantXP(). */
    var killLevelThreshold = Number.isFinite(opts.killLevelThreshold) && opts.killLevelThreshold > 0
      ? Math.floor(opts.killLevelThreshold)
      : DEFAULT_KILL_LEVEL_THRESHOLD;
    var onComputerLevelChanged = typeof opts.onComputerLevelChanged === 'function' ? opts.onComputerLevelChanged : null;
    var onTalentPointsGained = typeof opts.onTalentPointsGained === 'function' ? opts.onTalentPointsGained : null;
    var windowObj = opts.windowObj || (typeof window !== 'undefined' ? window : null);
    var levelRewardCfg = opts.levelRewardConfig || null;
    var effectiveMilestones = resolveMilestones(levelRewardCfg);
    var effectiveDamageRewards = resolveDamagePointRewards(levelRewardCfg);
    var effectiveBaseUpgradePoints = resolveBaseUpgradePoints(levelRewardCfg);

    function notifyTutorialLevelRewardDismissed(level) {
      if (!windowObj || !windowObj.Game || !windowObj.Game.TutorialRuntime) return;
      if (typeof windowObj.Game.TutorialRuntime.handleSupercomputerLevelRewardDismissed !== 'function') return;
      windowObj.Game.TutorialRuntime.handleSupercomputerLevelRewardDismissed(level);
    }

    function getDefaultXpToNext(level) {
      return Number.isFinite(level) && level <= 0 ? 50 : 500;
    }

    function getComputer() {
      if (state.supercomputer) return state.supercomputer;
      if (state.player && Number.isFinite(state.player.level)) {
        return {
          computerLevel: state.player.level,
          xp: Number.isFinite(state.player.xp) ? state.player.xp : 0,
          xpToNext: Number.isFinite(state.player.xpToNext) ? state.player.xpToNext : getDefaultXpToNext(state.player.level),
          maxLevel: Number.isFinite(state.player.maxLevel) ? state.player.maxLevel : 60,
          levelKills: normalizeKillProgress(state.player.levelKills),
          eventShown40: !!state.player.eventShown40,
          eventShown50: !!state.player.eventShown50,
          eventShown60: !!state.player.eventShown60,
          _legacyProxy: true,
        };
      }
      return null;
    }

    function writeBackLegacyComputer(computer) {
      if (!computer || !computer._legacyProxy || !state.player) return;
      state.player.level = computer.computerLevel;
      state.player.xp = computer.xp;
      state.player.xpToNext = computer.xpToNext;
      state.player.maxLevel = computer.maxLevel;
      state.player.levelKills = normalizeKillProgress(computer.levelKills);
      state.player.eventShown40 = !!computer.eventShown40;
      state.player.eventShown50 = !!computer.eventShown50;
      state.player.eventShown60 = !!computer.eventShown60;
    }

    function normalizeDamageProgress(value) {
      return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    }

    /* supercomputer.levelKills — альтернативный per-level прогресс убийств.
       Всегда неотрицательное целое; отсутствующее/битое значение → 0. */
    function normalizeKillProgress(value) {
      return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    }

    function normalizeDamagePoints(value) {
      return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    }

    function getCurrentDamagePointTotal() {
      if (Number.isFinite(state.totalDamageDealtRaw)) {
        return Math.floor(normalizeDamageProgress(state.totalDamageDealtRaw) / DAMAGE_PROGRESS_PER_POINT);
      }
      return normalizeDamagePoints(state.damagePointsSpent)
        + (state.player ? normalizeDamagePoints(state.player.damagePoints) : 0);
    }

    function grantDamagePointReward(points) {
      var rewardPoints = normalizeDamagePoints(points);
      var spentPoints = normalizeDamagePoints(state.damagePointsSpent);
      var remainder = normalizeDamageProgress(state.totalDamageDealtRaw) % DAMAGE_PROGRESS_PER_POINT;
      var totalDamagePoints = getCurrentDamagePointTotal();
      if (!rewardPoints) return 0;
      totalDamagePoints += rewardPoints;
      state.totalDamageDealtRaw = totalDamagePoints * DAMAGE_PROGRESS_PER_POINT + remainder;
      if (state.player) {
        state.player.damagePoints = Math.max(0, totalDamagePoints - spentPoints);
      }
      return rewardPoints;
    }

    function updateLevelModal() {
      var reward = state.ui.levelReward;
      if (!reward || !ui.levelModal) return;
      if (ui.levelTitle) ui.levelTitle.textContent = t('levelModalTitle', { level: reward.level });
      if (ui.levelTalent) {
        ui.levelTalent.textContent = reward.damagePoints > 0
          ? t('levelModalTalentWithDamage', {
              points: reward.points,
              damagePoints: reward.damagePoints,
            })
          : t('levelModalTalent', {
              points: reward.points,
            });
      }
      var fmt = windowObj && windowObj.Game && windowObj.Game.NumberFormat
        ? windowObj.Game.NumberFormat.formatCompactRu
        : function (n) { return String(Math.round(n)); };
      if (ui.levelGold) ui.levelGold.textContent = t('levelModalGold', { gold: fmt(reward.gold) });
      if (ui.levelAccept) ui.levelAccept.textContent = t('levelUpAccept');
    }

    function openLevelModal() {
      if (UIModals && typeof UIModals.openLevelModal === 'function') {
        UIModals.openLevelModal({
          ui: ui,
          a11yOpen: a11yOpen,
          onClose: closeLevelModal,
          updateLevelModal: updateLevelModal,
        });
      } else {
        if (!ui.levelModal) return;
        var docObj = windowObj && windowObj.document;
        if (docObj && docObj.body) docObj.body.classList.add('levelmodal-open');
        ui.levelModal.classList.remove('hidden');
        ui.levelModal.setAttribute('aria-hidden', 'false');
        if (typeof a11yOpen === 'function') a11yOpen(ui.levelModal, { initialFocus: ui.levelAccept, onClose: closeLevelModal });
        updateLevelModal();
      }
      // Phase 3b: notify ModalAdapter
      var reward = state && state.ui ? state.ui.levelReward : null;
      var ma = windowObj.Game && windowObj.Game.ModalAdapter;
      if (ma && ma.isInitialized && ma.isInitialized()) {
        ma.notifyOpen('levelUp', reward ? { level: reward.level, points: reward.points, gold: reward.gold, damagePoints: reward.damagePoints || 0 } : null);
      }
    }

    function closeLevelModal() {
      var reward = state && state.ui ? state.ui.levelReward : null;
      var dismissedLevel = reward && Number.isFinite(Number(reward.level))
        ? Math.max(0, Math.floor(Number(reward.level)))
        : 0;
      if (UIModals && typeof UIModals.closeLevelModal === 'function') {
        UIModals.closeLevelModal({ ui: ui, a11yClose: a11yClose });
      } else {
        if (!ui.levelModal) return;
        var docObj = windowObj && windowObj.document;
        if (docObj && docObj.body) docObj.body.classList.remove('levelmodal-open');
        ui.levelModal.classList.add('hidden');
        ui.levelModal.setAttribute('aria-hidden', 'true');
        if (typeof a11yClose === 'function') a11yClose(ui.levelModal);
      }
      // Phase 3b: notify ModalAdapter
      var ma2 = windowObj.Game && windowObj.Game.ModalAdapter;
      if (ma2 && ma2.isInitialized && ma2.isInitialized()) ma2.notifyClose('levelUp');
      if (state.ui.levelRewardTimer) {
        windowObj.clearTimeout(state.ui.levelRewardTimer);
        state.ui.levelRewardTimer = 0;
      }
      state.ui.levelReward = null;
      if (dismissedLevel > 0) notifyTutorialLevelRewardDismissed(dismissedLevel);
    }

    function queueLevelReward(level, points, gold, damagePoints) {
      if (!points && !gold && !damagePoints) return;
      var reward = state.ui.levelReward;
      if (reward) {
        reward.level = Math.max(reward.level, level);
        reward.points += points;
        reward.gold += gold;
        reward.damagePoints = (reward.damagePoints || 0) + (damagePoints || 0);
      } else {
        state.ui.levelReward = {
          level: level,
          points: points,
          gold: gold,
          damagePoints: damagePoints || 0,
        };
      }
      openLevelModal();
    }

    function acceptLevelReward() {
      closeLevelModal();
    }

    function triggerLevelUpVfx(level) {
      var now = nowSec();
      state.levelUpVfxUntil = now + 0.15;
      state.levelUpText = { level: level, until: now + 2.2 };
      state.timeScale = 0.7;
      playSfx('levelUp');
    }

    function checkPowerMomentEvents(level) {
      var computer = getComputer();
      if (!computer) return;
      // batch solo-pipeline-yandex-vk#2 (item 7): «Открыты активные способности» теперь срабатывает,
      // когда у игрока стало >= 31 очка талантов суммарно (свободные + потраченные), а не от уровня.
      // Уровень-параметр сохранён только как back-compat сигнал для late-bind level >= 50/60.
      if (!computer.eventShown40) {
        var freePoints = 0;
        if (state.player) {
          if (state.player.talentsV2 && Number.isFinite(state.player.talentsV2.freePoints)) {
            freePoints = Math.max(0, Math.floor(state.player.talentsV2.freePoints));
          } else if (Number.isFinite(state.player.freeTalentPointsV2)) {
            freePoints = Math.max(0, Math.floor(state.player.freeTalentPointsV2));
          }
        }
        var spentPoints = 0;
        var TV2 = windowObj && windowObj.Game && windowObj.Game.TalentsV2;
        if (TV2 && typeof TV2.getBranchSpent === 'function') {
          var branches = ['offense', 'defense', 'economy'];
          for (var bi = 0; bi < branches.length; bi++) {
            spentPoints += Math.max(0, Math.floor(TV2.getBranchSpent(branches[bi]) || 0));
          }
        }
        if ((freePoints + spentPoints) >= 31) {
          computer.eventShown40 = true;
          // batch solo-pipeline-yandex-vk#1 (item 9): silent unlock — pop-up
          // «Открыты активные способности» suppressed by user request.
          // Visual indicator in the upgrade menu (talentAbilityUnlocked class
          // applied via `btn.classList.toggle('talentAbilityUnlocked', stateActive.unlocked)`
          // in game.js) remains; only this center-screen notification is gated.
          // showCenterNotification(t('powerMoment40'));
        }
      }
      if (level >= 50) computer.eventShown50 = true;
      if (level >= 60) {
        computer.eventShown60 = true;
        state.endgameVisuals = true;
      }
    }

    /* Общий агрегатор наград за пачку уровней. Один и тот же объект
       наполняется и XP-путём, и kill-путём, чтобы награды/модалка/VFX
       не разъезжались между двумя источниками уровня. */
    function createLevelAggregate(p) {
      return {
        gainedLevels: 0,
        bonusUpgradePoints: 0,
        rewardGold: 0,
        rewardDamagePoints: 0,
        previousMaxHp: Number.isFinite(p && p.maxHp) ? p.maxHp : 1,
      };
    }

    /* +1 уровень: общие счётчики награды (золото / damage points / milestone). */
    function consumeLevel(p, agg) {
      p.computerLevel += 1;
      agg.gainedLevels += 1;
      agg.rewardGold += levelGoldReward(p.computerLevel);
      var dmgRewardForLevel = effectiveDamageRewards[p.computerLevel];
      if (dmgRewardForLevel) agg.rewardDamagePoints += dmgRewardForLevel;
      var levelBonus = effectiveMilestones[p.computerLevel];
      if (levelBonus) agg.bonusUpgradePoints += levelBonus;
    }

    /* Хвост левелапа: очки улучшений, золото, damage points, VFX, модалка,
       power-moments, save/UI. Вызывается ТОЛЬКО когда agg.gainedLevels > 0. */
    function applyLevelRewards(p, agg) {
      var totalUpgradePoints = agg.gainedLevels * effectiveBaseUpgradePoints + agg.bonusUpgradePoints;
      if (state.player) {
        state.player.talentPoints = Math.max(0, Math.floor(state.player.talentPoints || 0)) + totalUpgradePoints;
        if (state.player.talentsV2 && typeof state.player.talentsV2 === 'object') {
          state.player.talentsV2.freePoints = Math.max(0, Math.floor(state.player.talentsV2.freePoints || 0)) + totalUpgradePoints;
          state.player.freeTalentPointsV2 = state.player.talentsV2.freePoints;
        } else if (Number.isFinite(state.player.freeTalentPointsV2)) {
          state.player.freeTalentPointsV2 = Math.max(0, Math.floor(state.player.freeTalentPointsV2 || 0)) + totalUpgradePoints;
        }
      }
      if (onTalentPointsGained) onTalentPointsGained(totalUpgradePoints);
      state.coins += agg.rewardGold;
      var rewardDamagePoints = grantDamagePointReward(agg.rewardDamagePoints);
      if (onComputerLevelChanged) {
        onComputerLevelChanged({
          computer: p,
          oldMaxHp: agg.previousMaxHp,
        });
      }
      refreshTanksPowerTier();
      triggerLevelUpVfx(p.computerLevel);
      checkPowerMomentEvents(p.computerLevel);
      queueLevelReward(p.computerLevel, totalUpgradePoints, agg.rewardGold, rewardDamagePoints);
      saveProgress();
      updateUI();
    }

    function grantXP(amount) {
      var p = getComputer();
      if (!p || p.computerLevel >= p.maxLevel) return;

      p.xp += amount;
      var agg = createLevelAggregate(p);

      while (p.computerLevel < p.maxLevel) {
        p.xpToNext = xpNeededForLevel(p.computerLevel);
        if (p.xp < p.xpToNext) break;

        p.xp -= p.xpToNext;
        consumeLevel(p, agg);
      }

      p.xpToNext = xpNeededForLevel(p.computerLevel);
      if (agg.gainedLevels > 0) {
        /* Per ТЗ: счётчик убийств для повышения уровня сбрасывается после
           ЛЮБОГО полученного уровня — включая уровень, полученный по XP. */
        p.levelKills = 0;
        applyLevelRewards(p, agg);
      }
      writeBackLegacyComputer(p);
    }

    /* grantKillProgress — альтернативный путь получения уровня.
       Инкрементит отдельный per-level счётчик supercomputer.levelKills
       (НЕ state.kills, который выводится в HUD) и при достижении порога
       выдаёт уровень. Счётчик СБРАСЫВАЕТСЯ (остаток сверх порога не
       переносится) после каждого полученного уровня.

       @returns {number} сколько уровней было получено за этот вызов */
    function grantKillProgress(amount) {
      var p = getComputer();
      var inc = Number.isFinite(amount) ? Math.floor(amount) : 0;
      if (!p || inc <= 0 || p.computerLevel >= p.maxLevel) return 0;

      p.levelKills = normalizeKillProgress(p.levelKills) + inc;
      var agg = createLevelAggregate(p);

      while (p.computerLevel < p.maxLevel && p.levelKills >= killLevelThreshold) {
        p.levelKills = 0;
        consumeLevel(p, agg);
      }

      p.xpToNext = xpNeededForLevel(p.computerLevel);
      if (agg.gainedLevels > 0) {
        applyLevelRewards(p, agg);
      }
      writeBackLegacyComputer(p);
      return agg.gainedLevels;
    }

    return {
      updateLevelModal: updateLevelModal,
      openLevelModal: openLevelModal,
      closeLevelModal: closeLevelModal,
      queueLevelReward: queueLevelReward,
      acceptLevelReward: acceptLevelReward,
      grantXP: grantXP,
      grantKillProgress: grantKillProgress,
      getKillLevelThreshold: function () { return killLevelThreshold; },
      triggerLevelUpVfx: triggerLevelUpVfx,
      checkPowerMomentEvents: checkPowerMomentEvents,
    };
  }

  global.Game = global.Game || {};
  global.Game.LevelFlow = {
    createLevelFlow: createLevelFlow,
  };
})(typeof window !== 'undefined' ? window : this);
