# Simulation: attackMode supplemental and partial reset

Этот документ описывает поведение "attackMode-доп. зомби" и правила частичного ресета (Перезапустить симуляцию).

1) Что такое "attackMode-доп. зомби"
- Имеются два числа желаемого количества живых зомби:
  - `baseDesiredAlive` — желаемое количество при базовом спавне (без учёта attackMode-множителя). Это вычисляется так же, как и раньше, но с множителем = 1.
  - `attackDesiredAlive` — текущее желаемое количество (с учётом attackMode alive-множителя).
- Пока `alive < baseDesiredAlive` новые зомби спавнятся по прежней логике (sideCount / slot-based). Это гарантирует «base spawn не трогаем».
- Когда `alive >= baseDesiredAlive` и `alive < attackDesiredAlive`, дополнительные зомби — это "attackMode-доп.". Они выбираются не из slot-логики, а из трёх фиксированных направлений эпизода (8-направлений сетка): при генерации одного такого зомби:
  - с вероятностью 0.5 — направление `dirA`
  - с вероятностью 0.25 — направление `dirB`
  - иначе — направление `dirC`
- Угол появления = центр выбранного направления + jitter в диапазоне ±π/32.
- Все "attackMode-доп." в рамках эпизода используют только эти три направления.

2) AttackMode-эпизод (deterministic runtime rules)
- При старте эпизода (переход attackMode false → true, включая force/debug-активацию) runtime формирует эпизод:
  - выбирает `dirA` (0..7). Если предыдущий прямой был одинаковым два эпизода подряд (`streak == 2`), то `dirA` выбирается с исключением предыдущего `prevPrimaryDir`.
  - выбирает `dirB` и `dirC` случайно из оставшихся (все три различны).
  - обновляет `attackSpawnPrimaryStreak`: если `dirA == prevPrimaryDir` → `streak++`, иначе `streak=1; prevPrimaryDir=dirA`.
- Системные поля runtime: `attackSpawnDirA/B/C`, `attackSpawnPrevPrimaryDir`, `attackSpawnPrimaryStreak`, `attackSpawnEpisodeKey`.

3) Critical modal
- При открытии critical modal вызывается единственная «force-off» функция, которая немедленно:
  - выключает attackMode runtime (attackStart/End/force flags),
  - сбрасывает все attack runtime поля (направления, streak, episodeKey),
  - останавливает соответствующие loop-sfx (rain/attack modes),
  - восстанавливает alive-множитель в 1.

4) Partial reset (Перезапустить симуляцию)
- Что сохраняется: прогресс игрока — таланты, апгрейды, дроны, достижения и т.п. (как раньше).
- Что принудительно сбрасывается при partial restart:
  - `state.fenceLevel` = 1 (base tier);
  - визуальные/логические сегменты стен пересоздаются как для tier1 (сброс `fenceSegments`, `fenceSegmentsMeta`, `savedFenceState` + принудительный `FenceSprites.ensureLevel(1)`);
  - инфляция цен покупки танков сбрасывается в "абсолютный старт" (`buyCounts = {}`, `buyPrices = {}`);
  - attackMode runtime выключается полностью (force-off) и runtime-поля сбрасываются в `onAfterRestore`/post-restore step.

5) Критерии проверки (как тестировать)
- Старт эпизода фиксирует ровно 3 направления; в рамках эпизода дополнительный спавн использует только их.
- После двух эпизодов подряд с одинаковым `dirA`, в третьем `dirA` не равен предыдущему.
- При активном attackMode и `alive < baseDesiredAlive` спавн происходит по прежней логике (sideCount), не по 8-направлениям.
- В длинном эпизоде статистика для доп. спавнов близка к 50/25/25.
- При открытии critical modal — attackMode выключается и loop-sfx останавливаются.
- После partial reset: `state.fenceLevel === 1`, стены пересозданы как tier1, `buyCounts`/`buyPrices` сброшены.

6) Fence tier runtime при рестарте
- `ensureFenceTierRuntimeState()` НЕ перезаписывает `runtimeMaxTankLevelAchieved` значением `maxTankLevelAchieved` — это позволяет fence начинать с уровня 1 после critical restart, а не перепрыгивать на ранее достигнутый максимум.

7) Zombie breach awareness
- `getNearestKnownBreachForZombie()` использует `awarenessRadiusPx` вместо `Infinity` для зомби, находящихся на той же стороне. Зомби «видят» бреши только в пределах настроенного радиуса.
- `zombieFenceLimit()`: если `z.breached === true`, но зомби стоит на целом (не разрушенном) сегменте и не находится глубоко внутри, флаг `breached` сбрасывается в `false`.

8) Защита дронов при restart/retry
- `buildPreRetryPayload()`: перед retry проверяется, что массив дронов сохранён в payload даже после `applyPreRetryRuntimeReset`.
- `applyCriticalRestartPostLoad()`: при critical restart выполняется восстановление из pre-retry snapshot не только при пустом массиве, но и при деградации состава дронов (меньше количество/сумма уровней).

9) Critical save & exit
- При `HP supercomputer <= 5%` и выборе `Сохранить прогресс и выйти` сохраняется не «текущий аварийный runtime», а нормализованный pre-retry payload:
  - `fenceLevel` сброшен в `1`,
  - в payload проставляется флаг принудительного fence runtime reset при загрузке (`forceFenceRuntimeResetOnLoad`),
  - `supercomputer.hp` восстановлен до `maxHp`,
  - runtime-объекты очищены,
  - стартовый `lvl1` танк присутствует в payload.

10) Fence pathing на нижних углах
- В `zombieFenceLimit()` проверка «зомби стоит на сломанном сегменте» выполняется по фактической позиции (`pickFenceSegmentByPoint`) с fallback на `theta`.
- Это убирает ложный проход зомби по целым нижним секциям fence после пролома углов, не меняя обзор/агро/другие attackMode-правила.

11) Drag threshold (pointermove)
- В обработчике `pointermove` (canvas) координаты `state.dragging.x/y` обновляются только после того, как суммарное смещение превысит 6 px (`moved=true`). Это предотвращает ложные начала drag при тапе.

Если нужно, добавим диаграмму эпизода/потока или unit-test инструкции.
