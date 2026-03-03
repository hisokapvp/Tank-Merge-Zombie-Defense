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
	- Stage HUD active slots для v2 используют иконки активных талантов из `assets/ui/icons/talents/*` (через `Game.TalentsV2.getTalentUi(...)`), а не legacy `assets/active_*.png`.
	- Stage HUD active slots (v2) обязаны показывать: корректный hover-tooltip (имя/описание/заряды/перезарядка), бейдж зарядов в правом верхнем углу, секундный countdown перезарядки всегда при идущем recharge (даже если есть оставшиеся заряды), и секторную cooldown-заливку по часовой стрелке от центра (`rgba(20,20,20,0.62)` при `charges>0`, `rgba(255,255,255,0.58)` при `charges=0`).
	- Бейдж зарядов на stage active slots должен оставаться читаемым при стандартном масштабе HUD (увеличенный размер цифры/плашки).
	- Tooltip для talent nodes и stage active slots рендерится через unified DOM-tooltip (`#settingsTooltip` + `data-ui-tooltip`), не через нативный `title` браузера.
	- Stage active cooldown-sector стартует сверху (12 o'clock / north) и заполняется по часовой стрелке.
	- Бейдж зарядов на stage active slots не должен смещаться на hover: для слотов и бейджа в hover/pressed состоянии `transform:none`, позиция стабильно в правом верхнем углу.
	- Для каждой ветки есть локальная кнопка `Сбросить выбор` (сбрасывает только pending-выбор этой ветки).
	- В footer есть кнопка `Применить`, которая фиксирует pending-выбор и только после этого включает модификаторы талантов.
	- Кнопка `Сбросить улучшения` сбрасывает и pending, и уже применённые ранги, плюс очищает runtime-эффекты талантов (active/status/defense runtime).
	- Геометрия дерева и SVG-связи берутся из `Game.TalentsV2.getTalentsByBranch(...).layout` (`row/slot/parents`) с fallback на legacy-layout (`3-3-3-3-2-2-1`).
	- Базовые SVG-связи дерева (`.talentEdge`) должны быть визуально заметны даже до первой покупки таланта.
	- Unlock-gating рядов в V2: row1..row6 открываются только при spent `5/10/15/20/25/30` в текущей ветке + минимум `1` rank в таланте из предыдущего ряда (row0 доступен сразу).
	- V2 nodes не должны пересоздаваться каждый UI-tick: ререндер дерева допускается только при изменении signature (ranks/freePoints/canBuy/lang), иначе это провоцирует hover-SFX spam и потерю click-событий.

## Интеграция
- Big menu функции (`setBigMenuOpen`, `openBigMenuLoadView`, `renderBigMenuTexts`, `startFromBigMenu`, `initBigMainMenu`) в `game.js` делегируются в `Game.BigMenuRuntime` через `ensureBigMenuRuntimeController()`.
- Для загрузки save через small/big menu действует единый контракт: `restoreFullState(payload)` должен завершаться post-restore синхронизацией (`postRestoreSync`) для runtime-систем (в т.ч. TalentsV2), чтобы ранги/очки и UI состояния были согласованы сразу после старта.
- Runtime crate-логика вынесена в `src/mechanics/crateRuntime.js`; в `game.js` crate entrypoints делегируются через `ensureCrateRuntimeController()`.

## Мастерская (Workshop) — под-вкладки в модификациях ангара
- Расположение: `#modsHangarOverlay` → три основные вкладки: «Улучшение ячеек» (`hangarTabCells`), «Мастерская» (`hangarTabWorkshop`), «Открытие технологий» (`hangarTabTechUnlock`).
- Под-вкладки Мастерской: «Улучшение чипов» (`workshopTabChipUpgrade`, панель `workshopPanelChipUpgrade`) и «Создание чипов» (`workshopTabChipCraft`, панель `workshopPanelChipCraft`).
- Переключение основных вкладок: `Game.HangarChipsUI.switchHangarTab(tabId)` — DOM-переключение active/hidden, aria-selected. Принимает `'cells'`, `'workshop'`, `'techUnlock'`.
- Переключение под-вкладок: `Game.HangarChipsUI.switchWorkshopSubTab(tabId)` — DOM-переключение active/hidden, aria-selected.
- «Улучшение чипов»: сетка `#chipUpgradeGrid` с карточками чипов из инвентаря `playerChips`. Каждая карточка показывает SVG-иконку, имя, уровень («Ур. N»), счётчик копий. Кнопка «Объединить» удалена — merge выполняется исключительно через drag-and-drop.
- Drag-and-drop merge: пользователь зажимает карточку чипа (pointerdown) и перетаскивает на другую карточку того же `chipId` и `level`. При наведении на валидную цель карточка подсвечивается (`chipUpgradeCard--dropTarget`). При отпускании выполняется `mergeChips(chipId, level)`. Drag доступен только при `count >= 2`. Паттерн pointer events аналогичен merge танков.
- Логика merge: `mergeChips(chipId, level)` — забирает 2 копии, создаёт 1 копию `level+1`. Бонус: `level * 10`% к урону.
- Бонус урона интегрирован в `fireTankProjectile` через `getChipLevelDmgMul(cellIndex)`.

### Создание чипов (Chip Craft) — вкладка Мастерской
- Панель `workshopPanelChipCraft`, функция `renderChipCraftPanel()`.
- **Лейаут панели**: `chipCraftLayout` содержит `chipCraftPreview` (drop-зона + кнопки режимов) и `chipCraftInventory` (инвентарь + нижняя панель действий). Кнопки режимов (`chipCraftModeRow`) и кнопка Execute (`chipCraftExecBtn`) расположены **внутри** `chipCraftDropZone` и отображаются **только при наличии элементов** в слотах (`hasContent === true`).
- **Drag-drop из инвентаря**: элементы инвентаря поддерживают pointer-based drag-drop в drop-зону. При перетаскивании целого чипа автоматически переключается режим на «Разобрать», при перетаскивании фрагмента — на «Создать чип». Вспомогательная функция `_addItemToSlot(itemEl, srcType)`.
- **Режимы**: два постоянных toggle-кнопки «Разобрать» и «Создать чип» (`chipCraftModeBtn`). Активный режим подсвечивается зелёным (`chipCraftModeBtn--active`). По умолчанию — «Создать чип» (`_craftMode = 'assemble'`).
- **Разобрать (disassemble)**: игрок кладёт целый чип в слот → получает 3 фрагмента. Кликабельны только целые чипы.
- **Создать чип (assemble)**: игрок кладёт 3 фрагмента в слоты → получает целый чип. Кликабельны только фрагменты.
- Drop-зона: 3 слота для элементов, кнопка «×» для снятия. Кнопка действия (Execute) становится активной при заполненных слотах в правильном режиме.
- **Фрагменты SVG**: иконки фрагментов в инвентаре рендерятся с размером `22px` (через `_fragmentSvgUp`).
- **Распылить (Pulverize / Dust mode)**: кнопка «Распылить» (`chipCraftDustBtn`) в нижней панели (`chipCraftBottomBar`) под сеткой инвентаря. При нажатии:
  - Переход в `_dustMode = true`: скрывается drop-зона, на всех элементах инвентаря появляются чекбоксы.
  - Большой чип = 10 ед. кремниевой пыли (`DUST_PER_CHIP`), фрагмент = 3 ед. (`DUST_PER_FRAGMENT`).
  - Динамически отображается «Получите кремниевой пыли: X» (`chipCraftDustTotal`).
  - Кнопки «Подтвердить» и «Отменить» появляются в `chipCraftDustActions` обёртке, заменяя кнопку «Распылить».
  - Чекбоксы используют кастомную стилизацию: скрытый `<input>` + span `.chipCraftDustCheckmark` с CSS-псевдоэлементами для галочки.
  - Клик по любой области карточки чипа/фрагмента в dust mode переключает чекбокс выбора (вспомогательная функция `_toggleDustCheckbox(cb)`).
  - Подтверждение: выбранные элементы удаляются, `_siliconDust` увеличивается.
- **Кремниевая пыль** (`_siliconDust`): ресурс, отображаемый в нижней панели (`chipCraftBottomBar`). Сохраняется через `getSiliconDust()`/`setSiliconDust()`.

### Открытие технологий — процесс изучения
- Все кнопки «Скормить x» удалены. Вместо них — кнопка «Начать процесс изучения» с таймером.
- Длительность изучения: 2 часа (7200 сек) для открытых технологий, 5 часов (18000 сек) для технологий под замком. Константы: `TECH_STUDY_DURATION_OPEN`, `TECH_STUDY_DURATION_LOCKED`.
- Одновременно можно изучать только одну технологию; при попытке начать вторую — auto-отказ.
- Состояние изучения: `_techStudying = { techId, remaining, total, timer }`, хранится в `HangarChipsUI`.
- Таймер: `setInterval(1000)` декрементирует `remaining`; при `remaining <= 0` технология разблокируется, таймер останавливается.
- Кнопка «Отменить»: показывает модальное окно подтверждения (`_showTechCancelConfirm`). При подтверждении прогресс изучения теряется полностью.
- Кнопка «Ускорить процесс открытия»: показывает модальное окно (`_showTechAccelModal`) со списком чипов из инвентаря. Каждый выбранный чип = +5% ускорения. Максимум ускорения: 95%. Выбранные чипы «сжигаются» (удаляются из инвентаря).
- Сериализация: `techStudying: { techId, remaining, total }` сохраняется в save payload; при восстановлении таймер автоматически перезапускается через `setTechStudying()`.

## Правила
- Не добавлять тексты мимо `src/i18n/ru.json` и `src/i18n/en.json`.
- `src/i18n/fallbackStrings.js` — синхронный fallback, применяется до загрузки JSON; при добавлении нового i18n-ключа его нужно добавлять **одновременно** в `ru.json`, `en.json` **и** `fallbackStrings.js` (иначе до async-загрузки ключ отображается как literal-строка).
- Не переносить доменную логику в слой UI.
- Тени UI-элементов (кнопки/панели/модалки/уведомления/debug) должны оставаться тонкими: baseline `box-shadow` с Y-offset не более `3px`.
- Debug-панели и admin-кнопки оставлять за `?debug=1`.
- Для critical modal: вход/выход должен включать/снимать hard pause через `PauseManager`, skip-кнопка видна только во время typing.
- Кнопка `Перезапустить симуляцию` должна вызывать partial reset runtime мира без запуска второго main loop.
- Для `Перезапустить симуляцию` в `restartSimulationPartial(..., { onAfterRestore })` обязательно выполнять post-restore доведение: телепорт дронов к `supercomputer` (с fallback `(0,0)`), сброс zombie target к дефолту из `assets/zombies.json`, сброс `attackMode` runtime к off/default.
- Critical flow активируется при пороге HP supercomputer `<= 5%`; `Перезапустить симуляцию` в этом сценарии обязан сохранять прогресс-апгрейды из snapshot (talents/mods/cannon/fence/drones/achievements), сбрасывая только runtime-состояние мира.
- Для critical restart post-restore fence runtime сначала принудительно ставится в L1 (`runtimeMaxTankLevelAchieved/currentFenceTierApplied/fenceLevel = 1`), после чего выполняется `syncFenceTierWithMaxTankLevel(..., { force:true })` — итоговый tier пересчитывается по сохранённому `maxTankLevelAchieved`.
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

## Auto pause toggle
- В small menu есть checkbox `menuAutoPause` (`Автопауза при неактивной вкладке`).
- В big menu есть два синхронных checkbox той же настройки: в sound subpanel (`bigMenuAutoPause`) и в root-view (`bigMenuRootAutoPause`).
- Настройка хранится в `settings.autoPauseOnInactive` (default `false`).
- `PauseManager` учитывает флаг через `isAutoPauseEnabled`; при `false` причина `tabInactive` принудительно очищается.

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
- Контейнер плиток: равномерная grid-сетка `3` колонки (`.scRootTiles`), без ручного расчёта фиксированной ширины карточки.
- Иконка `.scRootTile__icon` рендерится как полноразмерный фон карточки (`position:absolute; inset:0; background-size:cover`), а текстовый label (`.scRootTile__label`) идёт поверх.
- Label `.scRootTile__label`: перенос строк разрешён (`white-space:normal`, `overflow-wrap:anywhere`), чтобы длинные названия не обрезались в root-плитках.
- Label `.scRootTile__label` фиксируется у нижней кромки плитки (`margin-top:auto`), чтобы подписи root-плашек визуально располагались внизу.
- Высота root-карточек нормализуется по самой высокой карточке через `--scRootTileUniformHeight` + runtime-нормализацию (`normalizeRootTilesSize()` при `openRoot()`).
- Для root-сетки сохраняется запас по краям (`overflow:visible` у контейнера), при этом сама карточка может использовать `overflow:hidden` для корректного клипа полноразмерного фонового изображения по радиусу.

## Supercomputer: modal layout
- `supercomputer` модалки (`#supercomputerMenuOverlay`, `#modsHangarOverlay`, `#modsTankWallOverlay`) оформляются как `large modal` по паттерну дерева улучшений: panel с классом `.scModal`.
- Размеры модалки должны быть адаптивными и ограниченными viewport: паттерн `width:min(96vw, 1060px)` и `max-height:min(90vh, 920px)`.
- Для `#modsTankWallOverlay` размер панели выровнен с окном дерева талантов: `width:min(980px,95vw)`, `max-height:86vh`.
- Внешний overlay не скроллится (`overflow:hidden`), скролл разрешён только внутри `.scModal__body` (`overflow-y:auto; overflow-x:hidden`, `min-height:0`, `flex:1`).
- `.levelModal__panel.scModal` должен иметь `box-sizing:border-box` — чтобы padding не ломал расчёт ширины.
- Кастомный scrollbar для `.scModal__body`: эталон — audio slider (`.menuSlider input[type=range]`); применяется через `scrollbar-width:thin; scrollbar-color: rgba(255,140,90,.55) rgba(18,12,9,.7)` (Firefox) + webkit: ширина `7px`, thumb — `linear-gradient(140deg,#ffd39e,#ff8c5a)`, `border-radius:999px`.
- При открытой SC-модалке добавлять `body.scmodal-open { overflow:hidden; touch-action:none }`: `openRoot()` добавляет класс, `closeAll()` снимает. Это предотвращает появление второго скроллбара страницы при pressed-анимации кнопок внутри модалки.
- Кнопки `.scButton:active:not(:disabled)` — pressed-эффект только через `transform:translateY(2px) scale(0.99)`, без изменений layout (`margin`, `padding`, `height`), чтобы не провоцировать системный scrollbar.
- Для SC/Talents модалок (`#supercomputerMenuOverlay/#modsHangarOverlay/#modsTankWallOverlay/#talentOverlay`) pressed-состояние `uiButtonBehavior` и `scButton` принудительно `transform:none`, чтобы полностью убрать transient scrollbar при удержании.
- Для SC/Talents модалок у кнопок нельзя клиппить наружные тени (`overflow:visible` для `.btn` в пределах этих overlay).
- Для SC/Talents overlay shimmer-псевдоэлемент `.btn::after` отключён, чтобы hover не давал белый прямоугольник на кнопках.
- Для `.scButton` обязателен `box-sizing:border-box`; на active/pressed запрещено менять `border-width`, `padding`, `height`, `margin`, `line-height`.
- Правило overflow: одновременно скроллится только один контейнер (`.scModal__body`), а `overlay/panel/body` страницы не должны получать параллельный scroll.
- Для `modsTankWall` табы и крестик остаются доступными, а длинный контент (`таблицы/списки`) прокручивается внутри внутреннего scroll-контейнера, без внешнего page/overlay scroll.
- Для root/hangar модалок SC body-скролл отключён; для `modsTankWall` скролл оставлен только у `#modsTankWallOverlay .scModal__body`.

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
- В `modsTankWall` доступны только вкладки `Орудия` и `Стены`; вкладка `Базы` полностью удалена из DOM/runtime/i18n.
- В `modsTankWall` таблицы `Орудия` и `Стены` должны показывать минимум 4 строки сразу (без дополнительного скролла на первом экране).
- Состояние pending/reserved для стен (`pendingFenceUpgradesByLevel`, `getReservedFenceDamagePoints`) полностью независимо от состояния пушек.
- При смене вкладок внутри модалки (Орудия <-> Стены) pending state не сбрасывается. Сброс происходит только при полном закрытии модалки.
- Стоимость шага улучшения стены вычисляется через `getCannonUpgradeStepCost` (которая внутри вызывает общую `getUpgradeStepCost`).
- Суммарная стоимость pending шагов для уровня вычисляется как сумма стоимостей каждого шага: `sum_{i=0..k-1} getUpgradeStepCost(level, applied+i)`.
- Overflow-блокировки: если стоимость следующего шага превышает `Number.MAX_SAFE_INTEGER` или уходит в бесконечность, кнопка `+` блокируется.
- Preview стены рисуется в canvas через `drawGunsSpriteCanvas`.
- Источник превью кадра (по приоритету): `levels[].uiIcon.frame.id` -> `levels[].uiIcon.frame (x/y/w/h)` -> `levels[].uiIcon.frameId` -> `levels[].uiFrameId` -> `sideTop`.
- Источник превью atlas (по приоритету): `levels[].uiIcon.atlas` -> `levels[].uiAtlas` -> `levels[].atlas` -> `fence.json.atlas`.

## Modal padding standard
- Единый отступ модалок задаётся через `:root { --uiModalPad: clamp(16px, 4vw, 50px) }`.
- Применяется к ключевым контейнерам: `.levelModal__panel`, `.modalHeader`, `.modalBody`, `.levelModal__panel.scModal`.
- Для `#modsTankWallOverlay` внутренние боковые отступы табов/контента также завязаны на `--uiModalPad` через `--mods-sc-pad-x`.

## Debug panel tabs
- Реализация: `src/ui/debugPanel.js`.
- Текущий состав вкладок: `Tanks`, `Effects`, `Updates`, `Logs&Tools`.
- Из панели удалены вкладки и связанный runtime UI-код: `Zombies`, `Roads/Hangar`, `Actives`, `Talents`.
- В `Effects` удалены preview-VFX кнопки (`Burst center`, `Particle burst`, `Impact ring`, `Decal pool`) и служебные кнопки `Stop all preview VFX` / `Clear debug statuses` вместе с их обработчиками.
- В `Logs&Tools` удалены кнопки `Reset (statuses + VFX)`, `Clear log`, `Lesson Progress`; раздел оставляет только mount для telemetry/debug-виджетов.

## Hangar slot stamp reveal
- Визуал слота ангара: появление нового/купленного танка идёт через stamp-reveal анимацию (`10` горизонтальных полос).
- Реализация: `game.js` — `makeTank(..., options)` + `drawTankIconWithStampReveal(...)` / `getTankStampProgress(...)`.
- Длительность печати берётся из `assets/tanks.json -> tankPrintDurationSec` (fallback `1.5s` при отсутствии/невалидном значении).
- Пока танк в состоянии печати (`isTankPrinting`) он не участвует в пользовательских и авто-действиях: drag/перемещение, merge, auto-merge и отправка на трассу блокируются.
- В ангарной отрисовке слота тень корпуса танка отключена (`showShadow:false`).
- В preview иконок в dismantle confirm modal (`fillDismantleConfirmModal`) тень также отключена (`drawTankIconTo(..., { showShadow:false })`).
- Контракт restore: при `restoreFullState(...)` штамп отключается (`makeTank(..., { enableStamp:false })`), чтобы загруженные сейвы не проигрывали spawn-анимацию.

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
- Разделитель под вкладками `Орудия/Стены` в `#modsTankWallOverlay` — это нижняя граница `.scTabs`.
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
	- стоимость только текущего шага (`nextStepCost`),
	- действия `+`, `-`, `Улучшить` (кнопки `+/-` собраны в вертикальный стек `.scGunsActionStepper`).
- `pendingUpgradesByLevel` — локальное UI-состояние (живет только пока открыт supercomputer menu, сбрасывается при полном закрытии).
- `reservedDamagePoints` считается как сумма стоимости всех pending-шагов по всем уровням с учётом текущего `applied`.
- Расчёт стоимости для уровня `L`:
	- `applied = state.player.cannonUpgradesApplied[L]`;
	- `pending = pendingByLevel[L]`;
	- `u0 = applied + pending`;
	- `nextStepCost = getCannonUpgradeStepCost(level, applied + pending)`.
- Обновление значений: при `+/-` и после `Улучшить` пересчитывается только `nextStepCost` и состояние pending/applied.
- Кнопка `+` увеличивает pending только если `availableDamagePoints - reservedDamagePoints >= nextStepCost`.
- Кнопка `-` уменьшает pending до нуля и освобождает reserve.
- Кнопка `Улучшить`:
	- disabled при `pending=0`;
	- при `pending>0` повторно валидирует доступные очки,
	- списывает очки, применяет апгрейд в state и сбрасывает pending для выбранного уровня.
- Формат отображения статов: целые значения показываются без суффикса `.00` (для `attackSpeed`, `damage`, `HP`, `armor`).
- Иконки орудий:
	- источник кадра — текущий `cannon` spritesheet (`TankSprites.pickCannon(level)`);
	- source-кадр для UI принудительно берётся как `128x128` (через `Game.Config.LayoutTuning.weaponIconSpriteFrameW/H`), независимо от display-size canvas;
	- число кадров берётся из `Game.Config.LayoutTuning.weaponIconAnimFramesByLevel[L-1]` (fallback `iconFrames` из баланса, далее `1`), при `1` анимации нет;
	- FPS берётся из `Game.Config.LayoutTuning.weaponIconAnimFpsByLevel[L-1]` (fallback `8`);
	- ширина `canvas` задаётся через `Game.Config.LayoutTuning.weaponIconW`; ширина sprite-колонки в CSS должна быть согласована с этим значением;
	- строки таблицы и все ячейки центрируются по вертикали/горизонтали; высота строки должна гарантированно вмещать текущий sprite-размер без наезда на соседние строки;
	- используется один shared ticker (`setInterval`) на весь таб `Орудия`, без 60 отдельных `requestAnimationFrame`/таймеров;
	- ticker активен только пока открыт `Supercomputer -> Орудия`, и останавливается при закрытии/переключении таба.
	- поворот иконок задаётся единой константой `WEAPON_ICON_ROT_DEG` в `src/ui/supercomputerMenu.js` и применяется в `drawGunsSpriteCanvas(...)` через `ctx.translate(center)` + `ctx.rotate(...)`; `imageSmoothingEnabled` остаётся `false`.

## Stage actions: boost button
- Кнопка `#boost` и модалка `#boostModal` удалены; не добавлять обработчики `openBoostModal/closeBoostModal` обратно в runtime/UI.

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

## Треугольные чипы ангара (Hangar Chips)

### Где править
- Механики: `src/mechanics/hangarChips.js` (`Game.HangarChips`)
- UI контроллер: `src/ui/hangarChipsUI.js` (`Game.HangarChipsUI`)
- Разметка: `index.html` → `#modsHangarOverlay`
- Стили: `style.css` → `.hangarChipsModal`, `.hangarLayout`, `.hangarGrid`, `.hangarSlotView`, `.hangarActiveMods`, `.hangarChipBtn`
- Состояние: `src/persistence/initialState.js` → `state.hangarCells`
- i18n: ключи `hangarChips*` в `src/i18n/ru.json`, `src/i18n/en.json`
- Debug: `src/ui/debugPanel.js` → вкладка `Chips` с секцией `#debugSectionChips`

### Архитектура
- Каждая ячейка ангара (0–15) имеет «бабочку» из 6 равносторонних треугольных слотов одинакового размера (сторона ≈120px в viewBox 400×300):
  - 2 красных центральных (red-0 top, red-1 bottom) — образуют ромб с общей стороной A–B.
  - 4 жёлтых угловых (yellow-0..3) — примыкают к красным по рёбрам.
- SVG-геометрия: TC(200,90), BC(200,210), CL(96,150), CR(304,150), TL(96,30), TR(304,30), BL(96,270), BR(304,270).
- **Визуализация чипов (composed SVG)**: функция `chipSvgComposed(w, h, borderColor, modIds, cssClass, strokeW)` рисует чип как 3 вложенных мини-треугольника внутри большого контура. Каждый мини-треугольник окрашен цветом модификатора. Используется повсюду: инвентарь, грид улучшений, craft panel, tech modal.
- **Фрагмент SVG**: `_fragmentSvgUp(modId, size, strokeColor)` — маленький треугольник «вершиной вверх», окрашенный по модификатору.
- Чип — неупорядоченная тройка модификаторов {1..14}, max 1 «спецмод» (10–14), тройки вида (a,a,a) запрещены.
- Пул: 156 красных + 225 жёлтых = 381 уникальный чип.

### Правила размещения
- **Установка через выбор слота**: нажать на слот (треугольник) в SVG, затем на чип в списке.
- **Drag-and-drop в слоты (Task 7)**: зажать чип в инвентаре (pointerdown на `[data-chip-id]`), перетащить на SVG-слот бабочки. Подсветка слота при наведении (`brightness(1.5)`, утолщённая обводка). При отпускании: проверка цвета слота ↔ чипа, если слот занят — старый чип возвращается в инвентарь, новый устанавливается. Реализовано через `_slotDragging` state в `init()`.
- **Зелёная подсветка совпадений (Task 5)**: чипы в инвентаре, которые при установке создадут match с уже установленным красным чипом, подсвечиваются зелёным (`hangarChipBtn--canMatch`). Функция `_wouldChipCreateMatch(cell, chipEntry, h)` проверяет все 3 ротации.
- **Список чипов для установки**: во вкладке «Улучшение ячеек» отображаются только чипы из инвентаря игрока (`ensurePlayerChips()`), а не все чипы в игре. Каждая кнопка чипа содержит бейдж уровня (`.hangarChipBtn__lvl`) и бейдж количества (`.hangarChipBtn__cnt`).
- При установке чипа он удаляется из инвентаря (`removePlayerChipOne`). При снятии чипа он возвращается в инвентарь (`addPlayerChip`).
- Выбранный слот подсвечивается: утолщённая обводка (strokeW=4) + CSS-анимация пульсации (`.hangarSlotPoly--selected`, `@keyframes slotPulse`).
- Красный чип: mods сортируются → A ≤ B ≤ C; A и B — внутренние вершины (смежные со 2-м красным), C — внешняя.
- Жёлтый чип: mods с id ≥ 10 ставится в вершину X (не смежную с красными); оставшиеся 2 → innerA/innerB.
- Match двух красных чипов: `p1.A === p2.A && p1.B === p2.B` → активны A + B + C₁ + C₂; иначе **оба красных чипа не работают** (ни один модификатор не активен).
- Жёлтый чип: если установлен, активен только X-мод (внешний угол).
- Жёлтый слот: можно установить только 1 жёлтый чип на ячейку. При установке второго предыдущий снимается.
- **Вращение чипов**: при наведении курсора на слот с установленным чипом появляется кнопка ↻. Клик по ней вращает чип на 120° по часовой стрелке, изменяя привязку модификаторов к вершинам (A, B, C / innerA, innerB, X). Вращение влияет на match красных чипов.

### Интеграция
- `SupercomputerMenu.showHangarMods()` вызывает `Game.HangarChipsUI.init()` + `.show()`.
- Состояние хранится в `state.hangarCells` (массив из 16 объектов с `.slots` и `.activeMods`).
- Создаётся лениво при первом обращении через `Game.HangarChips.createHangarCellsState()`.

### Debug
- Вкладка `Chips` в debug panel (`?debug=1`): выбор ячейки, слота, ввод chip key (формат `a-b-c`), кнопки Install/Remove/Clear.
- API: `Game.HangarChipsUI.debugInstallByKey(cellIdx, slotType, slotId, 'a-b-c')`, `debugRemoveChip(cellIdx, slotType, slotId)`, `debugClearCell(cellIdx)`.

### QA (ручной)
- Суперкомпьютер → Модификации ангара: открываются 3 основные вкладки: «Улучшение ячеек», «Мастерская», «Открытие технологий».
- «Мастерская» содержит 2 под-вкладки: «Улучшение чипов» и «Создание чипов».
- Выбор ячейки в сетке 4×4: бабочка SVG обновляется, список чипов фильтруется по типу выбранного слота.
- Иконки чипов отображаются как composed SVG (3 мини-треугольника), фрагменты — как маленькие треугольники вершиной вверх.
- Чипы, создающие match при установке, подсвечиваются зелёным в списке инвентаря.
- Drag-and-drop из инвентаря в слот бабочки: зажать чип → перетащить на слот → при совпадении цвета устанавливается (с заменой).
- Установка красного чипа в оба red-слота: проверить match A+B, отображение «Совпадение!» или «Нет совпадения». Без совпадения оба чипа неактивны.
- Установка жёлтого чипа: проверить, что при установке 2-го жёлтого 1-й снимается автоматически.
- «Улучшение чипов»: merge через drag-and-drop (зажать чип и перетащить на одноименный).
- «Создание чипов»: два toggle-кнопки «Разобрать»/«Создать чип». В режиме «Разобрать» кликабельны только целые чипы, в «Создать чип» — только фрагменты.
- «Распылить»: нажать → появляются чекбоксы → выбрать элементы → «Подтвердить» → кремниевая пыль добавляется, элементы удаляются.
- «Открытие технологий»: кнопки «Скормить» удалены; вместо них — «Начать процесс изучения» с таймером, «Отменить» с подтверждением, «Ускорить» с выбором чипов.
- Debug panel: установить чип по ключу, убедиться, что SVG обновляется.
