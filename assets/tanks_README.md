# tanks.json — краткая схема

## Назначение

`assets/tanks.json` задаёт визуал танков для уровней 1–60.

## Обязательные разделы

- `body` — fallback корпус
- `bodies` — словарь вариантов корпусов
- `cannons` — массив вариантов пушек (`id` обязателен)
- `levels` — массив из 60 записей (уровни 1..60)

## Важные поля

- Для корпуса/пушки: `src`, `frame.{w,h}`, `frames`, `anchor`, `scale`
- Для пушки дополнительно: `fireFrame`, `muzzle`, `recoil`, `minLevel`
- Для уровня: `bodyVariant`, `cannonVariant`, `auraVariant`, `bulletVariant`, `impactVfxVariant`

## Быстрый сценарий: добавить вариант

1. Добавить PNG в `assets/tanks/`.
2. Добавить запись в `bodies` или `cannons`.
3. Сослаться на `id`/ключ в нужных элементах `levels[]`.
4. Проверить, что `levels` содержит 60 элементов.

## Контракты

- `bodyVariant` должен существовать в `bodies`.
- `cannonVariant` должен ссылаться на существующий `cannons[].id`.
- Некорректные ссылки приводят к runtime fallback или отсутствию нужного визуала.
