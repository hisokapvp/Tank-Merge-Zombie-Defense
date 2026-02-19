# Индекс документации для агента

## Порядок чтения
1. `docs/ai/STYLE.md`
2. `docs/ai/ARCHITECTURE.md`
3. Целевой файл из `docs/ai/SYSTEMS/*.md`
4. При типовой задаче  соответствующий `docs/ai/PLAYBOOKS/*.md`

## Карта систем
- UI: `docs/ai/SYSTEMS/ui.md`
- Render/Canvas: `docs/ai/SYSTEMS/render.md`
- Assets/JSON: `docs/ai/SYSTEMS/assets.md`
- Combat: `docs/ai/SYSTEMS/combat.md`
- Save/Offline: `docs/ai/SYSTEMS/save.md`
- Achievements: `docs/ai/SYSTEMS/achievements.md`
- World Events: `docs/ai/SYSTEMS/worldEvents.md`
- Fence: `docs/ai/SYSTEMS/fence.md`
- Audio: `docs/ai/SYSTEMS/audio.md`
- Telemetry/Flags: `docs/ai/SYSTEMS/telemetry.md`
- Input: `docs/ai/SYSTEMS/input.md`
- Performance: `docs/ai/SYSTEMS/perf.md`

## Текущие UI-акценты
- Меню (big/small): last-click selected state без default selected на первом показе — `docs/ai/SYSTEMS/ui.md`.
- Confirm выхода из small menu: отдельный view `menuExitConfirmView`, переиспользует текущий session-exit flow.
- Small menu Save view: отдельный подрежим `smallMenuSaveView` с таблицей 10 слотов, inline edit имени и timestamp `lastSavedAt`.
- Big menu: пункт `Devs` переименован в `Credits/Создатели` и открывает `creditsModal` со списком из `assets/credits.json`.
- Big menu language panel: подкнопки языка рендерятся прямо под кнопкой `Язык/Language`; active состояния `Русский/Английский` зависят только от текущей локали.
- Big menu `Load`: состояние доступности вычисляется по `saveSlotsMeta_v1.lastSavedAt` (через `hasAnySaves()`), disabled реализован как project-disabled (`aria-disabled` + `data-disabled-reason="noSaves"`), без постоянного текста «Нет сохранений».
- Удалён legacy-виджет пользовательских отзывов из UI и рантайма (small/big menu + modal).
- Achievements modal: accordion single-open с toggler `+`/`−`, по умолчанию всё закрыто при открытии.
- `#supercomputerBtn`: стабильная позиция при press/hover, без transform-конфликта с unified button behavior.
- Unified disabled toast: `data-disabled-reason="noSaves"` → «Нет сохранений/No saves», иначе «Недоступно/Unavailable»; показ централизован через `src/ui/toast.js`.
- Divider под вкладками `Орудия/Базы/Стены` в `#modsTankWallOverlay`: линия тянется до внутренних краёв рамки без боковых отступов.

## Важные конфиги
- Critical modal typing: `src/config/criticalModalTuning.js`
- Critical modal audio policy: `src/config/criticalAudioPolicy.js`
- UI SFX параметры (volume/cooldown): `src/config/audioUi.js`

## Runtime reset (partial)
- Оркестратор partial reset: `src/core/worldReset.js`
- Кнопка `Перезапустить симуляцию`: `src/ui/criticalModal.js` -> `game.js` (`restartSimulationPartial`)
- Контракт: runtime мира сбрасывается как `reset`, но сохраняются achievements/upgrades/mods/supercomputer progression.
