# Система: Assets

## Основные источники
- `assets/tanks.json`, `assets/zombies.json`, `assets/bullet.json`
- `assets/ground.json`, `assets/decor.json`, `assets/fence.json`
- `assets/supercomputer.json`, `assets/bonusbox.json`, `assets/boost_icons.json`
- `assets/credits.json` (данные для модалки `Credits/Создатели` в big menu)

## Правила
- Новые игровые параметры добавлять в JSON, не хардкодить в JS.
- Сохранять обратную совместимость полей для загрузки старых сейвов.
- Для визуальных изменений проверять соответствующий loader/renderer в `src/render/*`.
- Для `assets/credits.json` учитываются поля элемента: `name`, `role_ru`, `role_en`.
