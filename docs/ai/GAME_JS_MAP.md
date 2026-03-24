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
- Визуал ангара: `drawTankSlot(...)` использует stamp-reveal (`drawTankIconWithStampReveal`) на `10` полос; длительность берётся из `assets/tanks.json -> tankPrintDurationSec` (fallback `1.5s`); при restore сейва stamp отключён (`makeTank(..., { enableStamp:false })`).
- Critical restart (`HP <= 5%`): snapshot сохраняет Talents v2 (`player.talentsV2.ranksById/freePoints` + `freeTalentPointsV2`) и post-restore выполняет reset fence runtime до L1 с последующим force-resync tier по сохранённому `maxTankLevelAchieved`.

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
| 13385–13386 | `DEBUG_MAX_TANK_LEVEL`, `DEBUG_LOG_MAX` |

### State / Начальное состояние
| Диапазон | Описание |
|---|---|
| 447–477 | Settings defaults, audio controller vars, boot state variables |
| 478–606 | `createInitialState()`, `state = createInitialState()`, `meta` |
| 607–774 | Damage progress, cannon upgrade cost/apply, `GameApi.getDamagePoints` |
| 775–870 | Supercomputer state management (`getComputerState`, `getComputerLevel`) |
| 872–920 | Map seeds, debug panel flag, zombie overlay toggle |
# game.js — карта монолита

> Обновлено: 2026-03-07.
> Текущая длина файла: ~11 880 строк. Диапазоны ниже точны для ключевых entrypoint'ов и «горячих» зон; для вторичных блоков держите в уме, что это рабочая карта, а не полный line-by-line dump.

## Что это
`game.js` остаётся главным bootstrap/runtime-монолитом проекта: здесь живут глобальные aliases `window.Game`, world loop, render orchestration, часть fallback-логики, UI wiring и интеграция всех extracted модулей из `src/*`.

## Быстрый старт для агента
- Нужен boot / asset wiring → [boot()](../../game.js#L11714-L11885)
- Нужен world loop → [loop()](../../game.js#L11460-L11713)
- Нужен render order → [draw()](../../game.js#L9339-L9398)
- Нужны v2 stage active icons / HUD slots → [getTalentV2ActiveIconByBranch()](../../game.js#L3759-L3772), [getTalentV2ActiveIconUrlByBranch()](../../game.js#L3800-L3802), [updateTalentAbilitySlotsV2()](../../game.js#L8688-L8827), [updateStageAbilitySlots()](../../game.js#L8829-L8838)
- Нужен Talents v2 redraw/update orchestration → `updateTalentUIV2()` делегирует orchestration в `src/ui/talentOverlayUi.js`, а `game.js` оставляет bootstrap/fallback helpers для node/edge render.
- Нужен supercomputer render → [drawSupercomputerSpriteClip()](../../game.js#L9699-L9724), [drawSupercomputerHpBarOverlay()](../../game.js#L9750-L9755), [drawSupercomputer()](../../game.js#L9774-L9794)
- Нужен production line / buildTank hook → [setSpriteSource() wiring](../../game.js#L1869-L1875), [initBoard() layout sync](../../game.js#L2314-L2328), [performTankPurchaseOnce()](../../game.js#L3289-L3307), [kill hook](../../game.js#L5902-L5917), [setSupercomputerWantsBuildTank()](../../game.js#L11374-L11382)

## Инварианты ⚠️
- Новая логика по возможности живёт в `src/*`; `game.js` — bootstrap/fallback glue.
- `draw()` не мутирует gameplay-state; render side-effects выносятся в step/runtime-модули.
- HP bar суперкомпьютера рисуется последним overlay, отдельно от root sprite.
- Stage active slots Talents v2 резолвят branch-icon из `TalentsV2.getTalentUi(...).icon` через `getTalentV2ActiveIconUrlByBranch()`; CSS `activeOff/activeDef/activeEco` в `style.css` — fallback, не primary source.
- Tutorial runtime за пределами `game.js` использует правило first available incomplete tutorial step; skip-ahead баги нужно чинить в `src/ui/tutorialRuntime.js`/`src/config/tutorialSteps.js`, а не перестановкой поздних UI-completion hooks в монолите.

## Ключевые блоки файла
| Блок | Строки | Назначение |
|---|---|---|
| Canvas / aliases / DOM refs | [game.js](../../game.js#L1-L109) | `canvas`, `ctx`, `window.Game`, `ui` |
| Баланс / апгрейды / начальное состояние | [game.js](../../game.js#L110-L815) | `BAL`, cannon/fence/dron upgrades, `createInitialState()` |
| Supercomputer state / sim clock / API refs | [game.js](../../game.js#L816-L1013) | `getComputerState()`, seeds, debug flag, world helpers |
| i18n / settings / audio / sprite wiring | [game.js](../../game.js#L1014-L1875) | language, audio, `SupercomputerSprites`, loader wiring |
| Board / layout / production line placement | [game.js](../../game.js#L2244-L2334) | `initBoard()`, SC world position, `ProductionLineRender.updateLayout()` |
| Core combat pipeline | [game.js](../../game.js#L5918-L6961) | `stepZombies`, `stepTanks`, `spawnProjectile`, `impactAt`, `cleanupKills` |
| Menu / restore / critical restart / UI wiring | [game.js](../../game.js#L7107-L8838) | big menu, restartSimulationPartial, talents UI wiring, stage active HUD slots |
| World render | [game.js](../../game.js#L9339-L11278) | `draw()`, supercomputer, board, tanks, projectiles, HUD world overlay |
| Step tail / loop / boot | [game.js](../../game.js#L11425-L11885) | `stepSupercomputer`, `loop`, `boot` |

## Функциональное оглавление

### Bootstrap / state / runtime API
| Функция | Строки | Назначение |
|---|---|---|
| `computePowerTier()` | [game.js](../../game.js#L113-L125) | Power-tier helper |
| `createInitialState()` | [game.js](../../game.js#L454-L514) | Стартовое состояние мира |
| `getDamagePoints()` / `applyCannonUpgrade()` | [game.js](../../game.js#L572-L693) | Damage points и апгрейды |
| `getComputerState()` / `getComputerLevel()` | [game.js](../../game.js#L818-L851) | Доступ к runtime суперкомпьютера |

### Layout / world init
| Функция | Строки | Назначение |
|---|---|---|
| `initBoard()` | [game.js](../../game.js#L2244-L2334) | Геометрия карты, fence, supercomputer, production line layout |
| `getTankPrintDurationSec()` | [game.js](../../game.js#L2744-L2756) | Единая длительность печати/штампа из `assets/tanks.json` |
| `makeTank()` | [game.js](../../game.js#L2725-L2794) | Создание танка, включая stamp/runtime flags |
| `performTankPurchaseOnce()` | [game.js](../../game.js#L3289-L3307) | Покупка танка и старт окна `buildTank` у суперкомпьютера |
| `getTalentV2ActiveIconByBranch()` / `getTalentV2ActiveIconUrlByBranch()` | [game.js](../../game.js#L3759-L3802) | Branch → active talent icon key/url для stage HUD |

### Combat / cleanup hooks
| Функция | Строки | Назначение |
|---|---|---|
| `restoreFullState()` | [game.js](../../game.js#L4179-L4580) | Полное восстановление сейва / post-restore sync |
| `stepZombies()` | [game.js](../../game.js#L5918-L6166) | Zombie AI / movement / fence interaction |
| `stepTanks()` | [game.js](../../game.js#L6167-L6538) | Танки, таргетинг, стрельба |
| `spawnProjectile()` | [game.js](../../game.js#L6539-L6638) | Projectile pool / init |
| `impactAt()` | [game.js](../../game.js#L6639-L6960) | Impact effects / damage application |
| `cleanupKills()` | [game.js](../../game.js#L6961-L7106) | Награды за убийство, XP, conveyor work trigger |

### UI / reset / menus
| Функция | Строки | Назначение |
|---|---|---|
| `setBigMenuOpen()` | [game.js](../../game.js#L7107-L7462) | Big menu open/close wiring |
| `initBigMainMenu()` | [game.js](../../game.js#L7463-L7741) | Root menu event wiring |
| `restartSimulationPartial()` | [game.js](../../game.js#L7742-L7760) | Partial restart orchestration |
| `applyCriticalRestartPostLoad()` | [game.js](../../game.js#L7761-L7870) | Critical restart post-load normalization |
| `resetGameState()` | [game.js](../../game.js#L7875-L7952) | Full reset; `new_game` path даёт baseline `computerLevel=0`, `xpToNext=50`, free talent points = `0` |
| `updateTalentAbilitySlotsV2()` / `updateStageAbilitySlots()` | [game.js](../../game.js#L8688-L8838) | Runtime icon wiring, charge badges, cooldown fill и HUD slot delegation |
| `updateTalentUI()` | [game.js](../../game.js#L8822-L9338) | Talents DOM refresh / HUD slots |

### Render / world draw
| Функция | Строки | Назначение |
|---|---|---|
| `draw()` | [game.js](../../game.js#L9339-L9398) | Main render orchestrator |
| `drawBackground()` / `drawTankTrack()` | [game.js](../../game.js#L9490-L9568) | Фон и track |
| `drawSupercomputerSpriteClip()` | [game.js](../../game.js#L9699-L9724) | Root sprite + animation effects |
| `drawSupercomputerHpBar()` / `drawSupercomputerHpBarOverlay()` | [game.js](../../game.js#L9725-L9755) | Финальный HP overlay |
| `drawSupercomputer()` | [game.js](../../game.js#L9774-L9794) | Root supercomputer draw |
| `renderFenceHpBars()` | [game.js](../../game.js#L10331-L10350) | Fence HP bars поверх зомби/трупов |
| `drawBoard()` | [game.js](../../game.js#L10460-L10520) | Hangar cells / board |
| `drawTankSlot()` / `drawTankIconWithStampReveal()` | [game.js](../../game.js#L10521-L10585) | Hangar slot visuals |
| `drawProjectiles()` | [game.js](../../game.js#L11032-L11073) | Projectiles |
| `drawDrones()` | [game.js](../../game.js#L10152-L10330) | Drone render |

### Loop / boot
| Функция | Строки | Назначение |
|---|---|---|
| `stepSupercomputer()` | [game.js](../../game.js#L11425-L11459) | Supercomputer state tick |
| `loop()` | [game.js](../../game.js#L11460-L11713) | Step + draw + runtime sync |
| `boot()` | [game.js](../../game.js#L11714-L11885) | Загрузка JSON, sprites, bootstrap controllers |

## Горячие зоны от 2026-03-06
- `SupercomputerSprites` → `ProductionLineRender` wiring: [game.js](../../game.js#L1869-L1875)
- Layout sync production line к суперкомпьютеру: [game.js](../../game.js#L2314-L2328)
- Talents v2 stage active icon resolution и HUD-slot wiring: [game.js](../../game.js#L3759-L3802), [game.js](../../game.js#L8688-L8838)
- Purchase-driven `buildTank` FX window: [game.js](../../game.js#L3289-L3307), [game.js](../../game.js#L11374-L11382)
- Kill-driven conveyor work trigger: [game.js](../../game.js#L5902-L5917)
- Draw order + финальный HP overlay: [game.js](../../game.js#L9339-L9398)
- Root supercomputer effects / hp overlay helpers: [game.js](../../game.js#L9699-L9794)

## Связанные map-файлы
- `docs/ai/SPRITE_LOADERS_MAP.md`
- `docs/ai/SUPERCOMPUTER_MENU_MAP.md`
- `docs/ai/HANGAR_CHIPS_UI_MAP.md`
- `docs/ai/STYLE_CSS_MAP.md`
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
| 5715 | `zombieFenceLimit(z)` |

### Танки
| Строка | Функция |
|---|---|
| 5700 | `stepTanks(dt)` |
| 5800 | `tankOrbitState(cell, timeSec)` |

### Fence
| Строка | Функция |
|---|---|
| 2655 | `ensureFenceTierRuntimeState(stateRef)` |
| 4600 | `getFenceStats()` |
| 4650 | `tryUpgradeFenceLevel()` |
| 4700 | `estimateFenceMinRadius()` |
| 4750+ | Fence segment math (collision, breach) |
| 5000+ | `rebuildBreachesBySideFromFence()`, `syncFenceBreachForSegment()` |
| 5381 | `getNearestKnownBreachForZombie(sideKey, localX, localY, awarenessRadiusPx)` |
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
| 7957 | `pickCrateRewardLevel()` |
| 7961 | `pickEmptyCell()` |
| 7965 | `spawnCrate()` |
| 7969 | `getCrateAnimation(stateName)` |
| 7973 | `setCrateAnimationState(crate, nextState, resetTime)` |
| 7977 | `syncCrateHoverAt(x, y)` |
| 7981 | `maybeSpawnCrate()` |
| 7985 | `stepCrate(dt)` |
| 7989 | `crateHitTest(x, y)` |
| 10108 | `openCrateModal()` |
| 10132 | `closeCrateModal()` |
| 10143 | `grantCrateTank(level, preferredIndex)` |
| 10168 | `claimCrateReward()` |

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
| 10003 | `renderCrateIcon(level)` |
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
| 12667 | `drawCrate()` |
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
| 13385 | `DEBUG_MAX_TANK_LEVEL`, `DEBUG_LOG_MAX` |
| 13388 | `debugLog(level, msg)` |
| 13403 | `debugReset()` |
| 13423 | `safeDebug(fn, fallbackMsg)` |
| 13432 | `initDebugPanel()` |

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
| 13385 | `DEBUG_MAX_TANK_LEVEL` | const | = `MAX_TANK_LEVEL` |
| 13386 | `DEBUG_LOG_MAX` | const `100` | |
