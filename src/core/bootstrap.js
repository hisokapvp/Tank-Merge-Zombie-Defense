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
    var state = getState();
    if (state.supercomputer) {
      state.supercomputer.xpToNext = opts.xpNeededForLevel(state.supercomputer.computerLevel);
    } else {
      state.player.xpToNext = opts.xpNeededForLevel(state.player.level);
    }
    getState().player.modsDirty = true;

    var storageApi = windowObj.Game && windowObj.Game.Storage;
    var activeSaveSlotIndex = -1;

    function getSaveMeta() {
      if (storageApi && typeof storageApi.loadSaveSlotsMeta === 'function') {
        return storageApi.loadSaveSlotsMeta();
      }
      return { slots: [] };
    }

    function defaultSlotName(index) {
      if (storageApi && typeof storageApi.getDefaultSlotName === 'function') {
        return storageApi.getDefaultSlotName(index);
      }
      return 'Слот ' + (index + 1);
    }

    function setMenuView(viewName) {
      var views = {
        main: opts.ui.menuMainView,
        slots: opts.ui.menuSaveSlotsView,
        edit: opts.ui.menuSaveSlotEditView,
        exit: opts.ui.menuExitConfirmView,
      };
      Object.keys(views).forEach(function (key) {
        var el = views[key];
        if (!el) return;
        var visible = key === viewName;
        el.classList.toggle('hidden', !visible);
        el.setAttribute('aria-hidden', (!visible).toString());
      });
    }

    function renderSaveSlotsList() {
      if (!opts.ui.menuSaveSlotsList) return;
      var meta = getSaveMeta();
      var slots = Array.isArray(meta && meta.slots) ? meta.slots : [];
      opts.ui.menuSaveSlotsList.innerHTML = '';
      for (var i = 0; i < 10; i++) {
        var slot = slots[i] || { name: defaultSlotName(i) };
        var currentName = typeof slot.name === 'string' ? slot.name : defaultSlotName(i);
        var fallbackName = defaultSlotName(i);
        var isEmpty = currentName === fallbackName;

        var button = documentObj.createElement('button');
        button.type = 'button';
        button.className = 'btn btnSecondary menuSaveSlotBtn';
        button.setAttribute('data-slot-index', String(i));

        var indexEl = documentObj.createElement('span');
        indexEl.className = 'menuSaveSlotIndex';
        indexEl.textContent = String(i + 1);

        var nameEl = documentObj.createElement('span');
        nameEl.className = 'menuSaveSlotName' + (isEmpty ? ' menuSaveSlotNameEmpty' : '');
        nameEl.textContent = currentName;

        button.appendChild(indexEl);
        button.appendChild(nameEl);
        opts.ui.menuSaveSlotsList.appendChild(button);
      }
    }

    function openMainMenuView() {
      activeSaveSlotIndex = -1;
      setMenuView('main');
    }

    function openSaveSlotsView() {
      renderSaveSlotsList();
      setMenuView('slots');
    }

    function openSaveSlotEdit(index) {
      activeSaveSlotIndex = index;
      var meta = getSaveMeta();
      var slots = Array.isArray(meta && meta.slots) ? meta.slots : [];
      var slot = slots[index] || { name: defaultSlotName(index) };
      if (opts.ui.menuSaveSlotInput) {
        opts.ui.menuSaveSlotInput.maxLength = 20;
        opts.ui.menuSaveSlotInput.value = typeof slot.name === 'string' ? slot.name : defaultSlotName(index);
        opts.ui.menuSaveSlotInput.focus();
        opts.ui.menuSaveSlotInput.select();
      }
      setMenuView('edit');
    }

    function saveCurrentSlotName() {
      if (activeSaveSlotIndex < 0 || activeSaveSlotIndex > 9 || !storageApi || typeof storageApi.setSlotName !== 'function') {
        return;
      }
      var value = opts.ui.menuSaveSlotInput ? opts.ui.menuSaveSlotInput.value : '';
      if (typeof value === 'string' && value.length > 20) value = value.slice(0, 20);
      var meta = storageApi.setSlotName(activeSaveSlotIndex, value);
      if (opts.ui.menuSaveSlotInput && meta && Array.isArray(meta.slots) && meta.slots[activeSaveSlotIndex]) {
        opts.ui.menuSaveSlotInput.value = meta.slots[activeSaveSlotIndex].name;
      }
      windowObj.alert(opts.t('menuSaveSuccess'));
      renderSaveSlotsList();
      if (opts.ui.menuSaveSlotInput) {
        opts.ui.menuSaveSlotInput.focus();
      }
    }

    function openMenuOverlayMain() {
      openMainMenuView();
      opts.setMenuOpen(true);
    }

    function openExitConfirmView() {
      setMenuView('exit');
    }

    opts.ui.menuContinue && opts.ui.menuContinue.addEventListener('click', function () {
      var ContinueFlow = windowObj.Game && windowObj.Game.ContinueFlow;
      if (ContinueFlow) {
        ContinueFlow.onContinueClick(getState(), opts.meta, function () { return opts.setMenuOpen(false); });
        return;
      }
      opts.setMenuOpen(false);
    });

    opts.ui.menuNew && opts.ui.menuNew.addEventListener('click', function () {
      localStorageObj.removeItem('progress');
      opts.resetGameState({ reason: 'new_game' });
      opts.meta.lastSeenAt = Date.now();
      opts.saveProgress();
      opts.setMenuOpen(false);
    });

    opts.ui.menuFeedback && opts.ui.menuFeedback.addEventListener('click', function () {
      var feedbackWidget = windowObj.Game && windowObj.Game.FeedbackWidget;
      if (!feedbackWidget || typeof feedbackWidget.open !== 'function') return;
      feedbackWidget.open();
    });

    opts.ui.menuSave && opts.ui.menuSave.addEventListener('click', function () {
      openSaveSlotsView();
    });
    opts.ui.menuSaveSlotsList && opts.ui.menuSaveSlotsList.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      var slotBtn = target.closest('[data-slot-index]');
      if (!slotBtn) return;
      var slotIndex = Number(slotBtn.getAttribute('data-slot-index'));
      if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex > 9) return;
      openSaveSlotEdit(slotIndex);
    });

    opts.ui.menuSaveBack && opts.ui.menuSaveBack.addEventListener('click', function () {
      openMainMenuView();
    });
    opts.ui.menuSaveClose && opts.ui.menuSaveClose.addEventListener('click', function () {
      openMainMenuView();
      opts.setMenuOpen(false);
    });

    opts.ui.menuSaveSlotSave && opts.ui.menuSaveSlotSave.addEventListener('click', function () {
      saveCurrentSlotName();
    });
    opts.ui.menuSaveSlotBack && opts.ui.menuSaveSlotBack.addEventListener('click', function () {
      openSaveSlotsView();
    });
    opts.ui.menuSaveSlotClose && opts.ui.menuSaveSlotClose.addEventListener('click', function () {
      openMainMenuView();
      opts.setMenuOpen(false);
    });
    opts.ui.menuSaveSlotInput && opts.ui.menuSaveSlotInput.addEventListener('input', function (event) {
      if (event.target.value.length > 20) event.target.value = event.target.value.slice(0, 20);
    });
    opts.ui.menuSaveSlotInput && opts.ui.menuSaveSlotInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveCurrentSlotName();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        openSaveSlotsView();
      }
    });

    opts.ui.menuExit && opts.ui.menuExit.addEventListener('click', function () {
      openExitConfirmView();
    });
    opts.ui.menuExitConfirmCancel && opts.ui.menuExitConfirmCancel.addEventListener('click', function () {
      openMainMenuView();
    });
    opts.ui.menuExitConfirmLeave && opts.ui.menuExitConfirmLeave.addEventListener('click', function () {
      openMainMenuView();
      if (typeof opts.stopAndResetSessionToBigMenu === 'function') {
        opts.stopAndResetSessionToBigMenu();
      }
      if (typeof opts.updateBigMenuLoadState === 'function') {
        opts.updateBigMenuLoadState();
      }
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

    opts.ui.supercomputerBtn && opts.ui.supercomputerBtn.addEventListener('click', function () {
      if (typeof opts.openSupercomputerMenu === 'function') return opts.openSupercomputerMenu();
      return opts.openTalents();
    });
    opts.ui.settingsBtn && opts.ui.settingsBtn.addEventListener('click', function () {
      return openMenuOverlayMain();
    });

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

    if (typeof opts.ensureStarterTanks === 'function') {
      opts.ensureStarterTanks(getState(), 2);
    } else if (getState().cells[0] && getState().cells[1] && !getState().cells.some(function (c) { return c.tank; })) {
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
        return;
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
    if (opts.BulletSprites && typeof opts.BulletSprites.load === 'function') {
      await opts.BulletSprites.load().catch(function () {});
    }
    if (opts.BoostIconsSprites && typeof opts.BoostIconsSprites.load === 'function') {
      await opts.BoostIconsSprites.load().catch(function () {});
    }
    await opts.FenceSprites.load().catch(function () {});
    opts.resizeCanvas();
    await opts.DecorSprites.load().catch(function () {});
    if (opts.DronSprites && typeof opts.DronSprites.load === 'function') {
      await opts.DronSprites.load().catch(function () {});
    }
    if (opts.BonusBoxSprites && typeof opts.BonusBoxSprites.load === 'function') {
      await opts.BonusBoxSprites.load().catch(function () {});
    }
    if (opts.SupercomputerSprites && typeof opts.SupercomputerSprites.load === 'function') {
      await opts.SupercomputerSprites.load().catch(function () {});
      if (typeof opts.onSupercomputerConfigLoaded === 'function') opts.onSupercomputerConfigLoaded();
    }
    if (typeof opts.onDecorSpritesLoaded === 'function') opts.onDecorSpritesLoaded();

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
    if (typeof opts.startLoop === 'function') {
      opts.startLoop();
    } else {
      windowObj.requestAnimationFrame(opts.loop);
    }
  }

  global.Game = global.Game || {};
  global.Game.Bootstrap = {
    runBoot: runBoot,
  };
})(typeof window !== 'undefined' ? window : this);
