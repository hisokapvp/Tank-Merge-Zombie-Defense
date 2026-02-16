# Achievements и merge-прогресс

## Что считается успешным merge

Успешный merge — это операция объединения двух танков одного уровня, завершившаяся созданием танка уровня `N+1`.

Условия успеха:

- исходные танки существуют,
- уровни совпадают,
- уровень не превышает cap (`MAX_TANK_LEVEL`),
- merge реально выполнен через общий entrypoint `performMerge(...)`.

Если merge успешен, счётчик `totalMerges` увеличивается ровно на `+1`.

## Когда `totalMerges` НЕ растёт

`totalMerges` не меняется, если попытка merge неуспешна:

- нет валидной пары,
- drop невалидный,
- уровни танков не совпадают,
- достигнут cap уровня,
- merge отменён до фактического создания результата.

## Где хранится merge-прогресс

Источник правды: `state.achievements.totalMerges`.

Поле инициализируется по умолчанию как `0` и сохраняется вместе с остальным `state.achievements` через persistence (`src/persistence/storage.js`).

## Creator achievements (PACK1)

Достижения по merge-прогрессу:

- `creator_novice` — порог `100` успешных merge,
- `creator_pro` — порог `400` успешных merge,
- `creator_expert` — порог `1000` успешных merge.

Семантика unlock:

- достижение открывается автоматически при достижении порога,
- после открытия достижение не закрывается обратно, даже если значение прогресса уменьшилось вручную.

## Что открывают creator_*

`creator_novice/pro/expert` являются гейтами для одной auto-merge кнопки в нижней части панели.

Tier-поведение:

- до `creator_novice` — кнопка скрыта (`hidden`),
- `creator_novice` и без `creator_pro` — режим `merge2`, label: «Соединить 2 танка»,
- `creator_pro` и без `creator_expert` — режим `mergeX`, label: «Соединить 2 танка» или «Соединить 4 танка» по доступным парам,
- `creator_expert` — режим `mergeAll`, label: «Соединить все танки».

Дополнительно:

- auto-merge всегда использует общий merge entrypoint (`performMerge`) и кладёт результат в hangar,
- `mergeAll` работает только по снимку пар на момент клика (без chain reaction),
- повторный клик блокируется cooldown `200..400ms` (по умолчанию `300ms`).

Подробные правила подбора пар: `docs/auto-merge.md`.

## Merge FX/звук (post-merge)

- FX вызывается только после подтверждённого успешного merge в общем entrypoint `performMerge(...)`.
- Частота: `1 merge = 1 FX` (manual и auto используют один и тот же entrypoint).
- Для серий (`mergeX`/`mergeAll`) FX запускается по очереди в порядке merge-операций, с небольшим интервалом между стартами.
- Звук merge-эффекта уважает текущие audio settings проекта (`sfxVolume` и общий pipeline `playSfx(...)`).

## Debug tools (Achievements dev)

В debug panel (`src/ui/debugPanel.js`, вкладка `Logs&Tools`) доступны инструменты:

- `Unlock + claim reward`: форсирует `state.achievements.unlocked[selectedId] = true` через dev-hook и сразу обновляет UI.
- `Set totalMerges`: выставляет `state.achievements.totalMerges` (clamp `0..Number.MAX_SAFE_INTEGER`) и запускает стандартный пересчёт unlock'ов.

Политика пересчёта: **unlock-only** (уже открытые достижения не закрываются при уменьшении `totalMerges`).

## i18n (creator_* / auto-merge)

Строки достижений и кнопок live в:

- `src/i18n/ru.json`
- `src/i18n/en.json`

Ключи creator-tier:

- `achievementCreatorNovice`, `achievementCreatorPro`, `achievementCreatorExpert`
- (описания) `achievementCreatorNoviceDesc`, `achievementCreatorProDesc`, `achievementCreatorExpertDesc`

Ключи кнопок auto-merge:

- `autoMerge2`, `autoMerge4`, `autoMergeAll`
