# bibliotekar-skill-pack (v1.1)

Универсальный skill + reference + валидатор контракта (JSON Schema) + regression fixtures.

## Куда класть для VS Code Copilot
Рекомендуемая структура:
- `.github/skills/bibliotekar/SKILL.md`
- `.github/skills/bibliotekar/references/*`

## Быстрый старт (валидатор/регрессии)
```bash
npm i
npm test
```

## Валидация одного ответа
```bash
node handler.js path/to/output.json
# или
node handler.js path/to/output.json --report json
```

## Про repo
В `repo` можно передать:
- `url` (remote)
- `localPath` (локальный путь)
Нужен хотя бы один из них.
