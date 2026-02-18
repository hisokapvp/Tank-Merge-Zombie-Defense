# SYSTEM: Save / Offline

## Где искать

- Save/load: `src/persistence/storage.js`
- Initial defaults/state shape: `src/persistence/initialState.js`
- Offline модель: `src/persistence/offlineRewardModel.js`, `src/persistence/offlineProgress.js`
- UX: `src/ui/continueFlow.js` (offline modal отключена)
- Boot integration: `src/core/bootstrap.js`

## Что править

- Новые поля прогресса: сериализация + восстановление.
- Offline формулы: сначала модель, потом runtime hooks.
- Порог offline-отсутствия: `OFFLINE_THRESHOLD_MS` (используется только в continue-flow логике).
- Любые изменения схемы: синхронно `initialState` + `storage` + restore path в boot.

## Новые поля сейва

- `supercomputer`:
	- `computerLevel`, `xp`, `xpToNext`, `maxLevel`,
	- `hp`, `maxHp`, `armorFlat`,
	- runtime-поля state machine (`state`, `animElapsedSec`, `glitch*`, `wantsBuildTank/pendingBuildTank`).
- legacy-поля `player.level/xp` читаются только как fallback при миграции старых сейвов.

- `achievements`:
	- `unlocked` — карта полученных достижений,
	- `totalPurchased` — накопленный прогресс покупок,
	- `popupQueue` в сейв не критичен (на загрузке очищается).
- `fenceState`:
	- `segmentsPerSide` — сигнатура конфигурации,
	- `hpById` — сохранённое HP сегментов по стабильному `id`.
- `fenceLevel`:
	- текущий уровень стен (default `1`).
- `mapSeeds`:
	- `stampsSeed` — seed stamps placement,
	- `decorSeed` — seed decor placement,
	- применяется на load приоритетно из сейва (без перезаписи значениями из `assets/*.json`).
- `totalDamageDealtRaw`:
	- int, default `0`, монотонный накопитель нанесённого танками урона,
	- учитывается только applied damage по зомби (без overkill), источник урона `tank`.
- `damagePointsSpent`:
	- int, default `0`, сумма потраченных очков на апгрейды fence.
	- производная метрика: `damagePoints = max(0, floor(totalDamageDealtRaw / 10000) - damagePointsSpent)`.
- `drones`:
	- сериализуются `id/level/mode/substate/pos/basePos` (и служебные поля repair-процесса).
	- при load резервы fence не восстанавливаются «как есть»: runtime сбрасывает `reservedByDroneId` и безопасно ре-валидирует цели.

## Миграция / совместимость

- Старые сейвы без новых полей загружаются без ошибок.
- Для достижений без `totalPurchased` прогресс может быть восстановлен из исторического `buyCounts`.
- При смене `segmentsPerSide` восстановление fence HP идёт по совпавшим `id`; новые/изменённые сегменты получают `maxHp`.
- Для `mapSeeds`: старые сейвы без поля загружаются корректно; seed берётся из assets только если в сейве отсутствует.
- Для `totalDamageDealtRaw`: старые сейвы без поля загружаются корректно с дефолтом `0`.
- Для `fenceLevel`: старые сейвы без поля загружаются с дефолтом `1`.
- Для `damagePointsSpent`: старые сейвы без поля загружаются с дефолтом `0`.
- Для `drones`: старые сейвы без поля загружаются корректно с дефолтом `[]`.

## Риски

- Сохранять backward compatibility save.
- Не менять ключи сохранения без миграции.
- Не ломать ветку `legacyProgress` при загрузке старых сейвов.
- Offline modal/claim flow отключены в runtime (нет показа и ввода через canvas-loop).

## Мини-проверка

- `node Test/pack8/offlineProgress.test.js`
- Ручной сценарий: пауза > 5 мин и возврат не должен открывать offline modal.

## New Game: правило стартового таланта

- Reset по кнопке `menuNew` идёт отдельным путём через `src/core/bootstrap.js`:
	- `menuNew` → `resetGameState({ reason: 'new_game' })`.
- В `game.js` правило применено при создании state:
	- `createInitialState(options)` выставляет `player.talentPoints = 1` **только** при `reason === 'new_game'`.
	- Используется присваивание (не инкремент), поэтому повторный reset не накапливает очки.

Ожидаемое поведение по сценариям:

- Boot без сейва: `talentPoints` не форсится в `1` (остаётся дефолт initial state).
- Load сейва: `talentPoints` берётся из сейва (`applySavedProgress`), без post-load бонуса.
- New Game reset: `talentPoints === 1` сразу после создания нового state.

## Damage points: reset/load contract

- При `New game`/reset поле `totalDamageDealtRaw` сбрасывается в `0`.
- При `New game`/reset поле `damagePointsSpent` сбрасывается в `0`, `fenceLevel` — в `1`.
- При save/load поля сериализуются/десериализуются в payload `progress` как `totalDamageDealtRaw`, `damagePointsSpent`, `fenceLevel`.
- При открытии модалки «Модификации танков и стен» UI показывает локализованную строку:
	- RU: `Очки урона: {count}`
	- EN: `Damage points: {count}`
	- где `{count} = floor(totalDamageDealtRaw / 10000)`.
