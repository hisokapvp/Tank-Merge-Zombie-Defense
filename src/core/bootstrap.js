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
    var activeInlineEditSlotIndex = -1;
    var saveToastTimer = null;
    var lastActiveButtonIdSmallMenu = null;

    function getSmallMenuButtons() {
      return [opts.ui.menuContinue, opts.ui.menuNew, opts.ui.menuSave, opts.ui.menuExit];
    }

    function setMenuButtonSelected(button, selected) {
      if (!button || !button.classList) return;
      button.classList.toggle('menuActionSelected', !!selected);
      if (selected) {
        button.classList.add('btnPrimary');
        button.classList.remove('btnSecondary');
        return;
      }
      button.classList.remove('btnPrimary');
      button.classList.add('btnSecondary');
    }

    function applySmallMenuSelectedState() {
      var buttons = getSmallMenuButtons();
      for (var i = 0; i < buttons.length; i++) {
        var button = buttons[i];
        if (!button || !button.id) continue;
        setMenuButtonSelected(button, button.id === lastActiveButtonIdSmallMenu);
      }
    }

    function markSmallMenuButtonActive(buttonId) {
      if (!buttonId) return;
      lastActiveButtonIdSmallMenu = buttonId;
      applySmallMenuSelectedState();
    }

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

    function getSlotName(slot, index) {
      var raw = slot && typeof slot === 'object' ? slot.name : '';
      if (typeof raw !== 'string') return defaultSlotName(index);
      var text = raw.trim();
      return text || defaultSlotName(index);
    }

    function pad2(value) {
      var num = Number(value);
      if (!Number.isFinite(num)) return '00';
      var intNum = Math.max(0, Math.floor(num));
      return intNum < 10 ? '0' + intNum : String(intNum);
    }

    function formatDateYYYYMMDDHHmm(ms) {
      var timestamp = Number(ms);
      if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
      var date = new Date(Math.floor(timestamp));
      if (!Number.isFinite(date.getTime())) return '—';
      return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) + ' ' + pad2(date.getHours()) + ':' + pad2(date.getMinutes());
    }

    function setSaveViewOpen(open) {
      var visible = !!open;
      if (opts.ui.smallMenuRootView && opts.ui.smallMenuRootView.classList) {
        opts.ui.smallMenuRootView.classList.toggle('is-hidden', visible);
      }
      if (opts.ui.smallMenuSaveView && opts.ui.smallMenuSaveView.classList) {
        opts.ui.smallMenuSaveView.classList.toggle('is-active', visible);
        opts.ui.smallMenuSaveView.setAttribute('aria-hidden', (!visible).toString());
      }
      if (!visible) {
        activeInlineEditSlotIndex = -1;
      }
    }

    function showSaveToast(messageKey) {
      if (!opts.ui.smallMenuSaveToast) return;
      var text = opts.t(messageKey || 'menu.save.toast.saved');
      opts.ui.smallMenuSaveToast.textContent = text;
      opts.ui.smallMenuSaveToast.classList.add('is-visible');
      if (saveToastTimer != null) {
        windowObj.clearTimeout(saveToastTimer);
        saveToastTimer = null;
      }
      saveToastTimer = windowObj.setTimeout(function () {
        if (!opts.ui.smallMenuSaveToast) return;
        opts.ui.smallMenuSaveToast.classList.remove('is-visible');
      }, 1400);
    }

    function parseSlotIndexFromNode(node) {
      if (!node || typeof node.closest !== 'function') return -1;
      var row = node.closest('[data-slot-index]');
      if (!row) return -1;
      var slotIndex = Number(row.getAttribute('data-slot-index'));
      if (!Number.isFinite(slotIndex)) return -1;
      slotIndex = Math.floor(slotIndex);
      if (slotIndex < 0 || slotIndex > 9) return -1;
      return slotIndex;
    }

    function renderSaveRows() {
      if (!opts.ui.smallMenuSaveRows) return;
      var meta = getSaveMeta();
      var slots = Array.isArray(meta && meta.slots) ? meta.slots : [];
      opts.ui.smallMenuSaveRows.innerHTML = '';

      for (var i = 0; i < 10; i++) {
        var row = documentObj.createElement('div');
        row.className = 'smallMenuSaveTable__row';
        row.setAttribute('role', 'row');
        row.setAttribute('data-slot-index', String(i));

        var slot = slots[i] || null;

        var numberCell = documentObj.createElement('div');
        numberCell.className = 'smallMenuSaveTable__cell smallMenuSaveTable__cell_num';
        numberCell.setAttribute('role', 'cell');
        numberCell.textContent = String(i + 1);

        var nameCell = documentObj.createElement('div');
        nameCell.className = 'smallMenuSaveTable__cell smallMenuSaveTable__cell_name';
        nameCell.setAttribute('role', 'cell');

        var nameText = documentObj.createElement('span');
        nameText.className = 'smallMenuSaveNameText';
        nameText.textContent = getSlotName(slot, i);
        nameCell.appendChild(nameText);

        var dateCell = documentObj.createElement('div');
        dateCell.className = 'smallMenuSaveTable__cell smallMenuSaveTable__cell_date';
        dateCell.setAttribute('role', 'cell');
        dateCell.textContent = formatDateYYYYMMDDHHmm(slot && slot.lastSavedAt);

        var actionCell = documentObj.createElement('div');
        actionCell.className = 'smallMenuSaveTable__cell smallMenuSaveTable__cell_action';
        actionCell.setAttribute('role', 'cell');

        var saveButton = documentObj.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'btn btnSecondary uiButtonBehavior smallMenuSaveSlotBtn';
        saveButton.setAttribute('data-save-slot-btn', 'true');
        saveButton.setAttribute('data-slot-index', String(i));
        saveButton.textContent = opts.t('menu.save.col.action');

        actionCell.appendChild(saveButton);

        row.appendChild(numberCell);
        row.appendChild(nameCell);
        row.appendChild(dateCell);
        row.appendChild(actionCell);

        opts.ui.smallMenuSaveRows.appendChild(row);
      }
    }

    function openNameInlineEdit(slotIndex) {
      if (!opts.ui.smallMenuSaveRows) return;
      var row = opts.ui.smallMenuSaveRows.querySelector('[data-slot-index="' + String(slotIndex) + '"]');
      if (!row) return;
      var nameCell = row.querySelector('.smallMenuSaveTable__cell_name');
      if (!nameCell) return;

      var currentText = nameCell.textContent || defaultSlotName(slotIndex);
      var input = documentObj.createElement('input');
      input.type = 'text';
      input.maxLength = storageApi && Number.isFinite(storageApi.SAVE_SLOT_NAME_MAX_LEN) ? storageApi.SAVE_SLOT_NAME_MAX_LEN : 20;
      input.className = 'smallMenuSaveNameInput';
      input.value = currentText;

      nameCell.innerHTML = '';
      nameCell.appendChild(input);
      activeInlineEditSlotIndex = slotIndex;

      var settled = false;
      function closeEdit(commit) {
        if (settled) return;
        settled = true;
        if (commit && storageApi && typeof storageApi.setSlotName === 'function') {
          storageApi.setSlotName(slotIndex, input.value);
        }
        activeInlineEditSlotIndex = -1;
        renderSaveRows();
      }

      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          closeEdit(true);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          closeEdit(false);
        }
      });
      input.addEventListener('blur', function () {
        closeEdit(true);
      });

      input.focus();
      input.select();
    }

    function setMenuView(viewName) {
      var views = {
        main: opts.ui.menuMainView,
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

    function openMainMenuView() {
      setSaveViewOpen(false);
      setMenuView('main');
      applySmallMenuSelectedState();
    }

    function openSaveView() {
      setSaveViewOpen(true);
      renderSaveRows();
      if (typeof opts.updateBigMenuLoadState === 'function') {
        opts.updateBigMenuLoadState();
      }
    }

    function openMenuOverlayMain() {
      openMainMenuView();
      if (typeof opts.syncVolumeUIFromSettings === 'function') {
        opts.syncVolumeUIFromSettings();
      }
      opts.setMenuOpen(true);
    }

    function openExitConfirmView() {
      setMenuView('exit');
    }

    opts.ui.menuContinue && opts.ui.menuContinue.addEventListener('click', function () {
      markSmallMenuButtonActive('menuContinue');
      var ContinueFlow = windowObj.Game && windowObj.Game.ContinueFlow;
      if (ContinueFlow) {
        ContinueFlow.onContinueClick(getState(), opts.meta, function () { return opts.setMenuOpen(false); });
        return;
      }
      opts.setMenuOpen(false);
    });

    opts.ui.menuNew && opts.ui.menuNew.addEventListener('click', function () {
      markSmallMenuButtonActive('menuNew');
      localStorageObj.removeItem('progress');
      opts.resetGameState({ reason: 'new_game' });
      opts.meta.lastSeenAt = Date.now();
      opts.saveProgress();
      opts.setMenuOpen(false);
    });

    opts.ui.menuSave && opts.ui.menuSave.addEventListener('click', function () {
      markSmallMenuButtonActive('menuSave');
      openSaveView();
    });
    opts.ui.smallMenuSaveRows && opts.ui.smallMenuSaveRows.addEventListener('pointerdown', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('[data-save-slot-btn="true"]')) return;
      if (activeInlineEditSlotIndex >= 0) return;
      var slotIndex = parseSlotIndexFromNode(target);
      if (slotIndex < 0) return;
      event.preventDefault();
      openNameInlineEdit(slotIndex);
    });
    opts.ui.smallMenuSaveRows && opts.ui.smallMenuSaveRows.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      var saveBtn = target.closest('[data-save-slot-btn="true"]');
      if (!saveBtn) return;
      var slotIndex = Number(saveBtn.getAttribute('data-slot-index'));
      if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex > 9) return;
      if (storageApi && typeof storageApi.markSlotSaved === 'function') {
        storageApi.markSlotSaved(slotIndex, Date.now());
      }
      renderSaveRows();
      showSaveToast('menu.save.toast.saved');
      if (typeof opts.updateBigMenuLoadState === 'function') {
        opts.updateBigMenuLoadState();
      }
    });

    opts.ui.smallMenuSaveBack && opts.ui.smallMenuSaveBack.addEventListener('click', function () {
      openMainMenuView();
    });

    opts.ui.menuExit && opts.ui.menuExit.addEventListener('click', function () {
      markSmallMenuButtonActive('menuExit');
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
      if (typeof opts.setVolume === 'function') {
        opts.setVolume('sfx', e.target.value, 'percent');
      } else {
        var value = Number(e.target.value) / 100;
        var settings = getSettings();
        settings.sfxVolume = opts.clamp(value, 0, 1);
        opts.applyAudioSettings();
      }
      if (typeof opts.syncVolumeUIFromSettings === 'function') {
        opts.syncVolumeUIFromSettings();
      } else {
        opts.updateMenuVolumes();
      }
      opts.saveSettings();
    });

    opts.ui.menuMusic && opts.ui.menuMusic.addEventListener('input', function (e) {
      if (typeof opts.setVolume === 'function') {
        opts.setVolume('music', e.target.value, 'percent');
      } else {
        var value = Number(e.target.value) / 100;
        var settings = getSettings();
        settings.musicVolume = opts.clamp(value, 0, 1);
        opts.applyAudioSettings();
      }
      if (typeof opts.syncVolumeUIFromSettings === 'function') {
        opts.syncVolumeUIFromSettings();
      } else {
        opts.updateMenuVolumes();
      }
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
