# SYSTEM: Assets

## Purpose

Описывает пайплайн контента: где лежат JSON-конфиги и спрайты, как они подгружаются и как безопасно обновлять ассеты.

## Быстрый ответ (куда идти)

- Конфиги: `assets/tanks.json`, `assets/zombies.json`, `assets/fence.json`, `assets/decor.json`.
- Доки по форматам: `assets/tanks_README.md`, `assets/zombies_README.md`.
- Загрузка в рантайме: `src/render/spriteLoaders.js` (`Game.SpriteLoaders.createSpriteLoaders`).

## Key files

- `assets/tanks.json`
- `assets/zombies.json`
- `assets/fence.json`
- `assets/decor.json`
- `assets/tanks/`, `assets/sfx/`, `assets/talent_icon/`
- `src/utils/tankConfig.js`
- `src/render/spriteLoaders.js`
- `game.js`

## Entrypoints

- `boot()` вызывает загрузчики спрайтов, созданные через `Game.SpriteLoaders.createSpriteLoaders(...)`.
- `window.Game.TankSprites` публикуется в `game.js` после инициализации bundle из `src/render/spriteLoaders.js`.
- `Game.TankConfig.getTankVisualSpec(level)` решает варианты корпуса/пушки/aura/bullet.

## Data & config

- `tanks.json`: `body/bodies/cannons/levels`.
- `zombies.json`: `atlas/deathCommon/types[]` + `spawn`.
- `zombies.json.spawn`:
   - `targetAlive` — целевой alive-cap (например, `240`);
   - `sideCount` — число сторон кольца/квот (обычно `4`);
   - `perSideTarget` — целевой alive на сторону (например, `60`);
   - `perSideTolerance` — допустимое отклонение на сторону (например, `5`).
- `fence.json`: `frames[].scale` поддерживается без clamp (например `0.75`).
- `fence.json`: обязательные `corner*` и `side*` ids используются для квадратного забора.
- Обязательна валидная JSON структура; health check проверяет parse.

## Common edits

1. **Добавить новый вариант пушки/корпуса**
   - Править `assets/tanks.json` (`bodies` или `cannons`, затем `levels`).

2. **Добавить/изменить death-анимацию зомби**
   - Править `assets/zombies.json` (`deathCommon` и/или `types[].death`).

3. **Изменить лимиты спавна зомби (data-driven)**
   - Править `assets/zombies.json.spawn`.
   - Сохранять согласованность: `targetAlive ≈ sideCount * perSideTarget`.
   - Для цели `240` использовать профиль `4 x 60` с допуском `±5`.

4. **Изменить декор/забор**
   - Обновить `assets/decor.json` или `assets/fence.json`.
   - Проверить fallback в `game.js` при пустых списках.
   - Для fence визуальный `scale` влияет и на рендер, и на bounds/avoid зомби.
   - Для зазора дорога↔fence (6–12px world-scale) правки в геометрии/клипе делать в `game.js` (`initBoard`, `drawTankTrack`), не в `fence.json`.

5. **Переключить визуал по флагу**
   - Использовать `flag`-зависимые ветки в `src/utils/tankConfig.js`.

## Don’t touch / risks

- Не меняй поля схемы произвольно (сломается runtime pick logic).
- Не ссылайся на несуществующие PNG/atlas-файлы.
- Не редактируй только `assets/*_README.md` без синхронизации с реальным JSON.

## Checks

- `node ops/monitoring/health_check.js --root .`
- Ручной: старт игры без ошибок загрузки ассетов в консоли.
- Ручной: после стабилизации волны alive ≈ `targetAlive`, распределение по 4 сторонам в пределах `perSideTarget ± perSideTolerance`.
- Регресс: `node Test/pack7/fenceAssetsCornersSides.test.js`, `node Test/pack7/fenceCornerSlots.test.js`, `node Test/pack7/fenceSquareGeometry.test.js`.
