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
	- `grid`: матрица тайлов `[{ frame:{col,row}|{x,y,w,h,scale?}, rotationDeg?, scale? }]`.
- `procedural`:
	- `seed`: строка/число для детерминизма.
	- `weights`: массив `{ frame:{col,row}|{x,y,w,h,scale?}, weight, rotationDeg?, scale? }`.
	- Допускаются дубликаты `{col,row}` с разными `rotationDeg/scale`.
- `stamps[]` (алиас `pieces[]`): куски карты
	- `stamp`: `{ id, mode?, count, spawnArea, items[] }`
	- `mode`:
		- `composite` (по умолчанию) — каждый placement рисует все `items[]` со своими `xg/yg`.
		- `variants` — каждый placement выбирает ровно один item-вариант из `items[]`.
		- Для `variants`: при `count >= items.length` каждый вариант гарантированно используется минимум один раз; остаток распределяется детерминированно по seed/stamp.id; порядок placement перемешивается детерминированно.
	- `spawnArea`: `rect|circle` в world-coords относительно центра.
	- `items[]`: `{ xg, yg, x, y, w, h, scale }`, рисуется в `(spawnPoint.x + xg, spawnPoint.y + yg)`.

Runtime:

- Loader: `GroundSprites.load()` в `src/render/spriteLoaders.js`.
- При ошибке загрузки atlas/config рендер возвращается к legacy background.

### Fence (`assets/fence.json`)

- Top-level `cornerInsetPx` (optional): override авто-расчёта inset для углов на каждой стороне.
- `frames[].rotation` (priority) → `frames[].rotationDeg` → `0` (degrees): поворот конкретного кадра сегмента.
- `frames[].scale` влияет на геометрию раскладки сегментов (step/inset) и реальный размер спрайта.

### Decor (`assets/decor.json`)

- `count` / `spriteIds[]` / `noSpawnZones[]` можно задавать в JSON.
- `frames[].scale` (optional, default `1`): локальный множитель размера конкретного декор-кадра.
- `noSpawnZones[]`: `circle {type:'circle',cx,cy,r}` и `rect {type:'rect',x,y,w,h}` в world-coords.
- Приоритет runtime: `BAL.decorNoSpawnZones` / `BAL.decorCount` / `BAL.decorSpriteIds` переопределяют JSON.

### Zombies (`assets/zombies.json`)

- `types[].attack` (optional) поддерживается по аналогии с `death`:
	- `{ x, y, w, h, frames }`
	- если `attack` отсутствует, используется обычная `frame` анимация (fallback).

## Риски

- Не менять JSON-схемы без обновления runtime.
- Не ссылаться на несуществующие файлы.
- `zombies.spawn`: держать согласованность `targetAlive ≈ sideCount * perSideTarget`.
- Для `ground.json` не использовать отрицательные `tile.w/h` и не нулевые веса.

## Weather SFX (WorldEvents)

- Конфиг дождя: `src/config/worldEvents.js` → `weather.rain`.
- Поддерживаемые поля для loop-звука дождя:
	- `sfxLoopSources: ['assets/sfx/rain_loop.ogg','assets/sfx/rain_loop.wav']`
	- или `sfxLoopFile: 'assets/sfx/rain_loop.ogg'`
- При отсутствии этих полей используется дефолт:
	- `assets/sfx/rain_loop.ogg`
	- fallback: `assets/sfx/rain_loop.wav`
- Файлы нужно класть в папку `assets/sfx/`.

## Мини-проверка

- `node ops/monitoring/health_check.js --root .`
- Ручной запуск игры без ошибок загрузки ассетов.
