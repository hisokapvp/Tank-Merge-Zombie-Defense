# game.js — Структурная карта (~9 500 строк)

> **ВНИМАНИЕ**: Номера строк здесь приблизительны.
> Файл был сокращён с 10 749 до ~9 500 строк (извлечены RuntimeTasks, CannonUpgrades; удалён мёртвый код ~120 строк; компактифицирован createInitialState).
> Извлечённые модули: `src/core/runtimeTasks.js` (Game.RuntimeTasks), `src/mechanics/cannonUpgrades.js` (Game.CannonUpgrades), `src/persistence/initialState.js` (Game.InitialState — обновлён).
> Дополнительно вынесены крупные runtime-блоки: `src/audio/sfxPoolRuntime.js`, `src/systems/worldEventsRuntime.js`, `src/render/zombieRender.js`, `src/mechanics/crateRuntime.js`, `src/ui/bigMenuRuntime.js`.
> Для точных номеров строк используйте grep.

## Extraction status (2026-02-25)
- В `game.js` для 5 систем добавлены `ensure*RuntimeController()` и делегирование вызовов в `Game.*Runtime.createController(...)`.
- Встроенная логика в `game.js` оставлена как fallback (поведение не зависит жёстко от порядка/наличия runtime-скриптов).
- Talents v2 UI layout в `getTalentNodeLayoutV2(...)` берётся из `node.layout` (из `Game.TalentsV2.getTalentsByBranch(...)`) с fallback на legacy `TALENT_LAYOUT`.
- Визуал ангара: `drawTankSlot(...)` использует stamp-reveal (`drawTankIconWithStampReveal`) на `10` полос/`1.5s`; при restore сейва stamp отключён (`makeTank(..., { enableStamp:false })`).

---

## 1. Блоки по категориям с диапазонами строк

### Entrypoint / Инициализация ядра
| Диапазон | Описание |
|---|---|
| 1–7 | Canvas/ctx setup, `GameApi`/`window.Game` aliasing, `SeededRngApi` |
| 9–100 | `RuntimeTasks` IIFE (timer/RAF suspend/resume), `.install()` |
| 102–177 | `ui` — объект с ~80 DOM-ссылками |
| 10625–10743 | `boot()` — async boot flow (balance.json, cannon upgrades, sprites, Bootstrap) |
| 10744 | **Entry point**: `initBigMainMenu()` вызов |

### Константы / Баланс / Конфигурация
| Диапазон | Описание |
|---|---|
| 179–183 | `MAX_TANK_LEVEL`, `CANNON_UPGRADES_LEVELS`, `ProgressionApi`, `computePowerTier` |
| 192–320 | Cannon upgrades: fallback, sanitize, normalize, getConfig, getRow |
| 286–407 | `BAL` (основные баланс-константы), `ACTIVE_ABILITY_DURATION_SEC`, `BOOST_EFFECT_DEFS`, `BASE_BAL` |
| 408–420 | `BalanceConfig`, `GameApi.Balance` assignments |
| 421–445 | `getZombieBalanceMul`, `getTankBalanceMul` |
| 960–975 | Fence/zombie constants (`ZOMBIE_DEFAULT_ATTACK_RANGE_PX`, etc.) |
| 996–1015 | `SUPERCOMPUTER_FALLBACK_BOUNDS`, `supercomputerHudRuntime` |
| 6138 | `MAX_DAMAGE_NUMBERS = 24` |
| 9517–9525 | `AuraStyleByBand` array |
| 10394–10399 | Main loop vars (`last`, `fpsAvg`, `qualityLow`, etc.) |
| 10540–10541 | `DEBUG_MAX_TANK_LEVEL`, `DEBUG_LOG_MAX` |

### State / Начальное состояние
| Диапазон | Описание |
|---|---|
| 447–477 | Settings defaults, audio controller vars, boot state variables |
| 478–606 | `createInitialState()`, `state = createInitialState()`, `meta` |
| 607–774 | Damage progress, cannon upgrade cost/apply, `GameApi.getDamagePoints` |
| 775–870 | Supercomputer state management (`getComputerState`, `getComputerLevel`) |
| 872–920 | Map seeds, debug panel flag, zombie overlay toggle |

### Внешние API-ссылки
| Диапазон | Описание |
|---|---|
| 964–1000 | ~20 API refs: `ZombieSpawnApi`, `UIModals`, `CombatProfilesApi`, `LevelFlowApi`, `BootstrapApi`, `FenceLayoutApi`, `GroundLayerApi`, `PauseManagerApi`, `DepthSortApi`, `AutoMergeApi`, `SupercomputerMenuApi`, `CriticalModalApi`, `AchievementsModalApi`, `WorldResetApi`, etc. |

### Настройки / Audio / SFX
| Диапазон | Описание |
|---|---|
| 1000–1070 | `loadSettings`, `saveSettings`, `applyAudioSettings`, `audioSettingsController` |
| 1070–1600 | SFX system: pools, dedup, channels, `playSfx`, `playLoopSfx`, `stopLoopSfx`, gameplay audio fade, critical audio policy; делегирование в `Game.SfxPoolRuntime` |
| 1600–1690 | `SFX_SOURCES`, volume helpers (`getVolume`, `setVolume`, `syncVolumeUIFromSettings`) |

### i18n
| Диапазон | Описание |
|---|---|
| 1690–1780 | `STRINGS`, `currentLang`, `getI18n`, `getCurrentLang`, `t()`, `setLanguage`, `applyTranslations` |

### Загрузка спрайтов
| Диапазон | Описание |
|---|---|
| 1780–1960 | Все sprite loaders: `ZombieSprites`, `TankSprites`, `FenceSprites`, `DecorSprites`, `GroundSprites`, `SupercomputerSprites`, `BoostIconsSprites`, `DronSprites`, `BonusBoxSprites`, `BulletSprites` |

### World Events (погода / атаки)
| Диапазон | Описание |
|---|---|
| 1960–2010 | `WorldEventsCfg`, `worldEventsState`, `groundLayer` |
| 2530–2840 | Weather system: rain, lightning, evening dim, attack mode cycling; делегирование в `Game.WorldEventsRuntime` |

### Canvas / Layout / Board / Decor
| Диапазон | Описание |
|---|---|
| 2010–2080 | `BASE_CANVAS`, `balScale`, `applyBalScale`, `resizeCanvas` |
| 2080–2200 | `initBoard()` — layout, fence radius, supercomputer positioning |
| 2200–2460 | `initDecors()` — seeded procedural decor placement |
| 2460–2530 | `buildBackground`, `rebuildGroundLayer` |

### Доменная логика / Механика
| Диапазон | Описание |
|---|---|
| 2840–2980 | `makeTank`, `addDron`, economy (`buyTankLevel`, `baseBuyPrice`, `buyTankCost`) |
| 2980–3100 | Achievements system |
| 3100–3450 | Bulk buy, tank purchasing, merge system (`performMerge`, `mergeCells`, `mergeAutoPair`) |
| 3450–3520 | `incomeMult`, `speedMult`, `coinsForShot`, `coinsForKill`, `tankStats` |
| 3520–3620 | XP/leveling, level flow controller |
| 3620–3650 | Center notification system |
| 3650–4000 | Talent tree: `TALENT_BRANCHES`, `TALENT_DEFS` (51 talents), mods computation, ability system |
| 4000–4200 | Save/restore progress |
| 4200–4350 | `PROJECTILE_KINDS`, bullet config, combat profiles |
| 4350–4600 | Zombie spawning (`makeZombie`, `ensureZombieCount`), zombie positioning |
| 4600–5000 | Fence system (levels, HP, armor, upgrades, repair, segment math) |
| 5000–5200 | Breach tracking by side |
| 5200–5700 | Zombie attack/combat (target selection, `stepZombies`) |
| 5700–5850 | `stepTanks` (orbit, targeting, firing) |
| 5850–6030 | Projectile system (`spawnProjectile`, `stepProjectiles`, projectile pool) |
| 6028–6175 | Combat math: `critChanceFromTankLevel`, `impactAt`, `chainLightning`, damage numbers |
| 6175–6210 | Decals (pool DOT) |
| 6207–6310 | Crates (`pickCrateRewardLevel`, `spawnCrate`, `stepCrate`, `crateHitTest`) |
| 6310–6370 | `cleanupKills`, particles |
| 7100–7145 | `spawnInitialTanksLvl1`, `clearAllTanksFromCells` |
| 7144–7200 | `forceAutosaveSafely`, `restoreFenceSegmentsToMaxHp`, `restoreSupercomputerAfterCritical` |
| 7197–7282 | Critical flow: modal controller, restart, save & exit |
| 7283–7345 | `resetGameState()` — полный сброс состояния |
| 10315–10391 | `stepImpacts`, `setSupercomputerWantsBuildTank`, `applySupercomputerDamage`, `stepSupercomputer` |

### UI / Модальные окна
| Диапазон | Описание |
|---|---|
| 6371–6500 | `setMenuOpen`, `setBigMenuOpen`, `setSessionStartGate`, `setBigMenuView` |
| 6451–7000 | Big Menu: save/load rows, language panel, credits modal, `startFromBigMenu`; делегирование в `Game.BigMenuRuntime` |
| 7001–7100 | `initBigMainMenu()` — привязка событий Big Menu |
| 7347–7410 | `a11yOpen`, `a11yClose`, `updateUI()` |
| 7409–7465 | Auto-merge button, dismantle button |
| 7464–7575 | Dismantle modal (open/close/confirm/toggle) |
| 7576–7650 | Achievements modal |
| 7647–7690 | Progress UI (XP bar) |
| 7690–7820 | Talent UI DOM builder |
| 7871–7960 | `updateTalentUI`, `updateStageAbilitySlots` |
| 7965–8050 | Crate modal, boost modal, reset talents modal |
| 8106–8175 | Supercomputer menu controller |

### Input / Events
| Диапазон | Описание |
|---|---|
| 8178–8310 | `getPointerPos`, `cellAt`, canvas pointer events (down/move/up/leave) |
| 8311–8405 | UI button event listeners (buy, bulk, merge, boost, achievements, crate, dismantle, level, talents) |
| 8392–8405 | PauseManager creation, debug hotkey |

### Render / Draw
| Диапазон | Описание |
|---|---|
| 8409–8438 | `draw()` — main render orchestrator |
| 8439–8500 | `drawZombieAttackOverlay`, `drawAttackModeEveningDim`, `drawLevelUpVfx` |
| 8539–8610 | `drawBackground`, `drawDecorSpriteAt`, `drawDecorZombieLayer`, `drawDecors` |
| 8611–8660 | `drawTrack` (disabled), `drawTankTrack` |
| 8660–8745 | `drawSupercomputerHpBar`, `drawSupercomputerFallback`, `drawSupercomputer` |
| 8745–8980 | Boost icons: config, layout, positioning, `drawSupercomputerBoostIcons` |
| 9001–9090 | `drawSupercomputerBoostIcons` body, `drawDrones` |
| 9091–9250 | `drawZombieFence` (sprite + fallback), `resolveFenceSpriteKeys` |
| 9249–9300 | `drawFence` (hangar visual), `clipRoundedRect` |
| 9298–9375 | `drawBoard` (cells, drag preview), `drawTankSlot` (stamp-reveal), `drawOrbitingTanks` |
| 9370–9500 | `drawTankIcon`, `drawTankIconTo` |
| 9503–9640 | `computeAuraBand`, `AuraStyleByBand`, `drawTankAura`, `drawTankAuraSprite` |
| 9634–9810 | `drawTank` — полный рендер танка (sprite + vector fallback) |
| 9814–10020 | `drawZombieEntity`, `drawZombieSprite`, `drawZombieFallback`; делегирование в `Game.ZombieRender` |
| 10024–10070 | `drawProjectiles` |
| 10067–10120 | `drawImpacts` |
| 10121–10200 | `drawCrate`, `drawDecals` |
| 10201–10250 | `drawDamageNumbers`, `drawParticles`, `drawHint` |

### Helpers / Утилиты
| Диапазон | Описание |
|---|---|
| 921–963 | `viewSize`, `center`, `nowSec`, `clamp` |
| 10252–10315 | `tankOnTrackAt`, `getMobileMode`, `getFxLevel`, `getFxScale`, `isFxLite`, `isFxUltraLite`, `smoothAngle`, `rr`, `shade`, `seededNoise` |

### Main Loop
| Диапазон | Описание |
|---|---|
| 10394–10399 | Loop variables |
| 10401–10537 | `scheduleMainLoop`, `loop()` — game loop (step + draw + telemetry) |

### Debug
| Диапазон | Описание |
|---|---|
| 10540–10625 | `debugLog`, `debugReset`, `safeDebug`, `initDebugPanel` |

---

## 2. Все `Game.*` / `GameApi.*` / `window.Game.*` присвоения

| Строка | Присвоение | Тип |
|---|---|---|
| 6 | `GameApi = (window.Game = window.Game \|\| {})` | alias, bootstrap |
| 7 | `SeededRngApi = window.Game.SeededRng \|\| {}` | read |
| 410 | `GameApi.Balance = GameApi.Balance \|\| {}` | object |
| 411 | `GameApi.Balance.CannonUpgrades = getCannonUpgradeConfig()` | object |
| 761 | `GameApi.getDamagePoints = getDamagePoints` | function |
| 774 | `GameApi.debugAdjustDamagePoints = debugAdjustDamagePoints` | function |
| 1850 | `window.TankSprites = TankSprites` | object (sprite loader) |
| 1853 | `window.Game.TankSprites = TankSprites` | object (sprite loader) |
| 10385 | `GameApi.setSupercomputerWantsBuildTank = setSupercomputerWantsBuildTank` | function |
| 10386 | `GameApi.applySupercomputerDamage = applySupercomputerDamage` | function |
| 10387–10391 | `GameApi.SupercomputerRuntime = { setWantsBuildTank, applyDamage, getState }` | object (API façade) |

Внутри `boot()` (строка ~10670):
| Строка | Присвоение | Контекст |
|---|---|---|
| ~10680 | `GameApi.Balance.CannonUpgrades = CannonUpgradesBalance` | повторное, после загрузки JSON |

---

## 3. Все top-level функции

### Инициализация / Boot
| Строка | Функция |
|---|---|
| 99 | `RuntimeTasks.install()` |
| 6998 | `initBigMainMenu()` |
| 10586 | `initDebugPanel()` |
| 10625 | `boot()` — async |
| 10401 | `scheduleMainLoop()` |

### Состояние / State
| Строка | Функция |
|---|---|
| 182 | `computePowerTier(level)` |
| 192 | `createFallbackCannonUpgrades(count)` |
| 216 | `sanitizeCannonUpgradeRow(row, index)` |
| 235 | `normalizeCannonUpgradesConfig(raw)` |
| 274 | `getCannonUpgradeConfig()` |
| 278 | `getCannonUpgradeRow(level)` |
| 485 | `createInitialState(options)` |
| 601 | (inline) `state = createInitialState()` |
| 607+ | `normalizeTotalDamageDealtRaw()`, `ensureDamageProgressState()`, `ensurePlayerDamagePointsState()` |
| 650+ | `getDamagePoints()`, `debugAdjustDamagePoints()` |
| 680+ | `getCannonUpgradeStepCost()`, `getCannonUpgradeTotalCost()`, `applyCannonUpgrade()` |
| 787 | `getComputerState()` |
| 810 | `getComputerLevel()` |
| 872 | `resolveGroundStampsSeed()` |
| 885 | `resolveDecorSeed()` |
| 890 | `ensureMapSeedsState()` |
| 912 | `isDebugPanelEnabled()` |
| 7283 | `resetGameState(options)` |

### Settings / Audio
| Строка | Функция |
|---|---|
| ~1010 | `loadSettings()` |
| ~1020 | `saveSettings()` |
| ~1030 | `applyAudioSettings()` |
| 1070+ | `playSfx(name)` |
| ~1180 | `playLoopSfx(name)` |
| ~1210 | `stopLoopSfx(name)` |
| ~1600 | `getVolume(channel)` |
| ~1610 | `setVolume(channel, value, unit)` |
| ~1630 | `syncVolumeUIFromSettings()` |
| ~1640 | `updateMenuVolumes()` |

### i18n
| Строка | Функция |
|---|---|
| ~1695 | `getI18n()` |
| ~1700 | `getCurrentLang()` |
| ~1705 | `t(key, params)` |
| ~1720 | `getTankWordKey()` |
| ~1730 | `bulkBuyLabel(count)` |
| ~1740 | `setLanguage(lang)` |
| ~1750 | `applyTranslations()` |

### Canvas / Layout
| Строка | Функция |
|---|---|
| ~2020 | `applyBalScale()` |
| ~2040 | `resizeCanvas()` |
| 2080 | `initBoard()` |
| 2200 | `initDecors()` |
| ~2460 | `buildBackground()` |
| ~2490 | `rebuildGroundLayer()` |

### World Events
| Строка | Функция |
|---|---|
| ~2540 | `getWorldEventsAttackCfg()` |
| ~2560 | `getWeatherCfg()` |
| ~2600 | `processWeatherLightning(dt)` |
| ~2650 | `isZombieAttackModeActive()` |
| ~2700 | `updateWorldEvents(dt)` |
| ~2800 | `drawWeather()` |

### Экономика / Покупка
| Строка | Функция |
|---|---|
| 2840 | `makeTank(level, onTrack = false, options = null)` |
| 2860 | `addDron(level)` |
| 2870 | `recordTankLevel(level)` |
| 2880 | `buyTankLevel()` |
| 2890 | `baseBuyPrice(level)` |
| 2910 | `buyTankCost(level)` |
| 2920 | `bumpBuyPrice()` |
| 3100 | `calculateAffordableBuyCount()` |
| 3120 | `getBulkBuyPlan()` |
| 3160 | `performTankPurchaseOnce()` |
| 3200 | `tryBuyTank()` |
| 3220 | `tryBuyBulk()` |

### Achievements
| Строка | Функция |
|---|---|
| 2980 | `ensureAchievementsState()` |
| 3000 | `processAchievementProgress()` |
| 7576 | `getAchievementDefinitions()` |
| 7581 | `getAchievementById(id)` |
| 7588 | `ensureAchievementsModalController()` |
| 7601 | `renderAchievementsList()` |
| 7619 | `openAchievementsModal()` |
| 7629 | `closeAchievementsModal()` |
| 7636 | `closeAchievementPopup()` |
| 7643 | `maybeShowNextAchievementPopup()` |

### Merge / Auto-Merge
| Строка | Функция |
|---|---|
| 3250 | `performMerge(fromIndex, toIndex, opts)` |
| 3350 | `mergeCells(fromIndex, toIndex)` |
| 3400 | `mergeAutoPair(pairA, pairB)` |
| 7409 | `refreshAutoMergeButton()` |
| 7424 | `runAutoMergeClick()` |

### Боевые формулы
| Строка | Функция |
|---|---|
| 3450 | `incomeMult()` |
| 3460 | `speedMult()` |
| 3470 | `coinsForShot()` |
| 3480 | `coinsForKill(zombieLevel)` |
| 3490 | `tankStats(level)` |

### XP / Уровни
| Строка | Функция |
|---|---|
| 3520 | `xpNeededForLevel(level)` |
| 3540 | `levelGoldReward(level)` |
| 3560 | `onComputerLevelChanged()` |
| ~3580 | `grantXP(amount)` |
| ~3590 | `acceptLevelReward()` |

### Уведомления
| Строка | Функция |
|---|---|
| 3620 | `showCenterNotification(text, duration)` |
| 3635 | `updateCenterNotification()` |

### Таланты
| Строка | Функция |
|---|---|
| 3650 | `initTalentDefs()` — создаёт 51 талант |
| 3870 | `baseMods()` |
| 3880 | `computeModsFromApplied()` |
| 3900 | `getMods()` |
| 3920 | `openTalents()` |
| 3930 | `closeTalents()` |
| 3940 | `canSelectTalent(index)` |
| 3960 | `applyTalentSelections()` |
| 3975 | `canUseActive(branch)` |
| 3980 | `useActiveAbility(branch)` |
| 3990 | `activateTimedBoost(kind, durationSec)` |
| 7690 | `ensureTalentUI()` — построение DOM дерева талантов |
| 7815 | `resetBranchPending(branch)` |
| 7822 | `drawTalentEdges(branch)` |
| 7871 | `updateTalentUI()` |
| 7942 | `updateStageAbilitySlots()` |

### Save / Load
| Строка | Функция |
|---|---|
| 4000 | `saveProgress()` |
| 4030 | `getSavedProgress()` |
| 4060 | `restoreFullState(payload)` (создаёт танки через `makeTank(..., { enableStamp:false })`) |
| 4100 | `applySavedProgress(saved)` |
| 7144 | `forceAutosaveSafely()` |

### Снаряды / Стрельба
| Строка | Функция |
|---|---|
| 4200 | `PROJECTILE_KINDS` (объект) |
| 4230 | `getBulletConfigForTankLevel(level)` |
| 4260 | `projectileProfile(kind)` |
| 4280 | `tankLevelCounts()` |
| 4300 | `zombieLevelWeights()` |
| 5850 | `fireTankProjectile(tank, cell, target)` |
| 5900 | `spawnProjectile(opts)` |
| 5950 | `stepProjectiles(dt)` |
| 6028 | `critChanceFromTankLevel(level)` |
| 6034 | `impactAt(x, y, b, opts)` |
| 6096 | `chainLightning(x, y, b, opts)` |

### Зомби
| Строка | Функция |
|---|---|
| 4350 | `makeZombie(type, level)` |
| 4420 | `ensureZombieCount()` |
| 4520 | `zombiePos(z)` |
| 4560 | `resolveZombieWallMove(z, dt)` |
| 5200 | `selectZombieFenceTarget(z)` |
| 5250 | `selectZombieAttackTargetForZombie(z)` |
| 5300 | `applyFenceSegmentDamage(seg, damage)` |
| 5350 | `getZombieFinalAttackDamage(z)` |
| 5360 | `startZombieDying(z)` |
| 5400 | `stepZombies(dt)` |

### Танки
| Строка | Функция |
|---|---|
| 5700 | `stepTanks(dt)` |
| 5800 | `tankOrbitState(cell, timeSec)` |

### Fence
| Строка | Функция |
|---|---|
| 4600 | `getFenceStats()` |
| 4650 | `tryUpgradeFenceLevel()` |
| 4700 | `estimateFenceMinRadius()` |
| 4750+ | Fence segment math (collision, breach) |
| 5000+ | `rebuildBreachesBySideFromFence()`, `syncFenceBreachForSegment()` |
| 7170 | `restoreFenceSegmentsToMaxHp()` |

### Урон / Числа / Декали
| Строка | Функция |
|---|---|
| 6140 | `formatDamageNumber(value)` |
| 6151 | `addDamageNumber(x, y, value, isCrit)` |
| 6163 | `stepDamageNumbers(dt)` |
| 6175 | `addDecal(d)` |
| 6188 | `stepDecals(dt)` |

### Ящики (Crates)
| Строка | Функция |
|---|---|
| 6207 | `pickCrateRewardLevel()` |
| 6216 | `pickEmptyCell()` |
| 6225 | `spawnCrate()` |
| 6247 | `getCrateAnimation(stateName)` |
| 6252 | `setCrateAnimationState(crate, nextState, resetTime)` |
| 6259 | `syncCrateHoverAt(x, y)` |
| 6272 | `maybeSpawnCrate()` |
| 6279 | `stepCrate(dt)` |
| 6302 | `crateHitTest(x, y)` |
| 8017 | `openCrateModal()` |
| 8042 | `closeCrateModal()` |
| 8053 | `grantCrateTank(level, preferredIndex)` |
| 8074 | `claimCrateReward()` |

### Kill / Respawn / Particles
| Строка | Функция |
|---|---|
| 6310 | `cleanupKills()` |
| 6342 | `particle(x, y, r, color, life)` |
| 6348 | `burst(x, y, count, color)` |
| 6354 | `popText(x, y, text, color)` |
| 6358 | `stepParticles(dt)` |

### Меню / Big Menu
| Строка | Функция |
|---|---|
| 6371 | `setMenuOpen(open)` |
| 6398 | `updateMenuState()` |
| 6407 | `setBigMenuOpen(open)` |
| 6416 | `isBigMenuOpen()` |
| 6420 | `setSessionStartGate(nextValue)` |
| 6425 | `setBigMenuView(mode)` |
| 6440 | `openBigMenuRootView()` |
| 6445 | `openBigMenuLoadView()` |
| 6451 | `getBigMenuSaveMeta()` |
| 6468 | `getBigMenuDefaultSlotName(index)` |
| 6476 | `getBigMenuSlotName(slot, index)` |
| 6482 | `bigMenuSlotHasData(slot)` |
| 6506 | `pad2ForBigMenu(value)` |
| 6512 | `formatDateForBigMenu(ms)` |
| 6519 | `renderBigMenuLoadRows()` |
| 6580 | `parseBigMenuSlotIndexFromNode(node)` |
| 6588 | `loadSlotPayloadForBigMenu(slotIndex)` |
| 6599 | `getBigMenuActionButtons()` |
| 6603 | `setMenuActionButtonSelected(button, selected)` |
| 6613 | `applyBigMenuSelectedState()` |
| 6621 | `markBigMenuButtonActive(buttonId)` |
| 6626 | `removeBigMenuLanguageOutsideListener()` |
| 6632 | `closeBigMenuLanguagePanel()` |
| 6640 | `toggleBigMenuLanguagePanel()` |
| 6660 | `closeBigMenuPanels()` |
| 6671 | `toggleBigMenuPanel(panel)` |
| 6680 | `updateBigMenuVolumeState()` |
| 6684 | `applyBigMenuLanguageSelectedState()` |
| 6820 | `renderBigMenuTexts()` |
| 6870 | `updateBigMenuLoadState()` |
| 6891 | `applyBigMenuLanguage(lang)` |
| 6901 | `setBigMenuActionButtonsDisabled(disabled)` |
| 6909 | `stopAndResetSessionToBigMenu()` |
| 6950 | `resumeSessionRuntime()` |
| 6961 | `startFromBigMenu(mode)` — async |
| 6998 | `initBigMainMenu()` |

### Credits
| Строка | Функция |
|---|---|
| 6694 | `getCreditsRole(item, lang)` |
| 6706 | `loadCreditsData()` — async |
| 6738 | `renderCreditsModalList(items)` |
| 6766 | `closeCreditsModal()` |
| 6779 | `openCreditsModal()` — async |
| 6800 | `hasSaves()` |

### Critical Flow / Restart
| Строка | Функция |
|---|---|
| 7100 | `spawnInitialTanksLvl1(targetState, count)` |
| 7136 | `clearAllTanksFromCells(targetState)` |
| 7170 | `restoreFenceSegmentsToMaxHp()` |
| 7187 | `restoreSupercomputerAfterCritical()` |
| 7197 | `getCriticalModalController()` |
| 7214 | `closeCriticalModal()` |
| 7221 | `resetWorldRuntimeState()` |
| 7231 | `finalizePartialRestartRestore()` |
| 7248 | `restartSimulationPartial()` |
| 7263 | `performCriticalRestart()` |
| 7267 | `handleCriticalSaveAndExit()` |
| 7271 | `openCriticalModal()` |

### UI Update / Modals
| Строка | Функция |
|---|---|
| 7347 | `a11yOpen(modalEl, opts)` |
| 7354 | `a11yClose(modalEl)` |
| 7361 | `updateUI()` |
| 7458 | `updateDismantleButton()` |
| 7464 | `openDismantleModal()` |
| 7491 | `fillDismantleConfirmModal(selectedTankIds)` |
| 7531 | `closeDismantleModal()` |
| 7541 | `confirmDismantle()` |
| 7556 | `toggleDismantleSelection(tankId)` |
| 7562 | `dismantleCheckboxRect(cell)` |
| 7567 | `hitDismantleCheckbox(cell, px, py)` |
| 7572 | `isTankSelectedForDismantle(tankId)` |
| 7647 | `ensureProgressUI()` |
| 7670 | `updateProgressUI()` |
| 7965 | `renderCrateIcon(level)` |
| 7999 | `openResetTalentsModal()` |
| 8007 | `closeResetTalentsModal()` |

### Supercomputer Menu
| Строка | Функция |
|---|---|
| 8106 | `getSupercomputerMenuController()` |
| 8133 | `openSupercomputerMenu()` |
| 8141 | `closeSupercomputerMenu()` |
| 8147 | `supercomputerHitTest(x, y)` |

### Input
| Строка | Функция |
|---|---|
| 8178 | `getPointerPos(evt)` |
| 8184 | `cellAt(x, y)` |
| 8191 | `isLevelModalOpen()` |
| 10252 | `tankOnTrackAt(x, y, timeSec)` |

### Render (draw*)
| Строка | Функция |
|---|---|
| 8409 | `draw()` — main render orchestrator |
| 8439 | `drawZombieAttackOverlay()` |
| 8485 | `drawAttackModeEveningDim()` |
| 8498 | `drawLevelUpVfx()` |
| 8539 | `drawBackground()` |
| 8555 | `drawDecorSpriteAt(d)` |
| 8574 | `drawDecorZombieLayer()` |
| 8606 | `drawDecors()` |
| 8611 | `drawTrack()` (disabled) |
| 8615 | `drawTankTrack()` |
| 8660 | `drawSupercomputerHpBar(sc, hpBarCfg)` |
| 8688 | `drawSupercomputerFallback(sc)` |
| 8708 | `drawSupercomputer()` |
| 8981 | `drawSupercomputerBoostIcons()` |
| 9079 | `drawDrones()` |
| 9091 | `drawZombieFence()` |
| 9225 | `resolveFenceSpriteKeys()` |
| 9249 | `drawFence(br)` |
| 9284 | `clipRoundedRect(targetCtx, x, y, w, h, r)` |
| 9298 | `drawBoard()` |
| 9349 | `drawTankSlot(cell)` |
| 9350 | `getTankStampProgress(tank)` |
| 9356 | `drawTankIconWithStampReveal(cell, cx, cy)` |
| 9361 | `drawOrbitingTanks()` |
| 9370 | `drawTankIcon(x, y, level, mutedSlot)` |
| 9374 | `getOnTrackIconOpacity()` |
| 9383 | `drawTankIconTo(targetCtx, x, y, level, mutedSlot, scaleMul)` |
| 9503 | `computeAuraBand(level)` |
| 9527 | `drawTankAura(x, y, band)` |
| 9587 | `drawTankAuraSprite(x, y, aura)` |
| 9634 | `drawTank(x, y, tank, ghost, rotation, showLevelLabel, isDragPreview)` |
| 9808 | `drawZombies()` |
| 9814 | `drawZombieEntity(z, x, y)` |
| 9821 | `drawZombieSprite(x, y, z)` |
| 9955 | `drawZombieFallback(x, y, z)` |
| 10024 | `drawProjectiles()` |
| 10067 | `drawImpacts()` |
| 10121 | `drawCrate()` |
| 10191 | `drawDecals()` |
| 10201 | `drawDamageNumbers()` |
| 10217 | `drawParticles()` |
| 10240 | `drawHint(text)` |

### Boost Icons / HUD Layout
| Строка | Функция |
|---|---|
| 8742 | `getBoostEffectUntil(def)` |
| 8756 | `getSupercomputerBoostIconsConfig()` |
| 8770 | `collectActiveSupercomputerBoosts(now)` |
| 8794 | `resolveSupercomputerSpriteMetrics(sc)` |
| 8826 | `rectsOverlap(a, b)` |
| 8831 | `ensureSupercomputerBoostLayout(now)` |
| 8918 | `updateSupercomputerHudButtonPosition()` |
| 8971 | `isValidBoostFrame(frame)` |

### Supercomputer runtime
| Строка | Функция |
|---|---|
| 10315 | `stepImpacts(dt)` |
| 10328 | `setSupercomputerWantsBuildTank(wantsBuildTank)` |
| 10337 | `applySupercomputerDamage(baseDamage)` |
| 10375 | `stepSupercomputer(dt)` |

### Helpers
| Строка | Функция |
|---|---|
| 10266 | `getMobileMode()` |
| 10270 | `getFxLevel()` |
| 10275 | `getFxScale()` |
| 10280 | `isFxLite()` |
| 10284 | `isFxUltraLite()` |
| 10288 | `smoothAngle(current, target, amt)` |
| 10293 | `rr(ctx, x, y, w, h, r)` — rounded rect path |
| 10303 | `shade(hex, delta)` |
| 10310 | `seededNoise(x, y)` |

### Main loop
| Строка | Функция |
|---|---|
| 10401 | `scheduleMainLoop()` |
| 10407 | `loop(now)` |

### Debug
| Строка | Функция |
|---|---|
| 10543 | `debugLog(level, msg)` |
| 10559 | `debugReset()` |
| 10579 | `safeDebug(fn, fallbackMsg)` |
| 10586 | `initDebugPanel()` |

---

## 4. Основные объекты / константы

| Строка | Имя | Тип | Описание |
|---|---|---|---|
| 3–5 | `canvas`, `ctx` | DOM/CanvasRenderingContext2D | Основной canvas |
| 6 | `GameApi` | object | Глобальный API (=`window.Game`) |
| 7 | `SeededRngApi` | object | `window.Game.SeededRng` |
| 9–97 | `RuntimeTasks` | IIFE/object | Timer/RAF management |
| 102–177 | `ui` | object | ~80 DOM-ссылок |
| 179 | `MAX_TANK_LEVEL` | const `60` | |
| 180 | `CANNON_UPGRADES_LEVELS` | const `60` | |
| 272 | `CannonUpgradesBalance` | let/object | Нормализованный конфиг пушек |
| 286–375 | `BAL` | object | Основные баланс-параметры |
| 376 | `ACTIVE_ABILITY_DURATION_SEC` | const `6` | |
| 377–382 | `BOOST_EFFECT_DEFS` | array | Определения активных бустов |
| 384–407 | `BASE_BAL` | object | Базовые значения баланса |
| 409 | `BalanceConfig` | let/object | Загруженный баланс (zombie/tank overrides) |
| 447–477 | `settings` | object | Настройки игрока |
| 601 | `state` | let/object | Глобальное состояние игры |
| 602 | `meta` | let/object | `{ lastSeenAt }` |
| 921–963 | `viewSize`, `center` | objects | Canvas dimensions & center point |
| 996 | `SUPERCOMPUTER_FALLBACK_BOUNDS` | object | Fallback размеры суперкомпьютера |
| 997–1015 | `supercomputerHudRuntime` | object | Runtime layout/state для HUD |
| 1590–1610 | `SFX_SOURCES` | object | Маппинг SFX имён → файлов |
| 1695 | `STRINGS` | object | Объект i18n строк |
| 1780–1850 | `ZombieSprites` ... `BulletSprites` | objects | 10 sprite loader instances |
| 1960 | `WorldEventsCfg` | object | Конфиг погоды/атак |
| ~1975 | `worldEventsState` | object | Runtime состояние погоды |
| 2010 | `BASE_CANVAS` | object | `{ w: 1100, h: 650 }` |
| 3650 | `TALENT_BRANCHES` | array | `['Атака', 'Скорость', 'Экономика']` |
| 3660–3680 | `TALENT_LAYOUT`, `TALENT_EDGES` | arrays | Структура дерева талантов |
| 3685 | `TALENT_ROW_POINTS` | const `5` | |
| 3690 | `TALENT_DEFS` | array | 51 определение талантов |
| 4200 | `PROJECTILE_KINDS` | object | `{ ap, he, toxic, tesla }` |
| 6138 | `MAX_DAMAGE_NUMBERS` | const `24` | |
| 9517 | `AuraStyleByBand` | array | 7 стилей ауры по уровню |
| 10394 | `last` | let | `performance.now()` |
| 10396 | `fpsAvg` | let `60` | Скользящее среднее FPS |
| 10398 | `qualityLow` | let `false` | Флаг низкого качества |
| 10540 | `DEBUG_MAX_TANK_LEVEL` | const | = `MAX_TANK_LEVEL` |
| 10541 | `DEBUG_LOG_MAX` | const `100` | |
