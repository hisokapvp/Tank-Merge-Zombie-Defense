# QA Talents v2 (PACK 8)

Документ для ручного приёмочного прогона TalentsV2 без чтения кода.

## Подготовка

- Запуск: `node Test/tests.js` и `node Test/pack8/talentsV2_migration.test.js`.
- Dev-режим: `?debug=1`.
- Проверка debug-flags через `localStorage`:
  - `debug_dtScale` (например `4`)
  - `debug_fixedDtMs` (например `200`)
  - `talents_debug_forceChance` (`1`)
  - `talents_debug_forceChanceKey` (`acid`, `mark`, `ricochet`, `impulse`, `armorpiercing`, `killbounty`, `stun`, `immunity`, `lottery`, `doublerewardkill`, `doublerewardshot`)
  - `talents_debug_showIcons` (`0` чтобы скрыть статус-иконки)
  - `talents_debug_dump` (`1`; hotkey `F8` вызывает `Game.TalentsV2.debugDump()`)

## Авто-проверки во время прогона

- Если `onHit` приходит без `timeMs` в dev, выбрасывается ошибка.
- Если `onHit` значительно опережает `onShotFired` (или счётчик выстрелов танка не растёт), пишется warning в консоль.
- Если catch-up циклы (`DOT` / `interest` / `recharge` / `regen`) достигают guard-лимита, пишется warning и цикл мягко клампится к «почти текущему» времени.

## Чеклист

### 1) UI

- [ ] Вкладки веток работают, активная ветка корректно подсвечивается.
- [ ] Tier-lock корректно блокирует покупку и показывает причину.
- [ ] Покупка ранга корректно сохраняется в save.
- [ ] Активки корректно показывают `charges`, cooldown и disabled state.

### 2) Offense

- [ ] `armorPiercing/impulse/killBounty` прокают **на выстрел**, per-tank, с refresh/no-stack.
- [ ] Бафы держатся по времени (около `5с` или по текущим параметрам дерева).
- [ ] Иконки над танком соответствуют активным бафам.
- [ ] `acid DOT` тикает каждые ~`200ms`, иконка DOT отображается.
- [ ] `mark + execute + ramp + pulse + ricochet + crowd` работают в комбинации и без взаимных конфликтов.

### 3) Defense

- [ ] `shield` накапливается периодически и режет входящий урон.
- [ ] `barrier` срабатывает по порогу HP и уважает ICD.
- [ ] `slow field` замедляет зомби у стены.
- [ ] `second wind` срабатывает один раз и не допускает мгновенную смерть сегмента.
- [ ] `active dome` корректно уменьшает урон во время активности.

### 4) Economy

- [ ] `interest` начисляется по периоду, уважает cap.
- [ ] `voucher` копится от убийств и тратится на покупки.
- [ ] `lottery` уважает `ICD` и лимит за run.
- [ ] `clean defense` работает при волне без урона стенам.
- [ ] `grey -> damage points` переводится в конце волны.

### 5) Migration

- [ ] Старый save (v1) грузится и мигрирует без падения.
- [ ] Unknown legacy talents идут в refund, очки не теряются.
- [ ] После миграции `talentsVersion=2`.

## FPS-independence

- [ ] При `debug_dtScale=4` поведение `DOT/interest/recharge` остаётся стабильным по времени.
- [ ] При `debug_fixedDtMs=200` нет зависаний в `while`-догоне.
- [ ] Guard предупреждения появляются только при экстремальных dt.

## Debug snapshot

- Вызов: `Game.TalentsV2.debugDump()`.
- Проверить, что dump содержит:
  - `ranksById`
  - `mods`
  - `runActives`
  - `migration`
  - `firstTankRt` / `firstZombieRt` (если есть)

## Known Issues (фиксировать явно)

- DOT-kill без attribution считается ожидаемым поведением в PACK 8.
- Если `onHit` отправляется дважды (например и от пули, и от взрыва), это интеграционный баг боёвки, не TalentsV2.
