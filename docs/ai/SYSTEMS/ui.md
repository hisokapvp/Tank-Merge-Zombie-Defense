# Система: UI

## Где править
- Разметка: `index.html`
- Логика UI: `src/ui/*`
- Big menu runtime: `src/ui/bigMenuRuntime.js`
- Инициализация: `src/core/bootstrap.js`
- Critical modal: `src/ui/criticalModal.js`
- Restart simulation flow: `game.js` (`restartSimulationPartial`) + `src/core/worldReset.js`
- Talents v2 UI (overlay + HUD активок): `game.js` (`ensureTalentUI`, `updateTalentUI`, `updateStageAbilitySlots`) + контракт в `docs/ui_talents_v2.md`.
	- Overlay Talents v2: одновременно рендерятся все 3 ветки (`offense/defense/economy`) в отдельных колонках.
	- Для каждой ветки есть локальная кнопка `Сбросить выбор` (сбрасывает только pending-выбор этой ветки).
	- В footer есть кнопка `Применить`, которая фиксирует pending-выбор и только после этого включает модификаторы талантов.
	- Кнопка `Сбросить улучшения` сбрасывает и pending, и уже применённые ранги, плюс очищает runtime-эффекты талантов (active/status/defense runtime).
	- Геометрия дерева и SVG-связи соответствуют legacy-layout (ряды `3-3-3-3-2-2-1`).
	- Unlock-gating рядов в V2: row1..row6 открываются только при spent `5/10/15/20/25/30` в текущей ветке + минимум `1` rank в таланте из предыдущего ряда (row0 доступен сразу).
	- V2 nodes не должны пересоздаваться каждый UI-tick: ререндер дерева допускается только при изменении signature (ranks/freePoints/canBuy/lang), иначе это провоцирует hover-SFX spam и потерю click-событий.

## Интеграция
- Big menu функции (`setBigMenuOpen`, `openBigMenuLoadView`, `renderBigMenuTexts`, `startFromBigMenu`, `initBigMainMenu`) в `game.js` делегируются в `Game.BigMenuRuntime` через `ensureBigMenuRuntimeController()`.
- Runtime crate-логика вынесена в `src/mechanics/crateRuntime.js`; в `game.js` crate entrypoints делегируются через `ensureCrateRuntimeController()`.

## Правила
- Не добавлять тексты мимо `src/i18n/ru.json` и `src/i18n/en.json`.
- `src/i18n/fallbackStrings.js` — синхронный fallback, применяется до загрузки JSON; при добавлении нового i18n-ключа его нужно добавлять **одновременно** в `ru.json`, `en.json` **и** `fallbackStrings.js` (иначе до async-загрузки ключ отображается как literal-строка).
- Не переносить доменную логику в слой UI.
- Debug-панели и admin-кнопки оставлять за `?debug=1`.
- Для critical modal: вход/выход должен включать/снимать hard pause через `PauseManager`, skip-кнопка видна только во время typing.
- Кнопка `Перезапустить симуляцию` должна вызывать partial reset runtime мира без запуска второго main loop.
- Для `Перезапустить симуляцию` в `restartSimulationPartial(..., { onAfterRestore })` обязательно выполнять post-restore доведение: телепорт дронов к `supercomputer` (с fallback `(0,0)`), сброс zombie target к дефолту из `assets/zombies.json`, сброс `attackMode` runtime к off/default.
- Зомби — это runtime-состояние, не сохраняемое в payload. При любом `restoreFullState` в конце вызывается явный `state.zombies.length = 0` (сброс зомби).
- `restoreFullState` при `Object.assign(getComputerState(), saved.supercomputer)` сохраняет предыдущие валидные координаты `x/y` суперкомпьютера, если в `saved.supercomputer` они нулевые/невалидные (pre-retry payload использует `createInitialState` как базу и не хранит real-координаты).
- Количество стартовых танков при новой игре/рестарте симуляции: **1 танк 1-го уровня**. Точки спавна: `spawnInitialTanksLvl1(state, 1)` (в `resetGameState`) и цикл с `seeded < 1` (в `applyPreRetryRuntimeReset`).

## Меню и confirm выхода
- Small menu confirm выхода живёт в `menuExitConfirmView` (`index.html`), обработчики — `src/core/bootstrap.js`.
- Small menu confirm для `New` живёт в `menuNewConfirmView` (`index.html`): `Продолжить` запускает `New game`, `Назад` возвращает в root small menu.
- В small menu больше нет пункта для отправки отзывов; действия: `Continue`, `New`, `Save`, `Load`, `Exit`.
- Кнопка `Выход` в confirm должна переиспользовать существующий session-exit flow (`stopAndResetSessionToBigMenu`), без дублирования reset-логики.
- `stopAndResetSessionToBigMenu` приводит приложение к состоянию первого запуска через перезагрузку страницы (`window.location.reload`) после очистки transient `progress` (слотовые сохранения не затрагиваются).
- Открытие/закрытие confirm-экрана внутри small menu не должно трогать pause/unpause; меняется только активный `menuView`.
- Лейаут `#menuExitConfirmView .menuInlineActions` и `#menuNewConfirmView .menuInlineActions`: `display:flex`, `justify-content:center`, `align-items:center`, `flex-wrap:nowrap`, `gap:12px`; кнопки одинаковой ширины через `clamp(...)` с mobile-override.
- При открытии confirm (`openExitConfirmView`, `openNewConfirmView`) в `src/core/bootstrap.js` обязательно сбрасывать `lastActiveButtonIdSmallMenu = null` и вызывать `applySmallMenuSelectedState()` — чтобы ни одна кнопка main menu не светилась как selected пока открыт confirm.
- На экране confirm ни одна кнопка не имеет default selected-подсветки; selected появляется только после клика пользователя.
- Для `menuExitConfirmView`/`menuNewConfirmView` default-state: `selected = none` (первый рендер без `menuActionSelected`/`btnPrimary` на кнопках confirm).
- Явный выбор для confirm считается только после пользовательского действия: `pointerdown/click`, фокус и подтверждение с клавиатуры (`Enter`/`Space`) или навигация стрелками (`ArrowLeft/Right/Up/Down`).
- Пока `sessionStartGate=locked`, `Continue` в small menu недоступен; в сессию можно войти только через big menu `New` или успешный `Load(slot)`.

## Sound menu: track loop control
- Слайдер `sound.trackLoop` удалён из small menu и big menu.
- Громкость езды танка (`trackLoop`) настраивается только в коде: `src/config/audioUi.js` → `AudioUi.TANK_DRIVE_VOLUME_MULT`.

## Small menu Save/Load views
- Save-view — подрежим small menu: `#smallMenuSaveView` в `index.html`, логика в `src/core/bootstrap.js`.
- Load-view — соседний подрежим small menu: `#smallMenuLoadView` в `index.html`, использует тот же table-layout (`smallMenuSaveTable__*`) и тот же renderer в `src/core/bootstrap.js`.
- При входе в Save/Load view скрывается root small menu (`#smallMenuRootView.is-hidden`), показывается только активный subview (`.smallMenuSaveView.is-active`), pause остаётся через обычный menu lock (`setMenuOpen(true)` + `PauseManager.setMenuOpen`).
- Таблица слотов всегда рендерит 10 строк (`1..10`) с колонками: `№`, `Имя`, `Дата`, `Сохранить/Загрузить`.
- Inline edit имени включается по `pointerdown` по строке (кроме кнопки `Сохранить`) только для слотов `1..9`; Enter/blur = commit, Esc = cancel; commit идёт через `Game.Storage.setSlotName`.
- Кнопка `Сохранить` вызывает `Game.Storage.saveSlot(index, state)`; слот `10` (Auto) в Save view read-only (кнопка disabled).
- Кнопка `Загрузить` вызывает `Game.Storage.loadSlot(index)`; пустой слот остаётся disabled.
- Кнопка `Назад` в save/load-view возвращает в root small menu без отдельного снятия паузы; правила pause определяются состоянием открытия small menu в целом.

## Состояние подсветки кнопок меню
- Big menu и small menu хранят last-click состояние раздельно (без shared state между меню).
- На первом показе меню selected-подсветки нет; selected появляется только после клика.
- Hover остаётся CSS-driven (`:hover`) и не зависит от selected.
- При новом клике в пределах одного меню selected переносится на новую кнопку и снимается с предыдущей.
- При открытии sub-view (confirm, save, load) из small menu — `lastActiveButtonIdSmallMenu` сбрасывается в `null`, чтобы кнопка основного меню не оставалась подсвеченной.

## Big menu: Language + Credits
- Кнопка `Язык/Language` открывает подпанель из двух подкнопок (`Русский`, `Английский`) прямо под кнопкой через локальный wrapper в DOM (`bigMenuLanguageWrap`), а не через глобальное позиционирование.
- Активность подкнопок языка вычисляется только от текущей локали (`getCurrentLang`) и использует тот же selected-стиль (`menuActionSelected` + `btnPrimary/btnSecondary`), что и старая подсветка кнопки меню.
- Подпанель языка закрывается при выборе языка и по outside click; outside-listener снимается при закрытии.
- В big menu больше нет пункта для отправки отзывов; действия: `New`, `Load`, `Sound`, `Language`, `Credits`.
- Пункт `Credits/Создатели` открывает `creditsModal` (закрытие по `×` и `Esc`) и рендерит список участников из `assets/credits.json`.
- Для `Load` в big menu нет постоянного текста «Нет сохранений». Доступность отражает `Game.Storage.hasAnySaves()` по фактическому наличию payload в слотах: при отсутствии сейвов ставятся `aria-disabled="true"` и `data-disabled-reason="noSaves"`, при наличии — атрибут reason убирается.
- Big menu `Load` открывает отдельный subview `bigMenuLoadView` внутри big menu: таблица слотов всегда 10 строк (`1..10`), колонки `№/Имя/Дата/Загрузить`, `Назад` возвращает в root big menu.
- `Load(slot)` в big menu вызывает `Game.Storage.loadSlot(index)`; при успехе закрывает big menu, снимает gate (`sessionStartGate=unlocked`) и запускает сессию.
- `Back` в `bigMenuLoadView` не закрывает big menu и не снимает menu lock; возвращает только на root big menu.
- При открытом big menu gameplay всегда заблокирован (input + симуляция) через menu lock (`PauseManager` / `setMenuOpen`-источник big menu).

## HUD: supercomputer button
- `#supercomputerBtn` позиционируется runtime-логикой через `transform: translate3d(...)`; не применять к нему layout-сдвиги (`top/left`) на active/pressed.
- Press/hover-эффекты должны быть визуальными (яркость/scale иконки), не менять якорную позицию кнопки.
- При изменениях в unified button behavior (`.uiButtonBehavior`) обязательно сохранять исключение для HUD-кнопки суперкомпьютера.
- `.supercomputerHudBtn` по умолчанию скрыта (`visibility:hidden`) и показывается только после первого успешного расчёта позиции в `updateSupercomputerHudButtonPosition()`; это исключает появление в `(0,0)`.
- При `resetGameState` (до `initBoard`) обязательно: `supercomputerHudRuntime.button.lastVisible = false`, `supercomputerHudRuntime.button.lastTransform = ''`, `ui.supercomputerBtn.style.visibility = 'hidden'`. Это предотвращает однокадровый flash HUD-кнопки в (0,0) до пересчёта layout.
- Для `.supercomputerHudBtn` и `.supercomputerHudBtn.uiButtonBehavior` запрещён `transition` по `transform` и запрещён `transition: all`; допускаются только визуальные свойства (`box-shadow/filter/background-color/border-color/opacity`), чтобы убрать визуальный «полёт» при обновлении координат.

## HUD: XP bar
- Fill `#xpBar.xpFill` фиксирован: `background: #14a13d` (без gradient).
- Empty-часть (`.xpBar`) должна оставаться серой в общем HUD-стиле (используем штатный нейтральный серый фон, без случайных цветов).
- Анимация прогресса только через CSS transition `width` у fill-элемента в диапазоне `200–300ms`.
- JS-обновление должно менять именно `xpBar.style.width = 'NN%'` и писать значение только при фактическом изменении процента (чтобы не перезапускать transition на каждом тике).

## Supercomputer: root tiles
- Контейнер плиток: всегда `3 в ряд` без переноса (`.scRootTiles` + `.scRootTile` с фиксированным `calc((100% - 20px)/3)`).
- Label `.scRootTile__label`: одна строка (`white-space:nowrap`) с защитой layout (`overflow:hidden` + `text-overflow:ellipsis`), auto-shrink через `clamp(...)` с минимальным размером `12px` на всех брейкпоинтах.
- Размер иконок управляется одной переменной `--scTileIconSizePx` (в `:root`), а фактический размер идёт через `--scTileIconSize` + `clamp(...)`; целевой baseline около `96px` на стандартном экране.

## Supercomputer: modal layout
- `supercomputer` модалки (`#supercomputerMenuOverlay`, `#modsHangarOverlay`, `#modsTankWallOverlay`) оформляются как `large modal` по паттерну дерева улучшений: panel с классом `.scModal`.
- Размеры модалки должны быть адаптивными и ограниченными viewport: паттерн `width:min(96vw, 1060px)` и `max-height:min(90vh, 920px)`.
- Внешний overlay не скроллится (`overflow:hidden`), скролл разрешён только внутри `.scModal__body` (`overflow-y:auto; overflow-x:hidden`, `min-height:0`, `flex:1`).
- `.levelModal__panel.scModal` должен иметь `box-sizing:border-box` — чтобы padding не ломал расчёт ширины.
- Кастомный scrollbar для `.scModal__body`: эталон — audio slider (`.menuSlider input[type=range]`); применяется через `scrollbar-width:thin; scrollbar-color: rgba(255,140,90,.55) rgba(18,12,9,.7)` (Firefox) + webkit: ширина `7px`, thumb — `linear-gradient(140deg,#ffd39e,#ff8c5a)`, `border-radius:999px`.
- При открытой SC-модалке добавлять `body.scmodal-open { overflow:hidden; touch-action:none }`: `openRoot()` добавляет класс, `closeAll()` снимает. Это предотвращает появление второго скроллбара страницы при pressed-анимации кнопок внутри модалки.
- Кнопки `.scButton:active:not(:disabled)` — pressed-эффект только через `transform:translateY(2px) scale(0.99)`, без изменений layout (`margin`, `padding`, `height`), чтобы не провоцировать системный scrollbar.
- Для `.scButton` обязателен `box-sizing:border-box`; на active/pressed запрещено менять `border-width`, `padding`, `height`, `margin`, `line-height`.
- Правило overflow: одновременно скроллится только один контейнер (`.scModal__body`), а `overlay/panel/body` страницы не должны получать параллельный scroll.
- Для `modsTankWall` табы и крестик остаются доступными, а длинный контент (`таблицы/списки`) прокручивается внутри внутреннего scroll-контейнера, без внешнего page/overlay scroll.

### Диагностика: второй scrollbar в supercomputer modal
- Как воспроизвести: открыть `Supercomputer -> Модификации -> Назад`, зажать кнопку `Назад` (или другую `.scButton`) и удерживать.
- Ожидаемо: кнопка визуально «прижимается» только через `transform`, но layout не меняется; активен только внутренний scrollbar `.scModal__body`.
- Запрещённые изменения: любые pressed-стили, меняющие box-model, и любые правки, из-за которых `body` начинает прокручиваться параллельно с `.scModal__body`.

## On-track dim (иконка в слоте)
- Источник параметра: `assets/tanks.json` → `ui.onTrackIconOpacity`.
- Диапазон: `0..1`; default: `0.45`.
- Применение: `src/render/spriteLoaders.js` нормализует в `TankSprites.config.ui.onTrackIconOpacity`, а `game.js` использует значение в `drawTankIconTo(...)` вместо хардкода.
- Fallback: при отсутствии/невалидном значении используется `0.45`, итоговое значение всегда clamp `0..1`.

## Unified button behavior и UI SFX
- Hover/click UI SFX централизованы в `src/ui/buttonBehavior.js`; не дублировать обработчики по модалкам/экранам.
- Hover SFX запускается только для `mouse` (`pointerover`, capture) и с глобальным cooldown.
- Защита от повторов на дочерних элементах: если `relatedTarget` остаётся внутри той же `.uiButtonBehavior`, hover SFX не проигрывается.
- Hover SFX не запускается для disabled и hidden-элементов.
- Click SFX запускается на `pointerdown` (capture), с разными id для enabled/disabled состояния.
- Для disabled-кнопок воспроизводится только disabled-click SFX; `is-pressed` не проставляется.
- Изменения в unified button behavior не должны ломать HUD supercomputer (позиция остаётся под runtime `transform`).
- Disabled toast правило: если у кнопки `data-disabled-reason="noSaves"`, показывается «Нет сохранений/No saves», иначе «Недоступно/Unavailable». Сообщение показывается через единый helper `src/ui/toast.js` (один DOM, таймер перезапускается, без бесконечного stacking).

## Supercomputer: вкладка "Стены"
- Вкладка "Стены" (`walls`) в supercomputerMenu рендерит таблицу L1..L60 аналогично вкладке "Орудия".
- Состояние pending/reserved для стен (`pendingFenceUpgradesByLevel`, `getReservedFenceDamagePoints`) полностью независимо от состояния пушек.
- При смене вкладок внутри модалки (Орудия <-> Стены) pending state не сбрасывается. Сброс происходит только при полном закрытии модалки.
- Стоимость шага улучшения стены вычисляется через `getCannonUpgradeStepCost` (которая внутри вызывает общую `getUpgradeStepCost`).
- Суммарная стоимость pending шагов для уровня вычисляется как сумма стоимостей каждого шага: `sum_{i=0..k-1} getUpgradeStepCost(level, applied+i)`.
- Overflow-блокировки: если стоимость следующего шага превышает `Number.MAX_SAFE_INTEGER` или уходит в бесконечность, кнопка `+` блокируется.
- Preview стены рисуется в canvas через `drawGunsSpriteCanvas` с использованием `levels[].uiFrameId` из `fence.json`; fallback при отсутствии/ошибке — `sideTop` (или fallback-атлас).

## Debug panel tabs
- Реализация: `src/ui/debugPanel.js`.
- Текущий состав вкладок: `Tanks`, `Effects`, `Updates`, `Logs&Tools`.
- Из панели удалены вкладки и связанный runtime UI-код: `Zombies`, `Roads/Hangar`, `Actives`, `Talents`.

## Debug panel: Updates
- Раздел `Updates` содержит два действия: `Talent points (+)` и `Damage points (+)`.
- UX: `input type="number"` + кнопка `Окей`; значение парсится как `Math.floor(Number(value))`, невалидный ввод даёт `0`, начисление выполняется только для `>0`.
- Начисление talent points идёт через `game.js -> debugAdjustTalentPoints(...)` (с синхронизацией `state.player.talentsV2.freePoints` и `freeTalentPointsV2`, а также `TalentsV2.setFreePoints(...)` при активном v2 runtime).
- Начисление damage points идёт через `game.js -> debugAdjustDamagePoints(...)`, что корректно обновляет доступные очки и refresh supercomputer UI.

## Tank onTrack toggle
- User-action переключения `tank.onTrack` выполняются из `canvas` pointer handlers в `game.js`, но само изменение состояния делается через единый entrypoint `setTankOnTrackState(...)` -> `Game.Garage.setTankOnTrack(...)`.
- Прямые присваивания `tank.onTrack = ...` для UI-toggle не использовать.
- По user-action использовать `cause: 'user'` (SFX включены), по системным сценариям (`reset`, `restore`) использовать `playSfx: false`/соответствующий cause.
- В reset-пути (`resetGameState`) перед очисткой состояния применяется подавление track-SFX, чтобы при программных изменениях звуки не воспроизводились.

## Supercomputer tabs divider
- Разделитель под вкладками `Орудия/Базы/Стены` в `#modsTankWallOverlay` — это нижняя граница `.scTabs`.
- Правило вёрстки: линия должна доходить до внутренних краёв рамки окна без боковых отступов; для `#modsTankWallOverlay` это делается через нулевые боковые padding у panel и явные `margin-left/right` для прямых дочерних блоков (`title`, `scTabPanels`, footer-actions), без negative margin у `.scTabs`.
- Проверка: открыть `Модификации танков и стен`, убедиться, что у divider нет видимых зазоров слева/справа относительно внутренней рамки.

## Supercomputer: таб `Орудия`
- Реализация: `src/ui/supercomputerMenu.js`, панель `#modsTankWallPanelGuns`.
- Таблица рендерит 60 строк (`1..60`) и 7 колонок:
	- sprite `cannon.src` (по уровню танка, fallback-текст при отсутствии),
	- уровень `L`,
	- `attackSpeed` (базовое / текущее),
	- `baseDamage` (базовое / текущее),
	- уровень улучшения (`applied` и `+pending`),
	- стоимость `next / totalSpent`,
	- действия `+`, `-`, `Улучшить`.
- `pendingUpgradesByLevel` — локальное UI-состояние (живет только пока открыт supercomputer menu, сбрасывается при полном закрытии).
- `reservedDamagePoints` считается как сумма стоимости всех pending-шагов по всем уровням с учётом текущего `applied`.
- Расчёт стоимости для уровня `L`:
	- `applied = state.player.cannonUpgradesApplied[L]`;
	- `pending = pendingByLevel[L]`;
	- `u0 = applied + pending`;
	- `next = costBase(L) + costStep(L) * u0`;
	- `totalSpent = applied * costBase(L) + costStep(L) * applied * (applied - 1) / 2` (только `applied`, без `pending`).
- Обновление значений:
	- при `+/-` pending меняется только `next`;
	- после `Улучшить` (`Apply`) меняются и `applied`, и `totalSpent`.
- Кнопка `+` увеличивает pending только если `availableDamagePoints - reservedDamagePoints >= nextStepCost`.
- Кнопка `-` уменьшает pending до нуля и освобождает reserve.
- Кнопка `Улучшить`:
	- disabled при `pending=0`;
	- при `pending>0` повторно валидирует доступные очки,
	- списывает очки, применяет апгрейд в state и сбрасывает pending для выбранного уровня.
- Иконки орудий:
	- источник кадра — текущий `cannon` spritesheet (`TankSprites.pickCannon(level)`);
	- число кадров берётся из `iconFrames` (fallback `1`), при `iconFrames=1` анимации нет;
	- ширина `canvas` задаётся через `Game.Config.LayoutTuning.weaponIconW`; ширина sprite-колонки в CSS должна быть согласована с этим значением;
	- используется один shared ticker (`setInterval`) на весь таб `Орудия`, без 60 отдельных `requestAnimationFrame`/таймеров;
	- ticker активен только пока открыт `Supercomputer -> Орудия`, и останавливается при закрытии/переключении таба.
	- поворот иконок задаётся единой константой `WEAPON_ICON_ROT_DEG` в `src/ui/supercomputerMenu.js` и применяется в `drawGunsSpriteCanvas(...)` через `ctx.translate(center)` + `ctx.rotate(...)`; `imageSmoothingEnabled` остаётся `false`.

## Zombie extra VFX policy
- Дополнительные ауры/свечения/кольца для зомби отключены в коде рендера (`src/render/zombieRender.js`) через флаг `DISABLE_ZOMBIE_AURAS = true`.
- Отключаются только zombie-ветки overlay VFX (endgame glow + level ring), базовый спрайт/анимация/тени/логика боя не изменяются.
- `assets/zombies.json` для этого не используется и не должен редактироваться.

## Merge popup (новый уровень танка)
- Точка входа pop-up: `src/ui/mergePopup.js` (`Game.MergePopup.show(level)`), preview/render: `src/ui/mergePreview/mergePreviewModel.js` + `src/ui/mergePreview/mergePreviewRenderer.js`.
- Локальное условие удаления FX: `PREVIEW_UPDATE_OPTS = { disableRightHullShotFx: true }` и `PREVIEW_RENDER_OPTS = { showRightHullShotFx: false }` в `src/ui/mergePopup.js`; опции передаются только в preview model/renderer из merge popup.
- Правило: отключён только right-side hull shot FX (`tankIndex === 1`) в preview-рендере pop-up; пушечная стрельба/SFX и остальные loop FX pop-up не меняются.

### QA (ручной)
- Открыть pop-up нового уровня танка и проверить, что справа нет боковой shot-вспышки/трассера от правого корпуса.
- Убедиться, что остальные эффекты pop-up (основной fire/SFX и loop-анимации) визуально/аудио работают как раньше.

## Мини-проверка
- Кнопки работают мышью и touch.
- Фокус и закрытие модалок проходят через `Game.A11y`.
- UI не ломает паузу/возобновление и сохранение.
- В critical modal по `Skip` текст допечатывается мгновенно, затем показываются финальные действия.
- Повторные нажатия `Перезапустить симуляцию` не создают дубли таймеров/спавна.
