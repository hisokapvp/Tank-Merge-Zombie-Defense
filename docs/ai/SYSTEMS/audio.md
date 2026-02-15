# SYSTEM: Audio

## Где искать

- Основная runtime-логика звука: `game.js` (`playSfx`, `playLoopSfx`, pools/fade/pause).
- Настройки громкости UI: `src/audio/settingsAudio.js`.
- Управление причинами паузы: `src/systems/pauseManager.js`.

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
