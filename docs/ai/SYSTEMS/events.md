# Система: Game.Events

> Агент-ориентировано. Обновлён: 2026-04-25.
> Source of truth: `src/core/events.js`, emit call-sites в `src/ui/hangarChipsUI.js` и runtime writers.

## Что это
`Game.Events` — lightweight in-process EventBus для runtime/UI handoff без DOM `CustomEvent`. Он нужен для async repaint/effects notifications: state/runtime writers emit topics, UI/render subscribers планируют repaint/effects и не мутируют gameplay state из paint path.

## Быстрый старт для агента
- EventBus API: `src/core/events.js` L1-L120.
- Chip inventory writer: `src/ui/hangarChipsUI.js` L1399-L1428.
- Hangar lazy repaint subscriber: `src/ui/hangarChipsUI.js` L1435-L1457.

## Инварианты этого модуля ⚠️
- Payload передаёт ids/diff/snapshot, а не mutable canonical arrays. Subscriber не должен хранить ссылку на mutable runtime collection.
- `emit()` async: несколько emit одного `eventName` в текущем tick coalesced в один dispatch на следующий `requestAnimationFrame`; payload merge = last-write-wins per event type.
- Если `requestAnimationFrame` недоступен, scheduler fallback остаётся async через `setTimeout(..., 16)`; subscribers не должны рассчитывать на sync dispatch.
- UI/render subscribers не мутируют `state`, `playerChips`, talents, achievements или productionLine из paint path. Любая mutation остаётся в writer/runtime owner.
- `emitSync()` — отдельный lifecycle-critical escape hatch; новые UI repaint/effects topics должны использовать coalesced `emit()`.

## Topic contract

| Topic | Writer / owner | Payload | Семантика |
|---|---|---|---|
| `playerChips.changed` | `Game.HangarChipsUI.setPlayerChips(...)` | `{ reason, changedIds, prevSnapshot }` | Любая успешная смена canonical chips snapshot; `changedIds` — diff ids/candidate ids, `prevSnapshot` — shallow snapshot для consumer-side diff. |
| `chips.crafted` | тот же writer, только при `reason='craft'` | `{ changedIds }` | Craft-specific semantic signal после `playerChips.changed`. Не является заменой общего inventory topic. |
| `tech.studyCompleted` | achievements / technology unlock runtime | `{ techId }` | Изучение технологии учтено runtime owner-ом. |
| `drone.acquired` | drone acquisition runtime | `{ totalDrones }` | Успешное получение дрона после canonical owner update. |

## Payload-by-id contract
- `changedIds` содержит только ids изменённых сущностей или authoring keys, пригодные для re-fetch из canonical owner.
- Полный mutable массив чипов, дронов или технологий не передаётся по ссылке.
- Если consumer нужен полный state, он должен по id перечитать данные из owner API после callback.
- Для payload snapshots (`prevSnapshot`) допустима shallow копия только как old-value hint; она не становится новым source-of-truth.

## rAF-coalescing semantics
- `emit(eventName, payload)` сохраняет `pendingEmit[eventName] = payload`.
- В одном tick несколько emit одинакового `eventName` схлопываются; выигрывает последний payload.
- Разные event names dispatch'ятся отдельно в одном scheduled flush.
- Listener может отписаться во время dispatch: EventBus делает defensive shallow copy subscriber list.
- Error в одном listener не останавливает остальные; ошибка логируется через console.

## Known overlap: `playerChips.changed reason='craft'` + `chips.crafted`
Craft path intentionally emits both:
1. `playerChips.changed` with `reason='craft'` and `changedIds`.
2. `chips.crafted` with the same `changedIds` semantic group.

Это overlap by design. Его нельзя «чинить» silent suppression-ом `chips.crafted`, потому что общий inventory update и craft-specific notification — разные сигналы.

### Subscriber dedup policy
- Если нужен только repaint inventory UI — подписывайся на `playerChips.changed` и фильтруй `reason` при необходимости.
- Если нужен только craft-specific effect/audio/analytics — подписывайся на `chips.crafted`.
- Если нужны оба канала, dedup делается subscriber-side по tuple `eventName + reason + changedIds.join('|')` или через собственный per-frame guard.
- Не добавляй dedup внутрь EventBus: он не знает бизнес-семантику topic'ов.

## Owner boundary
- Writers: runtime/state owners (`Game.HangarChipsUI.setPlayerChips`, technology unlock owner, drone owner) emit после успешной state mutation.
- Subscribers: UI/render/adapters только schedule repaint, effects, audio или local derived view refresh.
- Paint path (`draw()`, HUD render, Phaser overlay draw) не должен вызывать state writers из listener side-effect.

## Зависимости
- Использует: browser `requestAnimationFrame` или fallback `setTimeout`.
- Используется в: hangar chips UI repaint, craft notifications, tech/drone runtime notifications.

## Известные ограничения / TODO
- EventBus не хранит event history: late subscriber не получает последний payload автоматически.
- `listenerCount(eventName)` — diagnostic helper, не lifecycle manager.
- Для high-frequency future topics нужен отдельный owner-level rate budget, а не расширение базового EventBus.
