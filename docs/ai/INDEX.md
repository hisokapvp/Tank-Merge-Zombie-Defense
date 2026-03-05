# Индекс документации для агента

## Порядок чтения
1. `docs/ai/STYLE.md`
2. `docs/ai/ARCHITECTURE.md`
3. Целевой файл из `docs/ai/SYSTEMS/*.md`
4. При типовой задаче  соответствующий `docs/ai/PLAYBOOKS/*.md`

## Карта систем
- UI: `docs/ai/SYSTEMS/ui.md`
- Render/Canvas: `docs/ai/SYSTEMS/render.md`
- Assets/JSON: `docs/ai/SYSTEMS/assets.md`
- Talents v2 data + runtime API: `docs/talents_v2.md`
- Talents v2 UI integration (3 ветки одновременно/actives/status icons): `docs/ui_talents_v2.md`
- Combat: `docs/ai/SYSTEMS/combat.md`
- Save/Offline: `docs/ai/SYSTEMS/save.md`
- Achievements: `docs/ai/SYSTEMS/achievements.md`
- World Events: `docs/ai/SYSTEMS/worldEvents.md`
- Fence: `docs/ai/SYSTEMS/fence.md`
- Audio: `docs/ai/SYSTEMS/audio.md`
- Telemetry/Flags: `docs/ai/SYSTEMS/telemetry.md`
- Input: `docs/ai/SYSTEMS/input.md`
- Performance: `docs/ai/SYSTEMS/perf.md`

## Extraction status (2026-02-25)
- Big Menu runtime вынесен в `src/ui/bigMenuRuntime.js` (делегирование из `game.js`, API имён сохранён).
- World Events runtime вынесен в `src/systems/worldEventsRuntime.js`.
- Zombie rendering вынесен в `src/render/zombieRender.js`.
- Crate runtime вынесен в `src/mechanics/crateRuntime.js`.
- SFX pool runtime вынесен в `src/audio/sfxPoolRuntime.js`.
- Talents v2 runtime добавлен в `src/systems/talents/talentsV2.js` (`Game.TalentsV2`).
- Talents v2 PACK 3: добавлены entity runtime-структуры (`_talentRt/_statusRt/_defRt`), timing helpers, DOT tick engine (`tickStatuses`) и ramp state helper (`_onShotCounterAndRamp`).
- Talents v2 PACK 4: реализованы offense hooks (`onShotFired`, `onHit`) с per-shot procs/ICD, рикошет-цепочка (`extraHits`) без secondary procs и реальный DOT apply (`_applyDotDamage`) с HP-снятием без tank attribution.
- Talents v2 PACK 5: добавлены run-runtime (`TalentsV2._runRt`), defense/economy hooks (`onWallDamage`, `onUpdate`, `onKill`, `onShotReward`, `onBuyTank`, `onPurchase`, `onOverkill`, `onWaveStart/End`) и runtime API активок (`activateDefenseActive`, `activateEconomyActive`) с recharge через catch-up `while`.
- Talents v2 PACK 6: UI дерева переведён на `Game.TalentsV2` (3 ветки одновременно + SVG-связи по legacy-layout 3-3-3-3-2-2-1 + canBuy reason), active HUD использует `getActiveState(...)`, в world-render подключён `renderStatusIcons(...)` (limit=3, приоритеты status).
- Talents v2 PACK 7: добавлена миграция legacy save v1 -> v2 по `talentsVersion` (`<2` или отсутствует) с fail-soft extract adapter, canonical map `MIGRATE_V1_TO_V2`, refund unknown и немедленным persist результата (`talentsVersion=2`).
- Talents v2 PACK 8: добавлены строгая validation/reporting (`TalentsV2.validate()`), контрактная проверка `mods`, anti-freeze guard’ы catch-up `while` (DOT/ramp/recharge/interest), debug toggles (`debug_dtScale`, `debug_fixedDtMs`, `talents_debug_*`), `debugDump()` и debug overlay в бою.
- Talents v2 PACK 9: `canBuy` переведён на строгий row-gating legacy-layout `3-3-3-3-2-2-1` (ряды `0/5/10/15/20/25/30` по spent в ветке) + обязательный prereq из предыдущего ряда (rank >= 1); V2 UI перестал пересоздавать talent-nodes каждый тик (signature-based render), что устраняет hover-SFX spam и потерю click при покупке.
- Talents v2 runtime integration fix: `game.js/getMods()` теперь использует `Game.TalentsV2.getMods()` через legacy-adapter (`damage/fireRate/range/aoe`, `tankBuyCostMul`, `coinsKillMul/coinsShotMul`, `xpMul`), поэтому эффекты v2 реально влияют на бой и экономику.
- Talents v2 active slots (stage HUD): иконки активок берутся из talentTree v2 (`assets/ui/icons/talents/*` через `Game.TalentsV2.getTalentUi`) для веток offense/defense/economy; legacy stage active icons больше не источник для v2.
- Talents v2 status icons: над танками/зомби добавлен expiry-progress без чисел — иконки постепенно закрашиваются белым к окончанию эффекта.
- Stage active HUD (v2): в бою для активок показываются корректные tooltip (название+описание+заряды+перезарядка), бейдж зарядов в правом верхнем углу, секундный таймер перезарядки всегда (в т.ч. при оставшихся зарядах) и секторная заливка cooldown по часовой стрелке из центра иконки (черная полупрозрачная при `charges>0`, белая при `charges=0`).
- Stage active HUD/tooltips: нативные `title` для talent nodes/active slots заменены на unified in-game tooltip (`#settingsTooltip` + `data-ui-tooltip`), чтобы исключить браузерные чёрные подсказки и сохранить единый стиль UI.
- Stage active HUD: бейдж зарядов активок всегда видим (не зависит от hover-анимации кнопки), cooldown-сектор стартует сверху (`12 o'clock`).
- Main menu sound settings: добавлен флаг `Автопауза при неактивной вкладке / Auto-pause on inactive tab`; default `OFF` (`settings.autoPauseOnInactive=false`).
- Big menu root view: добавлен дублирующий toggle `Автопауза при неактивной вкладке` (вне `Sound` subpanel), синхронизированный с `settings.autoPauseOnInactive`.
- Talents v2 overlay: базовые SVG-связи (`.talentEdge`) усилены по контрасту и видны даже до первой прокачки таланта.
- Stage active HUD: увеличен размер бейджа зарядов (`font-size` и габариты), чтобы значение зарядов читалось без приближения.
- QA чеклист Talents v2 вынесен в `docs/qa_talents_v2.md`.
- Talents v2 layout contract: `Game.TalentsV2.getTalentsByBranch()` теперь возвращает `node.layout` (`row/slot/parents`); `game.js/getTalentNodeLayoutV2()` сначала использует API-layout и только затем fallback на `TALENT_LAYOUT`.
- Talents v2 edges: базовые `.talentEdge` видимы сразу после `New game`.
- Supercomputer root tiles: `.scRootTiles` переведён на grid (3 колонки), а высота карточек нормализуется через `--scRootTileUniformHeight` + `normalizeRootTilesSize()`.
- Supercomputer root tiles: `.scRootTile__icon` переведён в полноразмерный фон карточки (`inset:0`, `background-size:cover`), подпись остаётся поверх (readable label).
- Supercomputer root tiles: подпись `.scRootTile__label` прижата к нижней части карточки (`margin-top:auto`), чтобы labels root-плашек стабильно стояли внизу.
- Hangar slot stamp reveal: `makeTank(..., options)` записывает `stampStartSec`; в `drawTankSlot` применён reveal-штамп на 10 полос; длительность берётся из `assets/tanks.json -> tankPrintDurationSec` (fallback `1.5s`); при `restoreFullState` штамп отключается (`enableStamp:false`).
- Tank printing guard: печатающийся танк не участвует в `drag/merge/auto-merge/onTrack` до завершения печати (`isTankPrinting`).
- Hangar render: тени танков в ангарных слотах отключены (`showShadow:false` в slot-render).
- Talents v2 edges: при `openTalents/closeTalents` и изменении видимого layout выполняется инвалидация кэша геометрии связей (fix скрытия линий после `New/Load`).
- Supercomputer root tiles: размер root-плашек (`width/height`) берётся из `src/config/layoutTuning.js` (`supercomputerTileWidthPx`, `supercomputerTileHeightPx`) и прокидывается в CSS-переменные `--scRootTileWidthPx/--scRootTileHeightPx`; таблицы `Орудия/Стены` остаются на `--scTableTile*`.
- `modsTankWall` (`Орудия`/`Стены`): колонка `Стоимость` показывает только `nextStepCost` (без `totalSpent`).
- `modsTankWall`: действия `+/-` собраны в вертикальный стек `.scGunsActionStepper`.
- `modsTankWall` и stats-таблицы: целые значения в `attackSpeed/armor` и связанных статах показываются без `.00`.
- Stage active HUD: hover не смещает слот и charge-бейдж (бейдж стабильно в правом верхнем углу).
- Debug panel `Logs&Tools`: удалены `Reset (statuses + VFX)`, `Clear log`, `Lesson Progress` и их обработчики; оставлен telemetry mount.

## Текущие UI-акценты
- Меню (big/small): last-click selected state без default selected на первом показе — `docs/ai/SYSTEMS/ui.md`.
- Confirm выхода из small menu: отдельный view `menuExitConfirmView`, переиспользует текущий session-exit flow.
- Small menu Save/Load views: подрежимы `smallMenuSaveView` и `smallMenuLoadView` с общим списком 10 статичных слотов (`1..10`), inline edit имени только в Save для слотов `1..9`.
- Big menu: пункт `Devs` переименован в `Credits/Создатели` и открывает `creditsModal` со списком из `assets/credits.json`.
- Big menu language panel: подкнопки языка рендерятся прямо под кнопкой `Язык/Language`; active состояния `Русский/Английский` зависят только от текущей локали.
- Big menu `Load`: отдельный subview `bigMenuLoadView` внутри big menu (таблица 10 слотов `1..10`, `Назад` → root big menu); при отсутствии сейвов `Load` disabled как project-disabled (`aria-disabled` + `data-disabled-reason="noSaves"`) и показывает unified toast «Нет сохранений/No saves».
- Session start gate: вход в сессию разрешён только через big menu `New` или успешный big menu `Load(slot)`; до этого `Continue` неактивен и big menu остаётся единственным входным экраном.
- Small menu `New`: добавлен confirm-view `menuNewConfirmView` (`Продолжить` стартует New game, `Назад` возвращает в root small menu).
- Confirm (`Exit`/`New`): на первом рендере нет default selected; selected появляется только после явного выбора (клик/клавиатурная навигация/подтверждение на фокусе).
- [Fix] Тесты: исправлены моки для `adminFlags_visibility` и `fenceSquareGeometry`, устранена ложная детекция "zombie road" в `game.js`, поправлена близость кода в `bootstrap.js` для прохождения `newGamePopupReset`.
- Slot storage: `saveSlotsMeta_v1` + `saveSlot_v1_0..9`; legacy `progress` мигрируется в слот 1 (`index 0`) при первой инициализации слотов.
- Слот 10 (`index 9`) зарезервирован под pre-retry autosave: создаётся при входе supercomputer в critical-эпизод (один раз за эпизод), в Load отображается через i18n (`save.autoRetryName`), в Save недоступен для ручного save/rename/delete.
- Удалён legacy-виджет пользовательских отзывов из UI и рантайма (small/big menu + modal).
- Achievements modal: accordion single-open с toggler `+`/`−`, по умолчанию всё закрыто при открытии.
- `#supercomputerBtn`: стабильная позиция при press/hover, без transform-конфликта с unified button behavior.
- HUD XP bar: fill фиксирован `#14a13d` без gradient, анимация прогресса только через CSS `width` transition `200–300ms`.
- `#supercomputerBtn`: позиционирование только через `transform`; для кнопки запрещены `transition` по `transform` и `transition: all`.
- Unified disabled toast: `data-disabled-reason="noSaves"` → «Нет сохранений/No saves», иначе «Недоступно/Unavailable»; показ централизован через `src/ui/toast.js`.
- Divider под вкладками `Орудия/Стены` в `#modsTankWallOverlay`: линия тянется до внутренних краёв рамки без боковых отступов.
- `modsTankWall`: вкладка `Базы` удалена из `index.html`, `src/ui/supercomputerMenu.js` и i18n/fallback-строк.
- Вкладка `Орудия` в `modsTankWall`: таблица 60 уровней с pending/reserve и apply в `state.player.cannonUpgradesApplied`; pending не сохраняется между открытиями меню.
- `Орудия`: колонка `Стоимость` показывает только `nextStepCost`; поддержка `iconFrames` в `assets/balance/cannonUpgrades.json` используется для аним-иконок через shared ticker.
- `modsTankWall` таблицы (`Орудия/Стены`): строки и ячейки центрированы по вертикали/горизонтали, увеличена базовая sprite-колонка и высота строк под текущий `weaponIconW/H`, чтобы иконки не наезжали на соседние строки.
- `Орудия`: в `src/config/layoutTuning.js` добавлены per-level массивы `weaponIconAnimFramesByLevel` и `weaponIconAnimFpsByLevel` (L1..L60) для ручной настройки кадров и fps.
- `Стены`: preview-иконки уровней берутся из `assets/fence.json -> levels[]` с приоритетом `uiIcon.frame.id` -> `uiIcon.frame` -> `uiIcon.frameId` -> `uiFrameId` -> `sideTop`, atlas по `uiIcon.atlas`/fallback-цепочке.
- Tank track toggle (`onTrack`) меняется через единый entrypoint `Game.Garage.setTankOnTrack(...)`; user-cause играет `tankToTrack/tankToHangar`, reset/restore-cause подавляет эти SFX.
- On-track dim иконки в слоте настраивается параметром `assets/tanks.json -> ui.onTrackIconOpacity` (нормализация в `TankSprites.config.ui`).
- Merge popup нового уровня танка: локально отключён только right-side hull shot FX через popup-опции preview model/renderer (без spawn right-shot и без его draw); остальные popup FX/SFX и gameplay-эффекты не затронуты.
- Exit из small menu в big menu приводит приложение к состоянию первого запуска через reload shell после очистки transient `progress` (слоты сохранений не удаляются).
- Supercomputer root tiles: grid 3 колонки, label с переносом строк (`white-space: normal` + `overflow-wrap`), полноразмерный background-икон слой карточки и унификация высоты через `--scRootTileUniformHeight` в `style.css`.
- Supercomputer modal: `large` и адаптивная (`.scModal`), со внутренним scroll-контейнером `.scModal__body`; root tile labels поддерживают перенос строк и остаются читаемыми на узких экранах.
- Supercomputer modal: pressed-состояние кнопок только через `transform` (без layout shift), body-scroll lock обязателен на всём жизненном цикле SC overlay, scrollbar `.scModal__body` стилизован по эталону audio slider.
- Supercomputer overlays: hover-sheen (`.btn::after`) отключён внутри SC/Talents overlays, чтобы не появлялся белый прямоугольник при hover.
- Supercomputer overlays: для `modsTankWall` скролл оставлен в `#modsTankWallOverlay .scModal__body`; для root/hangar body скролл отключён, чтобы не появлялся лишний scrollbar.
- `modsTankWall` panel: размер приведён к `talentTreeModal`-паттерну (`width:min(980px,95vw)`, `max-height:86vh`) для консистентной геометрии.
- SC/Talents modal buttons: для pressed-состояния отключён `translateY` в модалках (`transform:none`), чтобы исключить transient scrollbar при удержании кнопок/плашек.
- UI shadows: базовые тени UI-элементов (кнопки/панели/модалки/уведомления/debug/lesson panel) сведены к тонким значениям с Y-offset не более `3px`; pressed-state — до `2px`.
- Critical restart (`Перезапустить симуляцию`): post-load нормализация очищает текущие танки/зомби, спавнит 1 стартовый танк `lvl1` и восстанавливает default zombie/attack runtime.
- Critical restart (`HP <= 5%`): при `Перезапустить симуляцию` сохраняются progress-апгрейды (`talents/mods/cannon/fence/drones/achievements`) из auto-slot snapshot; сбрасывается только runtime мира.
- AttackMode supplemental spawn: базовый sideCount-спавн сохраняется до `baseDesiredAlive`, а только attackMode-добавка (до `attackDesiredAlive`) идёт по эпизодным направлениям `dirA/dirB/dirC` с 50/25/25 и анти-повтором `dirA` (не более 2 эпизодов подряд).
- Corpse despawn/fade: таймер трупа считается как `deathAnimDuration + corpseDespawnSec` из `assets/zombies.json`; в конце жизни трупа применяется linear fade на `corpseFadeOutSec`, forced culling не удаляет мгновенно, а ускоряет fade до `~0.2s`.
- Fence sprite hot-refresh: tier стен синхронизируется с `maxTankLevelAchieved`/runtime max в текущей симуляции (не только по popup-событию), применяясь one-shot на изменение tier с `FenceSprites.ensureLevel(...)`.
- Partial restart (`Перезапустить симуляцию`): после restore сбрасываются `buyCounts/buyPrices`, `maxTankLevelAchieved/runtimeMax/currentFenceTierApplied/fenceLevel` в `1`, затем выполняется force-sync tier стен и force-off reset attackMode/runtime.
- Post-restore helper: `finalizePartialRestartPostRestore(stateRef, { preserveProgression, forceFenceRuntimeReset })` поддерживает режим сохранения прогрессии; для critical restart используется `preserveProgression:true` + `forceFenceRuntimeReset:true` (fence runtime: L1 -> force-sync tier по `maxTankLevelAchieved`).
- New game/reset: выполняется `FenceSprites.ensureLevel(1)` для гарантированного возврата атласа fence к L1.
- Zombie breach targeting: детект пролома использует расширенный hit-test (padding от радиуса зомби); знание о проломе ограничено радиусом `WorldEvents.attackMode.fenceBreachAwarenessRadiusPx` вокруг бреши.
- Zombie breach targeting: пока зомби «знает» о проломе, он не выбирает целые fence-сегменты как attack-target и уходит в брешь; вне радиуса awareness продолжает стандартную атаку стены.
- Fence destruction cascade: при разрушении одной side-секции автоматически ломаются две смежные секции этой же стороны (`sideIndex-1` и `sideIndex+1`, если существуют); при разрушении corner-секции ломается по одной прилегающей side-секции с каждой стороны угла.
- Supercomputer root tiles: root-плашки и modal-кнопки не должны клиппить тени/hover-scale; для root-сетки обязателен запас по краям (`overflow:visible` + внутренние отступы в body).
- Supercomputer root icon tuning: размер иконок root-плашек задаётся из `src/config/layoutTuning.js` через `supercomputerTileIconSizePx` (baseline `250`).
- Supercomputer weapons source frame: источник кадра для оружейных иконок в tab `Орудия` задаётся фиксированным размером `128x128` через `layoutTuning` (`weaponIconSpriteFrameW/H`).
- Stage actions: удалены `#boost` и `#boostModal`; ad-speed boost больше не имеет отдельной кнопки/модалки.
- SFX slider preview: template-ассет `assets/sfx/ui_slider_preview_TEMPLATE.ogg`, id `uiSliderPreview`, throttled preview при `input`.
- Track loop SFX: `trackLoop` стартует/стопается от факта наличия танка на трассе (`state.cells[].tank.onTrack`) и pause-state; громкость задаётся кодовым множителем `AudioUi.TANK_DRIVE_VOLUME_MULT` (без UI-слайдера).
- Merge SFX new max: id `mergeNewMaxLevel` используется только вместо `levelUp` при merge, который повышает `maxLevel` и реально показывает `Game.MergePopup.show(level)`.
- Debug panel: добавлен блок `Damage Points` (доступен при `?debug=1`) с `input number` и `+Add/-Add`, влияющий на реальное save-состояние.
- Debug panel tabs обновлены: удалены `Zombies`, `Roads/Hangar`, `Actives`, `Talents`; добавлен таб `Updates` (начисление `talent points` и `damage points` по кнопке `Окей`).
- Debug panel `Effects`: удалены кнопки `Burst center`, `Particle burst`, `Impact ring`, `Decal Pool`, `Stop all preview VFX`, `Clear debug statuses` и связанный код.
- Zombie extra VFX policy: дополнительные zombie aura/glow/ring отключены в `src/render/zombieRender.js` через кодовый флаг `DISABLE_ZOMBIE_AURAS` (без правок `assets/zombies.json`).
- Supercomputer weapons icons: единый поворот настраивается константой `WEAPON_ICON_ROT_DEG` в `src/ui/supercomputerMenu.js`.

## Важные конфиги
- Critical modal typing: `src/config/criticalModalTuning.js`
- Critical modal audio policy: `src/config/criticalAudioPolicy.js`
- UI SFX параметры (volume/cooldown): `src/config/audioUi.js`
- Layout tuning (иконки/спрайты/плашки): `src/config/layoutTuning.js` (`supercomputerTileIconSizePx`, `supercomputerTileWidthPx`, `supercomputerTileHeightPx`, `weaponIconW`, `weaponIconH`, `weaponIconSpriteFrameW/H`)
- Fence preview кадры в supercomputer: `assets/fence.json` (`levels[].uiIcon.{atlas,frame|frameId}` / `levels[].uiFrameId`, fallback `sideTop`)
- Баланс апгрейдов орудий: `assets/balance/cannonUpgrades.json` (runtime fallback при ошибках загрузки/валидации)

## Инструменты балансировки
- **Balance Editor (HTML Dashboard):** `tools/balance-editor.html` — визуальный редактор всех balance JSON с графиками, формулами прогрессии, diff-preview и экспортом. Открывать из корня проекта через `http-server` или `Live Server`.
- **Balance Simulator (CLI):** `tools/balance-sim.js` — headless-симулятор боя (Node.js). Анализирует DPS/TTK, difficulty curve, breakpoints, wall survival. Запуск: `node tools/balance-sim.js --help`.

## Runtime reset (partial)
- Оркестратор partial reset: `src/core/worldReset.js`
- Кнопка `Перезапустить симуляцию`: `src/ui/criticalModal.js` -> `game.js` (`restartSimulationPartial`)
- Контракт: runtime мира сбрасывается как `reset`, но сохраняются achievements/upgrades/mods/supercomputer progression и `drones` progression.
- Позиции дронов не считаются частью snapshot-контракта: после restore выполняется принудительный телепорт к `supercomputer`; при отсутствии валидных координат `supercomputer` используется fallback `(0, 0)` без throw.
- После partial restore обязательно принудительно сбрасываются `attackMode` runtime (таймеры/мультипликаторы) и zombie target к дефолту из `assets/zombies.json`.
