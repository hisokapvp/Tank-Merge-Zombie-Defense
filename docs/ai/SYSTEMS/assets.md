# Система: Assets

## Основные источники
- `assets/tanks.json`, `assets/zombies.json`, `assets/bullet.json`
- `assets/ground.json`, `assets/decor.json`, `assets/fence.json`
- `assets/supercomputer.json`, `assets/bonusbox.json`, `assets/boost_icons.json`

## Правила
- Новые игровые параметры добавлять в JSON, не хардкодить в JS.
- Сохранять обратную совместимость полей для загрузки старых сейвов.
- Для визуальных изменений проверять соответствующий loader/renderer в `src/render/*`.
