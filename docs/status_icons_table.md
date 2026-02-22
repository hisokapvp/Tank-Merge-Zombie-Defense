Список статусов и иконок (1–10)

1) status_mark.png — Статус «mark»: накладывается на зомби (условие активации: `zRt.markUntilMs > nowMs`). Увеличивает получаемый зомби урон (параметр: `markDamageTakenMul`).

2) status_acid.png — DOT «acid»: наносит урон с течением времени (активация: `zRt.dots.acid.untilMs > nowMs`). DPS рассчитывается через `acidDotDpsMul` и длительность `acidDotDurationMs`.

3) status_convert.png — Converted dot: часть мгновенного урона конвертируется в DOT (активация: `zRt.dots.converted.untilMs > nowMs`). Параметры: `convertToDotPct`, `convertDotDurationMs`.

4) status_stun.png — Оглушение (stun): зомби оглушён (активация: `zRt.cc.stunUntilMs > nowMs`), временно теряет способность действовать/двигаться.

5) status_slow.png — Замедление (slow): снижает скорость зомби (активация: `zRt.cc.slowUntilMs > nowMs`), сила замедления хранится в `zRt.cc.slowPct`/параметрах `ccSlowDurationMs`.

6) status_armorPiercing.png — Armor Piercing (бафф на танке): повышает урон выстрела, пока активен (активация: `tRt.buffs.armorPiercing.untilMs > nowMs`), множитель `armorPiercingProcDamageMul`.

7) status_impulse.png — Impulse (бафф на танке): временно увеличивает скорострельность (активация: `tRt.buffs.impulse.untilMs > nowMs`), множитель `impulseProcFireRateMul`, длительность `impulseProcDurationMs`.

8) status_killBounty.png — Kill Bounty (бафф на танке): увеличивает награду за убийство, пока активен (активация: `tRt.buffs.killBounty.untilMs > nowMs`), множитель `killBountyCoinsMul` применяется в `onKill`.

9) status_activeOff.png — Offense Active (активка): показывается при включённой оффенсивной активке (пер-танк `tRt.buffs.offenseActive` или глобально `runRt.actives.offense`); даёт временные бафы (параметры: `offenseActiveDamageMul`, `offenseActiveFireRateMul`, `offenseActiveAoeMul`, `offenseActiveOrbitMul`).

10) status_ramp.png — Ramp (накапливаемые стеки на танке): отображается при `tRt.ramp.stacks > 0` и если последний выстрел в пределах grace; рядом выводится число стаков (1..5). Каждый стек даёт бонус (например, `rampUpFireRatePerStack`) до `rampUpStackMax`.

Примечание: условия активации и параметры вынесены из `src/systems/talents/talentsV2.js` и балансных параметров в `assets/balance/talentTree_v2.json`.