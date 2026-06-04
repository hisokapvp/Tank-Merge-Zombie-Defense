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
- UI-звуки используют id: `uiHover`, `uiClickOnEnabled`, `uiClickOnDisable`, `uiSliderPreview`, `tankToTrack`, `tankToHangar`, `mergeNewMaxLevel`; gameplay one-shot для активных способностей использует `activeAbility`.
- В `src/audio/settingsAudio.js` источник SFX может быть строкой (`.ogg`) или массивом источников в приоритетном порядке (например `['...ogg', '...mp3']`).
- Для массивов выбирается первый поддерживаемый формат через `Audio().canPlayType(...)`; если поддержку определить нельзя, берётся первый элемент массива.
- `playSfx(id, opts)` поддерживает `opts.volumeMult` (обратная совместимость с `playSfx(id)` обязательна), итоговая громкость всегда clamp `0..1`.
- Hover SFX должен быть throttled через cooldown (минимум 100ms), чтобы избежать спама в плотных pointer-сценариях.
- Hover SFX должен запускаться однократно при входе на кнопку: переходы между child-элементами внутри той же кнопки не должны повторно триггерить звук (`relatedTarget` guard).
- Для merge-сценария `mergeNewMaxLevel` используется вместо `levelUp` только когда merge впервые повышает `maxLevel` в рамках текущего merge и успешно запускает `Game.MergePopup.show(level)`; в обычном merge остаётся `levelUp`.
- `useActiveAbility(branch)` в `game.js` проигрывает `playSfx('activeAbility')` только после успешного `activateOffenseActive` / `activateDefenseActive` / `activateEconomyActive`; источник задаётся как `active_ability.ogg -> active_ability.mp3` fallback и должен оставаться синхронизированным в `game.js`, `src/audio/sfxPoolRuntime.js`, `src/audio/settingsAudio.js` и `assets/sfx/registry.json`.

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
- Формула итоговой громкости loop: `final = clamp(globalSfxVolume * TANK_DRIVE_VOLUME_MULT, 0, 1)`.
- Применение идёт через `resolveSfxPlaybackVolume('trackLoop', ...)` + `setLoopSfxVolume('trackLoop', ...)`.

## Zombie mode loops (атака / блуждание)
- Два взаимоисключающих loop-id на gameplay-канале (слайдер «Эффекты» / `sfxVolume`):
	- `zombieAttackLoop` → `assets/music/ataka-zombi.ogg` + `.mp3` (`DEFAULT_ZOMBIE_ATTACK_LOOP_SOURCES`).
	- `zombieWanderLoop` → `assets/music/zombi-bredut.ogg` + `.mp3` (`DEFAULT_ZOMBIE_WANDER_LOOP_SOURCES`).
- Регистрируются в трёх местах (parity обязательна, иначе `bootSfxRegistry()` ругается): inline `SFX_SOURCES`/`SFX_CHANNELS` в `game.js`, локальные `SFX_SOURCES`/`SFX_CHANNELS` в `src/audio/sfxPoolRuntime.js`, и `assets/sfx/registry.json`.
- State-manager `syncZombieModeSfxState(paused)` в `game.js` (вызывается после `syncTrackLoopSfxState` в основном loop) выбирает желаемое состояние через `desiredZombieModeSfxState()`:
	- `shouldZombieAttemptAttack()` (полный `attackMode` ИЛИ idleWave-фаза `attack`) → `zombieAttackLoop`.
	- `getZombieIdleWavePhase() === 'wander'` → `zombieWanderLoop`.
	- иначе → ни один loop (оба остановлены).
- Переключение: при смене состояния предыдущий loop останавливается, новый запускается; при том же состоянии только обновляется громкость через `setLoopSfxVolume`.
- Гарантированный stop обоих loop (`stopZombieModeSfxImmediate()`) зеркалит точки stop `trackLoop`: `setMenuOpen(true)`, `setBigMenuOpen(true)`, `restartSimulationPartial()`, `resetGameState()`, `stopAndResetSessionToBigMenu()`.
- Изменение global SFX меняет итоговый `final`, кодовый множитель остаётся фиксированным до правки конфига.

## Background music (MusicManager)
- Модуль: `src/audio/musicManager.js` → `Game.MusicManager`. Самодостаточный музыкальный bus на `HTMLAudioElement` (свои инстансы, независимы от SFX-pool), кроссформатный fallback `ogg → mp3` через `canPlayType`.
- Источники треков берутся из `Game.SfxRegistry.getMusic()` (блок `"music"` в `assets/sfx/registry.json`: `menuTheme`, `battleCalm`, `battleWave`), иначе из inline `FALLBACK_SOURCES` (`assets/music/*_TEMPLATE.{ogg,mp3}` — заменяемые шаблоны).
- Все фейды time-based и управляются `requestAnimationFrame`; ничего не исполняется внутри canvas `draw()` hot-path и не аллоцирует per-frame в steady state.
- Длительность перехода: `FADE_MS = 1000` (1.0с, линейный кроссфейд). По умолчанию `DEFAULT_MUSIC_VOLUME = 0.6`, `SFX_DUCK_LEVEL = 0.3`.
- Меню-музыка управляется авторитетным `setMenuActive(bool)`, который вызывается из агрегатного лока `recomputeMenuPauseLock()` в `game.js` (`MusicManager.setMenuActive(isAnyMenuPauseOpen())`). Пока любое меню открыто: `menuTheme` фейдится in, боевые треки out, SFX-bus duck-ается до `0.3` через `SfxPoolRuntime.setDuckFactor`. Закрытие последнего меню реверсит фейд.
- Боевая музыка: `battleCalm` вне волны атаки и `battleWave` во время волны. Переключение крутится через `onWaveStart()` / `onWaveEnd()`.
- Wave-синхронизация: `onWaveStart()` / `onWaveEnd()` вызываются из rain start/stop seam в `src/systems/worldEventsRuntime.js` (на тех же edge-переходах, что `playLoopSfx('rainLoop')` / `stopLoopSfx('rainLoop')`), а НЕ из `beginNoRepairAttackWaveEpisode` / `finalizeNoRepairAttackWaveEpisode`. Это даёт sample-sync музыки волны с дождём (старт музыки = старт дождя, конец = конец звука дождя). Edge-переход срабатывает однократно на смену состояния, поэтому steady-state hot-path не нагружается.
- Autoplay-разблокировка: браузеры блокируют `HTMLAudioElement.play()` до первого пользовательского жеста. `armGestureUnlock()` ставит capture-listeners (`pointerdown`/`keydown`/`touchstart`) и ретраит заблокированные `play()`. Listener переарм-ируемый и persistent: он отцепляется только когда трек реально зазвучал, а `recomputeTargets()` повторно арм-ит его, если трек хочет играть, но звук ещё залочен. Поэтому стартовое меню начинает играть на первом же клике/нажатии в любом месте страницы. Полностью беззвестный autoplay до первого жеста невозможен по политике браузеров.
- Wiring: `index.html` подключает `src/audio/musicManager.js` с cache-bust; `applyAudioSettings()` в `game.js` делает `mm.init()` + `setMusicVolume()` + `setMenuActive(isAnyMenuPauseOpen())`.
- Null-safety: каждая внешняя точка входа безопасна — отсутствующие/непроигрываемые placeholder-файлы деградируют в тишину, не бросают и не блокируют геймплей.
