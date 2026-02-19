# Журнал изменений (A2DP)

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
