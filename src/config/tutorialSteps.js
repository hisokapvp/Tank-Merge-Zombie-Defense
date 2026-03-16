(function (global) {
  'use strict';

  var VERSION = 5;
  var DEFAULT_BUBBLE_CONTROLS = ['close', 'continue', 'disable'];

  function cloneStringArray(value) {
    var result = [];
    if (!Array.isArray(value)) return result;
    for (var i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'string' || !value[i]) continue;
      if (result.indexOf(value[i]) !== -1) continue;
      result.push(value[i]);
    }
    return result;
  }

  function clonePlainObject(value) {
    if (!value || typeof value !== 'object') return null;
    var copy = {};
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      copy[keys[i]] = value[keys[i]];
    }
    return copy;
  }

  function createStep(definition) {
    var def = definition && typeof definition === 'object' ? definition : {};
    var allow = def.allow && typeof def.allow === 'object' ? def.allow : {};
    var unlock = def.unlock && typeof def.unlock === 'object' ? def.unlock : {};
    var bubbleControls = cloneStringArray(allow.bubbleControls);
    if (!bubbleControls.length) bubbleControls = DEFAULT_BUBBLE_CONTROLS.slice();

    return {
      id: typeof def.id === 'string' ? def.id : '',
      messageKey: typeof def.messageKey === 'string' ? def.messageKey : '',
      pointerAnimation: typeof def.pointerAnimation === 'string' ? def.pointerAnimation : 'click',
      pointerMotion: typeof def.pointerMotion === 'string' ? def.pointerMotion : '',
      activation: clonePlainObject(def.activation),
      target: clonePlainObject(def.target),
      secondaryTarget: clonePlainObject(def.secondaryTarget),
      pointerPath: clonePlainObject(def.pointerPath),
      completion: clonePlainObject(def.completion),
      allow: {
        bubbleControls: bubbleControls,
      },
      unlock: {
        uiKeys: cloneStringArray(unlock.uiKeys),
        selectors: cloneStringArray(unlock.selectors),
        targetKinds: cloneStringArray(unlock.targetKinds),
      },
    };
  }

  var STEPS = [
    createStep({
      id: 'starter_tank',
      messageKey: 'tutorialStarterTankMessage',
      pointerAnimation: 'click',
      target: {
        kind: 'starter_hangar_tank',
      },
      completion: {
        kind: 'tank_on_track',
        cause: 'user',
      },
      allow: {
        bubbleControls: ['close', 'continue', 'disable'],
      },
      unlock: {
        targetKinds: ['any_hangar_tank', 'any_track_tank'],
      },
    }),
    createStep({
      id: 'second_tank',
      messageKey: 'tutorialSecondTankMessage',
      pointerAnimation: 'click',
      pointerMotion: 'horizontal',
      activation: {
        kind: 'min_coins',
        value: 50,
      },
      target: {
        kind: 'buy_tank_button',
      },
      completion: {
        kind: 'tank_bought',
        cause: 'user',
      },
      allow: {
        bubbleControls: ['close', 'continue', 'disable'],
      },
      unlock: {
        uiKeys: ['buy'],
        targetKinds: ['any_track_tank'],
      },
    }),
    createStep({
      id: 'merge_tank',
      messageKey: 'tutorialMergeTankMessage',
      pointerAnimation: 'drag',
      activation: {
        kind: 'mergeable_hangar_pair',
      },
      target: {
        kind: 'mergeable_hangar_tank_source',
      },
      secondaryTarget: {
        kind: 'mergeable_hangar_tank_target',
      },
      pointerPath: {
        leadInMs: 220,
        dragMs: 1080,
        dropHoldMs: 320,
      },
      completion: {
        kind: 'tank_merged',
        cause: 'user',
      },
      allow: {
        bubbleControls: ['close', 'continue', 'disable'],
      },
      unlock: {
        targetKinds: ['mergeable_hangar_pair', 'any_hangar_tank', 'any_track_tank'],
      },
    }),
  ];

  function buildStepState() {
    return {
      completed: false,
      dismissed: false,
      bubbleOpen: true,
    };
  }

  function buildStepsState() {
    var steps = {};
    for (var i = 0; i < STEPS.length; i++) {
      steps[STEPS[i].id] = buildStepState();
    }
    return steps;
  }

  function buildInitialTutorialState() {
    return {
      version: VERSION,
      disabled: false,
      completed: false,
      currentStepId: STEPS.length ? STEPS[0].id : null,
      steps: buildStepsState(),
    };
  }

  function getAll() {
    var result = [];
    for (var i = 0; i < STEPS.length; i++) {
      result.push(createStep(STEPS[i]));
    }
    return result;
  }

  function getStep(stepId) {
    if (typeof stepId !== 'string' || !stepId) return null;
    for (var i = 0; i < STEPS.length; i++) {
      if (STEPS[i].id === stepId) return createStep(STEPS[i]);
    }
    return null;
  }

  global.Game = global.Game || {};
  global.Game.TutorialSteps = {
    VERSION: VERSION,
    getAll: getAll,
    getStep: getStep,
    buildStepState: buildStepState,
    buildInitialTutorialState: buildInitialTutorialState,
  };
})(typeof window !== 'undefined' ? window : this);