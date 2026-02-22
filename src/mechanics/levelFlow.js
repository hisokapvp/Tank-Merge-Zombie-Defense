(function (global) {
  'use strict';

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
    var onComputerLevelChanged = typeof opts.onComputerLevelChanged === 'function' ? opts.onComputerLevelChanged : null;
    var onTalentPointsGained = typeof opts.onTalentPointsGained === 'function' ? opts.onTalentPointsGained : null;
    var windowObj = opts.windowObj || (typeof window !== 'undefined' ? window : null);

    function getComputer() {
      if (state.supercomputer) return state.supercomputer;
      if (state.player && Number.isFinite(state.player.level)) {
        return {
          computerLevel: state.player.level,
          xp: Number.isFinite(state.player.xp) ? state.player.xp : 0,
          xpToNext: Number.isFinite(state.player.xpToNext) ? state.player.xpToNext : 500,
          maxLevel: Number.isFinite(state.player.maxLevel) ? state.player.maxLevel : 60,
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
      state.player.eventShown40 = !!computer.eventShown40;
      state.player.eventShown50 = !!computer.eventShown50;
      state.player.eventShown60 = !!computer.eventShown60;
    }

    function updateLevelModal() {
      var reward = state.ui.levelReward;
      if (!reward || !ui.levelModal) return;
      if (ui.levelTitle) ui.levelTitle.textContent = t('levelModalTitle', { level: reward.level });
      if (ui.levelTalent) {
        ui.levelTalent.textContent = t('levelModalTalent', {
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
      var ignoreClose = function () {};
      if (UIModals && typeof UIModals.openLevelModal === 'function') {
        UIModals.openLevelModal({
          ui: ui,
          a11yOpen: a11yOpen,
          onClose: ignoreClose,
          updateLevelModal: updateLevelModal,
        });
      } else {
        if (!ui.levelModal) return;
        ui.levelModal.classList.remove('hidden');
        ui.levelModal.setAttribute('aria-hidden', 'false');
        if (typeof a11yOpen === 'function') a11yOpen(ui.levelModal, { initialFocus: ui.levelAccept, onClose: ignoreClose });
        updateLevelModal();
      }
    }

    function closeLevelModal() {
      if (UIModals && typeof UIModals.closeLevelModal === 'function') {
        UIModals.closeLevelModal({ ui: ui, a11yClose: a11yClose });
      } else {
        if (!ui.levelModal) return;
        ui.levelModal.classList.add('hidden');
        ui.levelModal.setAttribute('aria-hidden', 'true');
        if (typeof a11yClose === 'function') a11yClose(ui.levelModal);
      }
      if (state.ui.levelRewardTimer) {
        windowObj.clearTimeout(state.ui.levelRewardTimer);
        state.ui.levelRewardTimer = 0;
      }
      state.ui.levelReward = null;
    }

    function queueLevelReward(level, points, gold) {
      if (!points && !gold) return;
      var reward = state.ui.levelReward;
      if (reward) {
        reward.level = Math.max(reward.level, level);
        reward.points += points;
        reward.gold += gold;
      } else {
        state.ui.levelReward = { level: level, points: points, gold: gold };
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
      if (level >= 40 && !computer.eventShown40) {
        computer.eventShown40 = true;
        showCenterNotification(t('powerMoment40'));
      }
      if (level >= 50) computer.eventShown50 = true;
      if (level >= 60) {
        computer.eventShown60 = true;
        state.endgameVisuals = true;
      }
    }

    function grantXP(amount) {
      var p = getComputer();
      if (!p || p.computerLevel >= p.maxLevel) return;

      p.xp += amount;
      var leveled = false;
      var gainedLevels = 0;
      var rewardGold = 0;
      var previousMaxHp = Number.isFinite(p.maxHp) ? p.maxHp : 1;

      while (p.computerLevel < p.maxLevel) {
        p.xpToNext = xpNeededForLevel(p.computerLevel);
        if (p.xp < p.xpToNext) break;

        p.xp -= p.xpToNext;
        p.computerLevel += 1;
        leveled = true;
        gainedLevels += 1;
        rewardGold += levelGoldReward(p.computerLevel);
      }

      p.xpToNext = xpNeededForLevel(p.computerLevel);
      if (leveled) {
        if (state.player) {
          state.player.talentPoints = Math.max(0, Math.floor(state.player.talentPoints || 0)) + gainedLevels;
          if (state.player.talentsV2 && typeof state.player.talentsV2 === 'object') {
            state.player.talentsV2.freePoints = Math.max(0, Math.floor(state.player.talentsV2.freePoints || 0)) + gainedLevels;
            state.player.freeTalentPointsV2 = state.player.talentsV2.freePoints;
          } else if (Number.isFinite(state.player.freeTalentPointsV2)) {
            state.player.freeTalentPointsV2 = Math.max(0, Math.floor(state.player.freeTalentPointsV2 || 0)) + gainedLevels;
          }
        }
        if (onTalentPointsGained) onTalentPointsGained(gainedLevels);
        state.coins += rewardGold;
        if (onComputerLevelChanged) {
          onComputerLevelChanged({
            computer: p,
            oldMaxHp: previousMaxHp,
          });
        }
        refreshTanksPowerTier();
        triggerLevelUpVfx(p.computerLevel);
        checkPowerMomentEvents(p.computerLevel);
        queueLevelReward(p.computerLevel, gainedLevels, rewardGold);
        saveProgress();
        updateUI();
      }
      writeBackLegacyComputer(p);
    }

    return {
      updateLevelModal: updateLevelModal,
      openLevelModal: openLevelModal,
      closeLevelModal: closeLevelModal,
      queueLevelReward: queueLevelReward,
      acceptLevelReward: acceptLevelReward,
      grantXP: grantXP,
      triggerLevelUpVfx: triggerLevelUpVfx,
      checkPowerMomentEvents: checkPowerMomentEvents,
    };
  }

  global.Game = global.Game || {};
  global.Game.LevelFlow = {
    createLevelFlow: createLevelFlow,
  };
})(typeof window !== 'undefined' ? window : this);
