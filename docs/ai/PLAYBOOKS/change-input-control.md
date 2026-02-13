# PLAYBOOK: Изменить input

## Шаги

1. Изменить нужную ветку в `game.js` (`pointerdown/move/up`).
2. Не ломать ранние перехваты (offline/crate).
3. При изменении координат синхронизировать `src/render/input.js`.
4. Проверить очистку `state.dragging` в `pointerup`.

## Проверка

- Tap, drag, merge, onTrack работают.
- Hit-test корректен после resize.
