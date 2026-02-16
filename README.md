# Tank Merge: Zombie Defense

Merge + tower defense на canvas.

## Быстрый старт

1. Открыть `index.html` в браузере.
2. Или запустить `npx serve .` и открыть `http://localhost:3000`.

## Где настраивать карту

- Ground tiles/stamps: `assets/ground.json`
- Decor/noSpawnZones: `assets/decor.json`
- Runtime pipeline: `src/render/spriteLoaders.js`, `src/render/groundLayer.js`, `game.js` (`initDecors`)
- Подробные правила: `docs/map-generation.md`

## Правила генерации карты

- **Stamps** размещаются поверх ground tiles, без overlap между stamp-спрайтами.
- Для stamps считается суммарное покрытие: `placedTotal / requestedTotal` по всем set’ам.
- Целевой порог stamps: `>= 0.8`; при недоборе игра не пишет новые `console.*` и рисует только размещённые stamps.
- **Decor** размещается строго по `count` из конфига (или BAL override), без overlap.
- Decor всегда соблюдает `noSpawnZones` и не ставится внутри fence-зоны.
- Поиск decor идёт по стадиям с расширением области до краёв карты.

## Параметр `placementMaxAttempts`

- Файл: `assets/decor.json`
- Тип: `int`
- Default: `40`
- Смысл: число попыток размещения одного decor-объекта на **каждом** этапе расширяемой области поиска.

## Настройка стыка углов забора (`cornerInsetPx`)

- Файл: `assets/fence.json`
- Тип: `float`
- Default: `0`
- Смысл: ручная подстройка положения corner относительно side после базового математического стыка по фактическим размерам/scale.
- Отрицательное значение разрешено и увеличивает заход corner в side (видимое перекрытие без артефактов).

### Предупреждение `Fence gap`

- После сборки fence-layout считается максимальная щель в стыках corner↔side.
- Если щель больше `0.5px`, выводится ровно: `console.warn("Fence gap", valuePx)`.
- `valuePx` — вычисленная максимальная щель в world/screen px (как в текущей геометрии fence).

## Zombie attack state machine + targeting

- Конфиг: `assets/zombies.json` → `types[i]`.
- Новые параметры анимаций: `animations.walk.frameRateFps`, `animations.attack.frameRateFps`, `animations.death.frameRateFps`, `animations.deathCommon.frameRateFps`.
- Новые параметры атаки: `attack.attackRangePx`, `attack.attackCooldownSec`, `attack.attackHitAt` (clamp `0..1`).
- Выбор цели fence выполняется единообразно по `distance(zombieCenter, segmentAabb)` для side+corner сегментов.
- Состояния атаки: `walk → attack → cooldown`; урон наносится один раз в момент `attackHitAt` внутри attack-анимации, а cooldown считается от конца attack-анимации.

## Debug overlay для атаки зомби

- Overlay доступен только при `?debug=1`.
- Toggle: клавиша `H`.
- Отрисовывается:
	- `AABB` fence-сегментов (side + corner),
	- круг `attackRangePx` для каждого зомби,
	- текущая выбранная цель (маркер + линия от зомби).

## Команды проверки

```bash
node Test/tests.js
bash ci/check_style.sh
bash ci/run_tests.sh
```
