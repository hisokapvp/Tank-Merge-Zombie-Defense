# Система: Combat

## Где править
- Бой и урон: `src/mechanics/combat.js`, `src/mechanics/combatProfiles.js`
- Наведение/цели: `src/mechanics/targeting.js`
- Спавн зомби: `src/mechanics/zombieSpawn.js`

## Правила
- Баланс брать из `global.BAL` и конфигов, а не из магических чисел.
- Изменения DPS/скорострельности валидировать на низких и высоких уровнях.
- Не ломать интеграцию с `worldEvents`, `supercomputer`, `fence`.

## Мини-проверка
- Урон, cooldown и target selection предсказуемы.
- Нет регрессий в critical/attack режимах.
