# SYSTEM: Combat

## Purpose

Определяет урон, скорострельность, количество снарядов, выбор death-анимации и цели для стрельбы.

## Быстрый ответ (куда идти)

- Константные правила боя: `src/mechanics/combat.js`.
- Targeting/multi-shot: `src/mechanics/targeting.js`.
- Таймер исчезновения трупов: `src/mechanics/corpseDespawn.js`.
- Runtime интеграция (spawn/step projectile): `game.js`.

## Key files

- `src/mechanics/combat.js`
- `src/mechanics/targeting.js`
- `src/mechanics/corpseDespawn.js`
- `game.js`

## Entrypoints

- `Game.Combat.getShootRange()`
- `Game.Combat.getProjectileCount(level)`
- `Game.Combat.pickDeathAnim(common, personal, rand01)`
- `Game.Targeting.pickBurstTargets*`

## Data & config

- Базовые боевые параметры в `BAL` (`game.js`).
- Множители HP/скорости/награды зомби в `assets/zombies.json`.
- SFX огня/level-up/абилок в `game.js`:
   - источники `SFX_SOURCES`;
   - воспроизведение через `playSfx()` + переиспользуемые `SFX_POOLS` (без `new Audio()` на каждый выстрел).

## Common edits

1. **Изменить формулу количества снарядов**
   - Редактировать `getProjectileCount(level)`.

2. **Подправить выбор death-анимации**
   - Редактировать `pickDeathAnim` (сохранять детерминизм для тестов).

3. **Сменить стратегию burst target selection**
   - Редактировать `pickBurstTargetsBySide` в targeting.

4. **Изменить тайминг despawn трупов**
   - Редактировать `CORPSE_DESPAWN_DELAY`.

5. **Править shot SFX без деградации в длинной сессии**
   - Изменять только pool-based логику (`SFX_POOLS`, `SFX_POOL_SIZE`, `playSfx`).
   - Не возвращаться к созданию нового `Audio` на каждый шот.

## Don’t touch / risks

- Не убирай deterministic ветки в `pickDeathAnim` (сломает регресс-тесты).
- Изменение формулы урона/шотов влияет на экономику и offline model.
- Сильные изменения targeting могут ломать projectile fallback.
- Создание `Audio` на каждый выстрел приводит к росту давления на GC/медиа-пайплайн и риску пропадания SFX.

## Checks

- `node Test/pack1/fireLogic.test.js`
- `node Test/pack2/fireLogicRegression.test.js`
- `node Test/pack6/burstTargeting.test.js`
- `node Test/pack6/projectileAimFallback.test.js`
- Ручной smoke: после 10+ level-up подряд shot SFX продолжает стабильно играть.
