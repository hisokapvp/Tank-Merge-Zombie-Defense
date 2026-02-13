# SYSTEM: Assets

## Где искать

- Конфиги: `assets/tanks.json`, `assets/zombies.json`, `assets/fence.json`, `assets/decor.json`, `assets/ground.json`
- Схемы: `assets/tanks_README.md`, `assets/zombies_README.md`
- Runtime loaders: `src/render/spriteLoaders.js`

## Что править

- Танки: `bodies`/`cannons`/`levels` в `tanks.json`.
- Зомби: `types`, `deathCommon`, `spawn` в `zombies.json`.
- Окружение: `fence.json`, `decor.json`.
- Земля/подложка: `ground.json`.

### Ground (`assets/ground.json`)

- Top-level:
	- `atlas`: имя atlas-файла (по умолчанию `ground_atlas.png`).
	- `tile`: `{w,h}` размер кадра (px), сейчас `16x16`.
	- `mode`: `manual | procedural`.
	- `fillMode`: `repeat | stretch`.
- `manual`:
	- `anchor`: `center` (центр тайла = центр клетки).
	- `grid`: матрица тайлов `[{ frame:{col,row}, rotationDeg?, scale? }]`.
- `procedural`:
	- `seed`: строка/число для детерминизма.
	- `weights`: массив `{ frame:{col,row}, weight, rotationDeg?, scale? }`.
	- Допускаются дубликаты `{col,row}` с разными `rotationDeg/scale`.

Runtime:

- Loader: `GroundSprites.load()` в `src/render/spriteLoaders.js`.
- При ошибке загрузки atlas/config рендер возвращается к legacy background.

### Fence (`assets/fence.json`)

- Top-level `cornerInsetPx` (optional): override авто-расчёта inset для углов на каждой стороне.
- `frames[].rotationDeg` (optional, degrees, default `0`): поворот конкретного кадра сегмента при `drawZombieFence()`.
- `frames[].scale` влияет на геометрию раскладки сегментов (step/inset) и реальный размер спрайта.

## Риски

- Не менять JSON-схемы без обновления runtime.
- Не ссылаться на несуществующие файлы.
- `zombies.spawn`: держать согласованность `targetAlive ≈ sideCount * perSideTarget`.
- Для `ground.json` не использовать отрицательные `tile.w/h` и не нулевые веса.

## Мини-проверка

- `node ops/monitoring/health_check.js --root .`
- Ручной запуск игры без ошибок загрузки ассетов.
