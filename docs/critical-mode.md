# Critical mode

Документ описывает аварийный сценарий при критическом уроне суперкомпьютера и действия игрока в critical modal.

## Порог и single-shot

- Точка входа: `game.js` → `applySupercomputerDamage(baseDamage)`.
- При первом пересечении порога:
  - вычисляется `hpThreshold = maxHp * 0.05`,
  - если `hp > hpThreshold` и `hp - finalDamage <= hpThreshold`, то `hp` ставится **ровно** в `hpThreshold` (без округления),
  - активируется `criticalFlowActive = true`,
  - ставится menu pause-lock (`setMenuPauseSource('critical', true)`),
  - открывается critical modal.
- Пока `criticalFlowActive === true`, дальнейший урон по суперкомпьютеру игнорируется (single-shot защита от повторного открытия).

## Critical modal

- Разметка: `index.html` → `#criticalOverlay`.
- Контроллер: `src/ui/criticalModal.js`.
- Тюнинг печати: `src/config/criticalModalTuning.js`.
  - `charsPerSec = 20`
  - `linePauseMs = 200`
  - `afterFinishPauseMs = 0`
- A11y:
  - открытие через `Game.A11y.openModal(...)`,
  - закрытие через `Game.A11y.closeModal(...)`,
  - modal попадает в вершину `openStack` (Tab trap + Esc по стандартному стеку).
- Поведение `Пропустить`:
  - во время печати мгновенно выводит остаток лога,
  - автоскролл остаётся внизу,
  - скрывает `Пропустить`,
  - показывает финальные кнопки.
- Строка про ошибку сохранения танков в нарративе выводится всегда и не зависит от фактического результата сейва.
- Строка про дронов печатается только если в state есть дроны.

## Autosave при входе в critical

Последовательность `openCriticalModal()`:

1. Очистка танков в ячейках: `cells[].tank = null`.
2. Попытка автосейва (`saveProgress`) в `try/catch`.
3. Открытие critical modal.

Важно: автосейв не должен падать приложением при ошибке хранения.

## Кнопки и действия

- `×` и `Сохранить прогресс и выйти`:
  1. повторная попытка сейва,
  2. `location.reload()`.
- `Перезапустить симуляцию` (partial reset):
  1. очистка танков,
  2. восстановление всех fence сегментов (`hp = maxHp`, `broken = false`) без изменения уровня/apгрейдов,
  3. восстановление `supercomputer.hp = supercomputer.maxHp`,
  4. гарантированный спавн `2x tank_lvl1`,
  5. закрытие critical modal,
  6. снятие pause-lock (`setMenuPauseSource('critical', false)`),
  7. `criticalFlowActive = false`.

## Load contract: 2x tank_lvl1

После применения загруженного state в boot-пайплайне вызывается helper `spawnInitialTanksLvl1(state, 2)`:

- если танки уже есть — не делает ничего,
- если танков нет — создаёт 2 стартовых `tank_lvl1` по тем же правилам, что и старт сессии.

Точка интеграции: `src/core/bootstrap.js` (после `restoreFullState(...)`, до запуска симуляции).

## Edge cases

- Если critical modal уже открыт, повторный `open` игнорируется.
- Если critical был активирован, урон по supercomputer не изменяет HP до restart/reload.
- Ошибка локального сохранения в critical flow не прерывает UI-сценарий.
- При `New game`/`reset` critical-флаги сбрасываются и pause-lock critical снимается.
