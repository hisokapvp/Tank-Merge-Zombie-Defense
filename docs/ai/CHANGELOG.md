# Журнал изменений (A2DP)

## Рефакторинг game.js — удаление мёртвого кода и извлечение талантов
- **Удалён мёртвый код из game.js** (~70 строк):
  - Первый (затенённый) `normalizeAppliedCannonUpgrade` — дубликат, перезаписывался вторым определением.
  - `drawZombieFence` — никогда не вызывалась.
  - `drawZombieSprite`, `drawZombieFallback` — не вызывались после перехода на ZombieRender runtime.
  - `pad2ForBigMenu`, `formatDateForBigMenu`, `renderBigMenuLoadRows`, `parseBigMenuSlotIndexFromNode` — не вызывались после перехода на BigMenuRuntime.
  - `sanitizeCannonUpgradeRow` — обёртка, которая не использовалась.
  - `setTrackLoopVolumeMul` — функция-заглушка (игнорировала параметры, использовала хардкод) и две ссылки в объектах deps.
  - `const compact = true` / `const muted = false` — удалены, значения заинлайнены (`0.065`/`0.56` вместо тернарных операторов; мёртвые ветки `if (muted)` удалены).
- **Извлечён блок талантов v1** (~170 строк) в `src/systems/talents/talentDefs.js`:
  - `TALENT_DEFS`, `ACTIVE_TALENT_INDEX`, `sanitizeTalentIconBaseName`, `talentIconPath`, `TALENT_LAYOUT`, `TALENT_EDGES`, `TALENT_ROW_POINTS`, `addTalent`, `initTalentDefs`, `baseMods`, `computeModsFromApplied`.
  - В `computeModsFromApplied` вызов `clamp()` заменён на `Math.max(0, Math.min(0.9, ...))` для устранения зависимости от game.js.
  - Скрипт подключён в `index.html` перед `game.js` (после `talentsV2.js`).
- **Итого**: game.js сокращён с ~12 212 до ~11 976 строк (−236 строк, −1.9%).

## 2026-02-28
- **Новая фича: Каскадная система модификаторов чипов**.
  - Модификаторы теперь разделяются по «порядку срабатывания» (order): первый красный мод (order 0) срабатывает при выстреле, второй красный мод (order 1) — при попадании первых снарядов, жёлтый мод (order 2) — при попадании последних каскадных снарядов.
  - `hangarChips.js`: `calculateActiveModifiers` теперь добавляет поле `order` (0, 1, 2) к каждому модификатору.
  - `chipEffects.js`: `applyShotModifiers` разделяет моды по order; order-0 применяются при выстреле, остальные сохраняются в `pendingCascadeMods` / `pendingYellowMods` на объекте `shotMods`.
  - `chipEffects.js`: добавлены каскадные функции — `_buildEmptyResult`, `_applyModToResult`, `_findCascadeTargets`, `_getCascadeProjectileCount`, `_spawnCascadeProjectiles`.
  - `chipEffects.js`: `applyImpactEffects` теперь после обработки текущих эффектов проверяет `pendingCascadeMods` и запускает `_spawnCascadeProjectiles`.
  - `game.js`: добавлен флаг `isCascadeChild` в `resetProjectile` и `spawnProjectile` для каскадных снарядов.
  - Каскадные снаряды летят к целям в 100–250px от точки взрыва, количество зависит от мода (Double Shot = 2, Combo = 3, остальные = 1).
  - Жёлтые моды (10–14) срабатывают ТОЛЬКО на последнем каскаде: если 1 красный + жёлтый → жёлтый на первом попадании; если 2 красных + жёлтый → жёлтый только на попадании каскадных снарядов.
  - Тесты: 79 passed, 3 failed (pre-existing T5 CSS).
- **Фикс: Мод 1 (Двойной снаряд) — снаряды летят в разные далёкие цели**.
  - Минимальная дистанция между основной и вторичной целью увеличена с 30px до 120px (настраиваемая через `Game.ChipEffects.DOUBLE_SHOT_MIN_TARGET_DISTANCE`).
  - Добавлена getter/setter-пара `DOUBLE_SHOT_MIN_TARGET_DISTANCE` в `chipEffects.js` для runtime-настройки дальности выбора второй цели.
  - `game.js`: `fireTankProjectile` использует `ChipFx.DOUBLE_SHOT_MIN_TARGET_DISTANCE` вместо хардкода 30px.
- **Новая фича: Жёлтые чипы — оформление углов как у красных**.
  - В SVG-бабочке жёлтые чипы теперь отображают метки модификаторов во всех 3 вершинах треугольника (`A:`, `B:`, `X:`), аналогично красным (`A:`, `B:`, `C:`).
  - Внутренние вершины (`A`, `B`) отображаются зелёным `#4af626`, внешняя (`X`) — жёлтым `#fdd835` жирным.
- **Фикс: Жёлтый модификатор — активация только при совпадении углов**.
  - Жёлтый чип теперь активирует свой X-модификатор только если оба внутренних угла (innerA, innerB) совпадают с соответствующими вершинами смежного красного чипа.
  - Добавлена карта смежности `YELLOW_ADJACENCY` и функция `checkYellowMatch(yellowPlacement, yellowSlotKey, cellState)` в `hangarChips.js`.
  - `calculateActiveModifiers`: жёлтый X добавляется в `mods` только при `checkYellowMatch === true`.
  - `uiState.yellowMatchSuccess`: новое поле, отображается в UI статусом «Жёлтый: совпадение! X активен» / «Жёлтый: нет совпадения. X не активен».
  - Тесты: 79 passed, 3 failed (pre-existing T5 CSS).
- **Фикс: Мод 6 (Комбо-счётчик дула) — последовательная стрельба**.
  - Комбо-выстрелы (каждый 4-й выстрел → 3 снаряда) теперь выпускаются последовательно с интервалом 0.15 сек через `setTimeout`, а не мгновенно.
- **Фикс: Несовпадение красных чипов — только 1 модификатор**.
  - При `matchSuccess = false` теперь активен только модификатор A первого красного чипа (было: A обоих чипов).
- **Новая фича: Вращение чипов в ангаре**.
  - Добавлена функция `rotateChip(cell, slotType, slotId)` в `Game.HangarChips`: вращает чип по часовой (120° за шаг, 3 позиции), изменяя привязку модификаторов к вершинам.
  - `normalizeRedPlacementRotated` / `normalizeYellowPlacementRotated`: нормализация с учётом поворота.
  - В SVG-бабочке на слоте с чипом при наведении появляется кнопка вращения (↻); клик крутит чип на 120° по часовой, пересчитывает `activeModifiers` и обновляет match.
  - CSS: `.hangarSlotGroup:hover .hangarRotateBtn` — кнопка visible on hover.
  - Документация: `docs/ai/SYSTEMS/combat.md`, `docs/ai/SYSTEMS/ui.md` обновлены.
- **Фикс: Чип-модификаторы 1–5 — поведение снарядов переработано**.
  - Мод 1 (Двойной снаряд): каждый снаряд получает полный базовый урон (делится только по дулам, не по чип-экстрам); второй снаряд летит в ДРУГУЮ цель (≥30px от первой).
  - Мод 2 (Цепной заряд): вместо мгновенного урона по цепи, снаряд при попадании порождает новый снаряд-отскок, летящий к другой цели (≥12px), до 2 отскоков.
  - Мод 3 (Матрёшка): визуальный размер снаряда теперь корректно увеличивается (×1.25 через `effectIntensity`); при попадании child-снаряд летит к другой цели (≥12px от взрыва), а не взрывается мгновенно.
  - Мод 5 (Вакуум): все зомби в радиусе 50px притягиваются К МЕСТУ ВЗРЫВА (Cartesian pull через полярные координаты), а не к центру/танку. Радиус 50px фиксированный.
  - `drawProjectiles` в `game.js`: спрайт снаряда масштабируется по `effectIntensity` (визуально увеличенные снаряды для матрёшки/нуки/powerTier).
  - `spawnProjectile`/`resetProjectile`: добавлено поле `isChainChild` для цепных снарядов.
  - Тесты: 79 passed, 3 failed (pre-existing T5 CSS).
- **Новая фича: Чип-эффекты в бою** — модификаторы ангарных чипов теперь реально влияют на поведение снарядов и боевую систему.
  - Добавлен `src/mechanics/chipEffects.js` (`Game.ChipEffects`): runtime-движок чип-эффектов — `applyShotModifiers`, `applyImpactEffects`, `stepChipEffects`, `stepChipDecal`, `checkLaserMarkBoost`, `reset`.
  - Добавлен `assets/chips.json`: конфиг спрайтов, эффектов и звуков для каждого из 14 модификаторов.
  - `index.html`: подключен `chipEffects.js` перед `hangarChipsUI.js`.
  - `game.js`: интеграция чипов в боевой pipeline — `cellIndex` передаётся в `fireTankProjectile`, снаряды хранят `chipShotMods`, `impactAt` вызывает чип-эффекты, `stepDecals` обрабатывает чип-пулы (огонь/кислота/лёд), `stepChipEffects` тикает электро-ноды и лазерные метки, замедление от чипов на скорость зомби, calming-эффект блокирует атаку зомби.
  - Реализованы все 14 модификаторов: двойной выстрел, цепная молния, матрёшка, толкание/притягивание, комбо, аркадный хаос, ядерный, успокоение, огонь, лёд, электро-нода, лазерная метка, кислота.
  - Документация: `docs/ai/SYSTEMS/combat.md`, `docs/configs.md` обновлены.
- **Новая фича: Треугольные чипы ангара** — система модификации ячеек ангара через треугольные чипы.
  - Добавлен `src/mechanics/hangarChips.js` (`Game.HangarChips`): генерация пула 381 чипа (156 красных + 225 жёлтых), нормализация размещения, расчёт активных модификаторов, match-логика красных чипов.
  - Добавлен `src/ui/hangarChipsUI.js` (`Game.HangarChipsUI`): SVG бабочка-визуализация 6 слотов, сетка ячеек 4×4, каталог чипов с фильтрацией, установка/удаление чипов.
  - `index.html`: заменена заглушка «В разработке» в `#modsHangarOverlay` на полную вкладочную структуру (Улучшение ячеек / Мастерская).
  - `style.css`: +~250 строк стилей для чипового UI в wasteland-палитре.
  - `src/persistence/initialState.js`: добавлено поле `hangarCells: null`.
  - `src/ui/supercomputerMenu.js`: `showHangarMods()` теперь вызывает `Game.HangarChipsUI.init()` / `.show()`.
  - `src/ui/debugPanel.js`: новая вкладка `Chips` для отладочной установки/удаления чипов по ключу.
  - i18n: добавлены ключи `hangarChips*` в `ru.json` и `en.json`.
  - Документация: `docs/ai/SYSTEMS/ui.md` + `docs/ui.md` обновлены.

## 2026-02-27
- **Баг-фикс**: ранняя инициализация `game.js` — `ensureDronUpgradesAppliedState()` переведён в fail-soft режим при раннем вызове (fallback по длине уже сохранённого массива/`MAX_TANK_LEVEL`, если `getDronLevelsCount()` ещё недоступен), что предотвращает падение загрузки скрипта.
- **Баг-фикс**: безопасное чтение конфига дронов — доступ к `DronSprites.config` обёрнут в `try/catch` и дополнен fallback на `spriteLoaders.DronSprites.config`; устранён runtime-crash и восстановлена штатная инициализация обработчиков большого меню.
- **Баг-фикс**: `normalizeAndTeleportDronesAfterRestore()` (~L1968) — при вызове `DronesApi.restoreSavedDrones(state, state.drones)` передавалась та же ссылка на массив; `restoreSavedDrones` обнулял `state.drones.length = 0` до итерации, что уничтожало входные данные. Исправлено клонированием массива перед передачей. Дроны и их прокачка теперь сохраняются при «Перезапустить симуляцию».
- **Баг-фикс**: `serializeState()` (storage.js ~L476) — поле `forceFenceRuntimeResetOnLoad` терялось при сериализации save-слота; при загрузке «Сохранить и выйти»-сейва fence уровень не сбрасывался. Добавлено сохранение флага в `serializeState`.
- **Баг-фикс**: Breached zombie movement (~L6023) — зомби, прошедшие через сломанные нижние углы забора, шли по целым секциям. Добавлена проверка `pickFenceSegmentByPoint` после перемещения breached-зомби: если зомби на целом сегменте, `z.r` уменьшается до внутреннего края забора.
- **Фикс UI**: `drawGunsSpriteCanvas()` (supercomputerMenu.js) — введён атрибут `data-rot-deg` на canvas-элементах. Оружия сохраняют поворот −90°; дроны и стены рисуются без поворота (0°). Дроны корректно воспроизводят repair-анимацию (16 кадров @ 15 fps).
- Тесты: 79 passed, 3 failed (pre-existing T5 settings CSS).

## 2026-02-26
- **Редизайн UI (Wasteland Edition)**: Полное обновление интерфейса в стиле Fallout 1 & 2.
  - Основной шрифт заменён на `Courier New` с эффектом фосфорного свечения (`text-shadow`).
  - Цветовая палитра переведена на тёмно-зелёные и фосфорные тона (`#0a0c0a`, `#1e231e`, `#4af626`).
  - Кнопки стали прямоугольными с металлическим градиентом и рамками «под металл».
  - Модальные окна и панели получили эффект ЭЛТ (сканирующие полосы CRT) и «заклёпки» по углам.
  - Индикатор опыта (`.xpBar`) стал сегментированным (ретро-индикатор).
  - Все игровые иконки и способности окрашены в зелёный через CSS-фильтры для единства стиля.
- **Баг-фикс**: `ensureFenceTierRuntimeState()` (~L2655) — убран `Math.max(maxAchieved, ...)` — `runtimeMaxTankLevelAchieved` больше не перезаписывается значением `maxTankLevelAchieved` при рестарте; fence корректно начинает с уровня 1 после critical restart.
- **Баг-фикс**: `getNearestKnownBreachForZombie()` (~L5381) — заменён `Infinity` на `awarenessRadiusPx` при поиске бреши на той же стороне; зомби используют настроенный радиус осведомлённости вместо бесконечного.
- **Баг-фикс**: `zombieFenceLimit()` (~L5715) — добавлена валидация `z.breached`: если зомби стоит на целом сегменте и не глубоко внутри, флаг `breached` сбрасывается.
- **Баг-фикс**: `buildPreRetryPayload()` (~L7323) — добавлена защитная проверка сохранения дронов после `applyPreRetryRuntimeReset`.
- **Баг-фикс**: `applyCriticalRestartPostLoad()` (~L7506) — добавлена защитная проверка восстановления дронов при critical restart.
- **Баг-фикс**: `pointermove` handler (~L9123) — координаты `state.dragging.x/y` обновляются только после превышения порога перемещения (6 px, `moved=true`).
- Тесты: 82 passed, 0 failed.

## 2026-02-20
- **Рефакторинг game.js**: сокращён с 10749 до 9502 строк (−1247 строк, −12%).
- Извлечён `src/core/runtimeTasks.js` (~100 строк): timer/RAF suspend/resume, экспорт `Game.RuntimeTasks`.
- Извлечён `src/mechanics/cannonUpgrades.js` (~80 строк): pure функции `createFallbackCannonUpgrades`, `sanitizeCannonUpgradeRow`, `normalizeCannonUpgradesConfig`, `normalizeAppliedCannonUpgrade`.
- Обновлён `src/persistence/initialState.js`: добавлены недостающие поля (`damagePointsSpent`, `fenceLevel`, `wallDecors`, `nextZombieRenderOrder`, `supercomputer.eventShown*`, `ui.toast`, `ui.unlockFx`); inline fallback в game.js компактифицирован.
- Удалён мёртвый код (~120 строк): 10 неиспользуемых функций (`getBulkBuyPlan`, `mergeCells`, `resetTalentSelections`, `hasAnyBreach`, `getActiveBreachAtPointAnySide`, `pickNearestBreachAnySide`, `getFenceCollisionPadding`, `maybeShowNextAchievementPopup`, `drawDecors`, `drawZombies`), 1 noop-функция (`drawTrack` + её вызов), 3 мёртвые константы (`FENCE_HIT_INTERVAL_MS`, `APPLY_VFX_FLASH_MS`, `APPLY_VFX_FLOW_MS`, `MAX_ZOMBIE_LEVEL`).
- **Баг-фикс**: Debug-панель «Damage Points» — перенесена проверка API внутрь retry-цикла, добавлена видимая стилизация и диагностика.
- **Баг-фикс**: Кнопка суперкомпьютера 🖥 — `supercomputerHudRuntime.button.lastVisible` инициализировался как `true` вместо `false`, JS пропускал установку visibility.
- **Баг-фикс**: Спрайты орудий в модалке суперкомпьютера — масштабирование через `Game.Config.LayoutTuning.weaponIconW/H` с пропорциональным вписыванием.

## 2026-02-19
- Реализован partial reset симуляции: `src/core/worldReset.js` + wiring в `game.js`.
- `Перезапустить симуляцию` теперь сбрасывает runtime мира (zombies/projectiles/FX/weather/wave runtime), но сохраняет achievements/upgrades/mods/supercomputer progression.
- Добавлен контракт на отсутствие дублирования main loop/таймеров при повторном restart.
- MergePopup SHOWCASE: удалён дополнительный правобоковой shot FX в `src/ui/mergePopup.js`.
- В pop-up нового уровня танка сохранены штатная анимация и shoot SFX.
- Полностью удалён legacy-виджет отзывов: menu entry points, связанная модалка и соответствующие i18n-ключи.
- Achievements modal переведён на single-open accordion с toggler `+`/`−`.
- Исправлен transform-конфликт `#supercomputerBtn` с unified button behavior (нет смещения кнопки при клике).

## 2026-02-13
- Документация для AI-агентов сжата и унифицирована.
- Убраны длинные дубли и избыточные объяснения.
- Добавлен компактный роутинг: `INDEX` -> `SYSTEMS` -> `PLAYBOOKS`.

## Примечание
- История кода и подробные изменения доступны в `git log`.
