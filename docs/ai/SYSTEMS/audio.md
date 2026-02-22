# Система: Audio

## Где править
- Логика звука: `src/audio/settingsAudio.js`
- Runtime SFX pool/controller: `src/audio/sfxPoolRuntime.js`
- Runtime playback/mute hooks: `game.js` (`playSfx`, `playLoopSfx`, `applyAudioSettings`)
- Конфиг критического режима: `src/config/criticalAudioPolicy.js`
- UI-слайдеры: `index.html`, `src/ui/*`

## Интеграция
- `game.js` подключает `Game.SfxPoolRuntime.createController(...)` через `ensureSfxPoolRuntimeController()`.
- Публичные точки (`playSfx`, `playLoopSfx`, `stopLoopSfx`, `setSfxSources`, `normalizedSfxSources`) сначала делегируют в runtime-модуль, затем fallback на встроенную реализацию.

## Правила
- Каналы и уровни громкости менять через единый модуль аудио.
- Сохранять корректную паузу/возобновление и mute-поведение.
- Не запускать SFX в tight-loop без throttling.
- Для critical modal использовать политику `CriticalAudioPolicy`: allowlist SFX + restore предыдущего состояния аудио при закрытии.

## UI SFX (централизованно)
- UI-звуки используют id: `uiHover`, `uiClickOnEnabled`, `uiClickOnDisable`, `uiSliderPreview`, `tankToTrack`, `tankToHangar`, `mergeNewMaxLevel`.
- В `src/audio/settingsAudio.js` источник SFX может быть строкой (`.ogg`) или массивом источников в приоритетном порядке (например `['...ogg', '...mp3']`).
- Для массивов выбирается первый поддерживаемый формат через `Audio().canPlayType(...)`; если поддержку определить нельзя, берётся первый элемент массива.
- `playSfx(id, opts)` поддерживает `opts.volumeMult` (обратная совместимость с `playSfx(id)` обязательна), итоговая громкость всегда clamp `0..1`.
- Hover SFX должен быть throttled через cooldown (минимум 100ms), чтобы избежать спама в плотных pointer-сценариях.
- Hover SFX должен запускаться однократно при входе на кнопку: переходы между child-элементами внутри той же кнопки не должны повторно триггерить звук (`relatedTarget` guard).
- Для merge-сценария `mergeNewMaxLevel` используется вместо `levelUp` только когда merge впервые повышает `maxLevel` в рамках текущего merge и успешно запускает `Game.MergePopup.show(level)`; в обычном merge остаётся `levelUp`.

## Slider preview SFX
- Ассет: `assets/sfx/ui_slider_preview_TEMPLATE.ogg` (template-файл, можно заменить без правки кода).
- Регистрация id: `uiSliderPreview` в `src/audio/settingsAudio.js` и runtime-реестре `game.js`.
- Точка вызова: обработчики `input` для SFX-слайдеров в `src/core/bootstrap.js` (`menuSfx`) и `game.js` (`bigMenuSfx`).
- Правило по частоте: throttling `160ms` (допустимый диапазон `120–200ms`) через helper `playUiSliderPreviewSfxThrottled()`.
- Ожидаемое поведение: preview играет с текущей `sfxVolume` (и стандартным UI channel), без звуковой «дроби» при перетаскивании.

## Tank onTrack toggle SFX
- Единая точка смены `tank.onTrack`: `Game.Garage.setTankOnTrack(tank, nextOnTrack, opts)` в `src/mechanics/garage.js`.
- `tankToTrack` и `tankToHangar` играют только внутри `setTankOnTrack`, чтобы не было задвоений.
- `opts.cause: 'user'` включает SFX; `reset`, `restore`, `system` выключают SFX по умолчанию.
- Для toggle-SFX использовать `playSfx(id, { volumeMult: UI_SFX_VOLUME_MULT, channel: 'ui' })`.
- QA: user-toggle да (по одному звуку), reset/restore нет.

## Track loop (танк на трассе)
- Loop-id: `trackLoop`, регистрируется в `src/audio/sfxPoolRuntime.js` и в `game.js` (`SFX_SOURCES`/`SFX_CHANNELS`).
- Источник loop-аудио задаётся через `DEFAULT_TRACK_LOOP_SOURCES` в `game.js` (актуально: `assets/sfx/TankDrive.ogg` + `assets/sfx/TankDrive.mp3`); runtime берёт список через `getDefaultTrackLoopSources()`.
- Старт/стоп выполняется state-manager-ом в `game.js` (`syncTrackLoopSfxState(paused)`):
	- `hasTankOnTrack && !paused` → `playLoopSfx('trackLoop')`
	- иначе → `stopLoopSfx('trackLoop')` (мгновенный stop без fade).
- Критерий «танк на трассе»: хотя бы один `state.cells[i].tank` с `tank.onTrack === true`.
- Гарантированный stop `trackLoop` вызывается при `setMenuOpen(true)`, `setBigMenuOpen(true)`, `restartSimulationPartial()`, `resetGameState()`, `stopAndResetSessionToBigMenu()`, `visibilitychange(hidden)` и `pagehide`.

## Track loop volume
- Пользовательский UI-слайдер для `trackLoop` отсутствует (small menu + big menu).
- Громкость loop управляется кодом через `AudioUi.TANK_DRIVE_VOLUME_MULT` в `src/config/audioUi.js`.
- Формула итоговой громкости loop: `final = globalSfxVolume * TANK_DRIVE_VOLUME_MULT`.
- Применение идёт через `resolveSfxPlaybackVolume('trackLoop', ...)` + `setLoopSfxVolume('trackLoop', ...)`.
- Изменение global SFX меняет итоговый `final`, кодовый множитель остаётся фиксированным до правки конфига.
