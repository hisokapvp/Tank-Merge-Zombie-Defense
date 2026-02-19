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
