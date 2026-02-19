# Архитектура (кратко)

## Слои
- Вход: `index.html`, `game.js`, `src/core/bootstrap.js`
- Домен: `src/mechanics/*`, `src/systems/*`, `src/persistence/*`
- Рендер/ввод: `src/render/*`, `src/ui/*`, `src/audio/*`
- Поддержка: `src/analytics/*`, `src/telemetry/*`, `src/flags/*`, `src/experiments/*`

## Контракты
- В `src/*` использовать IIFE + `'use strict'` + `global.Game.*`.
- Не раздувать `game.js`: новая логика должна жить в `src/*`.
- Горячий путь (`loop`/`draw`/`step*`) без лишних аллокаций; `draw()` только рисует.
