# SYSTEM: Assets

## Purpose

Описывает пайплайн контента: где лежат JSON-конфиги и спрайты, как они подгружаются и как безопасно обновлять ассеты.

## Быстрый ответ (куда идти)

- Конфиги: `assets/tanks.json`, `assets/zombies.json`, `assets/fence.json`, `assets/decor.json`.
- Доки по форматам: `assets/tanks_README.md`, `assets/zombies_README.md`.
- Загрузка в рантайме: `game.js` (`TankSprites.load`, `ZombieSprites.load`, `FenceSprites.load`, `DecorSprites.load`).

## Key files

- `assets/tanks.json`
- `assets/zombies.json`
- `assets/fence.json`
- `assets/decor.json`
- `assets/tanks/`, `assets/sfx/`, `assets/talent_icon/`
- `src/utils/tankConfig.js`
- `game.js`

## Entrypoints

- `boot()` вызывает загрузчики спрайтов.
- `window.Game.TankSprites` публикуется из `game.js`.
- `Game.TankConfig.getTankVisualSpec(level)` решает варианты корпуса/пушки/aura/bullet.

## Data & config

- `tanks.json`: `body/bodies/cannons/levels`.
- `zombies.json`: `atlas/deathCommon/types[]`.
- Обязательна валидная JSON структура; health check проверяет parse.

## Common edits

1. **Добавить новый вариант пушки/корпуса**
   - Править `assets/tanks.json` (`bodies` или `cannons`, затем `levels`).

2. **Добавить/изменить death-анимацию зомби**
   - Править `assets/zombies.json` (`deathCommon` и/или `types[].death`).

3. **Изменить декор/забор**
   - Обновить `assets/decor.json` или `assets/fence.json`.
   - Проверить fallback в `game.js` при пустых списках.

4. **Переключить визуал по флагу**
   - Использовать `flag`-зависимые ветки в `src/utils/tankConfig.js`.

## Don’t touch / risks

- Не меняй поля схемы произвольно (сломается runtime pick logic).
- Не ссылайся на несуществующие PNG/atlas-файлы.
- Не редактируй только `assets/*_README.md` без синхронизации с реальным JSON.

## Checks

- `node ops/monitoring/health_check.js --root .`
- Ручной: старт игры без ошибок загрузки ассетов в консоли.
- Регресс: `node Test/pack7/fenceAssetsCornersSides.test.js` и смежные визуальные тесты fence.
