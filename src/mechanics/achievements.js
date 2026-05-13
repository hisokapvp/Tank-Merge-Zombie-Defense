(function (global) {
  'use strict';

  var ACHIEVEMENT_FAMILIES = [
    {
      id: 'creator',
      definitions: [
        {
          id: 'creator_novice',
          familyId: 'creator',
          titleKey: 'achievementCreatorNovice',
          rewardKey: 'achievementRewardCreate2',
          target: 200,
          progressType: 'purchases',
          rewardMode: 'buy2',
        },
        {
          id: 'creator_pro',
          familyId: 'creator',
          titleKey: 'achievementCreatorPro',
          rewardKey: 'achievementRewardCreate5',
          target: 800,
          progressType: 'purchases',
          rewardMode: 'buy5',
        },
        {
          id: 'creator_expert',
          familyId: 'creator',
          titleKey: 'achievementCreatorExpert',
          rewardKey: 'achievementRewardCreateMax',
          target: 1600,
          progressType: 'purchases',
          rewardMode: 'buyMax',
        },
      ],
    },
    {
      id: 'engineer',
      definitions: [
        {
          id: 'engineer_novice',
          familyId: 'engineer',
          titleKey: 'achievementEngineerNovice',
          rewardKey: 'achievementRewardAutoMergeBasic',
          target: 200,
          progressType: 'merges',
          rewardMode: 'autoMergeBasic',
        },
        {
          id: 'engineer_pro',
          familyId: 'engineer',
          titleKey: 'achievementEngineerPro',
          rewardKey: 'achievementRewardAutoMergeAdvanced',
          target: 500,
          progressType: 'merges',
          rewardMode: 'autoMergeAdvanced',
        },
        {
          id: 'engineer_expert',
          familyId: 'engineer',
          titleKey: 'achievementEngineerExpert',
          rewardKey: 'achievementRewardAutoMergeExpert',
          target: 1000,
          progressType: 'merges',
          rewardMode: 'autoMergeExpert',
        },
      ],
    },
    {
      id: 'fence_mechanic',
      definitions: [
        {
          id: 'fence_mechanic_1',
          familyId: 'fence_mechanic',
          titleKey: 'achievementFenceMechanic1',
          descKey: 'achievementFenceMechanic1Desc',
          rewardKey: 'achievementRewardFenceMechanicCoins75',
          target: 1,
          progressType: 'manualFenceRepairs',
          rewardMode: 'fenceMechanicCoins75',
        },
        {
          id: 'fence_mechanic_2',
          familyId: 'fence_mechanic',
          titleKey: 'achievementFenceMechanic2',
          descKey: 'achievementFenceMechanic2Desc',
          rewardKey: 'achievementRewardFenceMechanicDust5',
          target: 50,
          progressType: 'manualFenceRepairs',
          rewardMode: 'fenceMechanicDust5',
        },
        {
          id: 'fence_mechanic_3',
          familyId: 'fence_mechanic',
          titleKey: 'achievementFenceMechanic3',
          descKey: 'achievementFenceMechanic3Desc',
          rewardKey: 'achievementRewardFenceMechanicFragment1',
          target: 200,
          progressType: 'manualFenceRepairs',
          rewardMode: 'fenceMechanicFragment1',
        },
        {
          id: 'fence_mechanic_4',
          familyId: 'fence_mechanic',
          titleKey: 'achievementFenceMechanic4',
          descKey: 'achievementFenceMechanic4Desc',
          rewardKey: 'achievementRewardFenceMechanicChips2',
          target: 1000,
          progressType: 'manualFenceRepairs',
          rewardMode: 'fenceMechanicRandomChips2',
        },
        {
          id: 'fence_mechanic_5',
          familyId: 'fence_mechanic',
          titleKey: 'achievementFenceMechanic5',
          descKey: 'achievementFenceMechanic5Desc',
          rewardKey: 'achievementRewardFenceMechanicUpgradePoint1',
          target: 10000,
          progressType: 'manualFenceRepairs',
          rewardMode: 'fenceMechanicUpgradePoint1',
        },
      ],
    },
    {
      id: 'new_technology',
      definitions: [
        {
          id: 'new_technology_1',
          familyId: 'new_technology',
          titleKey: 'achievementNewTechnology1',
          descKey: 'achievementNewTechnology1Desc',
          rewardKey: 'achievementRewardNewTechnologyFragments2',
          target: 1,
          progressType: 'modifierTechUnlocks',
          rewardMode: 'newTechnologyFragments2',
        },
        {
          id: 'new_technology_2',
          familyId: 'new_technology',
          titleKey: 'achievementNewTechnology2',
          descKey: 'achievementNewTechnology2Desc',
          rewardKey: 'achievementRewardNewTechnologyDust20',
          target: 3,
          progressType: 'modifierTechUnlocks',
          rewardMode: 'newTechnologyDust20',
        },
        {
          id: 'new_technology_3',
          familyId: 'new_technology',
          titleKey: 'achievementNewTechnology3',
          descKey: 'achievementNewTechnology3Desc',
          rewardKey: 'achievementRewardNewTechnologyChips2',
          target: 8,
          progressType: 'modifierTechUnlocks',
          rewardMode: 'newTechnologyRandomChips2',
        },
        {
          id: 'new_technology_4',
          familyId: 'new_technology',
          titleKey: 'achievementNewTechnology4',
          descKey: 'achievementNewTechnology4Desc',
          rewardKey: 'achievementRewardNewTechnologyUpgradePoints3',
          target: 16,
          progressType: 'modifierTechUnlocks',
          rewardMode: 'newTechnologyUpgradePoints3',
        },
      ],
    },
    {
      id: 'chip_crafting',
      definitions: [
        {
          id: 'chip_combinator_1',
          familyId: 'chip_crafting',
          titleKey: 'achievementChipCombinator1',
          descKey: 'achievementChipCombinator1Desc',
          rewardKey: 'achievementRewardChipCombinatorUpgrade1Dust50',
          target: 1,
          progressType: 'chipComboTriples',
          rewardMode: 'chipCombinatorUpgrade1Dust50',
        },
        {
          id: 'chip_creator_1',
          familyId: 'chip_crafting',
          titleKey: 'achievementChipCreator1',
          descKey: 'achievementChipCreator1Desc',
          rewardKey: 'achievementRewardChipCreator1Dust15',
          target: 1,
          progressType: 'chipCraftFromFragments',
          rewardMode: 'chipCreator1Dust15',
        },
        {
          id: 'chip_creator_2',
          familyId: 'chip_crafting',
          titleKey: 'achievementChipCreator2',
          descKey: 'achievementChipCreator2Desc',
          rewardKey: 'achievementRewardChipCreator2RandomChips3Dust50',
          target: 10,
          progressType: 'chipCraftFromFragments',
          rewardMode: 'chipCreator2RandomChips3Dust50',
        },
        {
          id: 'chip_creator_3',
          familyId: 'chip_crafting',
          titleKey: 'achievementChipCreator3',
          descKey: 'achievementChipCreator3Desc',
          rewardKey: 'achievementRewardChipCreator3UpgradePoints3Dust200',
          target: 100,
          progressType: 'chipCraftFromFragments',
          rewardMode: 'chipCreator3UpgradePoints3Dust200',
        },
      ],
    },
    {
      id: 'power_reserve',
      definitions: [
        {
          id: 'power_reserve_1',
          familyId: 'power_reserve',
          titleKey: 'achievementPowerReserve1',
          descKey: 'achievementPowerReserve1Desc',
          rewardKey: 'achievementRewardPowerReserve1',
          target: 5,
          progressType: 'unspentUpgradePoints',
          rewardMode: 'powerReserveDust15Fragments3',
        },
        {
          id: 'power_reserve_2',
          familyId: 'power_reserve',
          titleKey: 'achievementPowerReserve2',
          descKey: 'achievementPowerReserve2Desc',
          rewardKey: 'achievementRewardPowerReserve2',
          target: 10,
          progressType: 'unspentUpgradePoints',
          rewardMode: 'powerReserveRandomChips3Upgrade1',
        },
        {
          id: 'power_reserve_3',
          familyId: 'power_reserve',
          titleKey: 'achievementPowerReserve3',
          descKey: 'achievementPowerReserve3Desc',
          rewardKey: 'achievementRewardPowerReserve3',
          target: 15,
          progressType: 'unspentUpgradePoints',
          rewardMode: 'powerReserveUpgrade3Damage100000',
        },
      ],
    },
    {
      id: 'duty_shift',
      definitions: [
        {
          id: 'duty_shift_1',
          familyId: 'duty_shift',
          titleKey: 'achievementDutyShift1',
          descKey: 'achievementDutyShift1Desc',
          rewardKey: 'achievementRewardDutyShiftUpgradePoint1',
          target: 1,
          progressType: 'droneAcquisitions',
          rewardMode: 'dutyShiftUpgradePoint1',
        },
        {
          id: 'duty_shift_2',
          familyId: 'duty_shift',
          titleKey: 'achievementDutyShift2',
          descKey: 'achievementDutyShift2Desc',
          rewardKey: 'achievementRewardDutyShiftDamage20000',
          target: 4,
          progressType: 'droneAcquisitions',
          rewardMode: 'dutyShiftDamage20000',
        },
        {
          id: 'duty_shift_3',
          familyId: 'duty_shift',
          titleKey: 'achievementDutyShift3',
          descKey: 'achievementDutyShift3Desc',
          rewardKey: 'achievementRewardDutyShiftUpgradePoints2',
          target: 9,
          progressType: 'droneAcquisitions',
          rewardMode: 'dutyShiftUpgradePoints2',
        },
      ],
    },
    {
      id: 'drone_brigadier',
      definitions: [
        {
          id: 'drone_brigadier_1',
          familyId: 'drone_brigadier',
          titleKey: 'achievementDroneBrigadier1',
          descKey: 'achievementDroneBrigadier1Desc',
          rewardKey: 'achievementRewardDroneBrigadier1',
          target: 5,
          progressType: 'droneMaxLevel',
          rewardMode: 'droneBrigadierDrones2L2',
        },
        {
          id: 'drone_brigadier_2',
          familyId: 'drone_brigadier',
          titleKey: 'achievementDroneBrigadier2',
          descKey: 'achievementDroneBrigadier2Desc',
          rewardKey: 'achievementRewardDroneBrigadier2',
          target: 10,
          progressType: 'droneMaxLevel',
          rewardMode: 'droneBrigadierDrones3L5Upgrade3',
        },
      ],
    },
    {
      id: 'optimizer',
      definitions: [
        {
          id: 'optimizer_1',
          familyId: 'optimizer',
          titleKey: 'achievementOptimizer1',
          descKey: 'achievementOptimizer1Desc',
          rewardKey: 'achievementRewardOptimizer1',
          target: 1,
          displayTarget: 15,
          optimizerMinChips: 1,
          progressType: 'hangarCellChipTier',
          rewardMode: 'optimizerUpgrade2Drones2L2',
        },
        {
          id: 'optimizer_2',
          familyId: 'optimizer',
          titleKey: 'achievementOptimizer2',
          descKey: 'achievementOptimizer2Desc',
          rewardKey: 'achievementRewardOptimizer2',
          target: 2,
          displayTarget: 15,
          optimizerMinChips: 2,
          progressType: 'hangarCellChipTier',
          rewardMode: 'optimizerChips10Damage100000',
        },
        {
          id: 'optimizer_3',
          familyId: 'optimizer',
          titleKey: 'achievementOptimizer3',
          descKey: 'achievementOptimizer3Desc',
          rewardKey: 'achievementRewardOptimizer3',
          target: 3,
          displayTarget: 15,
          optimizerMinChips: 3,
          progressType: 'hangarCellChipTier',
          rewardMode: 'optimizerUpgrade5Drones3L5',
        },
      ],
    },
    {
      id: 'track_cleanup',
      definitions: [
        {
          id: 'track_cleanup_1',
          familyId: 'track_cleanup',
          titleKey: 'achievementTrackCleanup1',
          descKey: 'achievementTrackCleanup1Desc',
          rewardKey: 'achievementRewardTrackCleanupDamagePoints50',
          target: 1,
          progressType: 'noRepairAttackWaveStreak',
          rewardMode: 'trackCleanupDamagePoints50',
        },
        {
          id: 'track_cleanup_2',
          familyId: 'track_cleanup',
          titleKey: 'achievementTrackCleanup2',
          descKey: 'achievementTrackCleanup2Desc',
          rewardKey: 'achievementRewardTrackCleanupFragments2',
          target: 5,
          progressType: 'noRepairAttackWaveStreak',
          rewardMode: 'trackCleanupFragments2',
        },
        {
          id: 'track_cleanup_3',
          familyId: 'track_cleanup',
          titleKey: 'achievementTrackCleanup3',
          descKey: 'achievementTrackCleanup3Desc',
          rewardKey: 'achievementRewardTrackCleanupUpgradePoint1',
          target: 10,
          progressType: 'noRepairAttackWaveStreak',
          rewardMode: 'trackCleanupUpgradePoint1',
        },
        {
          id: 'track_cleanup_4',
          familyId: 'track_cleanup',
          titleKey: 'achievementTrackCleanup4',
          descKey: 'achievementTrackCleanup4Desc',
          rewardKey: 'achievementRewardTrackCleanupChips5',
          target: 25,
          progressType: 'noRepairAttackWaveStreak',
          rewardMode: 'trackCleanupRandomChips5',
        },
        {
          id: 'track_cleanup_5',
          familyId: 'track_cleanup',
          titleKey: 'achievementTrackCleanup5',
          descKey: 'achievementTrackCleanup5Desc',
          rewardKey: 'achievementRewardTrackCleanupUpgradePoints3',
          target: 50,
          progressType: 'noRepairAttackWaveStreak',
          rewardMode: 'trackCleanupUpgradePoints3',
        },
      ],
    },
    {
      id: 'stable_income',
      definitions: [
        {
          id: 'stable_income_1',
          familyId: 'stable_income',
          titleKey: 'achievementStableIncome1',
          descKey: 'achievementStableIncome1Desc',
          rewardKey: 'achievementRewardStableIncomeDamage100',
          target: 10000,
          progressType: 'moneyEarned',
          rewardMode: 'stableIncomeDamage100',
        },
        {
          id: 'stable_income_2',
          familyId: 'stable_income',
          titleKey: 'achievementStableIncome2',
          descKey: 'achievementStableIncome2Desc',
          rewardKey: 'achievementRewardStableIncomeDamage1000',
          target: 1000000,
          progressType: 'moneyEarned',
          rewardMode: 'stableIncomeDamage1000',
        },
        {
          id: 'stable_income_3',
          familyId: 'stable_income',
          titleKey: 'achievementStableIncome3',
          descKey: 'achievementStableIncome3Desc',
          rewardKey: 'achievementRewardStableIncomeDamage5000',
          target: 100000000,
          progressType: 'moneyEarned',
          rewardMode: 'stableIncomeDamage5000',
        },
        {
          id: 'stable_income_4',
          familyId: 'stable_income',
          titleKey: 'achievementStableIncome4',
          descKey: 'achievementStableIncome4Desc',
          rewardKey: 'achievementRewardStableIncomeDamage500M',
          target: 100000000000,
          progressType: 'moneyEarned',
          rewardMode: 'stableIncomeDamage500M',
        },
        {
          id: 'stable_income_5',
          familyId: 'stable_income',
          titleKey: 'achievementStableIncome5',
          descKey: 'achievementStableIncome5Desc',
          rewardKey: 'achievementRewardStableIncomeUpgradePoints10',
          target: 100000000000000,
          progressType: 'moneyEarned',
          rewardMode: 'stableIncomeUpgradePoints10',
        },
      ],
    },
    {
      id: 'early_capital',
      definitions: [
        {
          id: 'early_capital_1',
          familyId: 'early_capital',
          titleKey: 'achievementEarlyCapital1',
          descKey: 'achievementEarlyCapital1Desc',
          rewardKey: 'achievementRewardEarlyCapitalFragments2',
          target: 10000,
          progressType: 'currentBalance',
          rewardMode: 'earlyCapitalFragments2',
        },
        {
          id: 'early_capital_2',
          familyId: 'early_capital',
          titleKey: 'achievementEarlyCapital2',
          descKey: 'achievementEarlyCapital2Desc',
          rewardKey: 'achievementRewardEarlyCapitalChips2',
          target: 1000000,
          progressType: 'currentBalance',
          rewardMode: 'earlyCapitalChips2',
        },
        {
          id: 'early_capital_3',
          familyId: 'early_capital',
          titleKey: 'achievementEarlyCapital3',
          descKey: 'achievementEarlyCapital3Desc',
          rewardKey: 'achievementRewardEarlyCapitalDamage10000',
          target: 100000000,
          progressType: 'currentBalance',
          rewardMode: 'earlyCapitalDamage10000',
        },
        {
          id: 'early_capital_4',
          familyId: 'early_capital',
          titleKey: 'achievementEarlyCapital4',
          descKey: 'achievementEarlyCapital4Desc',
          rewardKey: 'achievementRewardEarlyCapitalFragments20',
          target: 100000000000,
          progressType: 'currentBalance',
          rewardMode: 'earlyCapitalFragments20',
        },
        {
          id: 'early_capital_5',
          familyId: 'early_capital',
          titleKey: 'achievementEarlyCapital5',
          descKey: 'achievementEarlyCapital5Desc',
          rewardKey: 'achievementRewardEarlyCapitalUpgrade3Drones5L2',
          target: 100000000000000,
          progressType: 'currentBalance',
          rewardMode: 'earlyCapitalUpgrade3Drones5L2',
        },
      ],
    },
    {
      id: 'tough_perimeter',
      definitions: [
        {
          id: 'tough_perimeter',
          familyId: 'tough_perimeter',
          titleKey: 'achievementToughPerimeter',
          descKey: 'achievementToughPerimeterDesc',
          rewardKey: 'achievementRewardToughPerimeterUpgradePoint1',
          target: 1,
          progressType: 'perfectFenceWaves',
          rewardMode: 'toughPerimeterUpgradePoint1',
        },
      ],
    },
    {
      id: 'hangar_master',
      definitions: [
        {
          id: 'hangar_master_1',
          familyId: 'hangar_master',
          titleKey: 'achievementHangarMaster1',
          descKey: 'achievementHangarMaster1Desc',
          rewardKey: 'achievementRewardHangarMaster1',
          target: 1,
          displayTarget: 15,
          hangarMinLevel: 1,
          progressType: 'hangarMasterLevel',
          rewardMode: 'hangarMasterFragmentDust10',
        },
        {
          id: 'hangar_master_2',
          familyId: 'hangar_master',
          titleKey: 'achievementHangarMaster2',
          descKey: 'achievementHangarMaster2Desc',
          rewardKey: 'achievementRewardHangarMaster2',
          target: 2,
          displayTarget: 15,
          hangarMinLevel: 10,
          progressType: 'hangarMasterLevel',
          rewardMode: 'hangarMasterChips2Damage5000',
        },
        {
          id: 'hangar_master_3',
          familyId: 'hangar_master',
          titleKey: 'achievementHangarMaster3',
          descKey: 'achievementHangarMaster3Desc',
          rewardKey: 'achievementRewardHangarMaster3',
          target: 3,
          displayTarget: 15,
          hangarMinLevel: 20,
          progressType: 'hangarMasterLevel',
          rewardMode: 'hangarMasterUpgradeDrone1',
        },
        {
          id: 'hangar_master_4',
          familyId: 'hangar_master',
          titleKey: 'achievementHangarMaster4',
          descKey: 'achievementHangarMaster4Desc',
          rewardKey: 'achievementRewardHangarMaster4',
          target: 4,
          displayTarget: 15,
          hangarMinLevel: 40,
          progressType: 'hangarMasterLevel',
          rewardMode: 'hangarMasterDamage50000Chips5',
        },
        {
          id: 'hangar_master_5',
          familyId: 'hangar_master',
          titleKey: 'achievementHangarMaster5',
          descKey: 'achievementHangarMaster5Desc',
          rewardKey: 'achievementRewardHangarMaster5',
          target: 5,
          displayTarget: 15,
          hangarMinLevel: 60,
          progressType: 'hangarMasterLevel',
          rewardMode: 'hangarMasterUpgrade3Drones2L5',
        },
      ],
    },
    {
      id: 'defense_order',
      definitions: [
        {
          id: 'defense_order_1',
          familyId: 'defense_order',
          titleKey: 'achievementDefenseOrder1',
          descKey: 'achievementDefenseOrder1Desc',
          rewardKey: 'achievementRewardDefenseOrder1',
          target: 5,
          progressType: 'defenseOrderStreak',
          rewardMode: 'defenseOrderFragments2',
        },
        {
          id: 'defense_order_2',
          familyId: 'defense_order',
          titleKey: 'achievementDefenseOrder2',
          descKey: 'achievementDefenseOrder2Desc',
          rewardKey: 'achievementRewardDefenseOrder2',
          target: 10,
          progressType: 'defenseOrderStreak',
          rewardMode: 'defenseOrderChips2',
        },
        {
          id: 'defense_order_3',
          familyId: 'defense_order',
          titleKey: 'achievementDefenseOrder3',
          descKey: 'achievementDefenseOrder3Desc',
          rewardKey: 'achievementRewardDefenseOrder3',
          target: 25,
          progressType: 'defenseOrderStreak',
          rewardMode: 'defenseOrderUpgrade1Drone1L1',
        },
        {
          id: 'defense_order_4',
          familyId: 'defense_order',
          titleKey: 'achievementDefenseOrder4',
          descKey: 'achievementDefenseOrder4Desc',
          rewardKey: 'achievementRewardDefenseOrder4',
          target: 50,
          progressType: 'defenseOrderStreak',
          rewardMode: 'defenseOrderUpgrade3Drones3L3',
        },
        {
          id: 'defense_order_5',
          familyId: 'defense_order',
          titleKey: 'achievementDefenseOrder5',
          descKey: 'achievementDefenseOrder5Desc',
          rewardKey: 'achievementRewardDefenseOrder5',
          target: 100,
          progressType: 'defenseOrderStreak',
          rewardMode: 'defenseOrderUpgrade5Chips15',
        },
      ],
    },
    {
      id: 'first_elite',
      definitions: [
        {
          id: 'first_elite_1',
          familyId: 'first_elite',
          titleKey: 'achievementFirstElite1',
          descKey: 'achievementFirstElite1Desc',
          rewardKey: 'achievementRewardFirstElite1',
          target: 10,
          progressType: 'maxTankLevel',
          rewardMode: 'firstEliteDamage500',
        },
        {
          id: 'first_elite_2',
          familyId: 'first_elite',
          titleKey: 'achievementFirstElite2',
          descKey: 'achievementFirstElite2Desc',
          rewardKey: 'achievementRewardFirstElite2',
          target: 20,
          progressType: 'maxTankLevel',
          rewardMode: 'firstEliteUpgradePoint1',
        },
        {
          id: 'first_elite_3',
          familyId: 'first_elite',
          titleKey: 'achievementFirstElite3',
          descKey: 'achievementFirstElite3Desc',
          rewardKey: 'achievementRewardFirstElite3',
          target: 30,
          progressType: 'maxTankLevel',
          rewardMode: 'firstEliteDamage5000Chips2',
        },
        {
          id: 'first_elite_4',
          familyId: 'first_elite',
          titleKey: 'achievementFirstElite4',
          descKey: 'achievementFirstElite4Desc',
          rewardKey: 'achievementRewardFirstElite4',
          target: 40,
          progressType: 'maxTankLevel',
          rewardMode: 'firstEliteUpgrade2Drone1L3',
        },
        {
          id: 'first_elite_5',
          familyId: 'first_elite',
          titleKey: 'achievementFirstElite5',
          descKey: 'achievementFirstElite5Desc',
          rewardKey: 'achievementRewardFirstElite5',
          target: 50,
          progressType: 'maxTankLevel',
          rewardMode: 'firstEliteUpgrade3Drones2L5',
        },
        {
          id: 'first_elite_6',
          familyId: 'first_elite',
          titleKey: 'achievementFirstElite6',
          descKey: 'achievementFirstElite6Desc',
          rewardKey: 'achievementRewardFirstElite6',
          target: 60,
          progressType: 'maxTankLevel',
          rewardMode: 'firstEliteUpgrade5Damage50000',
        },
      ],
    },
    {
      id: 'auto_merge_addict',
      definitions: [
        {
          id: 'auto_merge_addict_1',
          familyId: 'auto_merge_addict',
          titleKey: 'achievementAutoMergeAddict1',
          descKey: 'achievementAutoMergeAddict1Desc',
          rewardKey: 'achievementRewardAutoMergeAddict1',
          target: 5000,
          progressType: 'autoMergeActivations',
          rewardMode: 'autoMergeAddict1Dust25Fragments10',
        },
        {
          id: 'auto_merge_addict_2',
          familyId: 'auto_merge_addict',
          titleKey: 'achievementAutoMergeAddict2',
          descKey: 'achievementAutoMergeAddict2Desc',
          rewardKey: 'achievementRewardAutoMergeAddict2',
          target: 10000,
          progressType: 'autoMergeActivations',
          rewardMode: 'autoMergeAddict2Upgrade1Chips5',
        },
        {
          id: 'auto_merge_addict_3',
          familyId: 'auto_merge_addict',
          titleKey: 'achievementAutoMergeAddict3',
          descKey: 'achievementAutoMergeAddict3Desc',
          rewardKey: 'achievementRewardAutoMergeAddict3',
          target: 20000,
          progressType: 'autoMergeActivations',
          rewardMode: 'autoMergeAddict3Damage100000Drones3L3',
        },
        {
          id: 'auto_merge_addict_4',
          familyId: 'auto_merge_addict',
          titleKey: 'achievementAutoMergeAddict4',
          descKey: 'achievementAutoMergeAddict4Desc',
          rewardKey: 'achievementRewardAutoMergeAddict4',
          target: 50000,
          progressType: 'autoMergeActivations',
          rewardMode: 'autoMergeAddict4Upgrade3Chips15',
        },
        {
          id: 'auto_merge_addict_5',
          familyId: 'auto_merge_addict',
          titleKey: 'achievementAutoMergeAddict5',
          descKey: 'achievementAutoMergeAddict5Desc',
          rewardKey: 'achievementRewardAutoMergeAddict5',
          target: 100000,
          progressType: 'autoMergeActivations',
          rewardMode: 'autoMergeAddict5Drones6L6Damage1M',
        },
      ],
    },
    {
      id: 'conveyor_master',
      definitions: [
        {
          id: 'conveyor_master_1',
          familyId: 'conveyor_master',
          titleKey: 'achievementConveyorMaster1',
          descKey: 'achievementConveyorMaster1Desc',
          rewardKey: 'achievementRewardConveyorMaster1',
          target: 10000,
          progressType: 'purchases',
          rewardMode: 'conveyorMaster1Dust75',
        },
        {
          id: 'conveyor_master_2',
          familyId: 'conveyor_master',
          titleKey: 'achievementConveyorMaster2',
          descKey: 'achievementConveyorMaster2Desc',
          rewardKey: 'achievementRewardConveyorMaster2',
          target: 25000,
          progressType: 'purchases',
          rewardMode: 'conveyorMaster2Fragments25Chips5',
        },
        {
          id: 'conveyor_master_3',
          familyId: 'conveyor_master',
          titleKey: 'achievementConveyorMaster3',
          descKey: 'achievementConveyorMaster3Desc',
          rewardKey: 'achievementRewardConveyorMaster3',
          target: 50000,
          progressType: 'purchases',
          rewardMode: 'conveyorMaster3Drones5L4',
        },
        {
          id: 'conveyor_master_4',
          familyId: 'conveyor_master',
          titleKey: 'achievementConveyorMaster4',
          descKey: 'achievementConveyorMaster4Desc',
          rewardKey: 'achievementRewardConveyorMaster4',
          target: 100000,
          progressType: 'purchases',
          rewardMode: 'conveyorMaster4Upgrade5Dust150',
        },
        {
          id: 'conveyor_master_5',
          familyId: 'conveyor_master',
          titleKey: 'achievementConveyorMaster5',
          descKey: 'achievementConveyorMaster5Desc',
          rewardKey: 'achievementRewardConveyorMaster5',
          target: 250000,
          progressType: 'purchases',
          rewardMode: 'conveyorMaster5Damage10MDrones2L8',
        },
      ],
    },
    {
      id: 'storage_worker',
      definitions: [
        {
          id: 'storage_worker_1',
          familyId: 'storage_worker',
          titleKey: 'achievementStorageWorker1',
          descKey: 'achievementStorageWorker1Desc',
          rewardKey: 'achievementRewardStorageWorker1',
          target: 9,
          progressLevel: 0,
          progressType: 'productionStorageSnapshot',
          rewardMode: 'storageWorker1Chips3Drone1L3',
        },
        {
          id: 'storage_worker_2',
          familyId: 'storage_worker',
          titleKey: 'achievementStorageWorker2',
          descKey: 'achievementStorageWorker2Desc',
          rewardKey: 'achievementRewardStorageWorker2',
          target: 6,
          progressLevel: 2,
          progressType: 'productionStorageSnapshot',
          rewardMode: 'storageWorker2Chips5Drone2L4',
        },
        {
          id: 'storage_worker_3',
          familyId: 'storage_worker',
          titleKey: 'achievementStorageWorker3',
          descKey: 'achievementStorageWorker3Desc',
          rewardKey: 'achievementRewardStorageWorker3',
          target: 3,
          progressLevel: 4,
          progressType: 'productionStorageSnapshot',
          rewardMode: 'storageWorker3Upgrade5Chips10',
        },
      ],
    },
    {
      id: 'wave_survivor',
      definitions: [
        {
          id: 'wave_survivor_1',
          familyId: 'wave_survivor',
          titleKey: 'achievementWaveSurvivor1',
          descKey: 'achievementWaveSurvivor1Desc',
          rewardKey: 'achievementRewardWaveSurvivor1',
          target: 10,
          progressType: 'attackWavesCompleted',
          rewardMode: 'waveSurvivor1Coins2000',
        },
        {
          id: 'wave_survivor_2',
          familyId: 'wave_survivor',
          titleKey: 'achievementWaveSurvivor2',
          descKey: 'achievementWaveSurvivor2Desc',
          rewardKey: 'achievementRewardWaveSurvivor2',
          target: 50,
          progressType: 'attackWavesCompleted',
          rewardMode: 'waveSurvivor2RandomChips2',
        },
        {
          id: 'wave_survivor_3',
          familyId: 'wave_survivor',
          titleKey: 'achievementWaveSurvivor3',
          descKey: 'achievementWaveSurvivor3Desc',
          rewardKey: 'achievementRewardWaveSurvivor3',
          target: 200,
          progressType: 'attackWavesCompleted',
          rewardMode: 'waveSurvivor3UpgradePoints3',
        },
        {
          id: 'wave_survivor_4',
          familyId: 'wave_survivor',
          titleKey: 'achievementWaveSurvivor4',
          descKey: 'achievementWaveSurvivor4Desc',
          rewardKey: 'achievementRewardWaveSurvivor4',
          target: 1000,
          progressType: 'attackWavesCompleted',
          rewardMode: 'waveSurvivor4Drone1L5Chips5',
        },
        {
          id: 'wave_survivor_5',
          familyId: 'wave_survivor',
          titleKey: 'achievementWaveSurvivor5',
          descKey: 'achievementWaveSurvivor5Desc',
          rewardKey: 'achievementRewardWaveSurvivor5',
          target: 5000,
          progressType: 'attackWavesCompleted',
          rewardMode: 'waveSurvivor5Upgrade10Damage1M',
        },
      ],
    },
    {
      id: 'big_spender',
      definitions: [
        {
          id: 'big_spender_1',
          familyId: 'big_spender',
          titleKey: 'achievementBigSpender1',
          descKey: 'achievementBigSpender1Desc',
          rewardKey: 'achievementRewardBigSpender1',
          target: 1000000,
          progressType: 'coinsSpentTotal',
          rewardMode: 'bigSpender1Damage10000',
        },
        {
          id: 'big_spender_2',
          familyId: 'big_spender',
          titleKey: 'achievementBigSpender2',
          descKey: 'achievementBigSpender2Desc',
          rewardKey: 'achievementRewardBigSpender2',
          target: 100000000000,
          progressType: 'coinsSpentTotal',
          rewardMode: 'bigSpender2Chips2Upgrade2',
        },
        {
          id: 'big_spender_3',
          familyId: 'big_spender',
          titleKey: 'achievementBigSpender3',
          descKey: 'achievementBigSpender3Desc',
          rewardKey: 'achievementRewardBigSpender3',
          target: 100000000000000,
          progressType: 'coinsSpentTotal',
          rewardMode: 'bigSpender3Upgrade5Chips5',
        },
      ],
    },
    /* solo-pipeline-yandex-vk batch#1 — dust_master family.
       ADR (lifetime invariants):
         * `state.stats.dustEarnedLifetime` is a monotonic counter of
           positive silicon-dust deltas. Only the canonical inflow seam
           `HangarChipsUI.creditSiliconDust(amount, source)` updates it.
           Snapshot restoration (`achievementRewards.applyDustSnapshot`)
           and direct `setSiliconDust(...)` writes must NOT touch it,
           otherwise atomic rollback would re-credit lifetime.
         * The counter survives partial reset (workshop reset / shop
           rebalance) and full reset alike — it lives under both
           `state.stats.dustEarnedLifetime` and the legacy mirror
           `state.achievements.dustEarnedLifetime`, reconciled via
           `Math.max` in `ensureStats`.
         * dust_master_3 reward is intentionally identical to the
           future fragment_collector_3 reward (3 upgrade points + 3
           drones level 7) — by design, not a bug. */
    {
      id: 'dust_master',
      definitions: [
        {
          id: 'dust_master_1',
          familyId: 'dust_master',
          titleKey: 'achievementDustMaster1',
          descKey: 'achievementDustMaster1Desc',
          rewardKey: 'achievementRewardDustMaster1',
          target: 500,
          progressType: 'dustEarnedLifetime',
          rewardMode: 'dustMaster1RandomFragments10',
        },
        {
          id: 'dust_master_2',
          familyId: 'dust_master',
          titleKey: 'achievementDustMaster2',
          descKey: 'achievementDustMaster2Desc',
          rewardKey: 'achievementRewardDustMaster2',
          target: 2500,
          progressType: 'dustEarnedLifetime',
          rewardMode: 'dustMaster2RandomChips10',
        },
        {
          id: 'dust_master_3',
          familyId: 'dust_master',
          titleKey: 'achievementDustMaster3',
          descKey: 'achievementDustMaster3Desc',
          rewardKey: 'achievementRewardDustMaster3',
          target: 10000,
          progressType: 'dustEarnedLifetime',
          rewardMode: 'dustMaster3UpgradePoints3DronesL7x3',
        },
      ],
    },
    /* solo-pipeline-yandex-vk batch#2 — fragment_collector family.
     * ADR:
     * - Lifetime monotonic counter `state.stats.fragmentsAcquired` is
     *   bumped exclusively via the canonical inflow seam
     *   `Game.HangarChipsUI.addPlayerFragment(fragmentId, count)` →
     *   `_bumpFragmentsAcquired` → `_triggerAchievementSweep()`. No
     *   other entry points must mutate the counter.
     * - Counter survives partial reset (workshop reset / shop rebalance)
     *   and full reset alike — lives under both
     *   `state.stats.fragmentsAcquired` and the legacy mirror
     *   `state.achievements.fragmentsAcquired`, reconciled via
     *   `Math.max` in `ensureStats`.
     * - fragment_collector_3 reward is intentionally identical to
     *   dust_master_3 (3 upgrade points + 3 drones level 7) — by
     *   design, not a bug. */
    {
      id: 'fragment_collector',
      definitions: [
        {
          id: 'fragment_collector_1',
          familyId: 'fragment_collector',
          titleKey: 'achievementFragmentCollector1',
          descKey: 'achievementFragmentCollector1Desc',
          rewardKey: 'achievementRewardFragmentCollector1',
          target: 50,
          progressType: 'fragmentsAcquired',
          rewardMode: 'fragmentCollector1Dust50',
        },
        {
          id: 'fragment_collector_2',
          familyId: 'fragment_collector',
          titleKey: 'achievementFragmentCollector2',
          descKey: 'achievementFragmentCollector2Desc',
          rewardKey: 'achievementRewardFragmentCollector2',
          target: 250,
          progressType: 'fragmentsAcquired',
          rewardMode: 'fragmentCollector2Dust500',
        },
        {
          id: 'fragment_collector_3',
          familyId: 'fragment_collector',
          titleKey: 'achievementFragmentCollector3',
          descKey: 'achievementFragmentCollector3Desc',
          rewardKey: 'achievementRewardFragmentCollector3',
          target: 1000,
          progressType: 'fragmentsAcquired',
          rewardMode: 'fragmentCollector3UpgradePoints3DronesL7x3',
        },
      ],
    },
  ];

  var ACHIEVEMENTS = flattenAchievementFamilies(ACHIEVEMENT_FAMILIES);

  function flattenAchievementFamilies(families) {
    var definitions = [];
    if (!Array.isArray(families)) return definitions;
    for (var familyIndex = 0; familyIndex < families.length; familyIndex++) {
      var family = families[familyIndex];
      var familyDefinitions = family && Array.isArray(family.definitions)
        ? family.definitions
        : null;
      if (!familyDefinitions) continue;
      for (var definitionIndex = 0; definitionIndex < familyDefinitions.length; definitionIndex++) {
        definitions.push(familyDefinitions[definitionIndex]);
      }
    }
    return definitions;
  }

  var SELF_MANAGED_REWARD_MODES = {
    newTechnologyFragments2: true,
    newTechnologyDust20: true,
    newTechnologyRandomChips2: true,
    newTechnologyUpgradePoints3: true,
  };

  // Локальная fallback-таблица self-managed reward modes. Используется когда
  // global.Game.AchievementRewards.REWARD_TABLE недоступна (например, в pack4
  // unit-тестах TUT-8Q, где external module не подгружается). Канонический источник
  // — src/mechanics/achievementRewards.js; обе записи обязаны идти в синхроне.
  var LOCAL_SELF_MANAGED_REWARD_TABLE = {
    newTechnologyFragments2:     { type: 'fragments',     amount: 2 },
    newTechnologyDust20:         { type: 'dust',          amount: 20 },
    newTechnologyRandomChips2:   { type: 'randomChips',   amount: 2 },
    newTechnologyUpgradePoints3: { type: 'upgradePoints', amount: 3 },
  };

  function normalizeCounter(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)));
  }

  function normalizeModifierTechMap(value) {
    var normalized = {};
    if (!value || typeof value !== 'object') return normalized;
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      if (!value[keys[i]]) continue;
      var techId = normalizeCounter(Number(keys[i]));
      if (techId <= 0) continue;
      normalized[String(techId)] = true;
    }
    return normalized;
  }

  function countCompletedModifierTechs(map) {
    if (!map || typeof map !== 'object') return 0;
    var total = 0;
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      if (!map[keys[i]]) continue;
      total += 1;
    }
    return normalizeCounter(total);
  }

  function inferModifierTechUnlocksFromRuntime() {
    var hangarChips = global.Game && global.Game.HangarChips;
    var unlocked = hangarChips && typeof hangarChips.getUnlockedTechs === 'function'
      ? hangarChips.getUnlockedTechs()
      : null;
    var normalized = normalizeModifierTechMap(unlocked);
    return {
      map: normalized,
      count: countCompletedModifierTechs(normalized),
    };
  }

  function inferPurchasedFromBuyCounts(state) {
    var inferred = 0;
    if (!state || !state.buyCounts || typeof state.buyCounts !== 'object') return 0;
    var keys = Object.keys(state.buyCounts);
    for (var i = 0; i < keys.length; i++) {
      var count = Number(state.buyCounts[keys[i]]);
      if (Number.isFinite(count) && count > 0) inferred += Math.floor(count);
    }
    return normalizeCounter(inferred);
  }

  function countInstalledChipsInHangarCell(cell) {
    if (!cell || typeof cell !== 'object') return 0;
    if (Array.isArray(cell.activeModifiers)) {
      return normalizeCounter(cell.activeModifiers.length);
    }
    var total = 0;
    var red = cell.redSlots;
    var yellow = cell.yellowSlots;
    if (red && typeof red === 'object') {
      if (red.slot1) total += 1;
      if (red.slot2) total += 1;
    }
    if (yellow && typeof yellow === 'object') {
      if (yellow.slot1) total += 1;
      if (yellow.slot2) total += 1;
      if (yellow.slot3) total += 1;
      if (yellow.slot4) total += 1;
    }
    return normalizeCounter(total);
  }

  function computeHangarCellChipTierFromState(state) {
    var hangarCells = null;
    var hui = global.Game && global.Game.HangarChipsUI;
    if (hui && typeof hui.getCells === 'function') {
      var uiCells = hui.getCells();
      if (Array.isArray(uiCells)) hangarCells = uiCells;
    }
    if (!hangarCells && state && Array.isArray(state.hangarCells)) {
      hangarCells = state.hangarCells;
    }
    if (!hangarCells || hangarCells.length < 15) return 0;
    var maxCells = Math.min(hangarCells.length, 15);
    var minInstalled = Number.MAX_SAFE_INTEGER;
    for (var i = 0; i < maxCells; i++) {
      var installed = countInstalledChipsInHangarCell(hangarCells[i]);
      if (installed < minInstalled) minInstalled = installed;
    }
    if (minInstalled === Number.MAX_SAFE_INTEGER) return 0;
    return Math.max(0, Math.min(3, Math.floor(minInstalled)));
  }

  function computeDroneMaxLevelFromState(state) {
    var maxLevel = 0;
    var drones = state && Array.isArray(state.drones) ? state.drones : null;
    if (drones) {
      for (var i = 0; i < drones.length; i++) {
        var drone = drones[i];
        if (!drone) continue;
        var level = normalizeCounter(drone.level);
        if (level > maxLevel) maxLevel = level;
      }
    }
    var undergroundCells = state && state.undergroundHangar && Array.isArray(state.undergroundHangar.cells)
      ? state.undergroundHangar.cells
      : null;
    if (undergroundCells) {
      for (var ci = 0; ci < undergroundCells.length; ci++) {
        var cell = undergroundCells[ci];
        var cellDrone = cell && cell.drone ? cell.drone : null;
        if (!cellDrone) continue;
        var cellLevel = normalizeCounter(cellDrone.level);
        if (cellLevel > maxLevel) maxLevel = cellLevel;
      }
    }
    return normalizeCounter(maxLevel);
  }

  function isSelfManagedRewardMode(rewardMode) {
    return !!SELF_MANAGED_REWARD_MODES[rewardMode];
  }

  function getHangarChipsUi() {
    return global.Game && global.Game.HangarChipsUI ? global.Game.HangarChipsUI : null;
  }

  function getRandomAchievementChipDef() {
    var hangarChips = global.Game && global.Game.HangarChips;
    var pool = hangarChips && Array.isArray(hangarChips.allChips) ? hangarChips.allChips : null;
    if (!pool || pool.length <= 0) return null;
    return pool[Math.floor(Math.random() * pool.length)] || null;
  }

  function grantAchievementFragments(count) {
    var chipsUi = getHangarChipsUi();
    var total = normalizeCounter(count);
    if (!chipsUi || typeof chipsUi.addPlayerFragment !== 'function' || total <= 0) return false;
    for (var i = 0; i < total; i++) {
      chipsUi.addPlayerFragment(Math.floor(Math.random() * 14) + 1, 1);
    }
    return true;
  }

  function grantAchievementSiliconDust(amount) {
    var chipsUi = getHangarChipsUi();
    var total = normalizeCounter(amount);
    if (!chipsUi || typeof chipsUi.getSiliconDust !== 'function' || typeof chipsUi.setSiliconDust !== 'function' || total <= 0) {
      return false;
    }
    var currentDust = normalizeCounter(chipsUi.getSiliconDust());
    chipsUi.setSiliconDust(currentDust + total);
    return true;
  }

  function grantAchievementRandomChips(count) {
    var chipsUi = getHangarChipsUi();
    var total = normalizeCounter(count);
    if (!chipsUi || typeof chipsUi.addPlayerChip !== 'function' || total <= 0) return false;
    for (var i = 0; i < total; i++) {
      var chipDef = getRandomAchievementChipDef();
      if (!chipDef) return false;
      chipsUi.addPlayerChip(chipDef, 1);
    }
    return true;
  }

  function grantAchievementUpgradePoints(state, count) {
    var total = normalizeCounter(count);
    if (!state || total <= 0) return false;
    if (!state.player || typeof state.player !== 'object') state.player = {};
    if (!state.player.talentsV2 || typeof state.player.talentsV2 !== 'object') {
      state.player.talentsV2 = { ranksById: {}, freePoints: 0 };
    }
    state.player.talentsV2.freePoints = normalizeCounter(state.player.talentsV2.freePoints + total);
    state.player.freeTalentPointsV2 = state.player.talentsV2.freePoints;
    var tv2 = global.Game && global.Game.TalentsV2;
    if (tv2 && typeof tv2.setFreePoints === 'function') {
      tv2.setFreePoints(state.player.talentsV2.freePoints);
    }
    return true;
  }

  function grantSelfManagedReward(state, achievementId, def, ach) {
    var achievementState = ach || ensureState(state);
    if (!achievementState || !def || !isSelfManagedRewardMode(def.rewardMode)) return false;
    if (achievementState.rewarded[achievementId]) return false;

    var table = (global.Game && global.Game.AchievementRewards && global.Game.AchievementRewards.REWARD_TABLE) || {};
    var entry = table[def.rewardMode] || LOCAL_SELF_MANAGED_REWARD_TABLE[def.rewardMode];
    if (!entry) return false;

    var granted = false;
    if (entry.type === 'fragments')      granted = grantAchievementFragments(entry.amount);
    else if (entry.type === 'dust')      granted = grantAchievementSiliconDust(entry.amount);
    else if (entry.type === 'randomChips') granted = grantAchievementRandomChips(entry.amount);
    else if (entry.type === 'upgradePoints') granted = grantAchievementUpgradePoints(state, entry.amount);

    if (!granted) return false;
    achievementState.rewarded[achievementId] = true;
    return true;
  }

  function reconcileSelfManagedRewards(state, ach) {
    var achievementState = ach || ensureState(state);
    if (!achievementState) return false;
    var changed = false;
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var def = ACHIEVEMENTS[i];
      if (!achievementState.unlocked[def.id]) continue;
      if (!isSelfManagedRewardMode(def.rewardMode)) continue;
      if (grantSelfManagedReward(state, def.id, def, achievementState)) changed = true;
    }
    return changed;
  }

  function ensureStats(state, ach, options) {
    var opts = options || {};
    var hasStats = !!(state && state.stats && typeof state.stats === 'object');
    if (!hasStats) state.stats = {};

    var stats = state.stats;
    var hasMerged = Number.isFinite(stats.tanksMergedCount);
    var hasBought = Number.isFinite(stats.tanksBoughtCount);
    var hasManualFenceRepairs = Number.isFinite(stats.manualFenceRepairsCount);
    var hasModifierTechUnlocks = Number.isFinite(stats.modifierTechUnlocksCount);
    var hasDroneAcquisitions = Number.isFinite(stats.droneAcquisitionsCount);
    var hasNoRepairAttackWaveStreak = Number.isFinite(stats.noRepairAttackWaveStreakCount);
    var hasAttackWavesCompleted = Number.isFinite(stats.attackWavesCompletedCount);
    var hasAutoMergeActivations = Number.isFinite(stats.autoMergeActivationsCount);
    var hasCoinsSpentTotal = Number.isFinite(stats.coinsSpentTotal);
    var hasMoneyEarned = Number.isFinite(stats.moneyEarnedCount);
    var hasPerfectFenceWaves = Number.isFinite(stats.perfectFenceWavesCount);
    var hasHangarMasterLevel = Number.isFinite(stats.hangarMasterLevelCount);
    var hasDefenseOrderStreak = Number.isFinite(stats.defenseOrderStreakCount);
    var hasMaxTankLevel = Number.isFinite(stats.maxTankLevelCount);
    var hasChipComboTriples = Number.isFinite(stats.chipComboTriplesCount);
    var hasChipCraftFromFragments = Number.isFinite(stats.chipCraftFromFragmentsCount);
    /* solo-pipeline-yandex-vk batch#1 — lifetime counters for
       dust_master + fragment_collector families. See ADR above
       ACHIEVEMENT_FAMILIES.dust_master block. */
    var hasDustEarnedLifetime = Number.isFinite(stats.dustEarnedLifetime);
    var hasFragmentsAcquired = Number.isFinite(stats.fragmentsAcquired);

    var legacyMerges = normalizeCounter(ach.totalMerges);
    var legacyPurchased = normalizeCounter(ach.totalPurchased);
    var legacyManualFenceRepairs = normalizeCounter(ach.totalManualFenceRepairs);
    var legacyModifierTechUnlocks = normalizeCounter(ach.totalModifierTechUnlocks);
    var legacyDroneAcquisitions = normalizeCounter(ach.totalDroneAcquisitions);
    var legacyNoRepairAttackWaveStreak = normalizeCounter(ach.totalNoRepairAttackWaveStreak);
    var legacyAttackWavesCompleted = normalizeCounter(ach.totalAttackWavesCompleted);
    var legacyAutoMergeActivations = normalizeCounter(ach.totalAutoMergeActivations);
    var legacyCoinsSpentTotal = normalizeCounter(ach.totalCoinsSpent);
    var legacyMoneyEarned = normalizeCounter(ach.totalMoneyEarned);
    var legacyPerfectFenceWaves = normalizeCounter(ach.totalPerfectFenceWaves);
    var legacyHangarMasterLevel = normalizeCounter(ach.totalHangarMasterLevel);
    var legacyDefenseOrderStreak = normalizeCounter(ach.totalDefenseOrderStreak);
    var legacyMaxTankLevel = normalizeCounter(ach.totalMaxTankLevel);
    var legacyChipComboTriples = normalizeCounter(ach.totalChipComboTriples);
    var legacyChipCraftFromFragments = normalizeCounter(ach.totalChipCraftFromFragments);
    var legacyDustEarnedLifetime = normalizeCounter(ach.dustEarnedLifetime);
    var legacyFragmentsAcquired = normalizeCounter(ach.fragmentsAcquired);

    if (!hasMerged) stats.tanksMergedCount = legacyMerges;
    else stats.tanksMergedCount = normalizeCounter(stats.tanksMergedCount);

    if (!hasBought) stats.tanksBoughtCount = legacyPurchased;
    else stats.tanksBoughtCount = normalizeCounter(stats.tanksBoughtCount);

    if (!hasManualFenceRepairs) stats.manualFenceRepairsCount = legacyManualFenceRepairs;
    else stats.manualFenceRepairsCount = normalizeCounter(stats.manualFenceRepairsCount);

    if (!hasModifierTechUnlocks) stats.modifierTechUnlocksCount = legacyModifierTechUnlocks;
    else stats.modifierTechUnlocksCount = normalizeCounter(stats.modifierTechUnlocksCount);

    if (!hasDroneAcquisitions) stats.droneAcquisitionsCount = legacyDroneAcquisitions;
    else stats.droneAcquisitionsCount = normalizeCounter(stats.droneAcquisitionsCount);

    if (!hasNoRepairAttackWaveStreak) stats.noRepairAttackWaveStreakCount = legacyNoRepairAttackWaveStreak;
    else stats.noRepairAttackWaveStreakCount = normalizeCounter(stats.noRepairAttackWaveStreakCount);

    if (!hasAttackWavesCompleted) stats.attackWavesCompletedCount = legacyAttackWavesCompleted;
    else stats.attackWavesCompletedCount = normalizeCounter(stats.attackWavesCompletedCount);

    if (!hasAutoMergeActivations) stats.autoMergeActivationsCount = legacyAutoMergeActivations;
    else stats.autoMergeActivationsCount = normalizeCounter(stats.autoMergeActivationsCount);

    if (!hasCoinsSpentTotal) stats.coinsSpentTotal = legacyCoinsSpentTotal;
    else stats.coinsSpentTotal = normalizeCounter(stats.coinsSpentTotal);
    if (!stats.coinsSpentBySource || typeof stats.coinsSpentBySource !== 'object') stats.coinsSpentBySource = {};

    if (!hasMoneyEarned) stats.moneyEarnedCount = legacyMoneyEarned;
    else stats.moneyEarnedCount = normalizeCounter(stats.moneyEarnedCount);

    if (!hasPerfectFenceWaves) stats.perfectFenceWavesCount = legacyPerfectFenceWaves;
    else stats.perfectFenceWavesCount = normalizeCounter(stats.perfectFenceWavesCount);

    if (!hasHangarMasterLevel) stats.hangarMasterLevelCount = legacyHangarMasterLevel;
    else stats.hangarMasterLevelCount = normalizeCounter(stats.hangarMasterLevelCount);

    if (!hasDefenseOrderStreak) stats.defenseOrderStreakCount = legacyDefenseOrderStreak;
    else stats.defenseOrderStreakCount = normalizeCounter(stats.defenseOrderStreakCount);

    if (!hasMaxTankLevel) stats.maxTankLevelCount = legacyMaxTankLevel;
    else stats.maxTankLevelCount = normalizeCounter(stats.maxTankLevelCount);

    if (!hasChipComboTriples) stats.chipComboTriplesCount = legacyChipComboTriples;
    else stats.chipComboTriplesCount = normalizeCounter(stats.chipComboTriplesCount);

    if (!hasChipCraftFromFragments) stats.chipCraftFromFragmentsCount = legacyChipCraftFromFragments;
    else stats.chipCraftFromFragmentsCount = Math.max(normalizeCounter(stats.chipCraftFromFragmentsCount), legacyChipCraftFromFragments);

    /* Lifetime counters survive partial + full reset, reconcile via
       Math.max so a stale legacy mirror cannot demote the canonical
       stats counter. */
    if (!hasDustEarnedLifetime) stats.dustEarnedLifetime = legacyDustEarnedLifetime;
    else stats.dustEarnedLifetime = Math.max(normalizeCounter(stats.dustEarnedLifetime), legacyDustEarnedLifetime);

    if (!hasFragmentsAcquired) stats.fragmentsAcquired = legacyFragmentsAcquired;
    else stats.fragmentsAcquired = Math.max(normalizeCounter(stats.fragmentsAcquired), legacyFragmentsAcquired);

    if (hasMerged && opts.hadLegacyMerges && stats.tanksMergedCount !== legacyMerges) {
      stats.tanksMergedCount = legacyMerges;
    }
    if (hasBought && opts.hadLegacyPurchased && stats.tanksBoughtCount !== legacyPurchased) {
      stats.tanksBoughtCount = legacyPurchased;
    }

    ach.totalMerges = stats.tanksMergedCount;
    ach.totalPurchased = stats.tanksBoughtCount;
    ach.totalManualFenceRepairs = stats.manualFenceRepairsCount;
    ach.totalModifierTechUnlocks = stats.modifierTechUnlocksCount;
    ach.totalDroneAcquisitions = stats.droneAcquisitionsCount;
    ach.totalNoRepairAttackWaveStreak = stats.noRepairAttackWaveStreakCount;
    ach.totalAttackWavesCompleted = stats.attackWavesCompletedCount;
    ach.totalAutoMergeActivations = stats.autoMergeActivationsCount;
    ach.totalMoneyEarned = stats.moneyEarnedCount;
    ach.totalPerfectFenceWaves = stats.perfectFenceWavesCount;
    ach.totalHangarMasterLevel = stats.hangarMasterLevelCount;
    ach.totalDefenseOrderStreak = stats.defenseOrderStreakCount;
    ach.totalMaxTankLevel = stats.maxTankLevelCount;
    ach.totalChipComboTriples = stats.chipComboTriplesCount;
    ach.totalChipCraftFromFragments = stats.chipCraftFromFragmentsCount;
    ach.dustEarnedLifetime = stats.dustEarnedLifetime;
    ach.fragmentsAcquired = stats.fragmentsAcquired;
    return stats;
  }

  function ensureState(state) {
    if (!state) return null;
    if (!state.achievements || typeof state.achievements !== 'object') {
      state.achievements = {};
    }
    if (!state.achievements.unlocked || typeof state.achievements.unlocked !== 'object') {
      state.achievements.unlocked = {};
    }
    if (!Array.isArray(state.achievements.popupQueue)) {
      state.achievements.popupQueue = [];
    }
    if (!state.achievements.rewarded || typeof state.achievements.rewarded !== 'object') {
      state.achievements.rewarded = {};
    }
    if (!Array.isArray(state.achievements.rewardHistory)) {
      state.achievements.rewardHistory = [];
    }
    state.achievements.completedModifierTechs = normalizeModifierTechMap(state.achievements.completedModifierTechs);

    var hadLegacyPurchased = Number.isFinite(state.achievements.totalPurchased);
    var hadLegacyMerges = Number.isFinite(state.achievements.totalMerges);
    var inferredModifierTechUnlocks = inferModifierTechUnlocksFromRuntime();
    var completedModifierTechCount = countCompletedModifierTechs(state.achievements.completedModifierTechs);

    /* Merge inference into completedModifierTechs so runtime-only unlocks
       (e.g. techs unlocked before achievement tracking) are never missed. */
    if (inferredModifierTechUnlocks.count > 0) {
      var inferKeys = Object.keys(inferredModifierTechUnlocks.map);
      for (var ik = 0; ik < inferKeys.length; ik++) {
        if (!state.achievements.completedModifierTechs[inferKeys[ik]]) {
          state.achievements.completedModifierTechs[inferKeys[ik]] = true;
        }
      }
      completedModifierTechCount = countCompletedModifierTechs(state.achievements.completedModifierTechs);
    }

    if (!Number.isFinite(state.achievements.totalPurchased)) {
      state.achievements.totalPurchased = inferPurchasedFromBuyCounts(state);
    } else {
      state.achievements.totalPurchased = normalizeCounter(state.achievements.totalPurchased);
    }

    if (!Number.isFinite(state.achievements.totalMerges)) {
      state.achievements.totalMerges = 0;
    } else {
      state.achievements.totalMerges = normalizeCounter(state.achievements.totalMerges);
    }

    if (!Number.isFinite(state.achievements.totalManualFenceRepairs)) {
      state.achievements.totalManualFenceRepairs = 0;
    } else {
      state.achievements.totalManualFenceRepairs = normalizeCounter(state.achievements.totalManualFenceRepairs);
    }

    if (!Number.isFinite(state.achievements.totalModifierTechUnlocks)) {
      state.achievements.totalModifierTechUnlocks = completedModifierTechCount > 0
        ? completedModifierTechCount
        : inferredModifierTechUnlocks.count;
    } else {
      state.achievements.totalModifierTechUnlocks = normalizeCounter(state.achievements.totalModifierTechUnlocks);
    }

    if (!Number.isFinite(state.achievements.totalDroneAcquisitions)) {
      state.achievements.totalDroneAcquisitions = 0;
    } else {
      state.achievements.totalDroneAcquisitions = normalizeCounter(state.achievements.totalDroneAcquisitions);
    }

    if (!Number.isFinite(state.achievements.totalNoRepairAttackWaveStreak)) {
      state.achievements.totalNoRepairAttackWaveStreak = 0;
    } else {
      state.achievements.totalNoRepairAttackWaveStreak = normalizeCounter(state.achievements.totalNoRepairAttackWaveStreak);
    }

    if (!Number.isFinite(state.achievements.totalAttackWavesCompleted)) {
      state.achievements.totalAttackWavesCompleted = 0;
    } else {
      state.achievements.totalAttackWavesCompleted = normalizeCounter(state.achievements.totalAttackWavesCompleted);
    }

    if (!Number.isFinite(state.achievements.totalAutoMergeActivations)) {
      state.achievements.totalAutoMergeActivations = 0;
    } else {
      state.achievements.totalAutoMergeActivations = normalizeCounter(state.achievements.totalAutoMergeActivations);
    }

    if (!Number.isFinite(state.achievements.totalMoneyEarned)) {
      state.achievements.totalMoneyEarned = 0;
    } else {
      state.achievements.totalMoneyEarned = normalizeCounter(state.achievements.totalMoneyEarned);
    }

    if (!Number.isFinite(state.achievements.totalPerfectFenceWaves)) {
      state.achievements.totalPerfectFenceWaves = 0;
    } else {
      state.achievements.totalPerfectFenceWaves = normalizeCounter(state.achievements.totalPerfectFenceWaves);
    }

    if (!Number.isFinite(state.achievements.totalHangarMasterLevel)) {
      state.achievements.totalHangarMasterLevel = 0;
    } else {
      state.achievements.totalHangarMasterLevel = normalizeCounter(state.achievements.totalHangarMasterLevel);
    }

    if (!Number.isFinite(state.achievements.totalDefenseOrderStreak)) {
      state.achievements.totalDefenseOrderStreak = 0;
    } else {
      state.achievements.totalDefenseOrderStreak = normalizeCounter(state.achievements.totalDefenseOrderStreak);
    }

    if (!Number.isFinite(state.achievements.totalMaxTankLevel)) {
      state.achievements.totalMaxTankLevel = normalizeCounter(
        state.maxTankLevelAchieved || (state.runtimeMaxTankLevelAchieved || 0)
      );
    } else {
      state.achievements.totalMaxTankLevel = normalizeCounter(state.achievements.totalMaxTankLevel);
    }

    if (!Number.isFinite(state.achievements.totalChipComboTriples)) {
      state.achievements.totalChipComboTriples = 0;
    } else {
      state.achievements.totalChipComboTriples = normalizeCounter(state.achievements.totalChipComboTriples);
    }

    if (!Number.isFinite(state.achievements.totalChipCraftFromFragments)) {
      state.achievements.totalChipCraftFromFragments = 0;
    } else {
      state.achievements.totalChipCraftFromFragments = normalizeCounter(state.achievements.totalChipCraftFromFragments);
    }

    if (!Number.isFinite(state.achievements.totalDroneMaxLevel)) {
      state.achievements.totalDroneMaxLevel = computeDroneMaxLevelFromState(state);
    } else {
      state.achievements.totalDroneMaxLevel = normalizeCounter(state.achievements.totalDroneMaxLevel);
    }

    if (!Number.isFinite(state.achievements.totalHangarCellChipTier)) {
      state.achievements.totalHangarCellChipTier = computeHangarCellChipTierFromState(state);
    } else {
      state.achievements.totalHangarCellChipTier = normalizeCounter(state.achievements.totalHangarCellChipTier);
    }

    if (!Number.isFinite(state.achievements.reservePowerPeakCycle)) {
      state.achievements.reservePowerPeakCycle = 0;
    } else {
      state.achievements.reservePowerPeakCycle = normalizeCounter(state.achievements.reservePowerPeakCycle);
    }

    if (!Array.isArray(state.achievements.deferredRewards)) {
      state.achievements.deferredRewards = [];
    }

    if (!state.achievements.counters || typeof state.achievements.counters !== 'object') {
      state.achievements.counters = {};
    }
    if (!state.achievements.counters.productionStorageSnapshot || typeof state.achievements.counters.productionStorageSnapshot !== 'object') {
      state.achievements.counters.productionStorageSnapshot = { total: 0, level2: 0, level4: 0 };
    } else {
      var psSnap = state.achievements.counters.productionStorageSnapshot;
      psSnap.total = normalizeCounter(psSnap.total);
      psSnap.level2 = normalizeCounter(psSnap.level2);
      psSnap.level4 = normalizeCounter(psSnap.level4);
    }

    if (completedModifierTechCount > state.achievements.totalModifierTechUnlocks) {
      state.achievements.totalModifierTechUnlocks = completedModifierTechCount;
      if (state.stats && typeof state.stats === 'object') {
        state.stats.modifierTechUnlocksCount = completedModifierTechCount;
      }
    }

    ensureStats(state, state.achievements, {
      hadLegacyPurchased: hadLegacyPurchased,
      hadLegacyMerges: hadLegacyMerges,
    });
    reconcileSelfManagedRewards(state, state.achievements);
    return state.achievements;
  }

  function setNoRepairAttackWaveStreak(state, ach, value) {
    var achievementState = ach || ensureState(state);
    if (!achievementState) return 0;
    var nextValue = normalizeCounter(value);
    if (state && state.stats && typeof state.stats === 'object') {
      state.stats.noRepairAttackWaveStreakCount = nextValue;
    }
    achievementState.totalNoRepairAttackWaveStreak = nextValue;
    return nextValue;
  }

  function setDefenseOrderStreak(state, ach, value) {
    var achievementState = ach || ensureState(state);
    if (!achievementState) return 0;
    var nextValue = normalizeCounter(value);
    if (state && state.stats && typeof state.stats === 'object') {
      state.stats.defenseOrderStreakCount = nextValue;
    }
    achievementState.totalDefenseOrderStreak = nextValue;
    return nextValue;
  }

  function getProgressValueFromState(progressType, state, ach, def) {
    var type = typeof progressType === 'string' ? progressType : 'purchases';
    var stats = state && state.stats && typeof state.stats === 'object' ? state.stats : null;

    if (type === 'droneMaxLevel') return computeDroneMaxLevelFromState(state);
    if (type === 'hangarCellChipTier') return computeHangarCellChipTierFromState(state);
    if (type === 'productionStorageSnapshot') {
      var snapCounters = ach && ach.counters && ach.counters.productionStorageSnapshot;
      if (!snapCounters) return 0;
      var snapLvl = def && Number.isFinite(def.progressLevel) ? def.progressLevel : 0;
      if (snapLvl >= 4) return normalizeCounter(snapCounters.level4);
      if (snapLvl >= 2) return normalizeCounter(snapCounters.level2);
      return normalizeCounter(snapCounters.total);
    }

    if (stats) {
      if (type === 'currentBalance') return normalizeCounter(state && state.coins);
      if (type === 'merges') return normalizeCounter(stats.tanksMergedCount);
      if (type === 'manualFenceRepairs') return normalizeCounter(stats.manualFenceRepairsCount);
      if (type === 'modifierTechUnlocks') return normalizeCounter(stats.modifierTechUnlocksCount);
      if (type === 'droneAcquisitions') return normalizeCounter(stats.droneAcquisitionsCount);
      if (type === 'noRepairAttackWaveStreak') return normalizeCounter(stats.noRepairAttackWaveStreakCount);
      if (type === 'attackWavesCompleted') return normalizeCounter(stats.attackWavesCompletedCount);
      if (type === 'autoMergeActivations') return normalizeCounter(stats.autoMergeActivationsCount);
      if (type === 'coinsSpentTotal') return normalizeCounter(stats.coinsSpentTotal);
      if (type === 'moneyEarned') return normalizeCounter(stats.moneyEarnedCount);
      if (type === 'perfectFenceWaves') return normalizeCounter(stats.perfectFenceWavesCount);
      if (type === 'hangarMasterLevel') return normalizeCounter(stats.hangarMasterLevelCount);
      if (type === 'defenseOrderStreak') return normalizeCounter(stats.defenseOrderStreakCount);
      if (type === 'maxTankLevel') return normalizeCounter(stats.maxTankLevelCount);
      if (type === 'chipComboTriples') return normalizeCounter(stats.chipComboTriplesCount);
      if (type === 'chipCraftFromFragments') return normalizeCounter(stats.chipCraftFromFragmentsCount);
      if (type === 'dustEarnedLifetime') return normalizeCounter(stats.dustEarnedLifetime);
      if (type === 'fragmentsAcquired') return normalizeCounter(stats.fragmentsAcquired);
      if (type === 'unspentUpgradePoints') {
        return normalizeCounter(state && state.player && state.player.talentsV2 && state.player.talentsV2.freePoints);
      }
      return normalizeCounter(stats.tanksBoughtCount);
    }

    if (!ach || typeof ach !== 'object') return 0;
    if (type === 'currentBalance') {
      return normalizeCounter(state && state.coins);
    }
    if (type === 'merges') {
      return normalizeCounter(ach.totalMerges);
    }
    if (type === 'manualFenceRepairs') {
      return normalizeCounter(ach.totalManualFenceRepairs);
    }
    if (type === 'modifierTechUnlocks') {
      return normalizeCounter(ach.totalModifierTechUnlocks);
    }
    if (type === 'droneAcquisitions') {
      return normalizeCounter(ach.totalDroneAcquisitions);
    }
    if (type === 'noRepairAttackWaveStreak') {
      return normalizeCounter(ach.totalNoRepairAttackWaveStreak);
    }
    if (type === 'attackWavesCompleted') {
      return normalizeCounter(ach.totalAttackWavesCompleted);
    }
    if (type === 'autoMergeActivations') {
      return normalizeCounter(ach.totalAutoMergeActivations);
    }
    if (type === 'coinsSpentTotal') {
      return normalizeCounter(ach.totalCoinsSpent);
    }
    if (type === 'moneyEarned') {
      return normalizeCounter(ach.totalMoneyEarned);
    }
    if (type === 'perfectFenceWaves') {
      return normalizeCounter(ach.totalPerfectFenceWaves);
    }
    if (type === 'hangarMasterLevel') {
      return normalizeCounter(ach.totalHangarMasterLevel);
    }
    if (type === 'defenseOrderStreak') {
      return normalizeCounter(ach.totalDefenseOrderStreak);
    }
    if (type === 'maxTankLevel') {
      return normalizeCounter(ach.totalMaxTankLevel);
    }
    if (type === 'chipComboTriples') {
      return normalizeCounter(ach.totalChipComboTriples);
    }
    if (type === 'chipCraftFromFragments') {
      return normalizeCounter(ach.totalChipCraftFromFragments);
    }
    if (type === 'dustEarnedLifetime') {
      return normalizeCounter(ach.dustEarnedLifetime);
    }
    if (type === 'fragmentsAcquired') {
      return normalizeCounter(ach.fragmentsAcquired);
    }
    if (type === 'unspentUpgradePoints') {
      return normalizeCounter(state && state.player && state.player.talentsV2 && state.player.talentsV2.freePoints);
    }
    if (type === 'droneMaxLevel') {
      return normalizeCounter(ach.totalDroneMaxLevel);
    }
    if (type === 'hangarCellChipTier') {
      return normalizeCounter(ach.totalHangarCellChipTier);
    }
    return normalizeCounter(ach.totalPurchased);
  }

  function getProgressValue(state, progressType, def) {
    var ach = ensureState(state);
    return getProgressValueFromState(progressType, state, ach, def);
  }

  function recalculateUnlocks(state) {
    var ach = ensureState(state);
    if (!ach) return [];
    var unlockedNow = [];
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var def = ACHIEVEMENTS[i];
      if (ach.unlocked[def.id]) continue;
      var progress = getProgressValueFromState(def.progressType, state, ach, def);
      if (progress >= def.target) {
        ach.unlocked[def.id] = true;
        grantSelfManagedReward(state, def.id, def, ach);
        unlockedNow.push(def.id);
      }
    }
    return unlockedNow;
  }

  function getDefinitions() {
    return ACHIEVEMENTS.slice();
  }

  function getBulkMode(state) {
    var ach = ensureState(state);
    if (!ach) return 'none';
    if (ach.unlocked.creator_expert) return 'buyMax';
    if (ach.unlocked.creator_pro) return 'buy5';
    if (ach.unlocked.creator_novice) return 'buy2';
    return 'none';
  }

  function addProgress(state, progressType, deltaCount) {
    var ach = ensureState(state);
    if (!ach) return [];
    var stats = state && state.stats && typeof state.stats === 'object' ? state.stats : null;
    var type = progressType;
    var deltaRaw = deltaCount;

    if (typeof progressType !== 'string') {
      type = 'purchases';
      deltaRaw = progressType;
    }

    var delta = Math.max(0, Math.floor(Number(deltaRaw) || 0));
    if (delta <= 0) return [];

    if (stats) {
      if (type === 'maxTankLevel') {
        /* SET semantics: delta is the current max level, not an increment */
        var level = Math.max(0, Math.floor(Number(deltaRaw) || 0));
        if (level > normalizeCounter(stats.maxTankLevelCount)) {
          stats.maxTankLevelCount = level;
        }
      } else if (type === 'merges') {
        stats.tanksMergedCount = normalizeCounter(stats.tanksMergedCount + delta);
      } else if (type === 'manualFenceRepairs') {
        stats.manualFenceRepairsCount = normalizeCounter(stats.manualFenceRepairsCount + delta);
      } else if (type === 'modifierTechUnlocks') {
        stats.modifierTechUnlocksCount = normalizeCounter(stats.modifierTechUnlocksCount + delta);
      } else if (type === 'droneAcquisitions') {
        stats.droneAcquisitionsCount = normalizeCounter(stats.droneAcquisitionsCount + delta);
      } else if (type === 'noRepairAttackWaveStreak') {
        stats.noRepairAttackWaveStreakCount = normalizeCounter(stats.noRepairAttackWaveStreakCount + delta);
      } else if (type === 'moneyEarned') {
        stats.moneyEarnedCount = normalizeCounter(stats.moneyEarnedCount + delta);
      } else if (type === 'perfectFenceWaves') {
        stats.perfectFenceWavesCount = normalizeCounter(stats.perfectFenceWavesCount + delta);
      } else if (type === 'hangarMasterLevel') {
        stats.hangarMasterLevelCount = normalizeCounter(stats.hangarMasterLevelCount + delta);
      } else if (type === 'defenseOrderStreak') {
        stats.defenseOrderStreakCount = normalizeCounter(stats.defenseOrderStreakCount + delta);
      } else if (type === 'chipComboTriples') {
        stats.chipComboTriplesCount = normalizeCounter(stats.chipComboTriplesCount + delta);
      } else if (type === 'chipCraftFromFragments') {
        stats.chipCraftFromFragmentsCount = normalizeCounter(stats.chipCraftFromFragmentsCount + delta);
      } else if (type === 'droneMaxLevel') {
        var droneLevel = Math.max(0, Math.floor(Number(deltaRaw) || 0));
        ach.totalDroneMaxLevel = Math.max(normalizeCounter(ach.totalDroneMaxLevel), droneLevel);
      } else if (type === 'hangarCellChipTier') {
        var chipTier = Math.max(0, Math.floor(Number(deltaRaw) || 0));
        ach.totalHangarCellChipTier = Math.max(normalizeCounter(ach.totalHangarCellChipTier), chipTier);
      } else {
        stats.tanksBoughtCount = normalizeCounter(stats.tanksBoughtCount + delta);
      }
      ach.totalMerges = stats.tanksMergedCount;
      ach.totalPurchased = stats.tanksBoughtCount;
      ach.totalManualFenceRepairs = stats.manualFenceRepairsCount;
      ach.totalModifierTechUnlocks = stats.modifierTechUnlocksCount;
      ach.totalDroneAcquisitions = stats.droneAcquisitionsCount;
      ach.totalNoRepairAttackWaveStreak = stats.noRepairAttackWaveStreakCount;
      ach.totalMoneyEarned = stats.moneyEarnedCount;
      ach.totalPerfectFenceWaves = stats.perfectFenceWavesCount;
      ach.totalHangarMasterLevel = stats.hangarMasterLevelCount;
      ach.totalDefenseOrderStreak = stats.defenseOrderStreakCount;
      ach.totalMaxTankLevel = normalizeCounter(stats.maxTankLevelCount);
      ach.totalChipComboTriples = normalizeCounter(stats.chipComboTriplesCount);
      ach.totalChipCraftFromFragments = normalizeCounter(stats.chipCraftFromFragmentsCount);
    } else if (type === 'maxTankLevel') {
      var lvl = Math.max(0, Math.floor(Number(deltaRaw) || 0));
      if (lvl > normalizeCounter(ach.totalMaxTankLevel)) {
        ach.totalMaxTankLevel = lvl;
      }
    } else if (type === 'chipComboTriples') {
      ach.totalChipComboTriples = normalizeCounter(ach.totalChipComboTriples + delta);
    } else if (type === 'chipCraftFromFragments') {
      ach.totalChipCraftFromFragments = normalizeCounter(ach.totalChipCraftFromFragments + delta);
    } else if (type === 'droneAcquisitions') {
      ach.totalDroneAcquisitions = normalizeCounter(ach.totalDroneAcquisitions + delta);
    } else if (type === 'noRepairAttackWaveStreak') {
      ach.totalNoRepairAttackWaveStreak = normalizeCounter(ach.totalNoRepairAttackWaveStreak + delta);
    } else if (type === 'modifierTechUnlocks') {
      ach.totalModifierTechUnlocks = normalizeCounter(ach.totalModifierTechUnlocks + delta);
    } else if (type === 'manualFenceRepairs') {
      ach.totalManualFenceRepairs = normalizeCounter(ach.totalManualFenceRepairs + delta);
    } else if (type === 'merges') {
      ach.totalMerges = normalizeCounter(ach.totalMerges + delta);
    } else if (type === 'moneyEarned') {
      ach.totalMoneyEarned = normalizeCounter(ach.totalMoneyEarned + delta);
    } else if (type === 'perfectFenceWaves') {
      ach.totalPerfectFenceWaves = normalizeCounter(ach.totalPerfectFenceWaves + delta);
    } else if (type === 'hangarMasterLevel') {
      ach.totalHangarMasterLevel = normalizeCounter(ach.totalHangarMasterLevel + delta);
    } else if (type === 'defenseOrderStreak') {
      if (!Number.isFinite(ach.totalDefenseOrderStreak)) ach.totalDefenseOrderStreak = 0;
      ach.totalDefenseOrderStreak += delta;
    } else if (type === 'droneMaxLevel') {
      var maxDroneLevel = Math.max(0, Math.floor(Number(deltaRaw) || 0));
      if (!Number.isFinite(ach.totalDroneMaxLevel)) ach.totalDroneMaxLevel = 0;
      if (maxDroneLevel > ach.totalDroneMaxLevel) ach.totalDroneMaxLevel = maxDroneLevel;
    } else if (type === 'hangarCellChipTier') {
      var maxChipTier = Math.max(0, Math.floor(Number(deltaRaw) || 0));
      if (!Number.isFinite(ach.totalHangarCellChipTier)) ach.totalHangarCellChipTier = 0;
      if (maxChipTier > ach.totalHangarCellChipTier) ach.totalHangarCellChipTier = maxChipTier;
    } else {
      ach.totalPurchased = normalizeCounter(ach.totalPurchased + delta);
    }

    return recalculateUnlocks(state);
  }

  function recordNoRepairAttackWaveSuccess(state) {
    var ach = ensureState(state);
    if (!ach) return [];
    var current = getProgressValueFromState('noRepairAttackWaveStreak', state, ach);
    setNoRepairAttackWaveStreak(state, ach, current + 1);
    return recalculateUnlocks(state);
  }

  function resetNoRepairAttackWaveStreak(state) {
    var ach = ensureState(state);
    if (!ach) return false;
    if (getProgressValueFromState('noRepairAttackWaveStreak', state, ach) <= 0) return false;
    setNoRepairAttackWaveStreak(state, ach, 0);
    return true;
  }

  function recordDefenseOrderWaveSuccess(state) {
    var ach = ensureState(state);
    if (!ach) return [];
    var current = getProgressValueFromState('defenseOrderStreak', state, ach);
    setDefenseOrderStreak(state, ach, current + 1);
    return recalculateUnlocks(state);
  }

  function resetDefenseOrderStreak(state) {
    var ach = ensureState(state);
    if (!ach) return false;
    if (getProgressValueFromState('defenseOrderStreak', state, ach) <= 0) return false;
    setDefenseOrderStreak(state, ach, 0);
    return true;
  }

  function setAttackWavesCompleted(state, ach, value) {
    var achievementState = ach || ensureState(state);
    if (!achievementState) return;
    var nextValue = normalizeCounter(value);
    if (state && state.stats && typeof state.stats === 'object') {
      state.stats.attackWavesCompletedCount = nextValue;
    }
    achievementState.totalAttackWavesCompleted = nextValue;
  }

  function recordAttackEpisodeCompleted(state) {
    var ach = ensureState(state);
    if (!ach) return [];
    var current = getProgressValueFromState('attackWavesCompleted', state, ach);
    setAttackWavesCompleted(state, ach, current + 1);
    return recalculateUnlocks(state);
  }

  function resetAttackWavesCompleted(state) {
    var ach = ensureState(state);
    if (!ach) return false;
    if (getProgressValueFromState('attackWavesCompleted', state, ach) <= 0) return false;
    setAttackWavesCompleted(state, ach, 0);
    return true;
  }

  function setAutoMergeActivations(state, ach, value) {
    var achievementState = ach || ensureState(state);
    if (!achievementState) return;
    var nextValue = normalizeCounter(value);
    if (state && state.stats && typeof state.stats === 'object') {
      state.stats.autoMergeActivationsCount = nextValue;
    }
    achievementState.totalAutoMergeActivations = nextValue;
  }

  /* Postmortem item 11: pairsExecuted is the number of realized merge pairs
     after the eligibility filter in autoMerge.runAutoMerge — NOT button clicks.
     Invoked from autoMerge.js seam only when executed > 0. */
  function recordAutoMergeActivations(state, pairsExecuted) {
    if (!Number.isFinite(pairsExecuted) || pairsExecuted <= 0) return [];
    var ach = ensureState(state);
    if (!ach) return [];
    var inc = Math.max(0, Math.floor(Number(pairsExecuted)));
    if (inc <= 0) return [];
    var current = getProgressValueFromState('autoMergeActivations', state, ach);
    setAutoMergeActivations(state, ach, current + inc);
    return recalculateUnlocks(state);
  }

  function resetAutoMergeActivations(state) {
    var ach = ensureState(state);
    if (!ach) return false;
    if (getProgressValueFromState('autoMergeActivations', state, ach) <= 0) return false;
    setAutoMergeActivations(state, ach, 0);
    return true;
  }

  var COINS_SPENT_MAX = Number.MAX_SAFE_INTEGER;
  var COINS_SPENT_SOURCES = { tank: true, upgrade: true, wall: true, supercomputer: true, hangar: true, repair: true, talent: true };
  var coinsSpentClampWarned = false;

  function setCoinsSpent(state, ach, value) {
    var achievementState = ach || ensureState(state);
    if (!achievementState) return;
    var nextValue = normalizeCounter(value);
    if (nextValue > COINS_SPENT_MAX) nextValue = COINS_SPENT_MAX;
    achievementState.totalCoinsSpent = nextValue;
    if (state && state.stats && typeof state.stats === 'object') {
      state.stats.coinsSpentTotal = nextValue;
    }
  }

  function recordCoinsSpent(state, delta, source) {
    if (!Number.isFinite(delta) || delta <= 0) return [];
    var ach = ensureState(state);
    if (!ach) return [];
    var inc = Math.max(0, Math.floor(Number(delta)));
    if (inc <= 0) return [];
    var current = getProgressValueFromState('coinsSpentTotal', state, ach);
    var next = current + inc;
    if (next > COINS_SPENT_MAX) {
      if (!coinsSpentClampWarned && typeof console !== 'undefined' && console.warn) {
        console.warn('[achievements] coinsSpentTotal clamped at MAX_SAFE_INTEGER');
        coinsSpentClampWarned = true;
      }
      next = COINS_SPENT_MAX;
    }
    setCoinsSpent(state, ach, next);
    if (state && state.stats && typeof state.stats === 'object' && typeof source === 'string' && source.length > 0 && COINS_SPENT_SOURCES[source]) {
      if (!state.stats.coinsSpentBySource || typeof state.stats.coinsSpentBySource !== 'object') state.stats.coinsSpentBySource = {};
      var prevSrc = Number(state.stats.coinsSpentBySource[source]) || 0;
      var nextSrc = prevSrc + inc;
      if (nextSrc > COINS_SPENT_MAX) nextSrc = COINS_SPENT_MAX;
      state.stats.coinsSpentBySource[source] = nextSrc;
    }
    return recalculateUnlocks(state);
  }

  function resetCoinsSpent(state) {
    var ach = ensureState(state);
    if (!ach) return false;
    if (getProgressValueFromState('coinsSpentTotal', state, ach) <= 0
      && (!state || !state.stats || !state.stats.coinsSpentBySource || Object.keys(state.stats.coinsSpentBySource).length === 0)) return false;
    setCoinsSpent(state, ach, 0);
    if (state && state.stats && typeof state.stats === 'object') state.stats.coinsSpentBySource = {};
    return true;
  }

  function recordProductionStorageSnapshot(state) {
    var ach = ensureState(state);
    if (!ach) return [];
    if (!ach.counters || typeof ach.counters !== 'object') ach.counters = {};
    if (!ach.counters.productionStorageSnapshot || typeof ach.counters.productionStorageSnapshot !== 'object') {
      ach.counters.productionStorageSnapshot = { total: 0, level2: 0, level4: 0 };
    }
    var pl = state && state.productionLine;
    if (!pl || !Array.isArray(pl.storage)) return [];
    var total = pl.storage.length;
    var lvl2 = 0, lvl4 = 0;
    for (var bi = 0; bi < pl.storage.length; bi++) {
      var bx = pl.storage[bi];
      if (!bx) continue;
      var bxLvl = normalizeCounter(bx.level);
      if (bxLvl >= 2) lvl2++;
      if (bxLvl >= 4) lvl4++;
    }
    var c = ach.counters.productionStorageSnapshot;
    if (total > c.total) c.total = total;
    if (lvl2 > c.level2) c.level2 = lvl2;
    if (lvl4 > c.level4) c.level4 = lvl4;
    return recalculateUnlocks(state);
  }

  function recordModifierTechUnlock(state, techId) {
    var ach = ensureState(state);
    if (!ach) return [];
    var normalizedTechId = normalizeCounter(techId);
    if (normalizedTechId <= 0) return [];
    if (!ach.completedModifierTechs || typeof ach.completedModifierTechs !== 'object') {
      ach.completedModifierTechs = {};
    }
    var alreadyTracked = !!ach.completedModifierTechs[String(normalizedTechId)];
    if (!alreadyTracked) {
      ach.completedModifierTechs[String(normalizedTechId)] = true;
      var totalCompleted = countCompletedModifierTechs(ach.completedModifierTechs);
      ach.totalModifierTechUnlocks = totalCompleted;
      if (state && state.stats && typeof state.stats === 'object') {
        state.stats.modifierTechUnlocksCount = totalCompleted;
      }
      // TZ batch12 item 7: canonical Game.Events topic для tech-study-completed.
      try {
        if (global.Game && global.Game.Events && typeof global.Game.Events.emit === 'function') {
          global.Game.Events.emit('tech.studyCompleted', { techId: normalizedTechId });
        }
      } catch (_) {}
    }
    // Always recalculate — inference race may have added the tech
    // but never ran recalculateUnlocks
    return recalculateUnlocks(state);
  }

  function hasRewardGranted(state, achievementId) {
    var ach = ensureState(state);
    if (!ach || typeof achievementId !== 'string' || !achievementId) return false;
    return !!ach.rewarded[achievementId];
  }

  function appendRewardHistory(state, achievementId, metadata) {
    var ach = ensureState(state);
    if (!ach || typeof achievementId !== 'string' || !achievementId) return false;
    if (!Array.isArray(ach.rewardHistory)) ach.rewardHistory = [];
    var info = metadata && typeof metadata === 'object' ? metadata : {};
    var entry = {
      achievementId: achievementId,
      rewardMode: typeof info.rewardMode === 'string' ? info.rewardMode : '',
      status: typeof info.status === 'string' ? info.status : 'granted',
      ts: Date.now(),
    };
    ach.rewardHistory.push(entry);
    if (ach.rewardHistory.length > 300) {
      ach.rewardHistory = ach.rewardHistory.slice(ach.rewardHistory.length - 300);
    }
    return true;
  }

  function markRewardGranted(state, achievementId, metadata) {
    var ach = ensureState(state);
    if (!ach || typeof achievementId !== 'string' || !achievementId) return false;
    ach.rewarded[achievementId] = true;
    appendRewardHistory(state, achievementId, metadata);
    return true;
  }

  global.Game = global.Game || {};
  global.Game.Achievements = {
    getDefinitions: getDefinitions,
    ensureState: ensureState,
    addProgress: addProgress,
    getProgressValue: getProgressValue,
    recalculateUnlocks: recalculateUnlocks,
    getBulkMode: getBulkMode,
    hasRewardGranted: hasRewardGranted,
    markRewardGranted: markRewardGranted,
    appendRewardHistory: appendRewardHistory,
    recordModifierTechUnlock: recordModifierTechUnlock,
    recordProductionStorageSnapshot: recordProductionStorageSnapshot,
    recordNoRepairAttackWaveSuccess: recordNoRepairAttackWaveSuccess,
    resetNoRepairAttackWaveStreak: resetNoRepairAttackWaveStreak,
    recordDefenseOrderWaveSuccess: recordDefenseOrderWaveSuccess,
    resetDefenseOrderStreak: resetDefenseOrderStreak,
    recordAttackEpisodeCompleted: recordAttackEpisodeCompleted,
    resetAttackWavesCompleted: resetAttackWavesCompleted,
    recordAutoMergeActivations: recordAutoMergeActivations,
    resetAutoMergeActivations: resetAutoMergeActivations,
    recordCoinsSpent: recordCoinsSpent,
    resetCoinsSpent: resetCoinsSpent,
  };
})(typeof window !== 'undefined' ? window : this);
