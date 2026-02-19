# SYSTEM: Audio

## Где искать

- Основная runtime-логика звука: `game.js` (`playSfx`, `playLoopSfx`, pools/fade/pause).
- Настройки громкости UI: `src/audio/settingsAudio.js`.
- Управление причинами паузы: `src/systems/pauseManager.js`.

## Что править

- Маршрутизацию звуков по каналам (`gameplay/ui/music`) — в `game.js`.
- Настройки громкости и связь с UI — в `src/audio/settingsAudio.js`.
- Причины паузы/возобновления звука — в `src/systems/pauseManager.js`.

## Громкость: формат и источник

- Source of truth: `localStorage['settings']`.
- Поля хранения: `settings.sfxVolume`, `settings.musicVolume` (нативный диапазон `0..1`).
- UI-формат (small/big menu): `0..100%`.
- Конверсия: `UI percent -> value01` при записи; `value01 -> percent` при отображении.
- Единый runtime API: `getVolume(kind, format)` / `setVolume(kind, value, format)` + `syncVolumeUIFromSettings()`.
- Применение громкости должно происходить на `input` (live apply), затем — persist в `settings`.

## Каналы

- `gameplay`: боевые и worldEvents звуки (например `shoot*`, `thunder`, `rainLoop`, `activeAbility`).
- `ui`: интерфейсные звуки.
- `music`: `<audio data-audio="music">` элементы.

Правило паузы:

- при паузе симуляции глушится только канал `gameplay`;
- `ui/music` не принудительно останавливаются (чтобы меню/музыка могли продолжать играть).

## Пауза и возобновление

- Причины паузы: `menuOpen` и `tabInactive`.
- `menuOpen=true`: `gameplay` SFX fade-out за `1s`, затем `pause`.
- `tabInactive=true` (`visibilitychange:hidden`/`blur`): быстрый fade-out и pause.
- При снятии паузы выполняется `resume` ранее активных `gameplay` players с сохранением позиции (`currentTime`), без restart.

## Browser API

Используются стандартные API:

- `document.visibilitychange`
- `window.blur`
- `window.focus`

## Риски

- Не переводить UI/menu звуки в канал `gameplay`, иначе они будут глушиться на паузе меню.
- Не вызывать reset `currentTime` при pause/resume, иначе пропадает требуемое «доигрывание».

## Мини-проверка

- Открыть меню: `gameplay` затухает, `ui/music` не ломаются.
- Свернуть/развернуть вкладку: активные `gameplay` SFX возобновляются без restart.
