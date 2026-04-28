# Game.Events — краткий контракт

> Обновлено: 2026-04-25.
> Canonical agent doc: `docs/ai/SYSTEMS/events.md`.

## Зачем этот файл
Этот файл оставлен как короткий discoverability alias для запросов, где явно указан путь `docs/events.md`. Подробный контракт, таблица topic'ов и правила для subscribers живут в `docs/ai/SYSTEMS/events.md`.

## Known overlap
`playerChips.changed` с `reason='craft'` и `chips.crafted` intentionally могут прийти оба после успешного craft. Subscriber, подписанный на оба topic'а, получит двойной trigger by design.

Consumer должен выбрать один канал или dedup'ить на своей стороне по `reason/eventName/changedIds`. Подавлять `chips.crafted` в writer/EventBus нельзя: это отдельный craft-specific сигнал, а не дубль общего inventory update.
