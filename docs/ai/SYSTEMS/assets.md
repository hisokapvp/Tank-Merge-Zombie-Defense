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

- Top-level `cornerInsetPx` (float, default `0`): signed ручная подстройка угловых сегментов после базового стыка по bounds.
- Отрицательное значение допустимо: увеличивает заход corner в side (контролируемое перекрытие).
- `frames[].rotation` (priority) → `frames[].rotationDeg` → `0` (degrees): поворот конкретного кадра сегмента.
- `frames[].scale` влияет на геометрию раскладки сегментов (step/inset) и реальный размер спрайта.

### Decor (`assets/decor.json`)

- `count` / `spriteIds[]` / `noSpawnZones[]` можно задавать в JSON.
- `placementMaxAttempts` (int, default `40`): число попыток размещения на один этап области поиска для каждого decor-объекта.
- `frames[].scale` (optional, default `1`): локальный множитель размера конкретного декор-кадра.
- `frames[].isWall` (optional, default `false`): если `true`, decor считается стеной для зомби (коллизия + обход без телепорта).
- `noSpawnZones[]`: `circle {type:'circle',cx,cy,r}` и `rect {type:'rect',x,y,w,h}` в world-coords.
- Приоритет runtime: `BAL.decorNoSpawnZones` / `BAL.decorCount` / `BAL.decorSpriteIds` переопределяют JSON.
- Генератор decor выполняет `count` строго, без overlap и с соблюдением `noSpawnZones`; область поиска расширяется до краёв карты.

### Stamps (`assets/ground.json`)

- `stamps[]` задаёт stamp-set’ы для ground atlas.
- Runtime-правила: non-overlap между stamp-областями/спрайтами, суммарный coverage-порог `>= 80%` по всем set’ам (без console-логов при недоборе).

### Zombies (`assets/zombies.json`)

- `types[].attack` (optional) поддерживается по аналогии с `death`:
	- `{ x, y, w, h, frames }`
	- если `attack` отсутствует, используется обычная `frame` анимация (fallback).
- Параметры анимаций (per `types[i]`):
	- `animations.walk.frameRateFps`
	- `animations.attack.frameRateFps`
	- `animations.death.frameRateFps`
	- `animations.deathCommon.frameRateFps`
- Параметры атаки (per `types[i]`):
	- `attack.attackRangePx`
	- `attack.attackCooldownSec`
	- `attack.attackHitAt` (runtime clamp в `0..1`)
- Global common death может содержать `deathCommon.frameRateFps`.
- Runtime применяет дефолты/валидацию без console-спама для старых конфигов.

## Риски

- Не менять JSON-схемы без обновления runtime.
- Не ссылаться на несуществующие файлы.
- `zombies.spawn`: держать согласованность `targetAlive ≈ sideCount * perSideTarget`.
- Для `ground.json` не использовать отрицательные `tile.w/h` и не нулевые веса.
- Weather SFX конфиг и runtime-правила описаны в `docs/ai/SYSTEMS/worldEvents.md`.

## Мини-проверка

- `node ops/monitoring/health_check.js --root .`
- Ручной запуск игры без ошибок загрузки ассетов.
