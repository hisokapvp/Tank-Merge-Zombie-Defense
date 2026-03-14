(function (global) {
  'use strict';

  const TUTORIAL_BODY_CLASS = 'tutorial-modal-open';
  const LOCKED_REASON_KEY = 'tutorialLockedTooltip';
  const TUTORIAL_CURSOR_CONFIG_PATH = 'assets/tutotialCursore.json';

  function buildDefaultCursorConfig() {
    return {
      atlas: 'assets/tutorial_cursor_atlas.svg',
      animations: {
        click: { x: 0, y: 0, w: 32, h: 32, frames: 2, frameRateFps: 4, loop: true, scale: 1 },
        drag: { x: 64, y: 0, w: 32, h: 32, frames: 2, frameRateFps: 6, loop: true, scale: 1 },
        drop: { x: 128, y: 0, w: 32, h: 32, frames: 2, frameRateFps: 5, loop: true, scale: 1 },
      },
    };
  }

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
    pointerSpriteEl: null,
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
    cursorConfig: buildDefaultCursorConfig(),
    cursorConfigLoad: null,
    cursorAtlasImage: null,
    cursorAtlasUrl: '',
    pointerAnimationKey: 'click',
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
      version: 4,
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

  function getPurchasedTankCount(state) {
    if (!state || !state.buyCounts || typeof state.buyCounts !== 'object') return 0;
    const keys = Object.keys(state.buyCounts);
    let total = 0;
    for (let i = 0; i < keys.length; i++) {
      const value = Number(state.buyCounts[keys[i]]);
      if (Number.isFinite(value) && value > 0) total += value;
    }
    return total;
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
    const tutorialSteps = getTutorialStepsApi();
    const targetVersion = tutorialSteps && Number.isFinite(Number(tutorialSteps.VERSION))
      ? Math.max(1, Math.floor(Number(tutorialSteps.VERSION)))
      : 2;

    if (!!raw.completed && !raw.disabled && (!Number.isFinite(Number(raw.version)) || Number(raw.version) < targetVersion)) {
      const upgradedCompleted = createCompletedTutorialState();
      upgradedCompleted.version = targetVersion;
      state.tutorial = upgradedCompleted;
      return upgradedCompleted;
    }

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
      version: targetVersion,
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

  function getPendingStepId(state) {
    const tutorial = normalizeTutorialState(state);
    if (tutorial.disabled || tutorial.completed) return null;
    return tutorial.currentStepId || null;
  }

  function getPendingStepDefinition(state) {
    const pendingStepId = getPendingStepId(state);
    return pendingStepId ? getStepDefinition(pendingStepId) : null;
  }

  function getActiveStepId(state) {
    const stepDefinition = getPendingStepDefinition(state);
    if (!isStepAvailable(stepDefinition, state)) return null;
    return stepDefinition && typeof stepDefinition.id === 'string' ? stepDefinition.id : null;
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

  function isStepAvailable(stepDefinition, state) {
    if (!stepDefinition) return false;
    if (!stepDefinition.activation || !state) return true;
    if (stepDefinition.activation.kind === 'min_coins') {
      const requiredCoins = Number(stepDefinition.activation.value);
      if (!Number.isFinite(requiredCoins)) return true;
      return Number(state.coins) >= requiredCoins;
    }
    return true;
  }

  function pushUniqueTarget(list, target) {
    if (!target) return;
    if (list.indexOf(target) !== -1) return;
    list.push(target);
  }

  function resolveTargetsByKind(kind, state) {
    const targets = [];
    if (!kind || !state) return targets;

    if (kind === 'starter_hangar_tank') {
      pushUniqueTarget(targets, findStarterTankCell(state));
      return targets;
    }

    if (kind === 'any_hangar_tank') {
      if (!Array.isArray(state.cells)) return targets;
      for (let i = 0; i < state.cells.length; i++) {
        const cell = state.cells[i];
        if (!cell || !cell.tank || cell.tank.onTrack) continue;
        pushUniqueTarget(targets, cell);
      }
      return targets;
    }

    if (kind === 'buy_tank_button') {
      pushUniqueTarget(targets, runtime.ui && runtime.ui.buy ? runtime.ui.buy : null);
      return targets;
    }

    return targets;
  }

  function resolveStepTarget(stepDefinition, state) {
    if (!stepDefinition || !stepDefinition.target || !state) return null;
    if (typeof stepDefinition.target.kind === 'string') {
      const targets = resolveTargetsByKind(stepDefinition.target.kind, state);
      return targets.length ? targets[0] : null;
    }
    if (typeof stepDefinition.target.selector === 'string' && runtime.documentObj) {
      return runtime.documentObj.querySelector(stepDefinition.target.selector);
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

  function sanitizeCursorAnimation(raw, fallback) {
    const base = fallback || { x: 0, y: 0, w: 32, h: 32, frames: 1, frameRateFps: 1, loop: true, scale: 1 };
    const next = raw && typeof raw === 'object' ? raw : {};
    return {
      x: Number.isFinite(Number(next.x)) ? Math.max(0, Math.floor(Number(next.x))) : base.x,
      y: Number.isFinite(Number(next.y)) ? Math.max(0, Math.floor(Number(next.y))) : base.y,
      w: Number.isFinite(Number(next.w)) ? Math.max(1, Math.floor(Number(next.w))) : base.w,
      h: Number.isFinite(Number(next.h)) ? Math.max(1, Math.floor(Number(next.h))) : base.h,
      frames: Number.isFinite(Number(next.frames)) ? Math.max(1, Math.floor(Number(next.frames))) : base.frames,
      frameRateFps: Number.isFinite(Number(next.frameRateFps)) ? Math.max(1, Number(next.frameRateFps)) : base.frameRateFps,
      loop: typeof next.loop === 'boolean' ? next.loop : base.loop,
      scale: Number.isFinite(Number(next.scale)) ? Math.max(0.25, Number(next.scale)) : base.scale,
    };
  }

  function normalizeRotationDegrees(value, fallback) {
    const rawValue = Number(value);
    const baseValue = Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
    if (!Number.isFinite(rawValue)) return baseValue;
    const normalized = rawValue % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function sanitizeCursorStepVisual(raw) {
    const next = raw && typeof raw === 'object' ? raw : {};
    return {
      spriteRotationDeg: normalizeRotationDegrees(next.spriteRotationDeg, 0),
      motionAngleDeg: normalizeRotationDegrees(next.motionAngleDeg, 90),
    };
  }

  function sanitizeCursorConfig(raw) {
    const defaults = buildDefaultCursorConfig();
    const next = raw && typeof raw === 'object' ? raw : {};
    const animations = next.animations && typeof next.animations === 'object' ? next.animations : {};
    const rawSteps = next.steps && typeof next.steps === 'object'
      ? next.steps
      : (next.stepOverrides && typeof next.stepOverrides === 'object' ? next.stepOverrides : {});
    const steps = {};
    const stepIds = Object.keys(rawSteps);

    for (let i = 0; i < stepIds.length; i++) {
      const stepId = stepIds[i];
      if (typeof stepId !== 'string' || !stepId) continue;
      steps[stepId] = sanitizeCursorStepVisual(rawSteps[stepId]);
    }

    return {
      atlas: typeof next.atlas === 'string' && next.atlas ? next.atlas : defaults.atlas,
      animations: {
        click: sanitizeCursorAnimation(animations.click, defaults.animations.click),
        drag: sanitizeCursorAnimation(animations.drag, defaults.animations.drag),
        drop: sanitizeCursorAnimation(animations.drop, defaults.animations.drop),
      },
      steps: steps,
    };
  }

  function ensureCursorAtlasLoaded(url) {
    if (!url) return Promise.resolve(null);
    if (runtime.cursorAtlasImage && runtime.cursorAtlasUrl === url) return Promise.resolve(runtime.cursorAtlasImage);
    return new Promise(function (resolve, reject) {
      const image = new Image();
      image.onload = function () {
        runtime.cursorAtlasImage = image;
        runtime.cursorAtlasUrl = url;
        resolve(image);
      };
      image.onerror = function () { reject(new Error('tutorial_cursor_atlas_load_failed')); };
      image.src = url;
    });
  }

  function ensureCursorConfigLoaded() {
    if (runtime.cursorConfigLoad) return runtime.cursorConfigLoad;

    runtime.cursorConfig = sanitizeCursorConfig(runtime.cursorConfig);
    runtime.cursorConfigLoad = Promise.resolve()
      .then(function () {
        if (!global.fetch) return null;
        return global.fetch(TUTORIAL_CURSOR_CONFIG_PATH, { cache: 'no-store' }).then(function (response) {
          if (!response.ok) return null;
          return response.json();
        });
      })
      .then(function (payload) {
        if (payload && typeof payload === 'object') {
          runtime.cursorConfig = sanitizeCursorConfig(payload);
        }
        return ensureCursorAtlasLoaded(runtime.cursorConfig.atlas).catch(function () { return null; });
      })
      .catch(function () {
        return ensureCursorAtlasLoaded(runtime.cursorConfig.atlas).catch(function () { return null; });
      });

    return runtime.cursorConfigLoad;
  }

  function getPointerAnimationKey(stepDefinition) {
    const animations = runtime.cursorConfig && runtime.cursorConfig.animations ? runtime.cursorConfig.animations : {};
    const requested = stepDefinition && typeof stepDefinition.pointerAnimation === 'string'
      ? stepDefinition.pointerAnimation
      : 'click';
    return animations[requested] ? requested : 'click';
  }

  function syncPointerSprite(nowMs) {
    if (!runtime.pointerEl || !runtime.pointerSpriteEl) return;
    ensureCursorConfigLoaded();

    const config = runtime.cursorConfig || buildDefaultCursorConfig();
    const animations = config.animations || {};
    const animation = animations[runtime.pointerAnimationKey] || animations.click;
    if (!animation) return;

    const width = Math.max(1, Math.round(animation.w * animation.scale));
    const height = Math.max(1, Math.round(animation.h * animation.scale));
    runtime.pointerEl.style.width = width + 'px';
    runtime.pointerEl.style.height = height + 'px';

    if (!runtime.cursorAtlasImage || !runtime.cursorAtlasUrl) {
      runtime.pointerEl.classList.remove('gameTutorial__pointer--spriteReady');
      runtime.pointerSpriteEl.style.backgroundImage = '';
      return;
    }

    const fps = Math.max(1, animation.frameRateFps);
    const frameCount = Math.max(1, animation.frames);
    const frameDurationMs = 1000 / fps;
    let frameIndex = frameCount <= 1 ? 0 : Math.floor(nowMs / frameDurationMs);
    if (animation.loop) frameIndex %= frameCount;
    else frameIndex = Math.min(frameCount - 1, frameIndex);

    runtime.pointerEl.classList.add('gameTutorial__pointer--spriteReady');
    runtime.pointerSpriteEl.style.backgroundImage = 'url("' + runtime.cursorAtlasUrl + '")';
    runtime.pointerSpriteEl.style.backgroundSize = Math.round(runtime.cursorAtlasImage.naturalWidth * animation.scale) + 'px ' + Math.round(runtime.cursorAtlasImage.naturalHeight * animation.scale) + 'px';
    runtime.pointerSpriteEl.style.backgroundPosition = (-Math.round((animation.x + animation.w * frameIndex) * animation.scale)) + 'px ' + (-Math.round(animation.y * animation.scale)) + 'px';
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

    const pointerSprite = runtime.documentObj.createElement('div');
    pointerSprite.className = 'gameTutorial__pointerSprite';
    pointerSprite.setAttribute('aria-hidden', 'true');
    pointer.appendChild(pointerSprite);

    /* Grain SVG overlay on pointer */
    // const grainSvgNS = 'http://www.w3.org/2000/svg';
    // const grainSvg = runtime.documentObj.createElementNS(grainSvgNS, 'svg');
    // grainSvg.setAttribute('class', 'gameTutorial__pointerGrain');
    // grainSvg.setAttribute('aria-hidden', 'true');
    // const grainDefs = runtime.documentObj.createElementNS(grainSvgNS, 'defs');
    // const grainFilter = runtime.documentObj.createElementNS(grainSvgNS, 'filter');
    // grainFilter.setAttribute('id', 'tutPointerGrain');
    // const feTurb = runtime.documentObj.createElementNS(grainSvgNS, 'feTurbulence');
    // feTurb.setAttribute('type', 'fractalNoise');
    // feTurb.setAttribute('baseFrequency', '0.75');
    // feTurb.setAttribute('numOctaves', '30');
    // feTurb.setAttribute('stitchTiles', 'stitch');
    // feTurb.setAttribute('result', 'noise');
    // const feCM = runtime.documentObj.createElementNS(grainSvgNS, 'feColorMatrix');
    // feCM.setAttribute('type', 'saturate');
    // feCM.setAttribute('values', '0');
    // feCM.setAttribute('in', 'noise');
    // grainFilter.appendChild(feTurb);
    // grainFilter.appendChild(feCM);
    // grainDefs.appendChild(grainFilter);
    // grainSvg.appendChild(grainDefs);
    // const grainRect = runtime.documentObj.createElementNS(grainSvgNS, 'rect');
    // grainRect.setAttribute('width', '100%');
    // grainRect.setAttribute('height', '100%');
    // grainRect.setAttribute('filter', 'url(#tutPointerGrain)');
    // grainRect.setAttribute('opacity', '0.9');
    // grainSvg.appendChild(grainRect);
    // pointer.appendChild(grainSvg);

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

    const skipBtn = createButton('btn btnSecondary uiButtonBehavior gameTutorial__skipBtn', '');
    skipBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      completeCurrentStep('skip');
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
    actions.appendChild(skipBtn);
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
    runtime.pointerSpriteEl = pointerSprite;
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
    runtime.skipBtn = skipBtn;
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

  function syncPointerMode(stepDefinition) {
    if (!runtime.pointerEl) return;
    runtime.pointerAnimationKey = getPointerAnimationKey(stepDefinition);
    const stepId = stepDefinition && typeof stepDefinition.id === 'string' ? stepDefinition.id : '';
    const stepConfig = runtime.cursorConfig && runtime.cursorConfig.steps && stepId
      ? runtime.cursorConfig.steps[stepId] || null
      : null;
    const motionAngleDeg = stepConfig
      ? normalizeRotationDegrees(stepConfig.motionAngleDeg, stepDefinition && stepDefinition.pointerMotion === 'horizontal' ? 180 : 90)
      : (stepDefinition && stepDefinition.pointerMotion === 'horizontal' ? 180 : 90);
    const spriteRotationDeg = stepConfig
      ? normalizeRotationDegrees(stepConfig.spriteRotationDeg, 0)
      : 0;
    const radians = motionAngleDeg * (Math.PI / 180);
    runtime.pointerEl.style.setProperty('--tutorial-pointer-rotation', spriteRotationDeg + 'deg');
    runtime.pointerEl.style.setProperty('--tutorial-pointer-motion-x', String(Math.round(Math.cos(radians) * 1000) / 1000));
    runtime.pointerEl.style.setProperty('--tutorial-pointer-motion-y', String(Math.round(Math.sin(radians) * 1000) / 1000));
    runtime.pointerEl.classList.toggle(
      'gameTutorial__pointer--horizontal',
      !!(stepDefinition && stepDefinition.pointerMotion === 'horizontal')
    );
  }

  function positionOverlay(target) {
    if (!runtime.rootEl || !runtime.pointerEl || !runtime.documentObj || !target) return;
    const canvas = runtime.canvasEl || runtime.documentObj.getElementById('c');
    const stageCanvas = runtime.stageEl || runtime.rootEl.parentElement;
    if (!stageCanvas) {
      setOverlayHidden(true);
      return;
    }

    const stageRect = stageCanvas.getBoundingClientRect();
    let centerX = 0;
    let centerY = 0;

    if (target && typeof target.getBoundingClientRect === 'function') {
      if (!isElementVisible(target)) {
        setOverlayHidden(true);
        return;
      }
      const targetRect = target.getBoundingClientRect();
      if (!targetRect || targetRect.width <= 0 || targetRect.height <= 0) {
        setOverlayHidden(true);
        return;
      }
      centerX = targetRect.left - stageRect.left + targetRect.width * 0.5;
      centerY = targetRect.top - stageRect.top + targetRect.height * 0.5;
    } else {
      if (!canvas || !Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.w) || !Number.isFinite(target.h)) {
        setOverlayHidden(true);
        return;
      }
      const canvasRect = canvas.getBoundingClientRect();
      centerX = canvasRect.left - stageRect.left + target.x + target.w * 0.5;
      centerY = canvasRect.top - stageRect.top + target.y + target.h * 0.5;
    }

    const pointerWidth = runtime.pointerEl.offsetWidth || 32;
    const pointerHeight = runtime.pointerEl.offsetHeight || 32;
    runtime.pointerEl.style.left = Math.round(centerX - pointerWidth * 0.5) + 'px';
    runtime.pointerEl.style.top = Math.round(centerY - pointerHeight - 6) + 'px';

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

  function collectAccessList(source, key) {
    if (!source || typeof source !== 'object') return [];
    const list = source[key];
    const result = [];
    if (!Array.isArray(list)) return result;
    for (let i = 0; i < list.length; i++) {
      if (typeof list[i] !== 'string' || !list[i]) continue;
      if (result.indexOf(list[i]) !== -1) continue;
      result.push(list[i]);
    }
    return result;
  }

  function getStepUnlockDefinition(stepDefinition) {
    const unlock = stepDefinition && stepDefinition.unlock && typeof stepDefinition.unlock === 'object'
      ? stepDefinition.unlock
      : null;
    const legacyAllow = stepDefinition && stepDefinition.allow && typeof stepDefinition.allow === 'object'
      ? stepDefinition.allow
      : null;
    const uiKeys = collectAccessList(unlock, 'uiKeys');
    const selectors = collectAccessList(unlock, 'selectors');
    const targetKinds = collectAccessList(unlock, 'targetKinds');
    const legacyUiKeys = collectAccessList(legacyAllow, 'uiKeys');

    for (let i = 0; i < legacyUiKeys.length; i++) {
      if (uiKeys.indexOf(legacyUiKeys[i]) === -1) uiKeys.push(legacyUiKeys[i]);
    }

    return {
      uiKeys: uiKeys,
      selectors: selectors,
      targetKinds: targetKinds,
    };
  }

  function resolveSelectorTargets(selectors) {
    const targets = [];
    if (!runtime.documentObj || !Array.isArray(selectors)) return targets;
    for (let i = 0; i < selectors.length; i++) {
      if (typeof selectors[i] !== 'string' || !selectors[i]) continue;
      const element = runtime.documentObj.querySelector(selectors[i]);
      if (element) pushUniqueTarget(targets, element);
    }
    return targets;
  }

  function collectProgressiveAccess(state) {
    const tutorial = normalizeTutorialState(state);
    const definitions = getStepDefinitions();
    const activeStepId = getActiveStepId(state);
    const access = {
      uiKeys: [],
      selectors: [],
      targets: [],
    };

    for (let i = 0; i < definitions.length; i++) {
      const definition = definitions[i];
      if (!definition || typeof definition.id !== 'string' || !definition.id) continue;
      const stepState = tutorial.steps && tutorial.steps[definition.id] ? tutorial.steps[definition.id] : null;
      const shouldIncludeUnlock = !!(stepState && stepState.completed) || definition.id === activeStepId;
      if (!shouldIncludeUnlock) continue;

      const unlock = getStepUnlockDefinition(definition);
      for (let uiIndex = 0; uiIndex < unlock.uiKeys.length; uiIndex++) {
        if (access.uiKeys.indexOf(unlock.uiKeys[uiIndex]) === -1) access.uiKeys.push(unlock.uiKeys[uiIndex]);
      }
      for (let selectorIndex = 0; selectorIndex < unlock.selectors.length; selectorIndex++) {
        if (access.selectors.indexOf(unlock.selectors[selectorIndex]) === -1) access.selectors.push(unlock.selectors[selectorIndex]);
      }
      for (let targetIndex = 0; targetIndex < unlock.targetKinds.length; targetIndex++) {
        const targets = resolveTargetsByKind(unlock.targetKinds[targetIndex], state);
        for (let resolvedIndex = 0; resolvedIndex < targets.length; resolvedIndex++) {
          pushUniqueTarget(access.targets, targets[resolvedIndex]);
        }
      }
    }

    pushUniqueTarget(access.targets, resolveStepTarget(getActiveStepDefinition(state), state));
    return access;
  }

  function getAllowedUiElementsForStep(state) {
    const ui = runtime.ui || {};
    const elements = getAlwaysAllowedElements().slice();
    const access = collectProgressiveAccess(state);

    for (let i = 0; i < access.uiKeys.length; i++) {
      const candidate = ui[access.uiKeys[i]];
      if (candidate && elements.indexOf(candidate) === -1) elements.push(candidate);
    }

    const selectorTargets = resolveSelectorTargets(access.selectors);
    for (let selectorIndex = 0; selectorIndex < selectorTargets.length; selectorIndex++) {
      if (elements.indexOf(selectorTargets[selectorIndex]) === -1) elements.push(selectorTargets[selectorIndex]);
    }

    for (let targetIndex = 0; targetIndex < access.targets.length; targetIndex++) {
      const target = access.targets[targetIndex];
      if (target && typeof target.getBoundingClientRect === 'function' && elements.indexOf(target) === -1) {
        elements.push(target);
      }
    }

    return elements;
  }

  function getAllowedCanvasTargets(state) {
    const access = collectProgressiveAccess(state);
    const targets = [];
    for (let i = 0; i < access.targets.length; i++) {
      const target = access.targets[i];
      if (!target || typeof target.getBoundingClientRect === 'function') continue;
      if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.w) || !Number.isFinite(target.h)) continue;
      pushUniqueTarget(targets, target);
    }
    return targets;
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
    if (!getPendingStepId(state)) return false;
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
      ? [getPendingStepId(state) || '', getActiveStepId(state) || '', isStepBubbleOpen(state) ? '1' : '0', state && state.ui && state.ui.menuOpen ? '1' : '0'].join('|')
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
    if (runtime.skipBtn) runtime.skipBtn.textContent = translate('tutorialSkip', 'Пропустить');
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
    const point = getCanvasPointFromEvent(event);
    const targets = getAllowedCanvasTargets(state);
    let isAllowed = false;

    if (point) {
      for (let i = 0; i < targets.length; i++) {
        if (isPointInsideCell(targets[i], point)) {
          isAllowed = true;
          break;
        }
      }
    }

    if (!point || !isAllowed) {
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
    const nowMs = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

    migrateTutorialStateIfNeeded(state);
    const completionStep = getActiveStepDefinition(state);
    if (completionStep && completionStep.completion && completionStep.completion.kind === 'tank_bought' && getPurchasedTankCount(state) > 0) {
      completeCurrentStep('tank_bought');
      return;
    }
    ensureDom();
    patchPauseManagerFactory();
    attachInteractionGuards();
    applyUiLock(state);
    syncCopy();
    syncPauseState(state);
    syncBodyState(state);

    const activeStep = getActiveStepDefinition(state);
    syncPointerMode(activeStep);
    syncPointerSprite(nowMs);
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

  function handleTankPurchased(payload) {
    const info = payload || null;
    if (!info || info.cause !== 'user') return;
    const state = getState();
    const stepDefinition = getActiveStepDefinition(state);
    if (!stepDefinition || !stepDefinition.completion || stepDefinition.completion.kind !== 'tank_bought') return;
    completeCurrentStep('tank_bought');
  }

  function isUiLocked() {
    return shouldLockInteractions(getState());
  }

  const api = {
    init: init,
    syncNow: syncNow,
    isUiLocked: isUiLocked,
    handleTankOnTrackChanged: handleTankOnTrackChanged,
    handleTankPurchased: handleTankPurchased,
  };

  global.Game = global.Game || {};
  global.Game.TutorialRuntime = api;
})(typeof window !== 'undefined' ? window : this);