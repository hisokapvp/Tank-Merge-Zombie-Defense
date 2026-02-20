# Система: UI

## Где править
- Разметка: `index.html`
- Логика UI: `src/ui/*`
- Инициализация: `src/core/bootstrap.js`
- Critical modal: `src/ui/criticalModal.js`
- Restart simulation flow: `game.js` (`restartSimulationPartial`) + `src/core/worldReset.js`

## Правила
- Не добавлять тексты мимо `src/i18n/ru.json` и `src/i18n/en.json`.
- Не переносить доменную логику в слой UI.
- Debug-панели и admin-кнопки оставлять за `?debug=1`.
- Для critical modal: вход/выход должен включать/снимать hard pause через `PauseManager`, skip-кнопка видна только во время typing.
- Кнопка `Перезапустить симуляцию` должна вызывать partial reset runtime мира без запуска второго main loop.
- Для `Перезапустить симуляцию` в `restartSimulationPartial(..., { onAfterRestore })` обязательно выполнять post-restore доведение: телепорт дронов к `supercomputer` (с fallback `(0,0)`), сброс zombie target к дефолту из `assets/zombies.json`, сброс `attackMode` runtime к off/default.

## Меню и confirm выхода
- Small menu confirm выхода живёт в `menuExitConfirmView` (`index.html`), обработчики — `src/core/bootstrap.js`.
- В small menu больше нет пункта для отправки отзывов; действия: `Continue`, `New`, `Save`, `Load`, `Exit`.
- Кнопка `Выход` в confirm должна переиспользовать существующий session-exit flow (`stopAndResetSessionToBigMenu`), без дублирования reset-логики.
- `stopAndResetSessionToBigMenu` приводит приложение к состоянию первого запуска через перезагрузку страницы (`window.location.reload`) после очистки transient `progress` (слотовые сохранения не затрагиваются).
- Открытие/закрытие confirm-экрана внутри small menu не должно трогать pause/unpause; меняется только активный `menuView`.

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

## Big menu: Language + Credits
- Кнопка `Язык/Language` открывает подпанель из двух подкнопок (`Русский`, `Английский`) прямо под кнопкой через локальный wrapper в DOM (`bigMenuLanguageWrap`), а не через глобальное позиционирование.
- Активность подкнопок языка вычисляется только от текущей локали (`getCurrentLang`) и использует тот же selected-стиль (`menuActionSelected` + `btnPrimary/btnSecondary`), что и старая подсветка кнопки меню.
- Подпанель языка закрывается при выборе языка и по outside click; outside-listener снимается при закрытии.
- В big menu больше нет пункта для отправки отзывов; действия: `New`, `Load`, `Sound`, `Language`, `Credits`.
- Пункт `Credits/Создатели` открывает `creditsModal` (закрытие по `×` и `Esc`) и рендерит список участников из `assets/credits.json`.
- Для `Load` в big menu нет постоянного текста «Нет сохранений». Доступность отражает `Game.Storage.hasAnySaves()` по фактическому наличию payload в слотах: при отсутствии сейвов ставятся `aria-disabled="true"` и `data-disabled-reason="noSaves"`, при наличии — атрибут reason убирается.
- Big menu `Load` открывает тот же общий список слотов (Load view), что и кнопка `Load/Загрузка` в small menu.

## HUD: supercomputer button
- `#supercomputerBtn` позиционируется runtime-логикой через `transform: translate3d(...)`; не применять к нему layout-сдвиги (`top/left`) на active/pressed.
- Press/hover-эффекты должны быть визуальными (яркость/scale иконки), не менять якорную позицию кнопки.
- При изменениях в unified button behavior (`.uiButtonBehavior`) обязательно сохранять исключение для HUD-кнопки суперкомпьютера.

## Unified button behavior и UI SFX
- Hover/click UI SFX централизованы в `src/ui/buttonBehavior.js`; не дублировать обработчики по модалкам/экранам.
- Hover SFX запускается только для `mouse` (`pointerenter`, capture) и с глобальным cooldown.
- Click SFX запускается на `pointerdown` (capture), с разными id для enabled/disabled состояния.
- Для disabled-кнопок воспроизводится только disabled-click SFX; `is-pressed` не проставляется.
- Изменения в unified button behavior не должны ломать HUD supercomputer (позиция остаётся под runtime `transform`).
- Disabled toast правило: если у кнопки `data-disabled-reason="noSaves"`, показывается «Нет сохранений/No saves», иначе «Недоступно/Unavailable». Сообщение показывается через единый helper `src/ui/toast.js` (один DOM, таймер перезапускается, без бесконечного stacking).

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
- Таблица рендерит 60 строк (`1..60`) и 6 колонок:
	- sprite `cannon.src` (по уровню танка, fallback-текст при отсутствии),
	- уровень `L`,
	- `attackSpeed` (базовое / текущее),
	- `baseDamage` (базовое / текущее),
	- уровень улучшения (`applied` и `+pending`),
	- действия `+`, `-`, `Улучшить`.
- `pendingUpgradesByLevel` — локальное UI-состояние (живет только пока открыт supercomputer menu, сбрасывается при полном закрытии).
- `reservedDamagePoints` считается как сумма стоимости всех pending-шагов по всем уровням с учётом текущего `applied`.
- Кнопка `+` увеличивает pending только если `availableDamagePoints - reservedDamagePoints >= nextStepCost`.
- Кнопка `-` уменьшает pending до нуля и освобождает reserve.
- Кнопка `Улучшить`:
	- disabled при `pending=0`;
	- при `pending>0` повторно валидирует доступные очки,
	- списывает очки, применяет апгрейд в state и сбрасывает pending для выбранного уровня.

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
