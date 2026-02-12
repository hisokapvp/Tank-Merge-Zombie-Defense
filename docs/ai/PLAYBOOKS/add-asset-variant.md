# PLAYBOOK: Добавить/изменить ассет-вариант

## Когда использовать

Нужно добавить новый вид танка/пушки/зомби-анимации или обновить существующий JSON-конфиг ассетов.

## Шаги

1. Подготовь PNG/atlas в `assets/`.
2. Обнови JSON-конфиг:
   - танки: `assets/tanks.json`
   - зомби: `assets/zombies.json`
   - окружение: `assets/fence.json`/`assets/decor.json`
3. Для танков проверь `levels[]` соответствие `bodyVariant/cannonVariant`.
4. Для зомби проверь `frame/death/deathCommon` координаты и `frames`.
5. Убедись, что пути `src` указывают на существующие файлы.

## Какие файлы обычно править

- `assets/tanks.json`
- `assets/zombies.json`
- `assets/fence.json`
- `assets/decor.json`
- `assets/tanks_README.md` или `assets/zombies_README.md` (если поменялась схема)

## Проверки

- `node ops/monitoring/health_check.js --root .`
- Запуск игры без ошибок ассетов в консоли.
- Визуальный smoke: новый вариант реально отображается.

## Типовые ловушки

- Несовпадение `id` варианта и ссылки на него в `levels[]`.
- Неверные `frame.w/h` и `frames`, вызывающие обрезку/пустой рендер.
