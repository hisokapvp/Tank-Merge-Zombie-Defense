# Журнал изменений (A2DP)

## 2026-02-27
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
