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

- Ключевые поля: `atlas`, `tile`, `mode`, `fillMode`, `manual.grid`, `procedural.weights`, `stamps[]/pieces[]`.
- `mode`: `manual | procedural`; `fillMode`: `repeat | stretch`.
- Runtime: `GroundSprites.load()` в `src/render/spriteLoaders.js`; при ошибке загрузки fallback на legacy background.

### Fence (`assets/fence.json`)

- Top-level `cornerInsetPx` (optional): override авто-расчёта inset для углов на каждой стороне.
- `frames[].rotation` (priority) → `frames[].rotationDeg` → `0` (degrees): поворот конкретного кадра сегмента.
- `frames[].scale` влияет на геометрию раскладки сегментов (step/inset) и реальный размер спрайта.

### Decor (`assets/decor.json`)

- `count` / `spriteIds[]` / `noSpawnZones[]` можно задавать в JSON.
- `frames[].scale` (optional, default `1`): локальный множитель размера конкретного декор-кадра.
- `frames[].isWall` (optional, default `false`): если `true`, decor считается стеной для зомби (коллизия + обход без телепорта).
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
- Weather SFX конфиг и runtime-правила описаны в `docs/ai/SYSTEMS/worldEvents.md`.

## Мини-проверка

- `node ops/monitoring/health_check.js --root .`
- Ручной запуск игры без ошибок загрузки ассетов.
