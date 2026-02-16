# Debug panel: achievements/dev инструменты

## Где находится

- Включается через `?debug=1`.
- Файл реализации: `src/ui/debugPanel.js`.
- Секция: `Achievements (dev)` во вкладке `Logs&Tools`.

## Что умеет секция

### 1) Unlock + claim reward

- Источник ids: definitions achievements (из core API), включая:
  - `creator_novice`
  - `creator_pro`
  - `creator_expert`
- Действие:
  - ставит `state.achievements.unlocked[selectedId] = true` (через dev-hook в `game.js`),
  - применяет тот же эффект доступности награды в UI,
  - форсит `updateUI()`.

Практический эффект для creator_*:

- `creator_novice` → появляется tier `merge2`
- `creator_pro` → tier `mergeX`
- `creator_expert` → tier `mergeAll`

Смена доступности происходит сразу, без перезапуска.

### 2) Set totalMerges

- Input + кнопка задают `state.achievements.totalMerges`.
- Значение clamp: `0..Number.MAX_SAFE_INTEGER`.
- После установки вызывается стандартный пересчёт achievements (`recalculateUnlocks`) и обновление UI.

Политика: **unlock-only**.

- При уменьшении `totalMerges` уже открытые достижения не закрываются.

## Быстрая проверка порогов

1. Открыть debug (`?debug=1`) → вкладка `Logs&Tools` → `Achievements (dev)`.
2. Ввести и применить `totalMerges`:
   - `99` → creator_novice ещё закрыт.
   - `100` → creator_novice открыт, доступен `Merge 2 tanks`.
   - `399` → creator_pro ещё закрыт.
   - `400` → creator_pro открыт, доступен `Merge 4 tanks`/`Merge 2 tanks` (по наличию пар).
   - `999` → creator_expert ещё закрыт.
   - `1000` → creator_expert открыт, доступен `Merge all tanks`.
3. Проверка unlock-only:
   - после открытия `creator_expert` установить `totalMerges = 0`;
   - `creator_expert` остаётся открытым.

## i18n

Строки названий creator achievements и labels кнопок auto-merge находятся в:

- `src/i18n/ru.json`
- `src/i18n/en.json`

Ключи:

- `achievementCreatorNovice`, `achievementCreatorPro`, `achievementCreatorExpert`
- `achievementCreatorNoviceDesc`, `achievementCreatorProDesc`, `achievementCreatorExpertDesc`
- `autoMerge2`, `autoMerge4`, `autoMergeAll`
