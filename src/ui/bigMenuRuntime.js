(function (global) {
  'use strict';

  function createController(deps) {
    deps = deps || {};

    var runtime = {
      bigMenuLanguageOutsideListener: null,
      bigMenuSoundOutsideListener: null,
      creditsEscListener: null,
      bigMenuInitialized: false,
      bigMenuStartPending: false,
      lastActiveButtonIdBigMenu: null,
      bigMenuViewMode: 'root',
      creditsDataLoaded: false,
      creditsData: [],
    };

    function setBigMenuOpen(open) {
      var ui = deps.getUi();
      if (!ui.bigMenuOverlay) return;
      deps.setMenuPauseSource('bigMenu', !!open);
      ui.bigMenuOverlay.classList.toggle('bigMenuOverlayHidden', !open);
      ui.bigMenuOverlay.setAttribute('aria-hidden', (!open).toString());
      if (open) deps.syncVolumeUIFromSettings();

      var documentObj = global.document;
      if (documentObj && documentObj.body) {
        documentObj.body.classList.toggle('big-menu-open', !!open);
      }
    }

    function isBigMenuOpen() {
      var ui = deps.getUi();
      return !!(ui.bigMenuOverlay && !ui.bigMenuOverlay.classList.contains('bigMenuOverlayHidden'));
    }

    function setBigMenuView(mode) {
      var ui = deps.getUi();
      runtime.bigMenuViewMode = mode === 'load' ? 'load' : 'root';
      var rootVisible = runtime.bigMenuViewMode === 'root';
      if (ui.bigMenuRootView && ui.bigMenuRootView.classList) {
        ui.bigMenuRootView.classList.toggle('is-hidden', !rootVisible);
        ui.bigMenuRootView.setAttribute('aria-hidden', (!rootVisible).toString());
      }
      if (ui.bigMenuLoadView && ui.bigMenuLoadView.classList) {
        ui.bigMenuLoadView.classList.toggle('is-active', !rootVisible);
        ui.bigMenuLoadView.setAttribute('aria-hidden', rootVisible.toString());
      }
    }

    function openBigMenuRootView() {
      closeBigMenuPanels();
      setBigMenuView('root');
    }

    function openBigMenuLoadView() {
      closeBigMenuPanels();
      renderBigMenuLoadRows();
      setBigMenuView('load');
    }

    function getBigMenuSaveMeta() {
      var storageApi = global.Game && global.Game.Storage;
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

    function getBigMenuDefaultSlotName(index) {
      var storageApi = global.Game && global.Game.Storage;
      if (storageApi && typeof storageApi.getDefaultSlotName === 'function') {
        return storageApi.getDefaultSlotName(index);
      }
      return 'Слот ' + (index + 1);
    }

    function isAutoSlot(slot, index) {
      if (slot && typeof slot === 'object' && Object.prototype.hasOwnProperty.call(slot, 'isAuto')) {
        return !!slot.isAuto;
      }
      var storageApi = global.Game && global.Game.Storage;
      var autoIndex = storageApi && Number.isFinite(storageApi.AUTO_SLOT_INDEX) ? storageApi.AUTO_SLOT_INDEX : 9;
      return index === autoIndex;
    }

    function getBigMenuSlotName(slot, index) {
      if (isAutoSlot(slot, index)) return deps.t('save.autoRetryName');
      var raw = slot && typeof slot === 'object' ? slot.name : '';
      if (typeof raw !== 'string') return getBigMenuDefaultSlotName(index);
      var text = raw.trim();
      return text || getBigMenuDefaultSlotName(index);
    }

    function bigMenuSlotHasData(slot) {
      if (!slot || typeof slot !== 'object') return false;
      if (Object.prototype.hasOwnProperty.call(slot, 'hasData')) return !!slot.hasData;
      return Number(slot.lastSavedAt) > 0;
    }

    function pad2ForBigMenu(value) {
      var num = Number(value);
      if (!Number.isFinite(num)) return '00';
      var intNum = Math.max(0, Math.floor(num));
      return intNum < 10 ? '0' + intNum : String(intNum);
    }

    function formatDateForBigMenu(ms) {
      var timestamp = Number(ms);
      if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
      var date = new Date(Math.floor(timestamp));
      if (!Number.isFinite(date.getTime())) return '—';
      return date.getFullYear() + '-' + pad2ForBigMenu(date.getMonth() + 1) + '-' + pad2ForBigMenu(date.getDate()) + ' ' + pad2ForBigMenu(date.getHours()) + ':' + pad2ForBigMenu(date.getMinutes());
    }

    function renderBigMenuLoadRows() {
      var ui = deps.getUi();
      if (!ui.bigMenuLoadRows) return;
      var meta = getBigMenuSaveMeta();
      var slots = Array.isArray(meta && meta.slots) ? meta.slots : [];
      ui.bigMenuLoadRows.innerHTML = '';
      for (var i = 0; i < 10; i++) {
        var slot = slots[i] || null;
        var row = document.createElement('div');
        row.className = 'smallMenuSaveTable__row';
        row.setAttribute('role', 'row');

        var numberCell = document.createElement('div');
        numberCell.className = 'smallMenuSaveTable__cell smallMenuSaveTable__cell_num';
        numberCell.setAttribute('role', 'cell');
        numberCell.textContent = String(i + 1);

        var nameCell = document.createElement('div');
        nameCell.className = 'smallMenuSaveTable__cell smallMenuSaveTable__cell_name';
        nameCell.setAttribute('role', 'cell');
        var nameText = document.createElement('span');
        nameText.className = 'smallMenuSaveNameText';
        nameText.textContent = getBigMenuSlotName(slot, i);
        nameCell.appendChild(nameText);

        var dateCell = document.createElement('div');
        dateCell.className = 'smallMenuSaveTable__cell smallMenuSaveTable__cell_date';
        dateCell.setAttribute('role', 'cell');
        dateCell.textContent = formatDateForBigMenu(slot && slot.lastSavedAt);

        var actionCell = document.createElement('div');
        actionCell.className = 'smallMenuSaveTable__cell smallMenuSaveTable__cell_action';
        actionCell.setAttribute('role', 'cell');

        var loadButton = document.createElement('button');
        loadButton.type = 'button';
        loadButton.className = 'btn btnSecondary uiButtonBehavior smallMenuSaveSlotBtn';
        loadButton.setAttribute('data-big-load-slot-btn', 'true');
        loadButton.setAttribute('data-slot-index', String(i));
        loadButton.textContent = deps.t('menu.load.col.action');
        loadButton.disabled = !bigMenuSlotHasData(slot);

        actionCell.appendChild(loadButton);

        row.appendChild(numberCell);
        row.appendChild(nameCell);
        row.appendChild(dateCell);
        row.appendChild(actionCell);
        ui.bigMenuLoadRows.appendChild(row);
      }
    }

    function parseBigMenuSlotIndexFromNode(node) {
      if (!node || typeof node.closest !== 'function') return -1;
      var btn = node.closest('[data-big-load-slot-btn="true"]');
      if (!btn) return -1;
      var slotIndex = Number(btn.getAttribute('data-slot-index'));
      if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex > 9) return -1;
      return Math.floor(slotIndex);
    }

    function loadSlotPayloadForBigMenu(slotIndex) {
      var storageApi = global.Game && global.Game.Storage;
      if (!storageApi || typeof storageApi.loadSlot !== 'function') return null;
      var loaded = storageApi.loadSlot(slotIndex);
      if (!loaded || !loaded.ok || !loaded.payload || !Array.isArray(loaded.payload.cells)) {
        return null;
      }
      return loaded.payload;
    }

    function getBigMenuActionButtons() {
      var ui = deps.getUi();
      return [ui.bigMenuNew, ui.bigMenuLoad, ui.bigMenuSound, ui.bigMenuLanguage, ui.bigMenuDevs];
    }

    function setMenuActionButtonSelected(button, selected) {
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

    function applyBigMenuSelectedState() {
      var buttons = getBigMenuActionButtons();
      for (var i = 0; i < buttons.length; i++) {
        var button = buttons[i];
        if (!button || !button.id) continue;
        setMenuActionButtonSelected(button, button.id === runtime.lastActiveButtonIdBigMenu);
      }
    }

    function markBigMenuButtonActive(buttonId) {
      if (!buttonId) return;
      runtime.lastActiveButtonIdBigMenu = buttonId;
      applyBigMenuSelectedState();
    }

    function removeBigMenuSoundOutsideListener() {
      if (!runtime.bigMenuSoundOutsideListener) return;
      document.removeEventListener('pointerdown', runtime.bigMenuSoundOutsideListener, true);
      runtime.bigMenuSoundOutsideListener = null;
    }

    function closeBigMenuSoundPanel() {
      var ui = deps.getUi();
      if (!ui.bigMenuSoundPanel) return;
      ui.bigMenuSoundPanel.classList.remove('is-open');
      ui.bigMenuSoundPanel.setAttribute('aria-hidden', 'true');
      removeBigMenuSoundOutsideListener();
    }

    function toggleBigMenuSoundPanel() {
      var ui = deps.getUi();
      if (!ui.bigMenuSoundPanel) return;
      var shouldOpen = !ui.bigMenuSoundPanel.classList.contains('is-open');
      closeBigMenuPanels();
      if (!shouldOpen) return;
      ui.bigMenuSoundPanel.classList.add('is-open');
      ui.bigMenuSoundPanel.setAttribute('aria-hidden', 'false');
      if (!runtime.bigMenuSoundOutsideListener) {
        runtime.bigMenuSoundOutsideListener = function (event) {
          if (!ui.bigMenuSoundWrap) return;
          if (ui.bigMenuSoundWrap.contains(event.target)) return;
          closeBigMenuSoundPanel();
        };
        document.addEventListener('pointerdown', runtime.bigMenuSoundOutsideListener, true);
      }
    }

    function removeBigMenuLanguageOutsideListener() {
      if (!runtime.bigMenuLanguageOutsideListener) return;
      document.removeEventListener('pointerdown', runtime.bigMenuLanguageOutsideListener, true);
      runtime.bigMenuLanguageOutsideListener = null;
    }

    function closeBigMenuLanguagePanel() {
      var ui = deps.getUi();
      if (!ui.bigMenuLanguagePanel) return;
      ui.bigMenuLanguagePanel.classList.remove('is-open');
      ui.bigMenuLanguagePanel.classList.add('bigMenuLanguagePanelClosed');
      ui.bigMenuLanguagePanel.setAttribute('aria-hidden', 'true');
      removeBigMenuLanguageOutsideListener();
    }

    function toggleBigMenuLanguagePanel() {
      var ui = deps.getUi();
      if (!ui.bigMenuLanguagePanel) return;
      var shouldOpen = !ui.bigMenuLanguagePanel.classList.contains('is-open');
      closeBigMenuPanels();
      if (!shouldOpen) return;
      ui.bigMenuLanguagePanel.classList.remove('bigMenuLanguagePanelClosed');
      ui.bigMenuLanguagePanel.classList.add('is-open');
      ui.bigMenuLanguagePanel.setAttribute('aria-hidden', 'false');
      if (!runtime.bigMenuLanguageOutsideListener) {
        runtime.bigMenuLanguageOutsideListener = function (event) {
          if (!ui.bigMenuLanguageWrap) return;
          if (ui.bigMenuLanguageWrap.contains(event.target)) return;
          closeBigMenuLanguagePanel();
        };
        document.addEventListener('pointerdown', runtime.bigMenuLanguageOutsideListener, true);
      }
    }

    function closeBigMenuPanels() {
      closeBigMenuSoundPanel();
      closeBigMenuLanguagePanel();
    }

    function toggleBigMenuPanel(panel) {
      if (!panel) return;
      var shouldOpen = panel.classList.contains('bigMenuSubpanelHidden');
      closeBigMenuPanels();
      if (shouldOpen) {
        panel.classList.remove('bigMenuSubpanelHidden');
        panel.setAttribute('aria-hidden', 'false');
      }
    }

    function updateBigMenuVolumeState() {
      deps.syncVolumeUIFromSettings();
    }

    function applyBigMenuLanguageSelectedState() {
      var ui = deps.getUi();
      if (!ui.bigMenuLangRu || !ui.bigMenuLangEn) return;
      var lang = deps.getCurrentLang();
      setMenuActionButtonSelected(ui.bigMenuLangRu, lang === 'ru');
      setMenuActionButtonSelected(ui.bigMenuLangEn, lang === 'en');
      ui.bigMenuLangRu.setAttribute('aria-pressed', (lang === 'ru').toString());
      ui.bigMenuLangEn.setAttribute('aria-pressed', (lang === 'en').toString());
    }

    function getCreditsRole(item, lang) {
      if (!item || typeof item !== 'object') return '';
      if (lang === 'en') {
        if (typeof item.role_en === 'string' && item.role_en.trim()) return item.role_en.trim();
        if (typeof item.role_ru === 'string' && item.role_ru.trim()) return item.role_ru.trim();
        return '';
      }
      if (typeof item.role_ru === 'string' && item.role_ru.trim()) return item.role_ru.trim();
      if (typeof item.role_en === 'string' && item.role_en.trim()) return item.role_en.trim();
      return '';
    }

    async function loadCreditsData() {
      if (runtime.creditsDataLoaded) return runtime.creditsData;
      try {
        var response = await fetch('assets/credits.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('credits.json load failed');
        var parsed = await response.json();
        if (!Array.isArray(parsed)) {
          runtime.creditsData = [];
          runtime.creditsDataLoaded = true;
          return runtime.creditsData;
        }
        var normalized = [];
        for (var i = 0; i < parsed.length; i++) {
          var item = parsed[i];
          if (!item || typeof item !== 'object') continue;
          var name = typeof item.name === 'string' ? item.name.trim() : '';
          if (!name) continue;
          normalized.push({
            name: name,
            role_ru: typeof item.role_ru === 'string' ? item.role_ru.trim() : '',
            role_en: typeof item.role_en === 'string' ? item.role_en.trim() : '',
          });
        }
        runtime.creditsData = normalized;
      } catch (e) {
        runtime.creditsData = [];
      }
      runtime.creditsDataLoaded = true;
      return runtime.creditsData;
    }

    function renderCreditsModalList(items) {
      var ui = deps.getUi();
      if (!ui.creditsModalList) return;
      ui.creditsModalList.innerHTML = '';
      if (!Array.isArray(items) || !items.length) {
        var empty = document.createElement('div');
        empty.className = 'creditsModal__empty';
        empty.textContent = deps.t('creditsModalEmpty');
        ui.creditsModalList.appendChild(empty);
        return;
      }

      var lang = deps.getCurrentLang();
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var row = document.createElement('div');
        row.className = 'creditsModal__item';

        var nameEl = document.createElement('div');
        nameEl.className = 'creditsModal__name';
        nameEl.textContent = item.name;

        var roleEl = document.createElement('div');
        roleEl.className = 'creditsModal__role';
        roleEl.textContent = getCreditsRole(item, lang);

        row.appendChild(nameEl);
        row.appendChild(roleEl);
        ui.creditsModalList.appendChild(row);
      }
    }

    function closeCreditsModal() {
      var ui = deps.getUi();
      if (!ui.creditsModal) return;
      ui.creditsModal.classList.add('hidden');
      ui.creditsModal.setAttribute('aria-hidden', 'true');
      deps.a11yClose(ui.creditsModal);
      if (runtime.creditsEscListener) {
        document.removeEventListener('keydown', runtime.creditsEscListener);
        runtime.creditsEscListener = null;
      }
    }

    async function openCreditsModal() {
      var ui = deps.getUi();
      if (!ui.creditsModal) return;
      closeBigMenuPanels();
      if (ui.creditsModalTitle) ui.creditsModalTitle.textContent = deps.t('creditsModalTitle');
      if (ui.creditsModalList) {
        ui.creditsModalList.innerHTML = '';
      }
      ui.creditsModal.classList.remove('hidden');
      ui.creditsModal.setAttribute('aria-hidden', 'false');
      deps.a11yOpen(ui.creditsModal, { initialFocus: ui.creditsModalClose, onClose: closeCreditsModal });
      if (!runtime.creditsEscListener) {
        runtime.creditsEscListener = function (event) {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          closeCreditsModal();
        };
        document.addEventListener('keydown', runtime.creditsEscListener);
      }
      var data = await loadCreditsData();
      if (!ui.creditsModal || ui.creditsModal.classList.contains('hidden')) return;
      renderCreditsModalList(data);
    }

    function hasSaves() {
      var storageApi = global.Game && global.Game.Storage;
      if (storageApi && typeof storageApi.hasAnySaves === 'function') {
        try {
          return !!storageApi.hasAnySaves();
        } catch (e) {
          return false;
        }
      }

      if (storageApi && typeof storageApi.loadSaveSlotsMeta === 'function') {
        var meta = storageApi.loadSaveSlotsMeta();
        var slots = Array.isArray(meta && meta.slots) ? meta.slots : [];
        for (var i = 0; i < slots.length; i++) {
          var slot = slots[i];
          var ts = Number(slot && slot.lastSavedAt);
          if (Number.isFinite(ts) && ts > 0) return true;
        }
      }
      return false;
    }

    function renderBigMenuTexts() {
      var ui = deps.getUi();
      if (!ui.bigMenuOverlay) return;

      var hasSave = hasSaves();
      var noSaveText = deps.t('bigMenuNoSave');

      var bigMenuTitle = document.getElementById('bigMenuTitle');
      if (bigMenuTitle) bigMenuTitle.textContent = deps.t('menuTitle');

      var bigMenuActions = ui.bigMenuOverlay.querySelector('.bigMenuActions');
      if (bigMenuActions) bigMenuActions.setAttribute('aria-label', deps.t('menuSubtitle'));

      if (ui.bigMenuNew) ui.bigMenuNew.textContent = deps.t('menuNew');
      if (ui.bigMenuLoad) ui.bigMenuLoad.textContent = deps.t('bigMenuLoad');
      if (ui.bigMenuLoadBack) ui.bigMenuLoadBack.textContent = deps.t('common.back');
      if (ui.bigMenuSound) ui.bigMenuSound.textContent = deps.t('bigMenuSound');
      if (ui.bigMenuLanguage) ui.bigMenuLanguage.textContent = deps.t('menuLanguage');
      if (ui.bigMenuDevs) ui.bigMenuDevs.textContent = deps.t('bigMenuDevs');

      if (ui.bigMenuLoad) {
        if (hasSave) ui.bigMenuLoad.removeAttribute('title');
        else ui.bigMenuLoad.setAttribute('title', noSaveText);
      }

      var soundTitle = ui.bigMenuOverlay.querySelector('#bigMenuSoundPanel .bigMenuSubpanelTitle');
      var soundSfxLabel = ui.bigMenuOverlay.querySelector('#bigMenuSfxLabel');
      var soundMusicLabel = ui.bigMenuOverlay.querySelector('#bigMenuMusicLabel');
      var soundAutoPauseLabel = ui.bigMenuOverlay.querySelector('#bigMenuAutoPauseLabel');
      var rootAutoPauseText = ui.bigMenuOverlay.querySelector('#bigMenuRootAutoPauseLabel .menuLabel');
      if (soundTitle) soundTitle.textContent = deps.t('bigMenuSound');
      if (soundSfxLabel) soundSfxLabel.textContent = deps.t('bigMenuSfx');
      if (soundMusicLabel) soundMusicLabel.textContent = deps.t('bigMenuMusic');
      if (soundAutoPauseLabel) soundAutoPauseLabel.textContent = deps.t('menuAutoPause');
      if (rootAutoPauseText) rootAutoPauseText.textContent = deps.t('menuAutoPause');

      var languageTitle = ui.bigMenuOverlay.querySelector('#bigMenuLanguagePanel .bigMenuSubpanelTitle');
      if (languageTitle) languageTitle.textContent = deps.t('menuLanguage');
      if (ui.bigMenuLangRu) ui.bigMenuLangRu.textContent = deps.t('languageRussian');
      if (ui.bigMenuLangEn) ui.bigMenuLangEn.textContent = deps.t('languageEnglish');
      applyBigMenuLanguageSelectedState();
      if (ui.creditsModalTitle) ui.creditsModalTitle.textContent = deps.t('creditsModalTitle');
      if (ui.creditsModal && !ui.creditsModal.classList.contains('hidden')) {
        renderCreditsModalList(runtime.creditsData);
      }
    }

    function updateBigMenuLoadState() {
      var ui = deps.getUi();
      var hasSave = hasSaves();
      if (ui.bigMenuLoad) {
        ui.bigMenuLoad.disabled = false;
        ui.bigMenuLoad.setAttribute('aria-disabled', hasSave ? 'false' : 'true');
        if (hasSave) ui.bigMenuLoad.removeAttribute('data-disabled-reason');
        else ui.bigMenuLoad.setAttribute('data-disabled-reason', 'noSaves');
        if (hasSave) ui.bigMenuLoad.removeAttribute('title');
        else ui.bigMenuLoad.setAttribute('title', deps.t('bigMenuNoSave'));
      }
      if (runtime.bigMenuViewMode === 'load') {
        renderBigMenuLoadRows();
      }
    }

    function applyBigMenuLanguage(lang) {
      deps.setLanguage(lang);
      try {
        localStorage.setItem('lang', deps.getCurrentLang());
      } catch (e) {}
      renderBigMenuTexts();
      closeBigMenuLanguagePanel();
    }

    function setBigMenuActionButtonsDisabled(disabled) {
      var buttons = getBigMenuActionButtons();
      for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        if (!btn) continue;
        btn.disabled = !!disabled;
      }
      if (!disabled) updateBigMenuLoadState();
    }

    async function startFromBigMenu(mode) {
      if (runtime.bigMenuStartPending) return;
      var selectedPayload = null;
      var onAfterLoadRestore = null;
      if (mode && typeof mode === 'object') {
        var modeOptions = mode;
        selectedPayload = modeOptions.payload || null;
        onAfterLoadRestore = typeof modeOptions.onAfterLoadRestore === 'function' ? modeOptions.onAfterLoadRestore : null;
        mode = modeOptions.kind;
      }
      if (mode !== 'new' && mode !== 'load-slot') return;
      if (mode === 'load-slot' && (!selectedPayload || !Array.isArray(selectedPayload.cells))) return;
      deps.setBootInitialMenuSubView('main');
      var wasStopped = deps.getSessionRuntimeStopped();
      runtime.bigMenuStartPending = true;
      setBigMenuActionButtonsDisabled(true);
      closeBigMenuPanels();
      try {
        if (wasStopped) deps.resumeSessionRuntime();
        await deps.boot();
        if (mode === 'new') {
          deps.resetGameState({ reason: 'new_game' });
          deps.setMetaLastSeenAt(Date.now());
          deps.saveProgress();
        } else if (mode === 'load-slot') {
          deps.restoreFullState(selectedPayload);
          if (onAfterLoadRestore) onAfterLoadRestore(selectedPayload);
          if (typeof deps.postRestoreSync === 'function') deps.postRestoreSync();
          deps.setMetaLastSeenAt(Date.now());
          deps.saveProgress();
          deps.updateUI();
        }
        if (wasStopped) deps.scheduleMainLoop();
        deps.setSessionStartGate('unlocked');
        deps.setMenuOpen(false);
        setBigMenuOpen(false);
        openBigMenuRootView();
        if (global.Game && global.Game.TutorialRuntime && typeof global.Game.TutorialRuntime.syncNow === 'function') {
          global.Game.TutorialRuntime.syncNow();
        }
      } catch (err) {
        console.error('Big menu start failed', err);
        setBigMenuOpen(true);
        updateBigMenuLoadState();
        openBigMenuRootView();
      } finally {
        runtime.bigMenuStartPending = false;
        setBigMenuActionButtonsDisabled(false);
      }
    }

    function initBigMainMenu() {
      var ui = deps.getUi();
      if (!ui.bigMenuOverlay) {
        deps.boot();
        return;
      }
      deps.loadSettings();
      var savedLang = localStorage.getItem('lang');
      deps.setLanguage(savedLang || deps.getCurrentLang());
      renderBigMenuTexts();
      updateBigMenuVolumeState();
      updateBigMenuLoadState();
      deps.setSessionStartGate('locked');
      openBigMenuRootView();
      setBigMenuOpen(true);

      if (runtime.bigMenuInitialized) return;
      runtime.bigMenuInitialized = true;

      if (ui.bigMenuNew) ui.bigMenuNew.addEventListener('click', function () {
        markBigMenuButtonActive('bigMenuNew');
        startFromBigMenu('new');
      });
      if (ui.bigMenuLoad) ui.bigMenuLoad.addEventListener('click', function () {
        if (!hasSaves()) return;
        if (ui.bigMenuLoad && ui.bigMenuLoad.getAttribute('aria-disabled') === 'true') return;
        markBigMenuButtonActive('bigMenuLoad');
        openBigMenuLoadView();
      });
      if (ui.bigMenuLoadRows) ui.bigMenuLoadRows.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        var loadBtn = target.closest('[data-big-load-slot-btn="true"]');
        if (!loadBtn || loadBtn.disabled) return;
        var slotIndex = parseBigMenuSlotIndexFromNode(target);
        if (slotIndex < 0) return;
        var payload = loadSlotPayloadForBigMenu(slotIndex);
        if (!payload) {
          renderBigMenuLoadRows();
          return;
        }
        startFromBigMenu({ kind: 'load-slot', payload: payload });
      });
      if (ui.bigMenuLoadBack) ui.bigMenuLoadBack.addEventListener('click', function () {
        openBigMenuRootView();
      });
      if (ui.bigMenuSound) ui.bigMenuSound.addEventListener('click', function () {
        markBigMenuButtonActive('bigMenuSound');
        toggleBigMenuSoundPanel();
      });
      if (ui.bigMenuLanguage) ui.bigMenuLanguage.addEventListener('click', function () {
        markBigMenuButtonActive('bigMenuLanguage');
        toggleBigMenuLanguagePanel();
      });
      if (ui.bigMenuDevs) ui.bigMenuDevs.addEventListener('click', function () {
        markBigMenuButtonActive('bigMenuDevs');
        openCreditsModal();
      });

      if (ui.bigMenuSfx) {
        ui.bigMenuSfx.addEventListener('input', function (e) {
          deps.setVolume('sfx', e.target.value, 'percent');
          deps.playUiSliderPreviewSfxThrottled();
          deps.syncVolumeUIFromSettings();
          deps.saveSettings();
        });
      }
      if (ui.bigMenuMusic) {
        ui.bigMenuMusic.addEventListener('input', function (e) {
          deps.setVolume('music', e.target.value, 'percent');
          deps.syncVolumeUIFromSettings();
          deps.saveSettings();
        });
      }
      if (ui.bigMenuAutoPause) {
        ui.bigMenuAutoPause.addEventListener('change', function (e) {
          if (typeof deps.setAutoPauseEnabled === 'function') {
            deps.setAutoPauseEnabled(!!(e && e.target && e.target.checked));
          }
          deps.syncVolumeUIFromSettings();
          deps.saveSettings();
        });
      }
      if (ui.bigMenuRootAutoPause) {
        ui.bigMenuRootAutoPause.addEventListener('change', function (e) {
          if (typeof deps.setAutoPauseEnabled === 'function') {
            deps.setAutoPauseEnabled(!!(e && e.target && e.target.checked));
          }
          deps.syncVolumeUIFromSettings();
          deps.saveSettings();
        });
      }
      if (ui.bigMenuLangRu) ui.bigMenuLangRu.addEventListener('click', function () { return applyBigMenuLanguage('ru'); });
      if (ui.bigMenuLangEn) ui.bigMenuLangEn.addEventListener('click', function () { return applyBigMenuLanguage('en'); });
      if (ui.creditsModalClose) {
        ui.creditsModalClose.addEventListener('click', function () {
          closeCreditsModal();
        });
      }
    }

    return {
      setBigMenuOpen: setBigMenuOpen,
      isBigMenuOpen: isBigMenuOpen,
      setBigMenuView: setBigMenuView,
      openBigMenuRootView: openBigMenuRootView,
      openBigMenuLoadView: openBigMenuLoadView,
      getBigMenuSaveMeta: getBigMenuSaveMeta,
      getBigMenuDefaultSlotName: getBigMenuDefaultSlotName,
      getBigMenuSlotName: getBigMenuSlotName,
      bigMenuSlotHasData: bigMenuSlotHasData,
      pad2ForBigMenu: pad2ForBigMenu,
      formatDateForBigMenu: formatDateForBigMenu,
      renderBigMenuLoadRows: renderBigMenuLoadRows,
      parseBigMenuSlotIndexFromNode: parseBigMenuSlotIndexFromNode,
      loadSlotPayloadForBigMenu: loadSlotPayloadForBigMenu,
      getBigMenuActionButtons: getBigMenuActionButtons,
      setMenuActionButtonSelected: setMenuActionButtonSelected,
      applyBigMenuSelectedState: applyBigMenuSelectedState,
      markBigMenuButtonActive: markBigMenuButtonActive,
      removeBigMenuLanguageOutsideListener: removeBigMenuLanguageOutsideListener,
      closeBigMenuLanguagePanel: closeBigMenuLanguagePanel,
      toggleBigMenuLanguagePanel: toggleBigMenuLanguagePanel,
      removeBigMenuSoundOutsideListener: removeBigMenuSoundOutsideListener,
      closeBigMenuSoundPanel: closeBigMenuSoundPanel,
      toggleBigMenuSoundPanel: toggleBigMenuSoundPanel,
      closeBigMenuPanels: closeBigMenuPanels,
      toggleBigMenuPanel: toggleBigMenuPanel,
      updateBigMenuVolumeState: updateBigMenuVolumeState,
      applyBigMenuLanguageSelectedState: applyBigMenuLanguageSelectedState,
      getCreditsRole: getCreditsRole,
      loadCreditsData: loadCreditsData,
      renderCreditsModalList: renderCreditsModalList,
      closeCreditsModal: closeCreditsModal,
      openCreditsModal: openCreditsModal,
      hasSaves: hasSaves,
      renderBigMenuTexts: renderBigMenuTexts,
      updateBigMenuLoadState: updateBigMenuLoadState,
      applyBigMenuLanguage: applyBigMenuLanguage,
      setBigMenuActionButtonsDisabled: setBigMenuActionButtonsDisabled,
      startFromBigMenu: startFromBigMenu,
      initBigMainMenu: initBigMainMenu,
    };
  }

  global.Game = global.Game || {};
  global.Game.BigMenuRuntime = {
    createController: createController,
  };
})(typeof window !== 'undefined' ? window : this);
