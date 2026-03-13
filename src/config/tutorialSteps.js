(function (global) {
  'use strict';

  var VERSION = 3;

  var STEPS = [
    {
      id: 'starter_tank',
      messageKey: 'tutorialStarterTankMessage',
      target: {
        kind: 'starter_hangar_tank',
      },
      completion: {
        kind: 'tank_on_track',
        cause: 'user',
      },
      allow: {
        uiKeys: ['settingsBtn', 'terminalCollapseBtn', 'terminalExpandBtn'],
        bubbleControls: ['close', 'continue', 'disable'],
      },
    },
    {
      id: 'second_tank',
      messageKey: 'tutorialSecondTankMessage',
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
      pointerMotion: 'horizontal',
      allow: {
        uiKeys: ['buy', 'settingsBtn', 'terminalCollapseBtn', 'terminalExpandBtn'],
        bubbleControls: ['close', 'continue', 'disable'],
      },
    },
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
    return STEPS.slice();
  }

  function getStep(stepId) {
    if (typeof stepId !== 'string' || !stepId) return null;
    for (var i = 0; i < STEPS.length; i++) {
      if (STEPS[i].id === stepId) return STEPS[i];
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