# Tank Merge: Zombie Defense

Merge + tower defense на canvas.

## Быстрый старт

1. Открыть `index.html` в браузере.
2. Или запустить `npx serve .` и открыть `http://localhost:3000`.

## Главное меню (big menu)

- При открытии страницы сначала показывается большой стартовый экран (`#bigMenuOverlay`).
- `boot/loop` запускаются только после выбора `Новая игра` или `Загрузить`.
- Подробное поведение и порядок кнопок: `docs/main-menu.md`.

## Где настраивать карту

- Ground tiles/stamps: `assets/ground.json`
- Decor/noSpawnZones: `assets/decor.json`
- Runtime pipeline: `src/render/spriteLoaders.js`, `src/render/groundLayer.js`, `game.js` (`initDecors`)
- Подробные правила: `docs/map-generation.md`

## Формат `assets/tanks.json` (tank_lvlN)

- Конфиг теперь плоский: top-level ключи `tank_lvl1` … `tank_lvl60`.
- Для каждого уровня обязательны поля: `stats`, `body`, `cannon`.
- `stats`: `moveSpeed`, `attackSpeed`, `baseDamage`.
- `body` / `cannon`: `src`, `frame`, `frames`, `anchor`, `scale`, `animSpeed` (и для пушки `fireFrame`, `muzzle`, `recoil`).
- Опционально: `aura`, `bulletId` (default `bullet_base`), `bulletLevel` (default `1`).
- Используется только прямое чтение `tank_lvlN` (без fallback-наследования по предыдущим уровням).

Пример `tank_lvl1`:

```json
{
	"tank_lvl1": {
		"stats": { "moveSpeed": 1, "attackSpeed": 1, "baseDamage": 20 },
		"body": {
			"src": "tanks/body.png",
			"frame": { "x": 0, "y": 0, "w": 128, "h": 128 },
			"frames": 2,
			"animSpeed": 2,
			"anchor": { "x": 0.5, "y": 0.6 },
			"scale": 1
		},
		"cannon": {
			"src": "tanks/cannon_lvl1_desert.png",
			"frame": { "x": 0, "y": 0, "w": 128, "h": 128 },
			"frames": 8,
			"animSpeed": 10,
			"fireFrame": 2,
			"anchor": { "x": 0.5, "y": 0.7 },
			"scale": 1,
			"muzzle": { "x": 28, "y": -2 },
			"recoil": 4
		},
		"bulletId": "bullet_base",
		"bulletLevel": 1
	}
}
```

## Формат `assets/bullet.json`

- Конфиг пуль: `bullets.{bulletId}.levels[]`.
- Каждый уровень содержит: `bulletSprite`, `impactSprite`, `addDamage`, `aoe`, `sfx`.
- `bulletSprite.anchor` применяется при рендере снаряда.
- Для impact anchor из конфига игнорируется: impact всегда рисуется по центру точки попадания.
- Все bullet/impact кадры берутся только из `assets/bullet_atlas.png`.

Пример:

```json
{
	"atlas": "bullet_atlas.png",
	"bullets": {
		"bullet_base": {
			"levels": [
				{
					"addDamage": 0,
					"aoe": 1,
					"bulletSprite": {
						"src": "bullet_atlas.png",
						"frame": { "x": 0, "y": 0, "w": 32, "h": 32 },
						"frames": 4,
						"frameRateFps": 18,
						"anchor": { "x": 0.5, "y": 0.5 },
						"scale": 0.8
					},
					"impactSprite": {
						"src": "bullet_atlas.png",
						"frame": { "x": 0, "y": 32, "w": 32, "h": 32 },
						"frames": 6,
						"frameRateFps": 24,
						"scale": 1.6
					}
				}
			]
		}
	}
}
```

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

## Wave scaling anti-exploit

- Файл настройки: `src/config/worldEvents.js` (`attackMode.safeWaves`).
- `safeWaves` по умолчанию: `3`.
- Начиная с wave `safeWaves + 1`, при старте каждой новой волны: `zombieWaveAtkMult *= 1.05`.
- В формуле урона зомби `zombieWaveAtkMult` применяется последним множителем.
- При `New Game`/reset `zombieWaveAtkMult` сбрасывается в `1.0`.

## Bulk-buy танков (динамический X)

- Гейтинг bulk-buy идёт по `creator_*`: `none` → `buy2` → `buy5` → `buyMax`.
- До `creator_novice` кнопка `#buyBulk` скрыта (не занимает место).
- Формула: `X = min(maxByTier, freeSlots, affordableByCoins)`, где `affordableByCoins` считается точной симуляцией последовательных цен.
- Для текста: `xDisplay = max(2, X)`; если `X < 2`, кнопка disabled и клик no-op.
- Частичная bulk-покупка разрешена в рамках tier cap: покупается ровно `X`.

## Навигация через суперкомпьютер

- В правом HUD вход идёт через icon-only кнопку `#supercomputerBtn`; локализованный `aria-label` и `title` берутся из ключа `supercomputerBtn`.
- Root-меню суперкомпьютера содержит 3 tile-пункта в один ряд: `Модификации ангара`, `Модификации танков и стен`, `Древо улучшений`.
- У tile-пунктов сохраняются прежние IDs: `supercomputerOpenHangarMods`, `supercomputerOpenTankWallMods`, `supercomputerOpenTalents`.
- `Esc` в root-меню суперкомпьютера закрывает меню и снимает menu-pause (если settings уже не открыт).
- `Esc` в дочерних окнах суперкомпьютера (`mods*` и upgrade tree) делает шаг назад в root-меню, пауза сохраняется.
- Реализация: разметка в `index.html`, логика в `src/ui/supercomputerMenu.js` + orchestration в `game.js`, modal/a11y через `src/accessibility/a11y.js`, pause lock через `src/systems/pauseManager.js`.
- UI-правила для tabs/tiles и порядок feedback в in-session меню: `docs/supercomputer-ui.md`.

## Critical mode (5% HP порог)

- При первом пересечении порога `supercomputer.hp <= maxHp * 0.05` HP клампится ровно к `5%`, включается `criticalFlowActive`, открывается critical modal и ставится menu-pause lock.
- При входе в critical выполняется автосейв с предварительной очисткой танков (`cells[].tank = null`).
- Кнопки critical modal:
	- `Перезапустить симуляцию` — partial reset (танки очищаются, забор восстанавливается до `segment maxHp` при сохранённом `fenceLevel`, supercomputer HP восстанавливается), затем гарантируется `2x tank_lvl1` и игра продолжается.
	- `×` и `Сохранить прогресс и выйти` — повторная попытка сейва и `location.reload()` в большое меню.
- После загрузки любого сейва без танков автоматически вызывается спавн `2x tank_lvl1`.
- Детальный сценарий и edge-cases: `docs/critical-mode.md`.

## Boost UI

- HUD-блок `Boost` удалён; активные бусты рисуются рядом со спрайтом supercomputer в screen-space.
- Ассеты: `assets/boost_icons.json` + `assets/boost_icons_atlas.png`.
- JSON-схема:

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

- Таймер под иконкой: `Math.ceil(remainingSec)`.
- Кадр overlay: `p = clamp(1 - remainingSec/secondsTotal, 0..1)`, `idx = floor(p*(K-1))`.
- Если `cooldownOverlayFrames` отсутствует или содержит меньше 2 валидных кадров — иконка/таймер рисуются без overlay.
- Лимита на количество активных иконок нет: UI рисует все активные бусты.
- Повторная активация того же `boostId` сбрасывает `remainingSec` до полной длительности, без дублирования иконок.

## Feedback (main menu)

- Реализация виджета: `src/feedback/widget.js`.
- Floating-кнопка отключена: модалка открывается программно через `Game.FeedbackWidget.open()` (алиас `showModal()`).
- Кнопка в main menu: `#menuFeedback` (`data-i18n="menuFeedback"`) в `index.html`, клик привязан в `src/core/bootstrap.js`.
- Кнопка `#menuFeedback` в in-session меню (`#menuOverlay`) всегда последняя в списке действий.
- Все тексты feedback-модалки берутся из i18n ключей: `feedbackTitle`, `feedbackCategoryLabel`, `feedbackRatingLabel`, `feedbackMessagePlaceholder`, `feedbackCancel`, `feedbackSend`, `feedbackValidationMessageRequired`, `feedbackSuccess`, `feedbackCategory*`.
- Где менять тексты и категории: `src/i18n/ru.json`, `src/i18n/en.json` (fallback: `src/i18n/fallbackStrings.js`).

## Crate reward spawn rule

- Правило выдачи награды: после reward crate удаляется и танк спавнится строго в тот же слот (`crateSlotId`), где стоял crate.
- Точка логики: `game.js` (`claimCrateReward` + `grantCrateTank`).
- Альтернативный fallback в другой свободный слот не используется.
- При race/двойном вызове (crate удалён/заменён, невалидный слот, занятый слот) выдача безопасно пропускается с `console.warn`, без краша.

## Глоссарий терминов

- RU: `улучшение`, `Очки улучшений`, `Древо улучшений`.
- EN: `upgrade`, `Upgrade points`, `Upgrade Tree`.
- i18n ключи: `talentsBtn`, `supercomputerTalentsBtn`, `talentTreeTitle`, `talentPoints`, `levelModalTalent`, `talentResetAll`, `talentResetModalText`.

## Достижения и merge-прогресс

- Правила успешного merge и инкремента `totalMerges`: `docs/achievements.md`.
- UI списка достижений (collapse + single-open + a11y): `docs/achievements-ui.md`.
- Пороги `creator_novice/pro/expert`: `100/400/1000` (auto-merge unlock roadmap PACK2/3).

## New Game reset и стартовые таланты

- Кнопка **Новая игра** (`menuNew`) делает reset с причиной `reason: 'new_game'` и выставляет **ровно** `player.talentPoints = 1`.
- В этом же reset сбрасывается anti-exploit множитель волн: `zombieWaveAtkMult = 1.0`.
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
