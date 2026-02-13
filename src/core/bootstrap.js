(function (global) {
  'use strict';

  async function runBoot(options) {
    var opts = options || {};
    var windowObj = opts.windowObj || (typeof window !== 'undefined' ? window : null);
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    var localStorageObj = opts.localStorageObj || (typeof localStorage !== 'undefined' ? localStorage : null);
    var getState = typeof opts.getState === 'function' ? opts.getState : function () { return opts.state; };
    var getSettings = typeof opts.getSettings === 'function' ? opts.getSettings : function () { return opts.settings; };

    opts.loadSettings();
    var savedLang = localStorageObj.getItem('lang');
    if (savedLang) opts.setLanguage(savedLang);
    else opts.setLanguage(opts.currentLang);

    var i18n = opts.getI18n();
    if (i18n && typeof i18n.onReady === 'function') {
      i18n.onReady(function () {
        opts.applyTranslations();
        opts.updateUI();
        if (windowObj.Game && windowObj.Game.LessonProgress && windowObj.Game.LessonProgress.renderList) {
          windowObj.Game.LessonProgress.renderList();
        }
      });
    }

    opts.ensureProgressUI();
    opts.initTalentDefs();

    var loaded = null;
    if (windowObj.Game && windowObj.Game.Storage) {
      loaded = windowObj.Game.Storage.loadGame();
      if (loaded) {
        if (loaded.legacyProgress) opts.applySavedProgress(loaded.legacyProgress);
        if (loaded.meta && loaded.meta.lastSeenAt != null) opts.meta.lastSeenAt = loaded.meta.lastSeenAt;
      }
    } else {
      opts.applySavedProgress(opts.getSavedProgress());
    }

    opts.ensureTalentState();
    getState().player.xpToNext = opts.xpNeededForLevel(getState().player.level);
    getState().player.modsDirty = true;

    if (opts.ui.langRu && opts.ui.langEn) {
      opts.ui.langRu.addEventListener('click', function () { return opts.setLanguage('ru'); });
      opts.ui.langEn.addEventListener('click', function () { return opts.setLanguage('en'); });
    }

    function presentOfflineRewards(rewards) {
      var OfflineModal = windowObj.Game && windowObj.Game.OfflineModal;
      var AdService = windowObj.Game && windowObj.Game.AdService;
      if (!OfflineModal || !AdService) return;
      if (!rewards || (rewards.coins === 0 && rewards.xp === 0)) return;
      OfflineModal.showOfflineRewardsModal({
        coins: rewards.coins,
        xp: rewards.xp,
        onConfirm: function () {
          OfflineModal.setClaiming(true);
          AdService.requestRewardedAd().then(function (result) {
            if (result && result.success) {
              getState().coins += rewards.coins;
              getState().player.xp += rewards.xp;
              opts.grantXP(0);
              opts.meta.lastSeenAt = Date.now();
              opts.saveProgress();
              OfflineModal.hideModal();
              opts.updateUI();
            }
            OfflineModal.setClaiming(false);
          });
        },
      });
    }

    function maybeShowOfflineRewardsFromMeta() {
      var ContinueFlow = windowObj.Game && windowObj.Game.ContinueFlow;
      var OfflineModal = windowObj.Game && windowObj.Game.OfflineModal;
      var OfflineProgress = windowObj.Game && windowObj.Game.OfflineProgress;
      if (!ContinueFlow || !OfflineModal || !OfflineProgress) return;
      if (OfflineModal.isVisible && OfflineModal.isVisible()) return;
      if (!ContinueFlow.shouldShowOfflineModal(opts.meta && opts.meta.lastSeenAt)) return;
      var elapsed = ContinueFlow.getElapsedMs(opts.meta && opts.meta.lastSeenAt);
      var rewards = OfflineProgress.computeOfflineRewards(getState(), elapsed);
      presentOfflineRewards(rewards);
    }

    opts.ui.menuContinue && opts.ui.menuContinue.addEventListener('click', function () {
      var ContinueFlow = windowObj.Game && windowObj.Game.ContinueFlow;
      var OfflineModal = windowObj.Game && windowObj.Game.OfflineModal;
      var AdService = windowObj.Game && windowObj.Game.AdService;
      if (ContinueFlow && OfflineModal && AdService) {
        ContinueFlow.onContinueClick(getState(), opts.meta, function () { return opts.setMenuOpen(false); }, function (rewards) {
          presentOfflineRewards(rewards);
        });
        return;
      }
      opts.setMenuOpen(false);
    });

    opts.ui.menuNew && opts.ui.menuNew.addEventListener('click', function () {
      localStorageObj.removeItem('progress');
      opts.resetGameState();
      opts.meta.lastSeenAt = Date.now();
      opts.saveProgress();
      opts.setMenuOpen(false);
    });

    opts.ui.menuSfx && opts.ui.menuSfx.addEventListener('input', function (e) {
      var value = Number(e.target.value) / 100;
      var settings = getSettings();
      settings.sfxVolume = opts.clamp(value, 0, 1);
      opts.applyAudioSettings();
      opts.updateMenuVolumes();
      opts.saveSettings();
    });

    opts.ui.menuMusic && opts.ui.menuMusic.addEventListener('input', function (e) {
      var value = Number(e.target.value) / 100;
      var settings = getSettings();
      settings.musicVolume = opts.clamp(value, 0, 1);
      opts.applyAudioSettings();
      opts.updateMenuVolumes();
      opts.saveSettings();
    });

    opts.ui.talentsBtn && opts.ui.talentsBtn.addEventListener('click', function () { return opts.openTalents(); });
    opts.ui.settingsBtn && opts.ui.settingsBtn.addEventListener('click', function () { return opts.setMenuOpen(true); });

    var settingsTooltip = documentObj.getElementById('settingsTooltip');
    if (opts.ui.settingsBtn && settingsTooltip) {
      opts.ui.settingsBtn.addEventListener('mouseenter', function () {
        settingsTooltip.textContent = opts.t('menuSettings');
        settingsTooltip.classList.remove('hidden');
        settingsTooltip.setAttribute('aria-hidden', 'false');
      });
      opts.ui.settingsBtn.addEventListener('mousemove', function (e) {
        settingsTooltip.style.left = e.clientX + 'px';
        settingsTooltip.style.top = (e.clientY + 12) + 'px';
        settingsTooltip.style.transform = 'translate(-50%, 0)';
      });
      opts.ui.settingsBtn.addEventListener('mouseleave', function () {
        settingsTooltip.classList.add('hidden');
        settingsTooltip.setAttribute('aria-hidden', 'true');
      });
      opts.ui.settingsBtn.addEventListener('touchstart', function (e) {
        settingsTooltip.textContent = opts.t('menuSettings');
        settingsTooltip.classList.remove('hidden');
        settingsTooltip.setAttribute('aria-hidden', 'false');
        var touch = e.touches[0];
        if (touch) {
          settingsTooltip.style.left = touch.clientX + 'px';
          settingsTooltip.style.top = (touch.clientY + 24) + 'px';
          settingsTooltip.style.transform = 'translate(-50%, 0)';
        }
      }, { passive: true });
      opts.ui.settingsBtn.addEventListener('touchend', function () {
        settingsTooltip.classList.add('hidden');
        settingsTooltip.setAttribute('aria-hidden', 'true');
      });
    }

    opts.ui.levelAccept && opts.ui.levelAccept.addEventListener('click', function () { return opts.acceptLevelReward(); });
    windowObj.addEventListener('resize', opts.resizeCanvas);
    if (windowObj.visualViewport) {
      windowObj.visualViewport.addEventListener('resize', opts.resizeCanvas);
    }

    opts.resizeCanvas();
    if (loaded && loaded.state) opts.restoreFullState(loaded.state);
    getState().nextCrateAt = getState().nextCrateAt || opts.nowSec() + opts.BAL.crateIntervalSec;

    if (windowObj.Game && windowObj.Game.Telemetry) windowObj.Game.Telemetry.loadLifetime();
    if (windowObj.Game && windowObj.Game.Flags) windowObj.Game.Flags.init();
    if (windowObj.Game && windowObj.Game.MobileMode) windowObj.Game.MobileMode.init();
    if (windowObj.Game && windowObj.Game.Experiments) windowObj.Game.Experiments.init();
    if (windowObj.Game && windowObj.Game.Funnel) windowObj.Game.Funnel.init();

    if (opts.DebugPanelEnabled) opts.initDebugPanel();
    if (opts.DebugPanelEnabled && windowObj.Game && windowObj.Game.AdminFlags) windowObj.Game.AdminFlags.init();

    if (getState().cells[0] && getState().cells[1] && !getState().cells.some(function (c) { return c.tank; })) {
      getState().cells[0].tank = opts.makeTank(1, true);
      getState().cells[1].tank = opts.makeTank(1, true);
      opts.recordTankLevel(1);
    }

    documentObj.addEventListener('visibilitychange', function () {
      if (documentObj.visibilityState === 'hidden' && windowObj.Game && windowObj.Game.Storage) {
        opts.meta.lastSeenAt = Date.now();
        windowObj.Game.Storage.saveGame(getState(), opts.meta);
        return;
      }
      if (documentObj.visibilityState === 'visible') {
        maybeShowOfflineRewardsFromMeta();
      }
    });

    windowObj.addEventListener('pagehide', function () {
      if (windowObj.Game && windowObj.Game.Storage) {
        opts.meta.lastSeenAt = Date.now();
        windowObj.Game.Storage.saveGame(getState(), opts.meta);
      }
    });

    await opts.ZombieSprites.load();
    if (opts.ZombieSprites.spawnConfig) {
      var spawnCfg = opts.getZombieSpawnBalanceConfig();
      opts.BAL.zombieCountTarget = spawnCfg.targetAlive;
      opts.BAL.zombieSideCount = spawnCfg.sideCount;
      opts.BAL.zombiePerSideTarget = spawnCfg.perSideTarget;
      opts.BAL.zombiePerSideTolerance = Math.max(0, spawnCfg.perSideTarget - spawnCfg.perSideMin);
      opts.BAL.corpseMaxCount = Math.max(opts.BAL.corpseMaxCount, spawnCfg.targetAlive);
    }

    await opts.TankSprites.load();
    opts.FenceSprites.load().catch(function () {});
    opts.DecorSprites.load().catch(function () {});

    if (windowObj.Game && windowObj.Game.MergePopup) windowObj.Game.MergePopup.init();
    if (windowObj.Game && windowObj.Game.TelemetryLogger) windowObj.Game.TelemetryLogger.init();
    if (windowObj.Game && windowObj.Game.Experiments) windowObj.Game.Experiments.attachTelemetry();

    if (windowObj.Game && windowObj.Game.Funnel) {
      windowObj.Game.Funnel.trackStep('first_launch', { hasSave: !!(loaded && loaded.state) });
      if (opts.meta && opts.meta.lastSeenAt != null) windowObj.Game.Funnel.maybeTrackReturn(opts.meta.lastSeenAt);
    }

    if (windowObj.Game && windowObj.Game.LessonProgress) windowObj.Game.LessonProgress.init();
    if (windowObj.Game && windowObj.Game.AnkiExport) windowObj.Game.AnkiExport.hookUI();
    if (windowObj.Game && windowObj.Game.ZombieAnimPreview) windowObj.Game.ZombieAnimPreview.init();

    opts.ensureZombieCount();
    opts.updateUI();
    opts.setMenuOpen(true);
    windowObj.requestAnimationFrame(opts.loop);
  }

  global.Game = global.Game || {};
  global.Game.Bootstrap = {
    runBoot: runBoot,
  };
})(typeof window !== 'undefined' ? window : this);
