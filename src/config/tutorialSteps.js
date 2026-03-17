(function (global) {
  'use strict';

  var VERSION = 8;
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
    createStep({
      id: 'supercomputer_open_menu',
      messageKey: 'tutorialSupercomputerOpenMenuMessage',
      pointerAnimation: 'click',
      activation: {
        kind: 'supercomputer_level_reward_dismissed',
        minSupercomputerLevel: 1,
        minFreeTalentPoints: 1,
      },
      target: {
        selector: '#supercomputerBtn',
      },
      completion: {
        kind: 'supercomputer_root_open',
      },
      allow: {
        bubbleControls: ['close', 'continue', 'disable'],
      },
      unlock: {
        selectors: ['#supercomputerBtn'],
      },
    }),
    createStep({
      id: 'supercomputer_open_talent_tree',
      messageKey: 'tutorialSupercomputerOpenTreeMessage',
      pointerAnimation: 'click',
      activation: {
        kind: 'supercomputer_root_open',
        requiresStepBubbleShown: 'supercomputer_open_menu',
        minSupercomputerLevel: 1,
        minFreeTalentPoints: 1,
      },
      target: {
        selector: '#supercomputerOpenTalents',
      },
      completion: {
        kind: 'supercomputer_talents_open',
      },
      allow: {
        bubbleControls: ['close', 'continue', 'disable'],
      },
      unlock: {
        selectors: ['#supercomputerOpenTalents'],
      },
    }),
    createStep({
      id: 'supercomputer_apply_caliber',
      messageKey: 'tutorialSupercomputerApplyCaliberMessage',
      pointerAnimation: 'click',
      activation: {
        kind: 'supercomputer_talents_open',
        requiresStepBubbleShown: 'supercomputer_open_talent_tree',
        minSupercomputerLevel: 1,
        minFreeTalentPoints: 1,
      },
      target: {
        selector: '#talentOverlay .talentNode[data-talent-id="off_caliber"]',
      },
      completion: {
        kind: 'talent_rank_applied',
        talentId: 'off_caliber',
        acceptAnyTalent: true,
      },
      allow: {
        bubbleControls: ['close', 'continue', 'disable'],
      },
      unlock: {
        selectors: [
          '#talentOverlay .talentNode[data-talent-id="off_caliber"]',
          '#talentOverlay #talentApply'
        ],
      },
    }),
    createStep({
      id: 'supercomputer_damage_open_menu',
      messageKey: 'tutorialSupercomputerDamageOpenMenuMessage',
      pointerAnimation: 'click',
      activation: {
        kind: 'min_damage_points',
        value: 2,
        includePendingGreyDamage: true,
      },
      target: {
        selector: '#supercomputerBtn',
      },
      completion: {
        kind: 'supercomputer_root_open',
      },
      allow: {
        bubbleControls: ['close', 'continue', 'disable'],
      },
      unlock: {
        selectors: ['#supercomputerBtn'],
      },
    }),
    createStep({
      id: 'supercomputer_damage_open_tank_wall_mods',
      messageKey: 'tutorialSupercomputerOpenTankWallMessage',
      pointerAnimation: 'click',
      activation: {
        kind: 'supercomputer_root_open',
        requiresStepBubbleShown: 'supercomputer_damage_open_menu',
        minDamagePoints: 2,
        includePendingGreyDamage: true,
      },
      target: {
        selector: '#supercomputerOpenTankWallMods',
      },
      completion: {
        kind: 'supercomputer_tank_wall_open',
      },
      allow: {
        bubbleControls: ['close', 'continue', 'disable'],
      },
      unlock: {
        selectors: ['#supercomputerOpenTankWallMods'],
      },
    }),
    createStep({
      id: 'supercomputer_damage_apply_level1_weapon_upgrade',
      messageKey: 'tutorialSupercomputerApplyWeaponDamageMessage',
      pointerAnimation: 'click',
      activation: {
        kind: 'supercomputer_tank_wall_weapons_open',
        requiresStepBubbleShown: 'supercomputer_damage_open_tank_wall_mods',
        minDamagePoints: 2,
      },
      target: {
        selector: '#modsTankWallOverlay .scGunsTable__row[data-level="1"] [data-guns-action="plus"]',
      },
      completion: {
        kind: 'supercomputer_damage_upgrade_applied',
      },
      allow: {
        bubbleControls: ['close', 'continue', 'disable'],
      },
      unlock: {
        selectors: [
          '#modsTankWallTabGuns',
          '#modsTankWallTabDrones',
          '#modsTankWallTabWalls',
          '#modsTankWallOverlay [data-guns-action="plus"]',
          '#modsTankWallOverlay [data-guns-action="minus"]',
          '#modsTankWallOverlay [data-guns-action="apply"]',
          '#modsTankWallOverlay [data-dron-action="plus"]',
          '#modsTankWallOverlay [data-dron-action="minus"]',
          '#modsTankWallOverlay [data-dron-action="apply"]',
          '#modsTankWallOverlay [data-walls-action="plus"]',
          '#modsTankWallOverlay [data-walls-action="minus"]',
          '#modsTankWallOverlay [data-walls-action="apply"]'
        ],
      },
    }),
    createStep({
      id: 'production_storage_open_first_box',
      messageKey: 'tutorialProductionStorageOpenMessage',
      pointerAnimation: 'click',
      activation: {
        kind: 'production_line_box_available',
        minUnopenedProductionBoxes: 1,
      },
      target: {
        kind: 'production_storage_hotspot',
      },
      completion: {
        kind: 'production_storage_open',
      },
      allow: {
        bubbleControls: ['close', 'continue', 'disable'],
      },
      unlock: {
        targetKinds: ['production_storage_hotspot'],
      },
    }),
    createStep({
      id: 'production_storage_open_box',
      messageKey: 'tutorialProductionStorageOpenBoxMessage',
      pointerAnimation: 'click',
      activation: {
        kind: 'production_storage_open',
        requiresStepBubbleShown: 'production_storage_open_first_box',
        minUnopenedProductionBoxes: 1,
      },
      target: {
        kind: 'production_storage_first_box',
      },
      completion: {
        kind: 'production_box_opened',
      },
      allow: {
        bubbleControls: ['close', 'continue', 'disable'],
      },
      unlock: {
        targetKinds: ['production_storage_first_box'],
      },
    }),
  ];

  function buildStepState() {
    return {
      completed: false,
      dismissed: false,
      bubbleOpen: true,
      bubbleShown: false,
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
      flags: {
        supercomputerLevelRewardDismissed: false,
      },
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