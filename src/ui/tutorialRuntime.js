(function (global) {
  'use strict';

  const TUTORIAL_BODY_CLASS = 'tutorial-modal-open';
  const LOCKED_REASON_KEY = 'tutorialLockedTooltip';

  const runtime = {
    documentObj: typeof document !== 'undefined' ? document : null,
    getState: null,
    saveProgress: null,
    updateUi: null,
    enterCriticalPause: null,
    exitCriticalPause: null,
    t: null,
    ui: null,
    rootEl: null,
    canvasEl: null,
    stageEl: null,
    pointerEl: null,
    bubbleEl: null,
    confirmWrapEl: null,
    confirmPanelEl: null,
    confirmTextEl: null,
    confirmCloseBtn: null,
    confirmAcceptBtn: null,
    confirmCancelBtn: null,
    messageEl: null,
    closeBtn: null,
    continueBtn: null,
    disableBtn: null,
    disableConfirmOpen: false,
    pauseManager: null,
    pauseActive: false,
    canvasSequenceActive: false,
    guardsAttached: false,
    lockedTargets: [],
    restoreTooltipCache: new WeakMap(),
    lastLockKey: '',
    rafId: 0,
    started: false,
    lastStateRef: null,
  };

  function capturePauseManagerInstance(instance) {
    if (!instance || typeof instance !== 'object') return instance;
    runtime.pauseManager = instance;
    return instance;
  }

  function patchPauseManagerFactory() {
    const pauseApi = global.Game && global.Game.PauseManager;
    if (!pauseApi || typeof pauseApi.createPauseManager !== 'function') return;
    if (pauseApi.createPauseManager.__tutorialPauseCapture === true) return;

    const originalCreatePauseManager = pauseApi.createPauseManager;
    const wrappedCreatePauseManager = function (options) {
      return capturePauseManagerInstance(originalCreatePauseManager(options));
    };

    wrappedCreatePauseManager.__tutorialPauseCapture = true;
    wrappedCreatePauseManager.__tutorialPauseOriginal = originalCreatePauseManager;
    pauseApi.createPauseManager = wrappedCreatePauseManager;
  }

  patchPauseManagerFactory();

  function getTutorialStepsApi() {
    return global.Game && global.Game.TutorialSteps ? global.Game.TutorialSteps : null;
  }

  function getStepDefinitions() {
    const tutorialSteps = getTutorialStepsApi();
    if (tutorialSteps && typeof tutorialSteps.getAll === 'function') {
      const definitions = tutorialSteps.getAll();
      if (Array.isArray(definitions) && definitions.length) return definitions;
    }
    return [];
  }

  function getStepDefinition(stepId) {
    const tutorialSteps = getTutorialStepsApi();
    if (tutorialSteps && typeof tutorialSteps.getStep === 'function') {
      return tutorialSteps.getStep(stepId);
    }
    const definitions = getStepDefinitions();
    for (let i = 0; i < definitions.length; i++) {
      if (definitions[i] && definitions[i].id === stepId) return definitions[i];
    }
    return null;
  }

  function createDefaultStepState() {
    const tutorialSteps = getTutorialStepsApi();
    if (tutorialSteps && typeof tutorialSteps.buildStepState === 'function') {
      return tutorialSteps.buildStepState();
    }
    return {
      completed: false,
      dismissed: false,
      bubbleOpen: true,
    };
  }

  function createDefaultTutorialState() {
    const tutorialSteps = getTutorialStepsApi();
    if (tutorialSteps && typeof tutorialSteps.buildInitialTutorialState === 'function') {
      return tutorialSteps.buildInitialTutorialState();
    }
    const definitions = getStepDefinitions();
    const steps = {};
    for (let i = 0; i < definitions.length; i++) {
      const definition = definitions[i];
      if (!definition || typeof definition.id !== 'string' || !definition.id) continue;
      steps[definition.id] = createDefaultStepState();
    }
    return {
      version: 2,
      disabled: false,
      completed: false,
      currentStepId: definitions.length ? definitions[0].id : null,
      steps: steps,
    };
  }

  function createCompletedTutorialState() {
    const tutorial = createDefaultTutorialState();
    tutorial.completed = true;
    tutorial.currentStepId = null;
    const definitions = getStepDefinitions();
    for (let i = 0; i < definitions.length; i++) {
      const definition = definitions[i];
      if (!definition || typeof definition.id !== 'string' || !definition.id) continue;
      tutorial.steps[definition.id] = {
        completed: true,
        dismissed: false,
        bubbleOpen: false,
      };
    }
    return tutorial;
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

  function getNextIncompleteStepId(tutorial) {
    const definitions = getStepDefinitions();
    for (let i = 0; i < definitions.length; i++) {
      const definition = definitions[i];
      if (!definition || typeof definition.id !== 'string' || !definition.id) continue;
      const stepState = tutorial.steps[definition.id];
      if (!stepState || !stepState.completed) return definition.id;
    }
    return null;
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
    const definitions = getStepDefinitions();
    const steps = {};

    for (let i = 0; i < definitions.length; i++) {
      const definition = definitions[i];
      if (!definition || typeof definition.id !== 'string' || !definition.id) continue;
      const rawStep = raw.steps && typeof raw.steps === 'object' ? raw.steps[definition.id] : null;
      steps[definition.id] = {
        completed: !!(rawStep && rawStep.completed),
        dismissed: !!(rawStep && rawStep.dismissed),
        bubbleOpen: rawStep && typeof rawStep.bubbleOpen === 'boolean'
          ? rawStep.bubbleOpen
          : !rawStep || !rawStep.completed,
      };
    }

    const normalized = {
      version: Number.isFinite(Number(raw.version)) ? Math.max(1, Math.floor(Number(raw.version))) : 2,
      disabled: !!raw.disabled,
      completed: !!raw.completed,
      currentStepId: typeof raw.currentStepId === 'string' ? raw.currentStepId : null,
      steps: steps,
    };

    if (normalized.disabled) {
      normalized.completed = true;
      normalized.currentStepId = null;
      const stepIds = Object.keys(normalized.steps);
      for (let i = 0; i < stepIds.length; i++) {
        const stepState = normalized.steps[stepIds[i]];
        if (!stepState) continue;
        stepState.completed = true;
        stepState.bubbleOpen = false;
      }
    } else {
      const nextStepId = getNextIncompleteStepId(normalized);
      normalized.currentStepId = nextStepId;
      normalized.completed = !nextStepId;
    }

    state.tutorial = normalized;
    return normalized;
  }

  function migrateTutorialStateIfNeeded(state) {
    if (!state || state === runtime.lastStateRef) return;
    const hadTutorial = !!(state.tutorial && typeof state.tutorial === 'object');
    normalizeTutorialState(state);
    runtime.lastStateRef = state;
    runtime.pauseActive = false;
    if (!hadTutorial) persist();
  }

  function getActiveStepId(state) {
    const tutorial = normalizeTutorialState(state);
    if (tutorial.disabled || tutorial.completed) return null;
    return tutorial.currentStepId;
  }

  function getActiveStepDefinition(state) {
    const activeStepId = getActiveStepId(state);
    return activeStepId ? getStepDefinition(activeStepId) : null;
  }

  function getActiveStepState(state) {
    const tutorial = normalizeTutorialState(state);
    const activeStepId = getActiveStepId(state);
    return activeStepId && tutorial.steps ? tutorial.steps[activeStepId] || null : null;
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

  function resolveStepTarget(stepDefinition, state) {
    if (!stepDefinition || !stepDefinition.target || !state) return null;
    if (stepDefinition.target.kind === 'starter_hangar_tank') {
      return findStarterTankCell(state);
    }
    return null;
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function ensureDom() {
    if (runtime.rootEl || !runtime.documentObj) return;
    const stageCanvas = runtime.documentObj.querySelector('.stageCanvas');
    if (!stageCanvas) return;
    const canvas = runtime.documentObj.getElementById('c');

    const root = runtime.documentObj.createElement('div');
    root.id = 'gameTutorialOverlay';
    root.className = 'gameTutorial gameTutorial--hidden';
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('data-tutorial-root', 'true');

    const pointer = runtime.documentObj.createElement('div');
    pointer.className = 'gameTutorial__pointer';
    pointer.setAttribute('aria-hidden', 'true');

    const bubble = runtime.documentObj.createElement('div');
    bubble.className = 'gameTutorial__bubble';
    bubble.setAttribute('role', 'dialog');
    bubble.setAttribute('aria-modal', 'true');

    const closeBtn = createButton('levelModal__close scModal__close gameTutorial__close uiButtonBehavior', '×');
    closeBtn.setAttribute('data-font-floor-ignore', 'true');
    closeBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      dismissCurrentBubble('close');
    });

    const message = runtime.documentObj.createElement('p');
    message.className = 'gameTutorial__message';

    const actions = runtime.documentObj.createElement('div');
    actions.className = 'gameTutorial__actions';

    const continueBtn = createButton('btn btnPrimary uiButtonBehavior gameTutorial__continueBtn', '');
    continueBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      dismissCurrentBubble('continue');
    });

    const disableBtn = createButton('btn btnSecondary uiButtonBehavior gameTutorial__disableBtn', '');
    disableBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openDisableConfirm();
    });

    continueBtn.className = 'btn btnSecondary uiButtonBehavior gameTutorial__continueBtn';

    const confirmWrap = runtime.documentObj.createElement('div');
    confirmWrap.className = 'gameTutorial__confirm gameTutorial__confirm--hidden';
    confirmWrap.setAttribute('aria-hidden', 'true');

    const confirmBackdrop = runtime.documentObj.createElement('div');
    confirmBackdrop.className = 'gameTutorial__confirmBackdrop';

    const confirmPanel = runtime.documentObj.createElement('div');
    confirmPanel.className = 'levelModal__panel scModal gameTutorial__confirmPanel';
    confirmPanel.setAttribute('role', 'dialog');
    confirmPanel.setAttribute('aria-modal', 'true');

    const confirmCloseBtn = createButton('levelModal__close scModal__close gameTutorial__confirmClose uiButtonBehavior', '×');
    confirmCloseBtn.setAttribute('data-font-floor-ignore', 'true');
    confirmCloseBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeDisableConfirm();
    });

    const confirmText = runtime.documentObj.createElement('p');
    confirmText.className = 'gameTutorial__confirmText';

    const confirmActions = runtime.documentObj.createElement('div');
    confirmActions.className = 'gameTutorial__confirmActions';

    const confirmAcceptBtn = createButton('btn scButton uiButtonBehavior gameTutorial__confirmBtn', '');
    confirmAcceptBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      disableTutorial();
    });

    const confirmCancelBtn = createButton('btn scButton uiButtonBehavior gameTutorial__confirmBtn', '');
    confirmCancelBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeDisableConfirm();
    });

    confirmWrap.addEventListener('keydown', function (event) {
      if (!event || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeDisableConfirm();
    });

    confirmActions.appendChild(confirmAcceptBtn);
    confirmActions.appendChild(confirmCancelBtn);
    confirmPanel.appendChild(confirmCloseBtn);
    confirmPanel.appendChild(confirmText);
    confirmPanel.appendChild(confirmActions);
    confirmWrap.appendChild(confirmBackdrop);
    confirmWrap.appendChild(confirmPanel);

    actions.appendChild(continueBtn);
    actions.appendChild(disableBtn);
    bubble.appendChild(closeBtn);
    bubble.appendChild(message);
    bubble.appendChild(actions);
    root.appendChild(pointer);
    root.appendChild(bubble);
    root.appendChild(confirmWrap);
    stageCanvas.appendChild(root);

    if (global.Game && global.Game.ButtonBehavior && typeof global.Game.ButtonBehavior.decorateTree === 'function') {
      global.Game.ButtonBehavior.decorateTree(root);
    }

    runtime.rootEl = root;
    runtime.canvasEl = canvas;
    runtime.stageEl = stageCanvas;
    runtime.pointerEl = pointer;
    runtime.bubbleEl = bubble;
    runtime.confirmWrapEl = confirmWrap;
    runtime.confirmPanelEl = confirmPanel;
    runtime.confirmTextEl = confirmText;
    runtime.confirmCloseBtn = confirmCloseBtn;
    runtime.confirmAcceptBtn = confirmAcceptBtn;
    runtime.confirmCancelBtn = confirmCancelBtn;
    runtime.messageEl = message;
    runtime.closeBtn = closeBtn;
    runtime.continueBtn = continueBtn;
    runtime.disableBtn = disableBtn;
  }

  function setOverlayHidden(hidden) {
    if (!runtime.rootEl) return;
    runtime.rootEl.classList.toggle('gameTutorial--hidden', !!hidden);
    runtime.rootEl.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    if (runtime.pointerEl) runtime.pointerEl.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  }

  function setBubbleHidden(hidden) {
    if (!runtime.bubbleEl) return;
    runtime.bubbleEl.classList.toggle('gameTutorial__bubble--hidden', !!hidden);
    runtime.bubbleEl.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  }

  function setDisableConfirmHidden(hidden) {
    if (!runtime.confirmWrapEl) return;
    runtime.confirmWrapEl.classList.toggle('gameTutorial__confirm--hidden', !!hidden);
    runtime.confirmWrapEl.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  }

  function isStepBubbleOpen(state) {
    const stepState = getActiveStepState(state);
    return !!(stepState && stepState.bubbleOpen);
  }

  function positionOverlay(cell) {
    if (!runtime.rootEl || !runtime.pointerEl || !runtime.documentObj || !cell) return;
    const canvas = runtime.canvasEl || runtime.documentObj.getElementById('c');
    const stageCanvas = runtime.stageEl || runtime.rootEl.parentElement;
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

    runtime.pointerEl.style.left = Math.round(centerX - 18) + 'px';
    runtime.pointerEl.style.top = Math.round(centerY - 54) + 'px';

    if (!runtime.bubbleEl || runtime.bubbleEl.classList.contains('gameTutorial__bubble--hidden')) return;

    const bubbleWidth = runtime.bubbleEl.offsetWidth || 340;
    const bubbleHeight = runtime.bubbleEl.offsetHeight || 160;
    let bubbleLeft = centerX + 28;
    let bubbleTop = centerY - bubbleHeight - 18;

    if (bubbleLeft + bubbleWidth > stageRect.width - 12) bubbleLeft = centerX - bubbleWidth - 28;
    if (bubbleTop < 12) bubbleTop = centerY + 20;

    bubbleLeft = clamp(bubbleLeft, 12, Math.max(12, stageRect.width - bubbleWidth - 12));
    bubbleTop = clamp(bubbleTop, 12, Math.max(12, stageRect.height - bubbleHeight - 12));

    runtime.bubbleEl.style.left = Math.round(bubbleLeft) + 'px';
    runtime.bubbleEl.style.top = Math.round(bubbleTop) + 'px';
  }

  function getAlwaysAllowedElements() {
    const ui = runtime.ui || {};
    return [ui.settingsBtn, ui.terminalCollapseBtn, ui.terminalExpandBtn];
  }

  function getAllowedUiElementsForStep(state) {
    const stepDefinition = getActiveStepDefinition(state);
    const ui = runtime.ui || {};
    const elements = getAlwaysAllowedElements().slice();
    const allow = stepDefinition && stepDefinition.allow ? stepDefinition.allow : null;
    const uiKeys = allow && Array.isArray(allow.uiKeys) ? allow.uiKeys : [];

    for (let i = 0; i < uiKeys.length; i++) {
      const candidate = ui[uiKeys[i]];
      if (candidate && elements.indexOf(candidate) === -1) {
        elements.push(candidate);
      }
    }

    return elements;
  }

  function isBubbleControlAllowed(controlName, state) {
    const stepDefinition = getActiveStepDefinition(state);
    const allow = stepDefinition && stepDefinition.allow ? stepDefinition.allow : null;
    const controls = allow && Array.isArray(allow.bubbleControls) ? allow.bubbleControls : [];
    return controls.indexOf(controlName) !== -1;
  }

  function isElementInsideTutorial(element) {
    return !!(runtime.rootEl && element && runtime.rootEl.contains(element));
  }

  function isElementAlwaysAllowed(element) {
    const alwaysAllowed = getAlwaysAllowedElements();
    for (let i = 0; i < alwaysAllowed.length; i++) {
      const candidate = alwaysAllowed[i];
      if (!candidate) continue;
      if (element === candidate) return true;
      if (candidate.contains && candidate.contains(element)) return true;
    }
    return false;
  }

  function isElementAllowedForStep(element, state) {
    if (!element) return false;
    if (isElementInsideTutorial(element)) return true;

    const allowedUiElements = getAllowedUiElementsForStep(state);
    for (let i = 0; i < allowedUiElements.length; i++) {
      const candidate = allowedUiElements[i];
      if (!candidate) continue;
      if (element === candidate) return true;
      if (candidate.contains && candidate.contains(element)) return true;
    }

    if (!isStepBubbleOpen(state)) return false;

    if (isBubbleControlAllowed('close', state) && runtime.closeBtn && (element === runtime.closeBtn || runtime.closeBtn.contains(element))) return true;
    if (isBubbleControlAllowed('continue', state) && runtime.continueBtn && (element === runtime.continueBtn || runtime.continueBtn.contains(element))) return true;
    if (isBubbleControlAllowed('disable', state) && runtime.disableBtn && (element === runtime.disableBtn || runtime.disableBtn.contains(element))) return true;

    return false;
  }

  function shouldLockInteractions(state) {
    if (!getActiveStepId(state)) return false;
    if (!runtime.stageEl) return false;
    if (state && state.ui && state.ui.menuOpen) return false;
    return true;
  }

  function rememberOriginalTooltip(target) {
    if (!target || runtime.restoreTooltipCache.has(target)) return;
    runtime.restoreTooltipCache.set(target, {
      tooltip: target.hasAttribute('data-ui-tooltip') ? target.getAttribute('data-ui-tooltip') : null,
      ariaDisabled: target.hasAttribute('aria-disabled') ? target.getAttribute('aria-disabled') : null,
    });
  }

  function applyLockToTarget(target, tooltipText) {
    if (!target) return;
    rememberOriginalTooltip(target);
    target.setAttribute('data-tutorial-locked', 'true');
    target.setAttribute('aria-disabled', 'true');
    target.setAttribute('data-ui-tooltip', tooltipText);
  }

  function clearLockFromTarget(target) {
    if (!target || target.getAttribute('data-tutorial-locked') !== 'true') return;
    const original = runtime.restoreTooltipCache.get(target) || null;
    target.removeAttribute('data-tutorial-locked');
    if (original && original.ariaDisabled !== null) {
      target.setAttribute('aria-disabled', original.ariaDisabled);
    } else {
      target.removeAttribute('aria-disabled');
    }
    if (original && original.tooltip !== null) {
      target.setAttribute('data-ui-tooltip', original.tooltip);
    } else {
      target.removeAttribute('data-ui-tooltip');
    }
    runtime.restoreTooltipCache.delete(target);
  }

  function clearAllUiLocks() {
    for (let i = 0; i < runtime.lockedTargets.length; i++) {
      clearLockFromTarget(runtime.lockedTargets[i]);
    }
    runtime.lockedTargets.length = 0;
  }

  function applyUiLock(state) {
    const lockKey = shouldLockInteractions(state)
      ? [getActiveStepId(state) || '', isStepBubbleOpen(state) ? '1' : '0', state && state.ui && state.ui.menuOpen ? '1' : '0'].join('|')
      : '';
    if (lockKey === runtime.lastLockKey) return;

    runtime.lastLockKey = lockKey;
    clearAllUiLocks();
    if (!lockKey) return;

    const tooltipText = translate(LOCKED_REASON_KEY, 'Временно заблокировано. Закончите обучения для получения доступа');
    const targets = runtime.stageEl.querySelectorAll('button, [role="button"]');

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (!target || isElementAllowedForStep(target, state)) continue;
      applyLockToTarget(target, tooltipText);
      runtime.lockedTargets.push(target);
    }
  }

  function syncPauseState(state) {
    const shouldPause = !!(getActiveStepId(state) && isStepBubbleOpen(state));
    if (shouldPause === runtime.pauseActive) return;

    patchPauseManagerFactory();
    if (shouldPause) {
      if (runtime.pauseManager && typeof runtime.pauseManager.enterCriticalPause === 'function') {
        runtime.pauseManager.enterCriticalPause();
        runtime.pauseActive = true;
      } else if (typeof runtime.enterCriticalPause === 'function') {
        runtime.enterCriticalPause();
        runtime.pauseActive = true;
      }
      return;
    }

    if (runtime.pauseManager && typeof runtime.pauseManager.exitCriticalPause === 'function') {
      runtime.pauseManager.exitCriticalPause();
    } else if (typeof runtime.exitCriticalPause === 'function') {
      runtime.exitCriticalPause();
    }
    runtime.pauseActive = false;
  }

  function syncBodyState(state) {
    if (!runtime.documentObj || !runtime.documentObj.body) return;
    runtime.documentObj.body.classList.toggle(TUTORIAL_BODY_CLASS, !!(getActiveStepId(state) && isStepBubbleOpen(state)));
  }

  function dismissCurrentBubble(reason) {
    const state = getState();
    if (!state) return;
    const activeStepId = getActiveStepId(state);
    if (!activeStepId) return;
    const tutorial = state.tutorial;
    if (!tutorial || !tutorial.steps || !tutorial.steps[activeStepId]) return;

    tutorial.steps[activeStepId].bubbleOpen = false;
    if (reason === 'close') tutorial.steps[activeStepId].dismissed = true;
    closeDisableConfirm({ restoreFocus: false });
    persist();
    syncNow();
  }

  function completeCurrentStep(reason) {
    const state = getState();
    if (!state) return;
    const activeStepId = getActiveStepId(state);
    if (!activeStepId) return;
    const tutorial = state.tutorial;
    if (!tutorial || tutorial.disabled || tutorial.completed) return;

    const stepState = tutorial.steps[activeStepId] || createDefaultStepState();
    stepState.completed = true;
    stepState.bubbleOpen = false;
    if (reason === 'dismiss') stepState.dismissed = true;
    tutorial.steps[activeStepId] = stepState;
    tutorial.currentStepId = getNextIncompleteStepId(tutorial);
    tutorial.completed = !tutorial.currentStepId;
    runtime.canvasSequenceActive = false;
    closeDisableConfirm({ restoreFocus: false });

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
    closeDisableConfirm({ restoreFocus: false });
    tutorial.disabled = true;
    tutorial.completed = true;
    tutorial.currentStepId = null;
    runtime.canvasSequenceActive = false;

    const stepIds = Object.keys(tutorial.steps || {});
    for (let i = 0; i < stepIds.length; i++) {
      const stepState = tutorial.steps[stepIds[i]];
      if (!stepState) continue;
      stepState.completed = true;
      stepState.bubbleOpen = false;
    }

    persist();
    if (typeof runtime.updateUi === 'function') {
      try { runtime.updateUi(); } catch (_) {}
    }
    syncNow();
  }

  function openDisableConfirm() {
    const state = getState();
    if (!state || !isStepBubbleOpen(state) || !runtime.confirmWrapEl) return;
    runtime.disableConfirmOpen = true;
    setDisableConfirmHidden(false);
    if (runtime.confirmAcceptBtn && typeof runtime.confirmAcceptBtn.focus === 'function') {
      runtime.confirmAcceptBtn.focus();
    }
  }

  function closeDisableConfirm(options) {
    runtime.disableConfirmOpen = false;
    setDisableConfirmHidden(true);
    if (options && options.restoreFocus === false) return;
    if (runtime.disableBtn && typeof runtime.disableBtn.focus === 'function' && isElementVisible(runtime.disableBtn)) {
      runtime.disableBtn.focus();
    }
  }

  function syncCopy() {
    if (!runtime.messageEl || !runtime.disableBtn || !runtime.closeBtn || !runtime.continueBtn) return;
    const state = getState();
    const activeStep = getActiveStepDefinition(state);
    runtime.messageEl.textContent = translate(
      activeStep && activeStep.messageKey ? activeStep.messageKey : 'tutorialStarterTankMessage',
      'Нажми на танк и отправь его в бой!'
    );
    runtime.continueBtn.textContent = translate('tutorialContinue', 'Продолжить');
    runtime.disableBtn.textContent = translate('tutorialDisable', 'Выключить обучение');
    runtime.closeBtn.setAttribute('aria-label', translate('tutorialClose', 'Закрыть обучение'));
    if (runtime.confirmTextEl && runtime.confirmAcceptBtn && runtime.confirmCancelBtn && runtime.confirmCloseBtn) {
      const closeLabel = translate('menuClose', 'Закрыть');
      runtime.confirmTextEl.textContent = translate(
        'tutorialDisableConfirmText',
        'Вы действительно хотите закончить обучение и продолжить играть без подсказок?'
      );
      runtime.confirmAcceptBtn.textContent = translate('tutorialDisableConfirmAccept', 'Подтвердить');
      runtime.confirmCancelBtn.textContent = translate('tutorialDisableConfirmCancel', 'Отмена');
      runtime.confirmCloseBtn.setAttribute('aria-label', closeLabel);
      runtime.confirmCloseBtn.setAttribute('title', closeLabel);
    }
  }

  function getCanvasPointFromEvent(event) {
    if (!runtime.canvasEl || !event) return null;
    const rect = runtime.canvasEl.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const clientX = Number(event.clientX);
    const clientY = Number(event.clientY);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    return {
      x: (clientX - rect.left) * (runtime.canvasEl.width / rect.width),
      y: (clientY - rect.top) * (runtime.canvasEl.height / rect.height),
    };
  }

  function isPointInsideCell(cell, point) {
    if (!cell || !point) return false;
    return point.x >= cell.x
      && point.x <= cell.x + cell.w
      && point.y >= cell.y
      && point.y <= cell.y + cell.h;
  }

  function shouldHandleCanvasRestriction(state) {
    return shouldLockInteractions(state);
  }

  function stopEvent(event) {
    if (!event) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
      return;
    }
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
  }

  function handleCanvasPointerDown(event) {
    const state = getState();
    if (!state || !shouldHandleCanvasRestriction(state)) return;
    const stepDefinition = getActiveStepDefinition(state);
    const target = resolveStepTarget(stepDefinition, state);
    const point = getCanvasPointFromEvent(event);
    if (!target || !point || !isPointInsideCell(target, point)) {
      runtime.canvasSequenceActive = false;
      stopEvent(event);
      return;
    }
    runtime.canvasSequenceActive = true;
  }

  function handleCanvasPointerMove(event) {
    const state = getState();
    if (!state || !shouldHandleCanvasRestriction(state)) return;
    stopEvent(event);
  }

  function handleCanvasPointerUp(event) {
    const state = getState();
    if (!state || !shouldHandleCanvasRestriction(state)) {
      runtime.canvasSequenceActive = false;
      return;
    }
    if (!runtime.canvasSequenceActive) {
      stopEvent(event);
      return;
    }
    runtime.canvasSequenceActive = false;
  }

  function handleCanvasPointerCancel() {
    runtime.canvasSequenceActive = false;
  }

  function handleBlockedDomEvent(event) {
    const state = getState();
    if (!state || !shouldLockInteractions(state)) return;
    const target = event && event.target && event.target.closest
      ? event.target.closest('[data-tutorial-locked="true"]')
      : null;
    if (!target) return;
    stopEvent(event);
  }

  function handleBlockedKeydown(event) {
    if (!event || (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar')) return;
    handleBlockedDomEvent(event);
  }

  function attachInteractionGuards() {
    if (runtime.guardsAttached || !runtime.documentObj || !runtime.canvasEl) return;
    runtime.guardsAttached = true;
    runtime.canvasEl.addEventListener('pointerdown', handleCanvasPointerDown, true);
    runtime.canvasEl.addEventListener('pointermove', handleCanvasPointerMove, true);
    runtime.canvasEl.addEventListener('pointerup', handleCanvasPointerUp, true);
    runtime.canvasEl.addEventListener('pointercancel', handleCanvasPointerCancel, true);
    runtime.canvasEl.addEventListener('pointerleave', handleCanvasPointerCancel, true);
    runtime.documentObj.addEventListener('pointerdown', handleBlockedDomEvent, true);
    runtime.documentObj.addEventListener('click', handleBlockedDomEvent, true);
    runtime.documentObj.addEventListener('keydown', handleBlockedKeydown, true);
  }

  function syncNow() {
    const state = getState();
    if (!state) return;

    migrateTutorialStateIfNeeded(state);
    ensureDom();
    patchPauseManagerFactory();
    attachInteractionGuards();
    applyUiLock(state);
    syncCopy();
    syncPauseState(state);
    syncBodyState(state);

    const activeStep = getActiveStepDefinition(state);
    const target = resolveStepTarget(activeStep, state);
    const shouldHide = !activeStep || !target || shouldSuppressOverlay(state);

    if (!runtime.rootEl || shouldHide) {
      closeDisableConfirm({ restoreFocus: false });
      setOverlayHidden(true);
      setBubbleHidden(true);
      return;
    }

    if (!isStepBubbleOpen(state)) {
      closeDisableConfirm({ restoreFocus: false });
    }

    setOverlayHidden(false);
    setBubbleHidden(!isStepBubbleOpen(state));
    positionOverlay(target);
    setDisableConfirmHidden(!runtime.disableConfirmOpen);
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
    runtime.enterCriticalPause = typeof opts.enterCriticalPause === 'function' ? opts.enterCriticalPause : runtime.enterCriticalPause;
    runtime.exitCriticalPause = typeof opts.exitCriticalPause === 'function' ? opts.exitCriticalPause : runtime.exitCriticalPause;
    runtime.t = typeof opts.t === 'function' ? opts.t : runtime.t;
    runtime.ui = opts.ui || runtime.ui;

    patchPauseManagerFactory();

    if (runtime.started) {
      syncNow();
      return api;
    }

    runtime.started = true;
    ensureDom();
    attachInteractionGuards();
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
    const stepDefinition = getActiveStepDefinition(state);
    if (!stepDefinition || !stepDefinition.completion || stepDefinition.completion.kind !== 'tank_on_track') return;
    completeCurrentStep('sent_to_track');
  }

  function isUiLocked() {
    return shouldLockInteractions(getState());
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