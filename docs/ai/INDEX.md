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
- Combat: `docs/ai/SYSTEMS/combat.md`
- Save/Offline: `docs/ai/SYSTEMS/save.md`
- Achievements: `docs/ai/SYSTEMS/achievements.md`
- World Events: `docs/ai/SYSTEMS/worldEvents.md`
- Fence: `docs/ai/SYSTEMS/fence.md`
- Audio: `docs/ai/SYSTEMS/audio.md`
- Telemetry/Flags: `docs/ai/SYSTEMS/telemetry.md`
- Input: `docs/ai/SYSTEMS/input.md`
- Performance: `docs/ai/SYSTEMS/perf.md`

## Текущие UI-акценты
- Меню (big/small): last-click selected state без default selected на первом показе — `docs/ai/SYSTEMS/ui.md`.
- Confirm выхода из small menu: отдельный view `menuExitConfirmView`, переиспользует текущий session-exit flow.
- Small menu Save/Load views: подрежимы `smallMenuSaveView` и `smallMenuLoadView` с общим списком 10 статичных слотов (`1..10`), inline edit имени только в Save для слотов `1..9`.
- Big menu: пункт `Devs` переименован в `Credits/Создатели` и открывает `creditsModal` со списком из `assets/credits.json`.
- Big menu language panel: подкнопки языка рендерятся прямо под кнопкой `Язык/Language`; active состояния `Русский/Английский` зависят только от текущей локали.
- Big menu `Load`: отдельный subview `bigMenuLoadView` внутри big menu (таблица 10 слотов `1..10`, `Назад` → root big menu); при отсутствии сейвов `Load` disabled как project-disabled (`aria-disabled` + `data-disabled-reason="noSaves"`) и показывает unified toast «Нет сохранений/No saves».
- Session start gate: вход в сессию разрешён только через big menu `New` или успешный big menu `Load(slot)`; до этого `Continue` неактивен и big menu остаётся единственным входным экраном.
- Small menu `New`: добавлен confirm-view `menuNewConfirmView` (`Продолжить` стартует New game, `Назад` возвращает в root small menu).
- [Fix] Тесты: исправлены моки для `adminFlags_visibility` и `fenceSquareGeometry`, устранена ложная детекция "zombie road" в `game.js`, поправлена близость кода в `bootstrap.js` для прохождения `newGamePopupReset`.
- Slot storage: `saveSlotsMeta_v1` + `saveSlot_v1_0..9`; legacy `progress` мигрируется в слот 1 (`index 0`) при первой инициализации слотов.
- Слот 10 (`index 9`) зарезервирован под `Auto`; обновляется только autosave при входе supercomputer в critical режим.
- Удалён legacy-виджет пользовательских отзывов из UI и рантайма (small/big menu + modal).
- Achievements modal: accordion single-open с toggler `+`/`−`, по умолчанию всё закрыто при открытии.
- `#supercomputerBtn`: стабильная позиция при press/hover, без transform-конфликта с unified button behavior.
- HUD XP bar: fill фиксирован `#14a13d` без gradient, анимация прогресса только через CSS `width` transition `200–300ms`.
- `#supercomputerBtn`: позиционирование только через `transform`; для кнопки запрещены `transition` по `transform` и `transition: all`.
- Unified disabled toast: `data-disabled-reason="noSaves"` → «Нет сохранений/No saves», иначе «Недоступно/Unavailable»; показ централизован через `src/ui/toast.js`.
- Divider под вкладками `Орудия/Базы/Стены` в `#modsTankWallOverlay`: линия тянется до внутренних краёв рамки без боковых отступов.
- Вкладка `Орудия` в `modsTankWall`: таблица 60 уровней с pending/reserve и apply в `state.player.cannonUpgradesApplied`; pending не сохраняется между открытиями меню.
- `Орудия`: добавлена колонка `Стоимость` (`next / totalSpent`) и поддержка `iconFrames` в `assets/balance/cannonUpgrades.json` для аним-иконок через shared ticker.
- Tank track toggle (`onTrack`) меняется через единый entrypoint `Game.Garage.setTankOnTrack(...)`; user-cause играет `tankToTrack/tankToHangar`, reset/restore-cause подавляет эти SFX.
- On-track dim иконки в слоте настраивается параметром `assets/tanks.json -> ui.onTrackIconOpacity` (нормализация в `TankSprites.config.ui`).
- Merge popup нового уровня танка: локально отключён только right-side hull shot FX через popup-опции preview model/renderer (без spawn right-shot и без его draw); остальные popup FX/SFX и gameplay-эффекты не затронуты.
- Exit из small menu в big menu приводит приложение к состоянию первого запуска через reload shell после очистки transient `progress` (слоты сохранений не удаляются).
- Supercomputer root tiles: 3-в-ряд без переноса, label в одну строку с min font, размер иконок через `--scTileIconSizePx`/`--scTileIconSize` в `style.css`.
- Supercomputer modal: `large` и адаптивная (`.scModal`), со внутренним scroll-контейнером `.scModal__body`; root tile labels auto-shrink до `12px` минимум и защищены `text-overflow: ellipsis`.
- SFX slider preview: template-ассет `assets/sfx/ui_slider_preview_TEMPLATE.ogg`, id `uiSliderPreview`, throttled preview при `input`.
- Merge SFX new max: id `mergeNewMaxLevel` используется только вместо `levelUp` при merge, который повышает `maxLevel` и реально показывает `Game.MergePopup.show(level)`.
- Debug panel: добавлен блок `Damage Points` (доступен при `?debug=1`) с `input number` и `+Add/-Add`, влияющий на реальное save-состояние.

## Важные конфиги
- Critical modal typing: `src/config/criticalModalTuning.js`
- Critical modal audio policy: `src/config/criticalAudioPolicy.js`
- UI SFX параметры (volume/cooldown): `src/config/audioUi.js`
- Баланс апгрейдов орудий: `assets/balance/cannonUpgrades.json` (runtime fallback при ошибках загрузки/валидации)

## Runtime reset (partial)
- Оркестратор partial reset: `src/core/worldReset.js`
- Кнопка `Перезапустить симуляцию`: `src/ui/criticalModal.js` -> `game.js` (`restartSimulationPartial`)
- Контракт: runtime мира сбрасывается как `reset`, но сохраняются achievements/upgrades/mods/supercomputer progression и `drones` progression.
- Позиции дронов не считаются частью snapshot-контракта: после restore выполняется принудительный телепорт к `supercomputer`; при отсутствии валидных координат `supercomputer` используется fallback `(0, 0)` без throw.
- После partial restore обязательно принудительно сбрасываются `attackMode` runtime (таймеры/мультипликаторы) и zombie target к дефолту из `assets/zombies.json`.
