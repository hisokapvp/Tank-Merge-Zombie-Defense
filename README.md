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
- До брича зомби атакуют `fence`.
- После брича переключение на `supercomputer` происходит только у группы зомби стороны, где разрушен сегмент.
- Выбор цели fence выполняется единообразно по `distance(zombieCenter, segmentAabb)` для side+corner сегментов.
- Приоритет атаки: `supercomputer` (если `hp > 0` и цель в `attackRangePx`) → иначе `fence`.
- Урон по `supercomputer` интегрирован через `applySupercomputerDamage(...)`.
- Состояния атаки: `walk → attack → cooldown`; урон наносится один раз в момент `attackHitAt` внутри attack-анимации, а cooldown считается от конца attack-анимации.

## World Events: desired targetAlive

- `targetAliveMult` влияет **только** на `desired targetAlive` спавна зомби.
- Формула: `desiredTargetAlive = round(baseTargetAlive * aliveMultCurrent)`.
- `baseTargetAlive` — базовое значение без world events множителя.
- При `attackMode=true`: `aliveMultCurrent` плавно стремится к `targetAliveMult`.
- При `attackMode=false`: `aliveMultCurrent` плавно возвращается к `1`.
- Скорость задаётся `targetAliveRampSec`; если `targetAliveRampSec <= 0`, переключение мгновенное.

## Bulk-buy танков (динамический X)

- Гейтинг bulk-buy идёт по `creator_*`: `none` → `buy2` → `buy5` → `buyMax`.
- До `creator_novice` кнопка `#buyBulk` скрыта (не занимает место).
- Формула: `X = min(maxByTier, freeSlots, affordableByCoins)`, где `affordableByCoins` считается точной симуляцией последовательных цен.
- Для текста: `xDisplay = max(2, X)`; если `X < 2`, кнопка disabled и клик no-op.
- Частичная bulk-покупка разрешена в рамках tier cap: покупается ровно `X`.

## Навигация через суперкомпьютер

- В правом HUD вход в таланты теперь идёт через кнопку `Суперкомпьютер` (`#supercomputerBtn`), прямой `talentsBtn` больше не используется.
- Root-меню суперкомпьютера содержит 3 пункта: `Модификации ангара`, `Модификации танков и стен`, `Древо талантов`.
- `Esc` в root-меню суперкомпьютера закрывает меню и снимает menu-pause (если settings уже не открыт).
- `Esc` в дочерних окнах суперкомпьютера (`mods*` и talents) делает шаг назад в root-меню, пауза сохраняется.
- Реализация: разметка в `index.html`, логика в `src/ui/supercomputerMenu.js` + orchestration в `game.js`, modal/a11y через `src/accessibility/a11y.js`, pause lock через `src/systems/pauseManager.js`.

## Достижения и merge-прогресс

- Правила успешного merge и инкремента `totalMerges`: `docs/achievements.md`.
- Пороги `creator_novice/pro/expert`: `100/400/1000` (auto-merge unlock roadmap PACK2/3).

## New Game reset и стартовые таланты

- Кнопка **Новая игра** (`menuNew`) делает reset с причиной `reason: 'new_game'` и выставляет **ровно** `player.talentPoints = 1`.
- Выдача делается присваиванием (не инкрементом), поэтому повторные reset не накапливают очки.

Сценарии и ожидаемое значение `talentPoints`:

- **Boot без сейва**: остаётся дефолт из initial state (`0`, если не изменён балансом/миграцией).
- **Load сейва**: берётся значение из сейва (без принудительной установки в `1`).
- **Новая игра**: сразу после reset всегда `1`.

Реализация:

- Вызов reset из UI: `src/core/bootstrap.js` (`menuNew` → `resetGameState({ reason: 'new_game' })`).
- Применение правила `talentPoints = 1`: `game.js` (`createInitialState(options)` для `reason === 'new_game'`).

## Очки урона (Damage Points)

- В `state` хранится сырой накопитель урона: `totalDamageDealtRaw` (int, default `0`).
- Доступные очки урона: `damagePoints = max(0, floor(totalDamageDealtRaw / 10000) - damagePointsSpent)`.
- `damagePointsSpent` — суммарно потраченные очки урона на апгрейды стен.
- В `totalDamageDealtRaw` засчитывается только фактически снятое HP (`applied`, без overkill) и только при источнике урона `tank`.
- Поля `totalDamageDealtRaw`, `damagePointsSpent`, `fenceLevel` сохраняются в `progress`; старые сейвы без новых полей загружаются с дефолтами (`0`, `1`).
- При `New game`/reset значение сбрасывается в `0`.

## Уровни стен и броня

- Уровень стен хранится в `state.fenceLevel` (default `1`).
- Конфиг уровней: `assets/fence.json -> levels[]`.
- Приоритет конфига: `levels[]` выше `segmentMaxHp`; `segmentMaxHp` используется только как fallback для legacy-конфига.
- Формула урона сегменту забора: `finalDamage = max(0, incomingDamage - armorFlat)`.
- Если `incomingDamage <= armorFlat`, HP сегмента не уменьшается.

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
