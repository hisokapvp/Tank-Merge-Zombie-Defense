# Configs

## assets/zombies.json

- `corpseDespawnSec` — время существования трупа **после** окончания death-анимации (сек).
- `corpseFadeOutSec` — длительность fade-out в конце life-time трупа (сек).

### Runtime-нормализация

- Оба значения приводятся к `Number` и clamp'ятся к `>= 0`.
- `corpseFadeOutSec` дополнительно clamp'ится до `corpseDespawnSec`.

### Поведение

- Общий life-time трупа до удаления: `deathAnimDuration + corpseDespawnSec`.
- Fade применяется только в хвосте life-time, линейно: `alpha = timeToRemove / corpseFadeOutSec`.
- При `corpseDespawnSec = 0` труп удаляется сразу после завершения death-анимации.

### Forced culling (лимит трупов)

- При превышении `corpseMaxCount` лишние трупы не удаляются мгновенно.
- Для них принудительно сокращается оставшийся таймер до ускоренного fade `~0.2s`, после чего удаление происходит штатным механизмом.
- Это сохраняет плавное исчезновение и избегает тяжёлых burst-удалений в один кадр.

## assets/fence.json

- `levels[].uiFrameId` — backward-compatible id кадра из `frames[].id` для превью уровня стены в таблице `Стены` суперкомпьютера.
- `levels[].uiIcon` — расширенная конфигурация превью уровня стены:
	- `uiIcon.atlas` — atlas для UI-превью (может отличаться от боевого atlas уровня).
	- `uiIcon.frameId` — id кадра из `frames[].id`.
	- `uiIcon.frame` — прямые координаты кадра `{ x, y, w, h }` без обязательной привязки к `frames[]`.
- Приоритет выбора кадра: `uiIcon.frame` -> `uiIcon.frameId` -> `uiFrameId` -> fallback `sideTop`.
- Приоритет выбора атласа: `uiIcon.atlas` -> `uiAtlas` -> `levels[].atlas` -> root `atlas`.

## assets/supercomputer.json

- `animations.*.scale` — optional-множитель масштаба конкретной анимации; применяется поверх root `renderScale`.
- `animations.*.effects` — optional-массив визуальных эффектов для конкретной анимации:
	- строковый preset (`"float"`, `"pulse"`, `"sway"`, `"wobble"`, `"vibration"`, `"vibrationStrong"`),
	- либо объект с `preset`/`type` и override-полями `amplitudeX`, `amplitudeY`, `angleDeg`, `scaleMul`, `frequencyHz`, `phase`, `offsetX`, `offsetY`.
- `conveyor` — optional-конфиг ленточного конвейера рядом с суперкомпьютером: `atlas`, `offset`, `anchor`, `animations.idle`, `animations.work`.
- `storageCell` — optional-конфиг ячейки-склада: `atlas`, `offset`, `anchor`, `animations.idle`, `animations.hover`.
- Для legacy-конфигов сохраняется обратная совместимость:
	- отсутствие `conveyor`/`storageCell` оставляет старую fallback-геометрию и fallback-отрисовку;
	- legacy-ключ `storage` при загрузке трактуется как `storageCell`.

## src/config/layoutTuning.js

- `weaponIconW` — ширина превью оружия в UI суперкомпьютера (включая `canvas` в таблице `Оружия`).
- При увеличении `weaponIconW` необходимо синхронно расширять ширину sprite-колонки в CSS таблицы `Оружия`, иначе спрайт/анимация будут обрезаться по ширине.
- `supercomputerTileWidthPx` / `supercomputerTileHeightPx` — размеры root-плашек supercomputer (root menu) через CSS custom properties `--scRootTileWidthPx`/`--scRootTileHeightPx`.
- Таблицы `Орудия`/`Стены` используют отдельные CSS custom properties `--scTableTileWidthPx`/`--scTableTileHeightPx` и не зависят от `supercomputerTileWidthPx`/`supercomputerTileHeightPx`.
- `supercomputerTileIconSizePx` — размер иконки root-плашек supercomputer (baseline `250`).

## assets/tanks.json

- `tankPrintDurationSec` — длительность stamp-reveal печати танка в ангаре (сек).
- Значение читается runtime-логикой печати с fallback `1.5`, если поле отсутствует/невалидно.

## assets/chips.json

Конфигурация спрайтов, эффектов и звуков для чип-модификаторов ангара.

### Структура верхнего уровня

- `atlas` — путь к атласу спрайтов (например `"assets/chips_atlas.png"`).
- `modifiers` — объект, ключи — ID модификатора (`"1"`.."14"`), значения — конфиг модификатора.

### Конфиг модификатора

Каждый модификатор содержит:

- `projectile` — спрайт снаряда: `{ sprite, frameWidth, frames, scale, tint }`.
- `projectileSmall` *(опционально, mod 3)* — спрайт child-снаряда (матрёшка).
- `projectileCombo` *(опционально, mod 6)* — спрайт комбо-снаряда.
- `projectileNormal` *(опционально, mod 8)* — спрайт обычного снаряда (нука в cooldown-е).
- `impact` — спрайт попадания: `{ sprite, frameWidth, frames, scale, tint }`.
- `effect` — спрайт эффекта: `{ sprite, frameWidth, frames, scale, tint }`.
  - Дополнительные поля для пулов/нод: `poolLife`, `poolRadius`, `slowFactor`, `nodeLife`.
- `sfx` — звуковые файлы: `{ shoot, impact }` и/или модификатор-специфичные (`chain`, `push`, `calm`, `fire`, `ice`, `electro`, `laser`, `acid`).

### Загрузка

- `boot()` в `game.js` загружает `assets/chips.json` через `fetch` и вызывает `ChipEffects.loadChipsCfg(data)`.
- Если файл не загрузился, чип-эффекты работают без визуальных/звуковых настроек (fallback поведение).
## src/mechanics/chipEffects.js — runtime-параметры

- `Game.ChipEffects.DOUBLE_SHOT_MIN_TARGET_DISTANCE` (read/write, default `120`) — минимальная дистанция (px) между основной и вторичной целью модификатора «Двойной снаряд» (mod 1). Увеличение значения заставляет второй снаряд искать более далёких зомби; уменьшение — допускает ближайших.