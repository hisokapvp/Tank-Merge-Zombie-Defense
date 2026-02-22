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
- При старте эпизода (переход attackMode false → true) runtime формирует эпизод:
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
  - визуальные/логические сегменты стен пересоздаются как для tier1 (сброс `fenceSegments`, `fenceSegmentsMeta`, `savedFenceState` — следующее отрисовывающееся построение создаст tier1 сегменты);
  - инфляция цен покупки танков сбрасывается в "абсолютный старт" (`buyCounts = {}`, `buyPrices = {}`);
  - attackMode runtime выключается полностью (force-off) и runtime-поля сбрасываются.

5) Критерии проверки (как тестировать)
- Старт эпизода фиксирует ровно 3 направления; в рамках эпизода дополнительный спавн использует только их.
- После двух эпизодов подряд с одинаковым `dirA`, в третьем `dirA` не равен предыдущему.
- При активном attackMode и `alive < baseDesiredAlive` спавн происходит по прежней логике (sideCount), не по 8-направлениям.
- В длинном эпизоде статистика для доп. спавнов близка к 50/25/25.
- При открытии critical modal — attackMode выключается и loop-sfx останавливаются.
- После partial reset: `state.fenceLevel === 1`, стены пересозданы как tier1, `buyCounts`/`buyPrices` сброшены.

Если нужно, добавим диаграмму эпизода/потока или unit-test инструкции.
