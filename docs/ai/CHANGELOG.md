# Журнал изменений (A2DP)

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
