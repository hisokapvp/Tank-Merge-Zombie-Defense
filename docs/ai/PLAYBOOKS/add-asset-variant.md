# Плейбук: Добавить или изменить ассет

## Шаги
1. Подготовить файлы в `assets/`.
2. Обновить нужный JSON (`tanks/zombies/fence/decor`).
3. Проверить ссылки (`src`, `id`, `levels[]`, `frames`).
4. Если менялась схема, обновить соответствующий файл в `docs/assets/*_README.md`.

## Проверка
- `node ops/monitoring/health_check.js --root .`
- Запуск игры без ошибок загрузки ассетов.
