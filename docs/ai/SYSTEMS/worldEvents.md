# SYSTEM: World Events

## Где искать

- Конфиг: `src/config/worldEvents.js`
- Runtime логика: `game.js` (`getWorldEventsAttackCfg`, `getWeatherCfg`, `updateWorldEvents`, `getZombieAttackMultipliers`)
- Debug toggles: `src/ui/debugPanel.js`

## Что править

- Тайминги attackMode (`attackEverySec`, `attackDurationSec`, `weatherLeadInSec`, `weatherLeadOutSec`) — в `src/config/worldEvents.js`.
- Множители атаки (`targetAliveMult`, `speedMult`, `damageMult`, `targetAliveRampSec`) — через `getZombieAttackMultipliers()`.
- Погода/SFX (`rain`, `lightning`, `thunder`, `rainLoop`) — конфиг + runtime в `updateWorldEvents`.
- Debug force-переключатели — только через `src/ui/debugPanel.js`.

## Force семантика (Debug)

- `Force weather`:
  - `ON` — погода включается сразу.
  - `OFF` — возврат к авто-логике weather.
- `Force attackMode`:
  - `ON` — attackMode включается сразу и применяет все эффекты attackMode (множители, спавн-цели, визуальные эффекты/погода, вечернее затемнение).
  - `OFF` — возврат к авто-логике attackMode.

## AttackMode множители и цель зомби

- Базовый принцип:
  - `EffectiveTargetAlive = BaseTargetAlive * targetAliveMult`
- В runtime это применяется в `getZombieSpawnBalanceConfig()` через `getZombieAttackMultipliers()`.

## Ramp targetAlive

- Новый параметр: `attackMode.targetAliveRampSec` (по умолчанию `2`, рабочий диапазон `1..3` сек).
- При старте attackMode множитель `targetAliveMult` растёт плавно от `1` до целевого значения за `targetAliveRampSec`.
- Работает и для auto attackMode, и для `Force attackMode`.

## Evening dim

- Параметр: `attackMode.eveningDimAlpha` (`0..1`, по умолчанию `0.16`).
- Затемнение включается только во время активного attackMode.

## Ключевые поля конфига

```js
attackMode: {
  enabled: true,
  attackEverySec: 180,
  attackDurationSec: 180,
  weatherLeadInSec: 5,
  weatherLeadOutSec: 3,
  targetAliveMult: 5,
  targetAliveRampSec: 2,
  speedMult: 1.2,
  damageMult: 1.15,
  eveningDimAlpha: 0.16,
}
```

## Риски

- Не смешивать debug force-state с production-логикой цикла.
- Не увеличивать множители без проверки спавна и нагрузки.
- При правках SFX сохранять fallback для форматов/отсутствующих файлов.

## Мини-проверка

- `?debug=1`: проверить `Force weather` и `Force attackMode` (`ON/OFF`).
- Проверить ramp: в начале attackMode `targetAliveMult` растёт плавно.
- Проверить weather SFX: thunder/rainLoop включаются и корректно отключаются.
