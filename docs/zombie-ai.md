# Zombie AI: walk / attack / cooldown

## State machine

- `walk`:
  - Зомби двигается к забору (обычная интеграция движения).
  - Проигрывается `walk` анимация.
  - Если есть валидная цель в `attackRangePx`, переход в `attack` и фиксация `attackTargetId`.

- `attack`:
  - Позиция зомби не обновляется (нет movement integration).
  - Проигрывается `attack` анимация.
  - Момент удара: `attackHitAt * attackAnimDuration`.
  - Урон наносится ровно один раз за атаку (`didHitThisAttack`).
  - В момент удара цель проверяется повторно через общий selector (разрешён re-pick).
  - Если цель к моменту удара невалидна или вне `attackRangePx`, урон пропускается.
  - После завершения attack-анимации переход в `cooldown`.

- `cooldown`:
  - Зомби снова двигается и использует `walk` анимацию.
  - Таймер `attackCooldownSec` стартует от конца attack-анимации.
  - По окончании cooldown: если цель есть в range — `attack`, иначе `walk`.

## Target selection rule

Цель для атаки и проверка "можно ли атаковать" используют одну и ту же метрику:

- `distancePointAabb(zombieCenter, segmentAabb)`
  - `0`, если центр внутри `AABB` сегмента,
  - иначе минимальная дистанция до прямоугольника.

Кандидаты:

- Только живые/уронопринимающие fence-сегменты (`!broken`, `hp > 0`) с `holeAabb`.
- В range: `distance <= attackRangePx`.

Tie-break (стабильный):

1. Меньший `distance`.
2. При равенстве — `isCorner=true`.
3. При равенстве — меньший `id` (или индекс как fallback).

## Конфиг `assets/zombies.json` (per `types[i]`)

- `animations.walk.frameRateFps`
- `animations.attack.frameRateFps`
- `animations.death.frameRateFps`
- `animations.deathCommon.frameRateFps`
- `attack.attackRangePx`
- `attack.attackCooldownSec`
- `attack.attackHitAt` (clamp `0..1`)

Совместимость со старыми конфигами:

- Если поля отсутствуют, применяются безопасные дефолты.
- Значения валидируются и clamp'ятся без console-спама.

## Почему corner теперь получает урон

Раньше выбор цели был привязан к направлению/углу (`theta`) и мог не совпадать с фактическим hit-area углового сегмента.

Теперь side и corner участвуют в одном списке кандидатов, а попадание считается по `distance(zombieCenter, segmentAabb)`.
Это устраняет кейс "зомби бьёт возле угла, но corner без урона".
