# Balance Assets

## Files

- `cannonUpgrades.json` — параметры апгрейдов орудий.
- `talentTree_v2.json` — data-driven дерево талантов v2 (PACK 1 baseline).

## `talentTree_v2.json` quick contract

- `version = 2`
- `tierUnlockSpent = [0,5,10,20,30]`
- `branches`: `offense`, `defense`, `economy`
- `talents`: 51 записей (17 на ветку), каждая с обязательными полями:
  - `id`, `branch`, `tier`, `maxRank`, `costPerRank`, `requires`, `ui`, `effects`
- `caps` содержит глобальные ограничения шансов/множителей.

Подробная спецификация и канонический список id: `docs/talents_v2.md`.

Runtime API и правила применения эффектов (PACK 2): `docs/talents_v2.md#talentsv2-runtime-api-pack-2`.
