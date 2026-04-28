# Система: HUD scratch pool

> Агент-ориентировано. Обновлён: 2026-04-25.
> Canonical module: `src/render/hudScratch.js`.

## Что это
`Game.HudScratch` — per-frame scratch pool для HUD/render hot path. Он снижает heap churn в `draw()` и держит parity между legacy Canvas HUD и Phaser overlay consumers.

## Быстрый старт для агента
- API и invariants: `src/render/hudScratch.js` L1-L246.
- `draw()` lazy init + `beginFrame()`: `game.js` world render path.
- Current array consumer: `game.js` L12419 (`acquireArray('hudTrack', 'tanksOnTrack')`).

## Инварианты этого модуля ⚠️
- `draw()` остаётся render-only: scratch slot/array mutation допустима только как temporary render buffer, не gameplay state mutation.
- `beginFrame()` вызывается один раз в начале кадра и освобождает per-frame leases без пересоздания backing arrays.
- `acquire(ownerTag, subSlot, shape)` возвращает preallocated object slot; writer обязан перезаписать все поля текущего frame.
- `acquireArray(ownerTag, subSlot)` idempotent per frame: повторный вызов с той же парой `(ownerTag, subSlot)` возвращает тот же physical array, уже truncated до `length=0` при первом lease кадра.
- Re-entry allowed: nested HUD/render helpers могут повторно запросить тот же array lease без allocation и без смены owner.
- Разные ownerTag/subSlot не должны шарить один buffer. Для нового consumer заводи стабильный `ownerTag` из `OWNER_TAGS` и deterministic `subSlot`.
- API не является general allocator: количество subSlot'ов ограничено `capacityPerOwner`; overflow/unknown owner graceful-degrade с warning, а не silent aliasing.

## `acquireArray(ownerTag, subSlot)` contract

| Свойство | Правило |
|---|---|
| Lease scope | Один frame, одна пара `(ownerTag, subSlot)`. |
| Re-entry | Да: тот же key в том же frame возвращает тот же array. |
| Allocation | Normal path не создаёт новый array per call; backing array reuse сохраняется между кадрами. |
| Frame boundary | `beginFrame()` ставит `arr.length = 0` для существующих leases и делает данные прошлого кадра stale. |
| Overflow | Если subSlot count у owner превышает capacity, возвращается fallback `[]` и пишется diagnostic warning. |
| Ownership | Caller заполняет array только для текущего draw-path и не хранит ссылку между кадрами. |

## Практический пример
`game.js` в talents HUD path берёт `tanksOnTrack` через `ctx.__hudScratch.acquireArray('hudTrack', 'tanksOnTrack')`, заполняет его танками на треке и передаёт в `talentsApi.renderStatusIcons(...)`. Повторный helper в этом же кадре может запросить тот же key и получить тот же stable buffer без heap churn.

## Что нельзя
- Использовать `acquireArray` как unbounded dynamic collection для gameplay/runtime state.
- Хранить returned array в module/global state после текущего frame.
- Смешивать в одном subSlot разные data layouts между вызовами.
- Создавать per-entity random subSlot keys в hot path без жёсткого upper bound.

## Зависимости
- `docs/ai/SYSTEMS/hud.md` — общий HUD/render contract.
- `docs/ai/SYSTEMS/phaser.md` — hybrid HUD/overlay parity.
