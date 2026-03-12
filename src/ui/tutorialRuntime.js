(function (global) {
  'use strict';

  const STEP_STARTER_TANK = 'starter_tank';

  const runtime = {
    documentObj: typeof document !== 'undefined' ? document : null,
    getState: null,
    saveProgress: null,
    updateUi: null,
    t: null,
    ui: null,
    rootEl: null,
    pointerEl: null,
    bubbleEl: null,
    messageEl: null,
    closeBtn: null,
    disableBtn: null,
    rafId: 0,
    started: false,
    lastStateRef: null,
  };

  function createDefaultStepState() {
    return {
      completed: false,
      dismissed: false,
    };
  }

  function createDefaultTutorialState() {
    const steps = {};
    steps[STEP_STARTER_TANK] = createDefaultStepState();
    return {
      version: 1,
      disabled: false,
      completed: false,
      currentStepId: STEP_STARTER_TANK,
      steps: steps,
    };
  }

  function createCompletedTutorialState() {
    const steps = {};
    steps[STEP_STARTER_TANK] = {
      completed: true,
      dismissed: false,
    };
    return {
      version: 1,
      disabled: false,
      completed: true,
      currentStepId: null,
      steps: steps,
    };
  }

  function getState() {
    return typeof runtime.getState === 'function' ? runtime.getState() : null;
  }

  function translate(key, fallback) {
    if (typeof runtime.t === 'function') {
      try {
        const resolved = runtime.t(key);
        if (typeof resolved === 'string' && resolved) return resolved;
      } catch (_) {}
    }
    return fallback || key;
  }

  function persist() {
    if (typeof runtime.saveProgress === 'function') {
      try { runtime.saveProgress(); } catch (_) {}
    }
  }

  function hasExistingProgress(state) {
    if (!state || typeof state !== 'object') return false;
    if (Number.isFinite(state.kills) && state.kills > 0) return true;
    if (Number.isFinite(state.totalDamageDealtRaw) && state.totalDamageDealtRaw > 0) return true;
    if (Number.isFinite(state.maxTankLevelAchieved) && state.maxTankLevelAchieved > 1) return true;
    if (Array.isArray(state.playerChips) && state.playerChips.length > 0) return true;
    if (Array.isArray(state.drones) && state.drones.length > 0) return true;
    if (state.productionLine && typeof state.productionLine === 'object') {
      if (Number.isFinite(state.productionLine.boxesProduced) && state.productionLine.boxesProduced > 0) return true;
      if (Number.isFinite(state.productionLine.killsTracked) && state.productionLine.killsTracked > 0) return true;
    }
    if (state.player && typeof state.player === 'object') {
      if (Number.isFinite(state.player.talentPoints) && state.player.talentPoints > 0) return true;
      if (Number.isFinite(state.player.damagePoints) && state.player.damagePoints > 0) return true;
      if (Number.isFinite(state.player.freeTalentPointsV2) && state.player.freeTalentPointsV2 > 0) return true;
      if (state.player.talentsV2 && state.player.talentsV2.ranksById && Object.keys(state.player.talentsV2.ranksById).length > 0) return true;
    }
    if (state.achievements && typeof state.achievements === 'object') {
      if (Number.isFinite(state.achievements.totalPurchased) && state.achievements.totalPurchased > 0) return true;
      if (Number.isFinite(state.achievements.totalMerges) && state.achievements.totalMerges > 0) return true;
      if (state.achievements.unlocked && Object.keys(state.achievements.unlocked).length > 0) return true;
    }
    if (state.buyCounts && Object.keys(state.buyCounts).length > 0) return true;
    if (Array.isArray(state.cells)) {
      for (let i = 0; i < state.cells.length; i++) {
        const cell = state.cells[i];
        if (!cell || !cell.tank) continue;
        if (cell.tank.onTrack === true) return true;
        if (Number.isFinite(cell.tank.level) && cell.tank.level > 1) return true;
      }
    }
    return false;
  }

  function normalizeTutorialState(state) {
    if (!state || typeof state !== 'object') return createDefaultTutorialState();
    if (!state.tutorial || typeof state.tutorial !== 'object') {
      state.tutorial = hasExistingProgress(state)
        ? createCompletedTutorialState()
        : createDefaultTutorialState();
      return state.tutorial;
    }

    const raw = state.tutorial;
    const steps = {};
    const starterRaw = raw.steps && typeof raw.steps === 'object' ? raw.steps[STEP_STARTER_TANK] : null;
    steps[STEP_STARTER_TANK] = {
      completed: !!(starterRaw && starterRaw.completed),
      dismissed: !!(starterRaw && starterRaw.dismissed),
    };

    const normalized = {
      version: Number.isFinite(Number(raw.version)) ? Math.max(1, Math.floor(Number(raw.version))) : 1,
      disabled: !!raw.disabled,
      completed: !!raw.completed,
      currentStepId: typeof raw.currentStepId === 'string' ? raw.currentStepId : null,
      steps: steps,
    };

    if (normalized.disabled) {
      normalized.completed = true;
      normalized.currentStepId = null;
      normalized.steps[STEP_STARTER_TANK].completed = true;
    } else if (normalized.steps[STEP_STARTER_TANK].completed) {
      normalized.completed = true;
      normalized.currentStepId = null;
    } else if (!normalized.currentStepId) {
      normalized.currentStepId = STEP_STARTER_TANK;
    }

    state.tutorial = normalized;
    return normalized;
  }

  function migrateTutorialStateIfNeeded(state) {
    if (!state || state === runtime.lastStateRef) return;
    const hadTutorial = !!(state.tutorial && typeof state.tutorial === 'object');
    normalizeTutorialState(state);
    runtime.lastStateRef = state;
    if (!hadTutorial) persist();
  }

  function getActiveStepId(state) {
    const tutorial = normalizeTutorialState(state);
    if (tutorial.disabled || tutorial.completed) return null;
    if (tutorial.currentStepId === STEP_STARTER_TANK && !tutorial.steps[STEP_STARTER_TANK].completed) {
      return STEP_STARTER_TANK;
    }
    return null;
  }

  function findStarterTankCell(state) {
    if (!state || !Array.isArray(state.cells)) return null;
    let fallback = null;
    for (let i = 0; i < state.cells.length; i++) {
      const cell = state.cells[i];
      if (!cell || !cell.tank || cell.tank.onTrack) continue;
      if (!fallback) fallback = cell;
      if (!Number.isFinite(cell.tank.level) || cell.tank.level === 1) return cell;
    }
    return fallback;
  }

  function isElementVisible(element) {
    if (!element) return false;
    if (element.hidden) return false;
    if (element.getAttribute && element.getAttribute('aria-hidden') === 'true') return false;
    if (typeof global.getComputedStyle !== 'function') return true;
    const style = global.getComputedStyle(element);
    return !!style && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function shouldSuppressOverlay(state) {
    if (!state) return true;
    if (state.ui && state.ui.menuOpen) return true;
    if (runtime.documentObj && runtime.documentObj.body && runtime.documentObj.body.classList.contains('big-menu-open')) return true;
    const bigMenu = runtime.documentObj ? runtime.documentObj.getElementById('bigMenuOverlay') : null;
    return isElementVisible(bigMenu);
  }

  function createButton(className, text) {
    const button = runtime.documentObj.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    return button;
  }

  function ensureDom() {
    if (runtime.rootEl || !runtime.documentObj) return;
    const stageCanvas = runtime.documentObj.querySelector('.stageCanvas');
    if (!stageCanvas) return;

    const root = runtime.documentObj.createElement('div');
    root.id = 'gameTutorialOverlay';
    root.className = 'gameTutorial gameTutorial--hidden';
    root.setAttribute('aria-hidden', 'true');

    const pointer = runtime.documentObj.createElement('div');
    pointer.className = 'gameTutorial__pointer';
    pointer.setAttribute('aria-hidden', 'true');

    const bubble = runtime.documentObj.createElement('div');
    bubble.className = 'gameTutorial__bubble';
    bubble.setAttribute('role', 'dialog');
    bubble.setAttribute('aria-modal', 'false');

    const closeBtn = createButton('gameTutorial__close uiButtonBehavior', 'x');
    closeBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      completeCurrentStep('dismiss');
    });

    const message = runtime.documentObj.createElement('p');
    message.className = 'gameTutorial__message';

    const actions = runtime.documentObj.createElement('div');
    actions.className = 'gameTutorial__actions';

    const disableBtn = createButton('btn btnSecondary uiButtonBehavior gameTutorial__disableBtn', '');
    disableBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      disableTutorial();
    });

    actions.appendChild(disableBtn);
    bubble.appendChild(closeBtn);
    bubble.appendChild(message);
    bubble.appendChild(actions);
    root.appendChild(pointer);
    root.appendChild(bubble);
    stageCanvas.appendChild(root);

    if (global.Game && global.Game.ButtonBehavior && typeof global.Game.ButtonBehavior.decorateTree === 'function') {
      global.Game.ButtonBehavior.decorateTree(root);
    }

    runtime.rootEl = root;
    runtime.pointerEl = pointer;
    runtime.bubbleEl = bubble;
    runtime.messageEl = message;
    runtime.closeBtn = closeBtn;
    runtime.disableBtn = disableBtn;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setOverlayHidden(hidden) {
    if (!runtime.rootEl) return;
    runtime.rootEl.classList.toggle('gameTutorial--hidden', !!hidden);
    runtime.rootEl.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  }

  function positionOverlay(cell) {
    if (!runtime.rootEl || !runtime.bubbleEl || !runtime.pointerEl || !runtime.documentObj) return;
    const canvas = runtime.documentObj.getElementById('c');
    const stageCanvas = runtime.rootEl.parentElement;
    if (!canvas || !stageCanvas) {
      setOverlayHidden(true);
      return;
    }
    if (!Number.isFinite(cell.x) || !Number.isFinite(cell.y) || !Number.isFinite(cell.w) || !Number.isFinite(cell.h)) {
      setOverlayHidden(true);
      return;
    }

    const stageRect = stageCanvas.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const centerX = canvasRect.left - stageRect.left + cell.x + cell.w * 0.5;
    const centerY = canvasRect.top - stageRect.top + cell.y + cell.h * 0.5;

    runtime.pointerEl.style.left = Math.round(centerX - 74) + 'px';
    runtime.pointerEl.style.top = Math.round(centerY - 18) + 'px';

    const bubbleWidth = runtime.bubbleEl.offsetWidth || 290;
    const bubbleHeight = runtime.bubbleEl.offsetHeight || 112;
    let bubbleLeft = centerX + 28;
    let bubbleTop = centerY - bubbleHeight - 18;

    if (bubbleLeft + bubbleWidth > stageRect.width - 12) bubbleLeft = centerX - bubbleWidth - 28;
    if (bubbleTop < 12) bubbleTop = centerY + 20;

    bubbleLeft = clamp(bubbleLeft, 12, Math.max(12, stageRect.width - bubbleWidth - 12));
    bubbleTop = clamp(bubbleTop, 12, Math.max(12, stageRect.height - bubbleHeight - 12));

    runtime.bubbleEl.style.left = Math.round(bubbleLeft) + 'px';
    runtime.bubbleEl.style.top = Math.round(bubbleTop) + 'px';
  }

  function getLockTargets() {
    const ui = runtime.ui || {};
    const targets = [];
    const push = function (element) {
      if (!element || targets.indexOf(element) !== -1) return;
      if (element === ui.settingsBtn) return;
      targets.push(element);
    };

    push(ui.buy);
    push(ui.buyBulk);
    push(ui.autoMergeBtn);
    push(ui.supercomputerBtn);
    push(ui.achievementsBtn);
    push(ui.dismantleBtn);
    push(ui.terminalExpandBtn);
    push(ui.terminalCollapseBtn);

    if (ui.stageAbilitySlots && typeof ui.stageAbilitySlots.querySelectorAll === 'function') {
      const slots = ui.stageAbilitySlots.querySelectorAll('button');
      for (let i = 0; i < slots.length; i++) push(slots[i]);
    }

    return targets;
  }

  function applyUiLock(state) {
    const shouldLock = !!getActiveStepId(state);
    const targets = getLockTargets();
    let unlockedAny = false;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (!target) continue;
      if (shouldLock) {
        target.disabled = true;
        target.setAttribute('aria-disabled', 'true');
        target.setAttribute('data-tutorial-locked', 'true');
      } else if (target.getAttribute('data-tutorial-locked') === 'true') {
        target.disabled = false;
        target.removeAttribute('aria-disabled');
        target.removeAttribute('data-tutorial-locked');
        unlockedAny = true;
      }
    }

    if (!shouldLock && unlockedAny && typeof runtime.updateUi === 'function') {
      try { runtime.updateUi(); } catch (_) {}
    }
  }

  function completeCurrentStep(reason) {
    const state = getState();
    if (!state) return;
    const tutorial = normalizeTutorialState(state);
    if (tutorial.disabled || tutorial.completed) return;

    tutorial.steps[STEP_STARTER_TANK].completed = true;
    if (reason === 'dismiss') tutorial.steps[STEP_STARTER_TANK].dismissed = true;
    tutorial.currentStepId = null;
    tutorial.completed = true;

    persist();
    if (typeof runtime.updateUi === 'function') {
      try { runtime.updateUi(); } catch (_) {}
    }
    syncNow();
  }

  function disableTutorial() {
    const state = getState();
    if (!state) return;
    const tutorial = normalizeTutorialState(state);
    tutorial.disabled = true;
    tutorial.completed = true;
    tutorial.currentStepId = null;
    tutorial.steps[STEP_STARTER_TANK].completed = true;

    persist();
    if (typeof runtime.updateUi === 'function') {
      try { runtime.updateUi(); } catch (_) {}
    }
    syncNow();
  }

  function syncCopy() {
    if (!runtime.messageEl || !runtime.disableBtn || !runtime.closeBtn) return;
    runtime.messageEl.textContent = translate('tutorialStarterTankMessage', 'Нажми на танк и отправь его в бой!');
    runtime.disableBtn.textContent = translate('tutorialDisable', 'Выключить обучение');
    runtime.closeBtn.setAttribute('aria-label', translate('tutorialClose', 'Закрыть обучение'));
  }

  function syncNow() {
    const state = getState();
    if (!state) return;

    migrateTutorialStateIfNeeded(state);
    ensureDom();
    applyUiLock(state);
    syncCopy();

    if (!runtime.rootEl || getActiveStepId(state) !== STEP_STARTER_TANK || shouldSuppressOverlay(state)) {
      setOverlayHidden(true);
      return;
    }

    const cell = findStarterTankCell(state);
    if (!cell) {
      setOverlayHidden(true);
      return;
    }

    setOverlayHidden(false);
    positionOverlay(cell);
  }

  function tick() {
    syncNow();
    runtime.rafId = global.requestAnimationFrame(tick);
  }

  function init(options) {
    const opts = options || {};
    runtime.documentObj = opts.documentObj || runtime.documentObj;
    runtime.getState = typeof opts.getState === 'function' ? opts.getState : runtime.getState;
    runtime.saveProgress = typeof opts.saveProgress === 'function' ? opts.saveProgress : runtime.saveProgress;
    runtime.updateUi = typeof opts.updateUi === 'function' ? opts.updateUi : runtime.updateUi;
    runtime.t = typeof opts.t === 'function' ? opts.t : runtime.t;
    runtime.ui = opts.ui || runtime.ui;

    if (runtime.started) {
      syncNow();
      return api;
    }

    runtime.started = true;
    syncNow();
    if (typeof global.requestAnimationFrame === 'function') {
      runtime.rafId = global.requestAnimationFrame(tick);
    }
    return api;
  }

  function handleTankOnTrackChanged(tank, nextOnTrack, opts) {
    if (!nextOnTrack) return;
    if (!opts || opts.cause !== 'user') return;
    const state = getState();
    if (getActiveStepId(state) !== STEP_STARTER_TANK) return;
    completeCurrentStep('sent_to_track');
  }

  function isUiLocked() {
    return !!getActiveStepId(getState());
  }

  const api = {
    init: init,
    syncNow: syncNow,
    isUiLocked: isUiLocked,
    handleTankOnTrackChanged: handleTankOnTrackChanged,
  };

  global.Game = global.Game || {};
  global.Game.TutorialRuntime = api;
})(typeof window !== 'undefined' ? window : this);