# Система: Tutorial Runtime

> Обновлено: 2026-03-27.

## Где править
- Конфиг шагов: `src/config/tutorialSteps.js`
- Runtime выбора/активации/завершения: `src/ui/tutorialRuntime.js`
- Bootstrap hook/fallback pause wiring: `src/core/bootstrap.js`
- Bubble/overlay/layout: `style.css`
- DOM target contracts: `index.html`, `src/ui/supercomputerMenu.js`, `src/ui/productionLineUI.js`

## Канонические инварианты
- Pending step выбирается через `getPreferredPendingStepId(state, tutorial)` как first available incomplete step. Нельзя перескакивать на более поздний доступный шаг, пока ранний незавершённый шаг ещё валиден по цепочке.
- Completion-проверки обязаны уважать prereq вроде `requiresStepBubbleShown`, `minSupercomputerLevel`, `minDamagePoints`, но не должны ломаться только потому, что целевой клик уже переключил UI из исходного root-view в дочерний экран.
- Для supercomputer-цепочек переходный шаг должен считаться завершённым по факту открытия целевого view: root menu, talents view, tank/wall mods. Не требовать, чтобы предыдущий root-view всё ещё оставался видимым в тот же тик.
- Шаг `supercomputer_damage_apply_level1_weapon_upgrade` теперь таргетит expand-toggle первой weapon row (`[data-guns-action="toggle"]`), unlock'ит stat controls во всех трёх табах (`guns/drones/walls`) и должен схлопываться по любому реально применённому damage-upgrade в weapons, drones или walls; шаг не должен «оживать» повторно после того, как у игрока уже есть applied upgrade в этой подсистеме.

## Activation / Completion
- Activation описывается data-driven в `src/config/tutorialSteps.js`.
- Runtime читает шаги только из конфига; не добавлять ad-hoc step logic в `game.js`.
- Для state-based completion используйте runtime helpers, а не ручные DOM side effects.
- Для navigation-steps completion-gate должен проверять prereq/bubble state отдельно от transient DOM-видимости исходного шага.
- Для damage-upgrade шага preserve-pending contract обязателен: `shouldPreservePendingCompletion()` должен оставлять step completion eligible, даже если prereq damage points уже потрачены на апгрейд; фактическое завершение идёт через `getAppliedDamageUpgradeTotal(state) > 0`, который суммирует `cannonUpgradesApplied`, `dronUpgradesApplied`, `fenceUpgradesApplied`: [src/ui/tutorialRuntime.js](../../../src/ui/tutorialRuntime.js#L626-L635), [src/ui/tutorialRuntime.js](../../../src/ui/tutorialRuntime.js#L671-L676), [src/ui/tutorialRuntime.js](../../../src/ui/tutorialRuntime.js#L947-L980), [src/ui/tutorialRuntime.js](../../../src/ui/tutorialRuntime.js#L2249-L2255).

## Modal Pause / Overlay
- Tutorial bubble использует modal pause contract через `enterCriticalPause` / `exitCriticalPause`, переданные из bootstrap. Нельзя полагаться только на перехват `PauseManager.createPauseManager()`.
- Body marker `tutorial-modal-open` синхронизируется только когда bubble реально открыт.
- Bubble допускает selective unlock только через step `unlock.selectors`, `unlock.targetKinds`, `unlock.uiKeys` и `allow.bubbleControls`.

## Targets / Selectors / Hotspots
- DOM selectors для tutorial unlock теперь могут матчить несколько элементов; runtime обязан открывать весь набор совпавших контролов, а не только первый `querySelector`.
- Для supercomputer-targets canonical ids: `#supercomputerBtn`, `#supercomputerOpenTalents`, `#supercomputerOpenTankWallMods`, `#talentOverlay`, `#modsTankWallOverlay`, `#modsTankWallPanelGuns`.
- Для modifiers-modal шага canonical selector остаётся `#modsTankWallOverlay .scGunsTable__row[data-level="1"] [data-guns-action="toggle"]`, а unlock surface intentionally включает `data-guns-action`, `data-dron-action`, `data-walls-action` controls на всех трёх табах: [src/config/tutorialSteps.js](../../../src/config/tutorialSteps.js#L249-L279).
- Для production storage первый box target берётся динамически через первый заполненный слот, а не по жёсткому индексу.

## Проверки после правок
- Открыть tutorial step и убедиться, что bubble не перескакивает вперёд мимо раннего шага.
- Проверить, что клик по supercomputer child-view завершает текущий navigation-step даже без нажатия `Продолжить`.
- Проверить, что первый damage-step ведёт в toggle первой weapon row, раскрытие показывает stat cards, а applied weapon/drone/wall upgrade завершает step и курсор больше не возвращается после нового накопления очков урона.