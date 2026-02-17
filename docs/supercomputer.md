# Supercomputer

## Сущность и размещение

- Сущность хранится в `state.supercomputer`.
- Позиция рассчитывается от ангара на каждом `initBoard()`:
  - `hangarCenterX = state.boardRect.x + state.boardRect.w / 2`
  - `hangarBottomY = state.boardRect.y + state.boardRect.h`
  - `x = hangarCenterX`
  - `y = hangarBottomY + offsetY`
- `offsetY` берётся из `assets/supercomputer.json` (`offsetY`), fallback — `src/config/layoutTuning.js` (`supercomputerOffsetY`).

## Поля состояния

`state.supercomputer` хранит:

- `computerLevel`
- `xp`, `xpToNext`, `maxLevel`
- `hp`, `maxHp`, `armorFlat`
- `x`, `y`, `offsetY`
- `state` (`idle` / `work` / `glitch` / `buildTank` / `destroy` / `destroyed`)
- `animElapsedSec`
- `glitchLoopsRemaining`, `glitchCooldownUntil`
- `wantsBuildTank`, `pendingBuildTank`

## Замена `playerLevel` → `computerLevel`

- Источник истины уровня/XP: `state.supercomputer`.
- Старый `player.level` поддерживается только как legacy fallback для старых сохранений.
- Формулы XP и level-up не меняются:
  - `xpNeededForLevel(level)` прежняя
  - источники XP прежние (kill/offline и т.д.)
- UI/HUD показывает `computerLevel` и XP из `state.supercomputer`.

## Пересчёт статов при level-up

После изменения `computerLevel`:

- `maxHp` и `armorFlat` берутся из data-driven конфига (`assets/supercomputer.json` → `stats`).
- HP сохраняет процент заполнения:
  - `hp = round(newMaxHp * (oldHp / oldMaxHp))`
  - затем `clamp(0..newMaxHp)`.

## Урон и поведение при нуле HP

Формула урона:

- `finalDamage = max(0, baseDamage - armorFlat)`
- `hp = max(0, hp - finalDamage)`

При `hp == 0`:

- state меняется на `destroy`, затем фиксируется в `destroyed`.
- Игра не ставится на паузу, game over не вызывается.
- Доступен визуальный `destroy` state.

## Zombie targeting

- До брича текущая цель зомби — `fence` (ломают сегменты по текущему selector'у).
- Переназначение стратегической цели на `supercomputer` включается только для стороны, где есть сломанный сегмент забора.
- Группы с других сторон продолжают ломать `fence` и не переключаются на `supercomputer` до брича на своей стороне.
- При попадании в радиус атаки урон по `supercomputer` наносится через `applySupercomputerDamage(baseDamage)`.
- Приоритет цели в атаке: `supercomputer` (если `hp > 0` и в range) → иначе `fence`.

## State machine анимаций

Базовые состояния:

- `idle/work` — дефолтный цикл.
- `glitch`:
  - стартует по `chancePerSecond`;
  - не стартует, если `destroy`/`destroyed`;
  - учитывает `cooldownSec`;
  - выполняет loops в диапазоне `minLoops..maxLoops`.
- `buildTank`:
  - управляется API `Game.setSupercomputerWantsBuildTank(true|false)`;
  - если в момент запроса идёт `glitch`, ставится `pendingBuildTank=true` и запускается после завершения loops.
- `destroy` → `destroyed`:
  - non-loop destroy-анимация;
  - после завершения фиксированное состояние `destroyed`.

Приоритеты:

- `glitch` не прерывается `buildTank`.
- `buildTank` стартует после окончания `glitch`, если запрос всё ещё актуален.
- при `destroyed` `glitch` не запускается.

## Конфиг `assets/supercomputer.json`

Data-driven параметры:

- `atlas`
- `offsetY`
- `anchor`, `renderScale`
- `hpBar` (`width`, `height`, `offsetY`)
- `animations`:
  - `idle` (или `work`)
  - `glitch`
  - `buildTank`
  - `destroy`
  - поля: `x`, `y`, `w`, `h`, `frames`, `frameRateFps`, `loop`
- `glitch`:
  - `chancePerSecond`
  - `minLoops`, `maxLoops`
  - `cooldownSec`
- `stats`:
  - `maxHp` formula (`base`, `perLevel`, опционально `min/max`)
  - `armorFlat` formula (`base`, `perLevel`, опционально `min/max`)
