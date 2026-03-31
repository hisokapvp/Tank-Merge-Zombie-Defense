# Система: Balance Editor

> Обновлено: 2026-03-31.

## Что это
`tools/balance-editor.html` — repo-local HTML tool для ручной настройки JSON-конфигов и быстрой аналитики без build step. Он грузит данные напрямую из `../assets/*`, держит рабочие копии в памяти и даёт две отдельные analytics-surface: `Damage Points Per Minute` для танков и `Танки vs Зомби` для сравнения shot damage против zombie HP.

## Быстрый старт для агента
- Открой analytics markup и поясняющие info-box'ы: [tools/balance-editor.html](../../../tools/balance-editor.html#L126-L154).
- Открой runtime constants и boot/load path: [tools/balance-editor.html](../../../tools/balance-editor.html#L269-L317).
- Открой damage-points helpers: [tools/balance-editor.html](../../../tools/balance-editor.html#L395-L452).
- Открой zombie HP comparison helpers: [tools/balance-editor.html](../../../tools/balance-editor.html#L479-L517).
- Открой selective analytics refresh после edit'ов: [tools/balance-editor.html](../../../tools/balance-editor.html#L831-L858).

## Инварианты ⚠️
- Tool ожидает запуск из корня репозитория или через static server с тем же относительным путём: все конфиги грузятся через `BASE_PATH = '../assets/'`, а `boot()` сразу fetch'ит `tanks.json`, `zombies.json`, `fence.json`, `dron.json`, `bullet.json`, `balance.json`, `chips.json`, `balance/cannonUpgrades.json`, `balance/talentTree_v2.json`: [tools/balance-editor.html](../../../tools/balance-editor.html#L269-L317).
- Damage-points analytics считает именно `damage points / minute`, а не grey damage: `shotDamage = (tank baseDamage + bullet addDamage) * attackDamageMul`, `shotsPerMinute = (0.85 + 0.075 × (lvl-1)) * attackSpeedMul * 60`, затем `rawDamagePerMinute / 10000`. Если меняется runtime формула урона танка, этот tool-contract нужно синхронизировать вместе с docs: [tools/balance-editor.html](../../../tools/balance-editor.html#L126-L139), [tools/balance-editor.html](../../../tools/balance-editor.html#L395-L452).
- Zombie chart сравнивает tank shot damage против zombie HP с приоритетом у явного `Health` из `assets/zombies.json`; legacy `health` остаётся alias, а fallback-формула использует `zombieHpBase`, `dmgMultPerLevel`, `zombieHpExtraPerLevel` и `hpMul`. Это должно совпадать с documented asset contract, иначе tool начинает показывать вводящую в заблуждение кривую HP: [tools/balance-editor.html](../../../tools/balance-editor.html#L143-L147), [tools/balance-editor.html](../../../tools/balance-editor.html#L479-L517), [assets/zombies.json](../../../assets/zombies.json#L101-L2939).
- `refreshAnalytics()` пересчитывает только tank/damage/zombie charts; `handleEdit()` зовёт его лишь для `tanks`, `bullet` и `balance`, тогда как edits в `zombies` перерисовывают только zombie chart. Не ожидать от tool'а полной cross-tab recompute на любой input change: [tools/balance-editor.html](../../../tools/balance-editor.html#L831-L858).

## Основные блоки
| Блок | Файл | Строки | Назначение |
|---|---|---|---|
| Analytics tab markup | [tools/balance-editor.html](../../../tools/balance-editor.html#L126-L154) | 126–154 | Заголовки, info-box'ы и таблицы для damage points и zombie comparison |
| `ANALYTICS_RUNTIME` | [tools/balance-editor.html](../../../tools/balance-editor.html#L269-L277) | 269–277 | Канонические константы tool'а для fire-rate, zombie HP и divisor damage points |
| `getTankShotDamage()` / `getTankShotsPerMinute()` / `getTankDamagePointMetrics()` / `renderDamagePoints()` | [tools/balance-editor.html](../../../tools/balance-editor.html#L395-L452) | 395–452 | Формула shot damage, RPM и таблица/график `Damage Points Per Minute` |
| `getZombieHpForChart()` / `drawZombieChart()` | [tools/balance-editor.html](../../../tools/balance-editor.html#L479-L517) | 479–517 | HP comparison с приоритетом `Health` и график `Zombie HP` vs `Tank shotDmg` |
| `refreshAnalytics()` / `handleEdit()` | [tools/balance-editor.html](../../../tools/balance-editor.html#L831-L858) | 831–858 | Selective refresh логика после edit'ов |

## Зависимости
- Источники данных: `assets/tanks.json`, `assets/zombies.json`, `assets/bullet.json`, `assets/balance.json`, `assets/fence.json`, `assets/dron.json`, `assets/chips.json`, `assets/balance/cannonUpgrades.json`, `assets/balance/talentTree_v2.json`.
- Связанные agent docs: [assets.md](assets.md), [combat.md](combat.md).

## Ограничения
- Это standalone tool surface, а не часть gameplay runtime; изменения здесь не подключаются через `index.html` и не должны описываться как Canvas/Phaser runtime.
- `tools/*` вне этого файла пока не картированы в `docs/ai`; не расширяйте scope без реального post-merge запроса.