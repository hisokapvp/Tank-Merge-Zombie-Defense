# SYSTEM: Assets

## Где искать

- Конфиги: `assets/tanks.json`, `assets/zombies.json`, `assets/fence.json`, `assets/decor.json`, `assets/ground.json`, `assets/supercomputer.json`
- Схемы: `assets/tanks_README.md`, `assets/zombies_README.md`
- Runtime loaders: `src/render/spriteLoaders.js`

## Что править

- Танки: top-level `tank_lvl1..tank_lvl60` в `tanks.json` (без `bodies/cannons/levels`).
- Пули: `assets/bullet.json` + общий атлас `assets/bullet_atlas.png`.
- Зомби: `types`, `deathCommon`, `spawn` в `zombies.json`.
- Окружение: `fence.json`, `decor.json`.
- Земля/подложка: `ground.json`.
- Supercomputer: `supercomputer.json` (`animations`, `glitch`, `stats`, `offsetY`).
- Boost icons: `boost_icons.json` + `boost_icons_atlas.png` (иконки и cooldown overlay для screen-space UI рядом с supercomputer).
- BonusBox/crate: `bonusbox.json` (`atlas`, `frames[]`, `animations.drop/idle/hover/press`).

### Tanks (`assets/tanks.json`)

- Ключи уровней: `tank_lvlN` (например `tank_lvl1`, `tank_lvl60`).
- Каждый `tank_lvlN` содержит минимум:
	- `stats: { moveSpeed, attackSpeed, baseDamage }`
	- `body: { src, frame, frames, anchor, scale, animSpeed/frameRateFps }`
	- `cannon: { src, frame, frames, anchor, scale, animSpeed/frameRateFps, fireFrame, muzzle, recoil }`
- Опционально:
	- `aura` (та же clip-схема)
	- `bulletId` (default `bullet_base`)
	- `bulletLevel` (default `1`)
- Runtime: `TankSprites.getTank(level)` + `pickBody/pickCannon/pickAura`; fallback по прошлым уровням не используется.
- Если запрошен уровень выше максимального в JSON — runtime clamp до max и пишет warning один раз.

### Bullets (`assets/bullet.json`)

- Корень: `atlas` + `bullets`.
- `bullets[bulletId].levels[]` — уровни с параметрами:
	- `bulletSprite`, `impactSprite` (clip-конфиги)
	- `addDamage`, `aoe`, `sfx`
- Рендер-правила:
	- bullet и impact кадры берутся только из `assets/bullet_atlas.png`
	- impact всегда рисуется по центру точки попадания (anchor из конфига impact игнорируется)
- Runtime: `BulletSprites.getBullet(bulletId, bulletLevel)`; при отсутствии `bullet_base`/пустых levels игра не падает, выстрел становится no-op с warning.

### Supercomputer (`assets/supercomputer.json`)

- Основные поля: `atlas`, `offsetY`, `anchor`, `renderScale`, `hpBar`.
- `boostIcons`: screen-space layout для группы boost-иконок рядом со спрайтом supercomputer:
	- `anchor`: `top|bottom` (базовая сторона спрайта)
	- `offsetX`, `offsetY`: смещения группы
	- `maxPerRow`: лимит иконок в строке
	- `gapX`, `gapY`: интервалы между иконками/рядами
- `animations`: `idle/work`, `glitch`, `buildTank`, `destroy` с кадрами/скоростью (`x,y,w,h,frames,frameRateFps,loop`).
- `glitch`: `chancePerSecond`, `minLoops`, `maxLoops`, `cooldownSec`.
- `stats`: data-driven формулы `maxHp`/`armorFlat` по `computerLevel`.
- Runtime: `SupercomputerSprites.load()` в `src/render/spriteLoaders.js`.

### Supercomputer root tile icons (`assets/computer_icons/*`)

- Файлы template-иконок (128x128 PNG):
	- `assets/computer_icons/hangar_mods_template.png`
	- `assets/computer_icons/tank_wall_mods_template.png`
	- `assets/computer_icons/talent_tree_template.png`
- Подключение выполняется через CSS по ID tiles root-меню supercomputer.
- Пользователь может заменять PNG напрямую без изменения JS/HTML логики.

### Boost icons (`assets/boost_icons.json`)

- Базовая схема:

```json
{
	"atlas": "boost_icons_atlas.png",
	"boosts": {
		"<boostId>": {
			"iconFrames": [{ "x": 0, "y": 0, "w": 32, "h": 32 }],
			"cooldownOverlayFrames": [{ "x": 32, "y": 0, "w": 32, "h": 32 }]
		}
	}
}
```

- `boostId` должен совпадать с runtime-идентификатором эффекта (например, `speedBoost`, `attackBoost`, `defenseBoost`, `economyBoost`).
- `iconFrames[0]` используется как базовая иконка буста.
- `cooldownOverlayFrames` опционален; если кадров `< 2`, overlay не рисуется.
- Runtime loader: `BoostIconsSprites.load()` в `src/render/spriteLoaders.js`.
- Runtime render (в `game.js`):
	- таймер под иконкой: `Math.ceil(remainingSec)`;
	- прогресс overlay: `p = clamp(1 - remainingSec/secondsTotal, 0..1)`, `idx = floor(p*(K-1))`;
	- количество иконок не ограничено (рисуются все активные boosts).

### Ground (`assets/ground.json`)

- Ключевые поля: `atlas`, `tile`, `mode`, `fillMode`, `manual.grid`, `procedural.weights`, `stamps[]/pieces[]`.
- `mode`: `manual | procedural`; `fillMode`: `repeat | stretch`.
- Runtime: `GroundSprites.load()` в `src/render/spriteLoaders.js`; при ошибке загрузки fallback на legacy background.

### Fence (`assets/fence.json`)

- Top-level `cornerInsetPx` (float, default `0`): signed ручная подстройка угловых сегментов после базового стыка по bounds.
- Отрицательное значение допустимо: увеличивает заход corner в side (контролируемое перекрытие).
- `levels[]` (приоритетнее legacy `segmentMaxHp`):
	- `segmentMaxHp` (int >= 1),
	- `armorFlat` (int >= 0),
	- `upgradeCostDamagePoints` (int >= 0, для последнего уровня может быть `0` или отсутствовать).
- Fallback: если `levels[]` отсутствует/пустой — runtime использует legacy `segmentMaxHp` как единственный уровень с `armorFlat=0`.
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

### Drones (`assets/dron.json`)

- Ключевые поля:
	- `atlas`/`png`
	- `frames[]` (optional legacy)
	- `animations.{idle,fly,repair}`
	- `levels[1..N]` (`N >= 10`) с `moveSpeedPxSec`, `repairSpeedMult`, `costMult`
	- `baseRepairSec`
	- `iconSize`, `iconsOffsetY`
- Формат анимации поддерживает два варианта:
	- legacy: `{ frames:[id...], frameRateFps, loop }`
	- clip: `{ x, y, w, h, frames, frameRateFps, loop }` (кадры берутся из atlas-strip слева направо)
- Runtime: `DronSprites.load()` в `src/render/spriteLoaders.js`.
- Путь к atlas/png берётся только из JSON (без хардкода в `game.js`).

### BonusBox (`assets/bonusbox.json`)

- Обязательные поля:
	- `atlas` (например, `bonusbox_atlas.png`)
	- `animations.drop|idle|hover|press` с clip-форматом `{ x, y, w, h, frames, frameRateFps, loop }`
	- `frames[]` в формате `{ id, x, y, w, h }` (optional legacy)
- Семантика loop:
	- one-shot: `drop`, `press` (`loop:false`)
	- зацикленные: `idle`, `hover` (`loop:true`)
- Runtime-loader: `BonusBoxSprites.load()` в `src/render/spriteLoaders.js`.

## Риски

- Не менять JSON-схемы без обновления runtime.
- Не ссылаться на несуществующие файлы.
- `zombies.spawn`: держать согласованность `targetAlive ≈ sideCount * perSideTarget`.
- Для `ground.json` не использовать отрицательные `tile.w/h` и не нулевые веса.
- Weather SFX конфиг и runtime-правила описаны в `docs/ai/SYSTEMS/worldEvents.md`.

## Мини-проверка

- `node ops/monitoring/health_check.js --root .`
- Ручной запуск игры без ошибок загрузки ассетов.
