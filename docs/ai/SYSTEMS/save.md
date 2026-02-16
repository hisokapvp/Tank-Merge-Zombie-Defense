# SYSTEM: Save / Offline

## Где искать

- Save/load: `src/persistence/storage.js`
- Initial defaults/state shape: `src/persistence/initialState.js`
- Offline модель: `src/persistence/offlineRewardModel.js`, `src/persistence/offlineProgress.js`
- UX: `src/ui/continueFlow.js`, `src/ui/offlineModal.js`
- Boot integration: `src/core/bootstrap.js`

## Что править

- Новые поля прогресса: сериализация + восстановление.
- Offline формулы: сначала модель, потом runtime hooks.
- Порог показа offline modal: `OFFLINE_THRESHOLD_MS`.
- Любые изменения схемы: синхронно `initialState` + `storage` + restore path в boot.

## Новые поля сейва

- `achievements`:
	- `unlocked` — карта полученных достижений,
	- `totalPurchased` — накопленный прогресс покупок,
	- `popupQueue` в сейв не критичен (на загрузке очищается).
- `fenceState`:
	- `segmentsPerSide` — сигнатура конфигурации,
	- `hpById` — сохранённое HP сегментов по стабильному `id`.
- `mapSeeds`:
	- `stampsSeed` — seed stamps placement,
	- `decorSeed` — seed decor placement,
	- применяется на load приоритетно из сейва (без перезаписи значениями из `assets/*.json`).

## Миграция / совместимость

- Старые сейвы без новых полей загружаются без ошибок.
- Для достижений без `totalPurchased` прогресс может быть восстановлен из исторического `buyCounts`.
- При смене `segmentsPerSide` восстановление fence HP идёт по совпавшим `id`; новые/изменённые сегменты получают `maxHp`.
- Для `mapSeeds`: старые сейвы без поля загружаются корректно; seed берётся из assets только если в сейве отсутствует.

## Риски

- Сохранять backward compatibility save.
- Не менять ключи сохранения без миграции.
- Не ломать ветку `legacyProgress` при загрузке старых сейвов.
- В offline claim-флоу всегда сбрасывать состояние `claiming` (включая reject/error ветки рекламы), чтобы модалка не зависала.

## Мини-проверка

- `node Test/pack8/offlineProgress.test.js`
- `node Test/pack9/offlineModal_ui_i18n.test.js`
- Ручной сценарий: пауза > 5 мин и возврат.
