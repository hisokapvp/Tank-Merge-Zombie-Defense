# zombies.json — краткая схема

## Назначение

`assets/zombies.json` задаёт атлас, типы зомби, death-анимации и spawn-параметры.

## Обязательные разделы

- `atlas` — путь к PNG-атласу
- `types[]` — набор типов зомби
- `spawn` — целевой alive-cap и баланс по сторонам
- `deathCommon` — опциональный общий death fallback

## Важные поля

- `types[].id`, `frame`, `frames`, `anchor`, `scale`, `hpMul`, `omegaMul`, `rewardMul`, `weight`, `hitbox`
- `types[].death` (опционально): `{x,y,w,h,frames}`
- `spawn`: `targetAlive`, `sideCount`, `perSideTarget`, `perSideTolerance`

## Логика death

- Есть `death` и `deathCommon`: 70% personal, 30% common
- Есть только одно: используется оно
- Нет обоих: runtime fallback (fade/tilt)

## Быстрый сценарий: добавить тип

1. Добавить спрайты в атлас.
2. Добавить объект в `types[]`.
3. При необходимости добавить `death`.
4. Проверить `spawn`-баланс и корректность координат кадров.

## Контракты

- Все координаты/размеры кадров должны соответствовать атласу.
- Для стабильного баланса держать `targetAlive ≈ sideCount * perSideTarget`.
