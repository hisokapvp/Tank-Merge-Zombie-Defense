# Система: Audio

## Где править
- Логика звука: `src/audio/settingsAudio.js`
- Runtime playback/mute hooks: `game.js` (`playSfx`, `playLoopSfx`, `applyAudioSettings`)
- Конфиг критического режима: `src/config/criticalAudioPolicy.js`
- UI-слайдеры: `index.html`, `src/ui/*`

## Правила
- Каналы и уровни громкости менять через единый модуль аудио.
- Сохранять корректную паузу/возобновление и mute-поведение.
- Не запускать SFX в tight-loop без throttling.
- Для critical modal использовать политику `CriticalAudioPolicy`: allowlist SFX + restore предыдущего состояния аудио при закрытии.

## UI SFX (централизованно)
- UI-звуки используют id: `uiHover`, `uiClickOnEnabled`, `uiClickOnDisable`, `tankToTrack`, `tankToHangar`.
- В `src/audio/settingsAudio.js` источник SFX может быть строкой (`.ogg`) или массивом источников в приоритетном порядке (например `['...ogg', '...mp3']`).
- Для массивов выбирается первый поддерживаемый формат через `Audio().canPlayType(...)`; если поддержку определить нельзя, берётся первый элемент массива.
- `playSfx(id, opts)` поддерживает `opts.volumeMult` (обратная совместимость с `playSfx(id)` обязательна), итоговая громкость всегда clamp `0..1`.
- Hover SFX должен быть throttled через cooldown (минимум 100ms), чтобы избежать спама в плотных pointer-сценариях.

## Tank onTrack toggle SFX
- Единая точка смены `tank.onTrack`: `Game.Garage.setTankOnTrack(tank, nextOnTrack, opts)` в `src/mechanics/garage.js`.
- `tankToTrack` и `tankToHangar` играют только внутри `setTankOnTrack`, чтобы не было задвоений.
- `opts.cause: 'user'` включает SFX; `reset`, `restore`, `system` выключают SFX по умолчанию.
- Для toggle-SFX использовать `playSfx(id, { volumeMult: UI_SFX_VOLUME_MULT, channel: 'ui' })`.
- QA: user-toggle да (по одному звуку), reset/restore нет.
