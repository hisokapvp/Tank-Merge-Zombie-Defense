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
    if (savedLang) {
      opts.setLanguage(savedLang);
    } else {
      // Yandex Games i18n env hook (item 8 — solo-pipeline-yandex-vk batch A3).
      // If running under Yandex SDK and the user has no explicit `lang` localStorage
      // override, honour `ysdk.environment.i18n.lang` so the debug panel sees the
      // env language being read. Falls back to the existing default otherwise.
      var envLang = null;
      try {
        var yndx = windowObj && windowObj.Game && windowObj.Game.YandexSDK;
        if (yndx && typeof yndx.getPreferredLang === 'function') envLang = yndx.getPreferredLang();
      } catch (_) { envLang = null; }
      opts.setLanguage(envLang || opts.currentLang);
    }

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
    /* V1 talentDefs removed – initTalentDefs is now a no-op */
    if (typeof opts.initTalentDefs === 'function') opts.initTalentDefs();

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
    if (typeof opts.initTalentsV2 === 'function') {
      await opts.initTalentsV2();
    }
    var state = getState();
    if (state.supercomputer) {
      state.supercomputer.xpToNext = opts.xpNeededForLevel(state.supercomputer.computerLevel);
    } else {
      state.player.xpToNext = opts.xpNeededForLevel(state.player.level);
    }
    getState().player.modsDirty = true;

    var storageApi = windowObj.Game && windowObj.Game.Storage;
    var activeInlineEditSlotIndex = -1;
    var activeSlotViewMode = 'none';
    var saveToastTimer = null;
    var lastActiveButtonIdSmallMenu = null;
    var lastActiveButtonIdConfirm = null;
    var AUTO_SLOT_INDEX = storageApi && Number.isFinite(storageApi.AUTO_SLOT_INDEX) ? storageApi.AUTO_SLOT_INDEX : 9;
    var saveViewConfig = {
      manualOnly: false,
      exitAfterSave: false,
    };

    function resetSaveViewConfig() {
      saveViewConfig.manualOnly = false;
      saveViewConfig.exitAfterSave = false;
    }

    function isAutoSlot(slot, index) {
      if (slot && typeof slot === 'object' && Object.prototype.hasOwnProperty.call(slot, 'isAuto')) {
        return !!slot.isAuto;
      }
      return index === AUTO_SLOT_INDEX;
    }

    function getSmallMenuButtons() {
      return [opts.ui.menuContinue, opts.ui.menuNew, opts.ui.menuSave, opts.ui.menuLoad, opts.ui.menuExit];
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

    function getConfirmButtons() {
      return [opts.ui.menuExitConfirmLeave, opts.ui.menuExitConfirmCancel, opts.ui.menuNewConfirmStart, opts.ui.menuNewConfirmBack];
    }

    function applyConfirmSelectedState() {
      var buttons = getConfirmButtons();
      for (var i = 0; i < buttons.length; i++) {
        var button = buttons[i];
        if (!button || !button.id) continue;
        setMenuButtonSelected(button, button.id === lastActiveButtonIdConfirm);
      }
    }

    function markConfirmButtonActive(buttonId) {
      if (!buttonId) return;
      lastActiveButtonIdConfirm = buttonId;
      applyConfirmSelectedState();
    }

    function clearConfirmSelectedState() {
      lastActiveButtonIdConfirm = null;
      applyConfirmSelectedState();
    }

    function focusConfirmButton(buttonId) {
      if (!buttonId) return;
      var button = documentObj.getElementById(buttonId);
      if (!button || button.disabled) return;
      markConfirmButtonActive(buttonId);
      button.focus();
    }

    function bindConfirmButtonSelectedEvents(button) {
      if (!button || !button.id) return;
      button.addEventListener('pointerdown', function () {
        markConfirmButtonActive(button.id);
      });
      button.addEventListener('focus', function () {
        markConfirmButtonActive(button.id);
      });
    }

    function getSaveMeta() {
      if (storageApi && typeof storageApi.listSlots === 'function') {
        var list = storageApi.listSlots();
        return {
          slots: Array.isArray(list && list.slots) ? list.slots : [],
          ok: !!(list && list.ok),
        };
      }
      if (storageApi && typeof storageApi.loadSaveSlotsMeta === 'function') {
        return {
          slots: (storageApi.loadSaveSlotsMeta() || {}).slots || [],
          ok: true,
        };
      }
      return { slots: [], ok: false };
    }

    function defaultSlotName(index) {
      if (storageApi && typeof storageApi.getDefaultSlotName === 'function') {
        return storageApi.getDefaultSlotName(index);
      }
      return 'Слот ' + (index + 1);
    }

    function getSlotName(slot, index) {
      if (isAutoSlot(slot, index)) return opts.t('save.autoRetryName');
      var raw = slot && typeof slot === 'object' ? slot.name : '';
      if (typeof raw !== 'string') return defaultSlotName(index);
      var text = raw.trim();
      return text || defaultSlotName(index);
    }

    function slotHasData(slot) {
      if (!slot || typeof slot !== 'object') return false;
      if (Object.prototype.hasOwnProperty.call(slot, 'hasData')) return !!slot.hasData;
      return Number(slot.lastSavedAt) > 0;
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

    function setSlotViewsOpen(mode) {
      activeSlotViewMode = mode === 'save' || mode === 'load' ? mode : 'none';
      var visible = activeSlotViewMode !== 'none';
      if (opts.ui.smallMenuRootView && opts.ui.smallMenuRootView.classList) {
        opts.ui.smallMenuRootView.classList.toggle('is-hidden', visible);
      }
      if (opts.ui.smallMenuSaveView && opts.ui.smallMenuSaveView.classList) {
        var saveVisible = activeSlotViewMode === 'save';
        opts.ui.smallMenuSaveView.classList.toggle('is-active', saveVisible);
        opts.ui.smallMenuSaveView.setAttribute('aria-hidden', (!saveVisible).toString());
      }
      if (opts.ui.smallMenuLoadView && opts.ui.smallMenuLoadView.classList) {
        var loadVisible = activeSlotViewMode === 'load';
        opts.ui.smallMenuLoadView.classList.toggle('is-active', loadVisible);
        opts.ui.smallMenuLoadView.setAttribute('aria-hidden', (!loadVisible).toString());
      }
      if (!visible) {
        activeInlineEditSlotIndex = -1;
      }
    }

    function showSaveToast(messageKey) {
      var text = opts.t(messageKey || 'menu.save.toast.saved');
      var toastApi = windowObj.Game && windowObj.Game.Toast;
      if (toastApi && typeof toastApi.show === 'function') {
        toastApi.show(text, 1400);
      }
      if (!opts.ui.smallMenuSaveToast) return;
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

    function renderSlotRows(mode) {
      var targetRows = mode === 'load' ? opts.ui.smallMenuLoadRows : opts.ui.smallMenuSaveRows;
      if (!targetRows) return;
      var meta = getSaveMeta();
      var slots = Array.isArray(meta && meta.slots) ? meta.slots : [];
      targetRows.innerHTML = '';
      var rowCount = mode === 'save' && saveViewConfig.manualOnly ? 9 : 10;

      for (var i = 0; i < rowCount; i++) {
        var row = documentObj.createElement('div');
        row.className = 'smallMenuSaveTable__row';
        row.setAttribute('role', 'row');
        row.setAttribute('data-slot-index', String(i));

        var slot = slots[i] || null;
        var isAuto = isAutoSlot(slot, i);
        row.setAttribute('data-slot-auto', isAuto ? 'true' : 'false');

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
        if (mode === 'load') {
          saveButton.setAttribute('data-load-slot-btn', 'true');
        } else {
          saveButton.setAttribute('data-save-slot-btn', 'true');
        }
        saveButton.setAttribute('data-slot-index', String(i));
        if (mode === 'load') {
          saveButton.textContent = opts.t('menu.load.col.action');
          saveButton.disabled = !slotHasData(slot);
        } else {
          saveButton.textContent = opts.t('menu.save.col.action');
          saveButton.disabled = isAuto;
        }

        actionCell.appendChild(saveButton);

        row.appendChild(numberCell);
        row.appendChild(nameCell);
        row.appendChild(dateCell);
        row.appendChild(actionCell);

        targetRows.appendChild(row);
      }
    }

    function openNameInlineEdit(slotIndex) {
      if (!opts.ui.smallMenuSaveRows) return;
      var row = opts.ui.smallMenuSaveRows.querySelector('[data-slot-index="' + String(slotIndex) + '"]');
      if (!row) return;
      if (row.getAttribute('data-slot-auto') === 'true') return;
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
        renderSlotRows('save');
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
        newConfirm: opts.ui.menuNewConfirmView,
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
      resetSaveViewConfig();
      setSlotViewsOpen('none');
      clearConfirmSelectedState();
      setMenuView('main');
      applySmallMenuSelectedState();
    }

    function openSaveView(config) {
      var cfg = config && typeof config === 'object' ? config : {};
      saveViewConfig.manualOnly = !!cfg.manualOnly;
      saveViewConfig.exitAfterSave = !!cfg.exitAfterSave;
      setSlotViewsOpen('save');
      renderSlotRows('save');
      if (typeof opts.updateBigMenuLoadState === 'function') {
        opts.updateBigMenuLoadState();
      }
    }

    function openLoadView() {
      resetSaveViewConfig();
      setSlotViewsOpen('load');
      renderSlotRows('load');
      if (typeof opts.updateBigMenuLoadState === 'function') {
        opts.updateBigMenuLoadState();
      }
    }

    function performSaveToSlot(slotIndex) {
      if (!storageApi || typeof storageApi.saveSlot !== 'function') {
        showSaveToast('menu.save.toast.error');
        return false;
      }
      var payload = getState();
      if (typeof opts.buildSavePayload === 'function') {
        try {
          var customPayload = opts.buildSavePayload(slotIndex, {
            manualOnly: !!saveViewConfig.manualOnly,
            exitAfterSave: !!saveViewConfig.exitAfterSave,
          });
          if (customPayload && typeof customPayload === 'object') {
            payload = customPayload;
          }
        } catch (_) {}
      }
      var result = storageApi.saveSlot(slotIndex, payload);
      if (!result || !result.ok) {
        showSaveToast('menu.save.toast.error');
        return false;
      }
      if (opts.meta) opts.meta.lastSeenAt = Date.now();
      if (typeof opts.saveProgress === 'function') {
        try { opts.saveProgress(); } catch (_) {}
      }
      renderSlotRows('save');
      showSaveToast('menu.save.toast.saved');
      if (typeof opts.updateBigMenuLoadState === 'function') {
        opts.updateBigMenuLoadState();
      }
      if (saveViewConfig.exitAfterSave && typeof opts.onCriticalSaveExitCompleted === 'function') {
        opts.onCriticalSaveExitCompleted(slotIndex);
      }
      return true;
    }

    function performLoadFromSlot(slotIndex) {
      if (!storageApi || typeof storageApi.loadSlot !== 'function') {
        showSaveToast('menu.load.toast.error');
        return false;
      }
      var loaded = storageApi.loadSlot(slotIndex);
      if (!loaded || !loaded.ok || !loaded.payload || !Array.isArray(loaded.payload.cells)) {
        showSaveToast('menu.load.toast.error');
        renderSlotRows('load');
        return false;
      }
      if (typeof opts.restoreFullState === 'function') {
        opts.restoreFullState(loaded.payload);
      }
      if (typeof opts.postRestoreSync === 'function') {
        opts.postRestoreSync();
      }
      if (opts.meta) opts.meta.lastSeenAt = Date.now();
      if (typeof opts.saveProgress === 'function') {
        try { opts.saveProgress(); } catch (_) {}
      }
      if (typeof opts.updateUI === 'function') {
        opts.updateUI();
      }
      showSaveToast('menu.load.toast.loaded');
      opts.setMenuOpen(false);
      return true;
    }

    function openMenuOverlayMain() {
      openMainMenuView();
      if (typeof opts.syncVolumeUIFromSettings === 'function') {
        opts.syncVolumeUIFromSettings();
      }
      opts.setMenuOpen(true);
    }

    if (typeof opts.onSmallMenuApiReady === 'function') {
      opts.onSmallMenuApiReady({
        openSaveView: function (config) {
          openSaveView(config);
          opts.setMenuOpen(true);
        },
        openCriticalSaveView: function () {
          markSmallMenuButtonActive('menuSave');
          openSaveView({ manualOnly: true, exitAfterSave: true });
          opts.setMenuOpen(true);
        },
      });
    }

    function openExitConfirmView() {
      lastActiveButtonIdSmallMenu = null;
      applySmallMenuSelectedState();
      clearConfirmSelectedState();
      setMenuView('exit');
    }

    function openNewConfirmView() {
      lastActiveButtonIdSmallMenu = null;
      applySmallMenuSelectedState();
      clearConfirmSelectedState();
      setMenuView('newConfirm');
    }

    opts.ui.menuExitConfirmView && opts.ui.menuExitConfirmView.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        focusConfirmButton('menuExitConfirmLeave');
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        focusConfirmButton('menuExitConfirmCancel');
      }
    });

    opts.ui.menuNewConfirmView && opts.ui.menuNewConfirmView.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        focusConfirmButton('menuNewConfirmStart');
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        focusConfirmButton('menuNewConfirmBack');
      }
    });

    bindConfirmButtonSelectedEvents(opts.ui.menuExitConfirmLeave);
    bindConfirmButtonSelectedEvents(opts.ui.menuExitConfirmCancel);
    bindConfirmButtonSelectedEvents(opts.ui.menuNewConfirmStart);
    bindConfirmButtonSelectedEvents(opts.ui.menuNewConfirmBack);

    opts.ui.menuContinue && opts.ui.menuContinue.addEventListener('click', function () {
      if (typeof opts.isSessionStartUnlocked === 'function' && !opts.isSessionStartUnlocked()) {
        return;
      }
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
      // localStorageObj.removeItem('progress'); opts.resetGameState({ reason: 'new_game' });
      openNewConfirmView();
    });
    opts.ui.menuNewConfirmStart && opts.ui.menuNewConfirmStart.addEventListener('click', function () {
      if (typeof opts.unlockSessionStartGate === 'function') opts.unlockSessionStartGate();
      localStorageObj.removeItem('progress');
      opts.resetGameState({ reason: 'new_game' });
      opts.meta.lastSeenAt = Date.now();
      opts.saveProgress();
      openMainMenuView();
      opts.setMenuOpen(false);
      if (windowObj.Game && windowObj.Game.TutorialRuntime && typeof windowObj.Game.TutorialRuntime.syncNow === 'function') {
        windowObj.Game.TutorialRuntime.syncNow();
      }
    });
    opts.ui.menuNewConfirmBack && opts.ui.menuNewConfirmBack.addEventListener('click', function () {
      openMainMenuView();
    });

    opts.ui.menuSave && opts.ui.menuSave.addEventListener('click', function () {
      markSmallMenuButtonActive('menuSave');
      openSaveView({ manualOnly: false, exitAfterSave: false });
    });
    opts.ui.menuLoad && opts.ui.menuLoad.addEventListener('click', function () {
      markSmallMenuButtonActive('menuLoad');
      openLoadView();
    });
    opts.ui.smallMenuSaveRows && opts.ui.smallMenuSaveRows.addEventListener('pointerdown', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('[data-save-slot-btn="true"]')) return;
      if (activeInlineEditSlotIndex >= 0) return;
      var slotIndex = parseSlotIndexFromNode(target);
      if (slotIndex < 0) return;
      var row = target.closest('[data-slot-index]');
      if (row && row.getAttribute('data-slot-auto') === 'true') return;
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
      performSaveToSlot(slotIndex);
    });
    opts.ui.smallMenuLoadRows && opts.ui.smallMenuLoadRows.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      var loadBtn = target.closest('[data-load-slot-btn="true"]');
      if (!loadBtn) return;
      if (loadBtn.disabled) return;
      var slotIndex = Number(loadBtn.getAttribute('data-slot-index'));
      if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex > 9) return;
      performLoadFromSlot(slotIndex);
    });

    opts.ui.smallMenuSaveBack && opts.ui.smallMenuSaveBack.addEventListener('click', function () {
      openMainMenuView();
    });
    opts.ui.smallMenuLoadBack && opts.ui.smallMenuLoadBack.addEventListener('click', function () {
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
      var pct = Math.round(Number(e.target.value));
      if (typeof opts.setVolume === 'function') {
        opts.setVolume('sfx', pct, 'percent');
      } else {
        var value = pct / 100;
        var settings = getSettings();
        settings.sfxVolume = opts.clamp(value, 0, 1);
        opts.applyAudioSettings();
      }
      if (typeof opts.syncVolumeUIFromSettings === 'function') {
        opts.syncVolumeUIFromSettings();
      } else {
        if (opts.ui.menuSfxValue) opts.ui.menuSfxValue.textContent = pct + '%';
      }
      if (typeof opts.playUiSliderPreviewSfxThrottled === 'function') {
        opts.playUiSliderPreviewSfxThrottled();
      }
      opts.saveSettings();
    });

    opts.ui.menuMusic && opts.ui.menuMusic.addEventListener('input', function (e) {
      var pct = Math.round(Number(e.target.value));
      if (typeof opts.setVolume === 'function') {
        opts.setVolume('music', pct, 'percent');
      } else {
        var value = pct / 100;
        var settings = getSettings();
        settings.musicVolume = opts.clamp(value, 0, 1);
        opts.applyAudioSettings();
      }
      if (typeof opts.syncVolumeUIFromSettings === 'function') {
        opts.syncVolumeUIFromSettings();
      } else {
        if (opts.ui.menuMusicValue) opts.ui.menuMusicValue.textContent = pct + '%';
      }
      opts.saveSettings();
    });

    opts.ui.menuAutoPause && opts.ui.menuAutoPause.addEventListener('change', function (e) {
      var checked = !!(e && e.target && e.target.checked);
      if (typeof opts.setAutoPauseEnabled === 'function') {
        opts.setAutoPauseEnabled(checked);
      } else {
        var settings = getSettings();
        settings.autoPauseOnInactive = checked;
      }
      if (typeof opts.syncVolumeUIFromSettings === 'function') {
        opts.syncVolumeUIFromSettings();
      } else {
        opts.updateMenuVolumes();
      }
      opts.saveSettings();
    });

    opts.ui.menuTutorialToggle && opts.ui.menuTutorialToggle.addEventListener('change', function (e) {
      var checked = !!(e && e.target && e.target.checked);
      var TutorialRuntime = global.Game && global.Game.TutorialRuntime;
      if (!TutorialRuntime) return;
      if (checked) {
        if (typeof TutorialRuntime.enableTutorial === 'function') TutorialRuntime.enableTutorial();
      } else {
        if (typeof TutorialRuntime.disableTutorial === 'function') TutorialRuntime.disableTutorial();
      }
    });

    opts.ui.supercomputerBtn && opts.ui.supercomputerBtn.addEventListener('click', function () {
      if (typeof opts.openSupercomputerMenu === 'function') return opts.openSupercomputerMenu();
      return opts.openTalents();
    });
    opts.ui.settingsBtn && opts.ui.settingsBtn.addEventListener('click', function () {
      return openMenuOverlayMain();
    });

    var settingsTooltip = documentObj.getElementById('settingsTooltip');
    if (settingsTooltip) {
      var activeTooltipTarget = null;

      function hideUnifiedTooltip() {
        activeTooltipTarget = null;
        settingsTooltip.classList.add('hidden');
        settingsTooltip.setAttribute('aria-hidden', 'true');
      }

      function positionUnifiedTooltip(clientX, clientY) {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
        settingsTooltip.style.left = clientX + 'px';
        settingsTooltip.style.top = (clientY + 12) + 'px';
        settingsTooltip.style.transform = 'translate(-50%, 0)';
      }

      function getTooltipText(target) {
        if (!target || !target.getAttribute) return '';
        var text = target.getAttribute('data-ui-tooltip');
        return typeof text === 'string' ? text.trim() : '';
      }

      documentObj.addEventListener('pointerover', function (event) {
        var target = event && event.target && event.target.closest
          ? event.target.closest('[data-ui-tooltip]')
          : null;
        if (!target) {
          hideUnifiedTooltip();
          return;
        }
        var text = getTooltipText(target);
        if (!text) {
          hideUnifiedTooltip();
          return;
        }
        activeTooltipTarget = target;
        settingsTooltip.textContent = text;
        settingsTooltip.classList.remove('hidden');
        settingsTooltip.setAttribute('aria-hidden', 'false');
        positionUnifiedTooltip(event.clientX, event.clientY);
      }, true);

      documentObj.addEventListener('pointermove', function (event) {
        if (!activeTooltipTarget) return;
        if (!documentObj.body || !documentObj.body.contains(activeTooltipTarget)) {
          hideUnifiedTooltip();
          return;
        }
        var text = getTooltipText(activeTooltipTarget);
        if (!text) {
          hideUnifiedTooltip();
          return;
        }
        settingsTooltip.textContent = text;
        positionUnifiedTooltip(event.clientX, event.clientY);
      }, true);

      documentObj.addEventListener('pointerout', function (event) {
        if (!activeTooltipTarget) return;
        var related = event ? event.relatedTarget : null;
        if (related && activeTooltipTarget.contains && activeTooltipTarget.contains(related)) return;
        if (event && event.target && activeTooltipTarget.contains && activeTooltipTarget.contains(event.target)) {
          hideUnifiedTooltip();
        }
      }, true);

      documentObj.addEventListener('touchstart', function (event) {
        var target = event && event.target && event.target.closest
          ? event.target.closest('[data-ui-tooltip]')
          : null;
        if (!target) {
          hideUnifiedTooltip();
          return;
        }
        var text = getTooltipText(target);
        if (!text) {
          hideUnifiedTooltip();
          return;
        }
        activeTooltipTarget = target;
        settingsTooltip.textContent = text;
        settingsTooltip.classList.remove('hidden');
        settingsTooltip.setAttribute('aria-hidden', 'false');
        var touch = event.touches && event.touches[0] ? event.touches[0] : null;
        if (touch) {
          positionUnifiedTooltip(touch.clientX, touch.clientY + 12);
        }
      }, { passive: true, capture: true });

      documentObj.addEventListener('touchend', hideUnifiedTooltip, { passive: true, capture: true });
      documentObj.addEventListener('touchcancel', hideUnifiedTooltip, { passive: true, capture: true });
      documentObj.addEventListener('visibilitychange', function () {
        if (documentObj.visibilityState === 'hidden') hideUnifiedTooltip();
      });
    }

    opts.ui.levelAccept && opts.ui.levelAccept.addEventListener('click', function () { return opts.acceptLevelReward(); });
    windowObj.addEventListener('resize', opts.resizeCanvas);
    if (windowObj.visualViewport) {
      windowObj.visualViewport.addEventListener('resize', opts.resizeCanvas);
    }

    opts.resizeCanvas();
    if (loaded && loaded.state) {
      opts.restoreFullState(loaded.state);
      if (typeof opts.postRestoreSync === 'function') {
        opts.postRestoreSync();
      }
    }
    getState().nextCrateAt = getState().nextCrateAt || opts.nowSec() + opts.BAL.crateIntervalSec;

    if (windowObj.Game && windowObj.Game.Telemetry) windowObj.Game.Telemetry.loadLifetime();
    if (windowObj.Game && windowObj.Game.Flags) windowObj.Game.Flags.init();
    if (windowObj.Game && windowObj.Game.MobileMode) windowObj.Game.MobileMode.init();
    if (windowObj.Game && windowObj.Game.Experiments) windowObj.Game.Experiments.init();
    if (windowObj.Game && windowObj.Game.Funnel) windowObj.Game.Funnel.init();

    if (opts.DebugPanelEnabled) opts.initDebugPanel();
    if (opts.DebugPanelEnabled && windowObj.Game && windowObj.Game.AdminFlags) windowObj.Game.AdminFlags.init();
    if (opts.DebugPanelEnabled && windowObj.Game && windowObj.Game.AdminDamagePoints) windowObj.Game.AdminDamagePoints.init();

    if (typeof opts.ensureStarterTanks === 'function') {
      opts.ensureStarterTanks(getState(), 1);
    } else if (getState().cells[0] && getState().cells[1] && !getState().cells.some(function (c) { return c.tank; })) {
      getState().cells[0].tank = opts.makeTank(1, false);
      opts.recordTankLevel(1);
    }

    if (windowObj.Game && windowObj.Game.TutorialRuntime && typeof windowObj.Game.TutorialRuntime.init === 'function') {
      windowObj.Game.TutorialRuntime.init({
        documentObj: documentObj,
        getState: getState,
        saveProgress: opts.saveProgress,
        updateUi: opts.updateUI,
        enterCriticalPause: opts.enterCriticalPause,
        exitCriticalPause: opts.exitCriticalPause,
        t: opts.t,
        ui: opts.ui,
      });
    }

    documentObj.addEventListener('visibilitychange', function () {
      if (documentObj.visibilityState === 'hidden' && windowObj.Game && windowObj.Game.Storage) {
        if (typeof opts.stopTrackLoopSfxImmediate === 'function') {
          opts.stopTrackLoopSfxImmediate();
        }
        opts.meta.lastSeenAt = Date.now();
        windowObj.Game.Storage.saveGame(getState(), opts.meta);
        return;
      }
      if (documentObj.visibilityState === 'visible') {
        return;
      }
    });

    windowObj.addEventListener('pagehide', function () {
      if (typeof opts.stopTrackLoopSfxImmediate === 'function') {
        opts.stopTrackLoopSfxImmediate();
      }
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
    // Underground Hangar sprites
    {
      const _UH = windowObj.Game && windowObj.Game.UndergroundHangar;
      if (_UH && typeof _UH.load === 'function') {
        await _UH.load().catch(function () {});
      }
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

    if (opts.initialMenuSubView === 'load') {
      openLoadView();
    } else {
      openMainMenuView();
    }

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
