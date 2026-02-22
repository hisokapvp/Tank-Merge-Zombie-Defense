# Система: Render

## Где править
- Canvas root и слои: `src/render/canvasRoot.js`, `src/render/groundLayer.js`
- Земля/декор: `src/render/groundGen.js`, `src/render/fenceLayout.js`
- Спрайты: `src/render/spriteLoaders.js`
- Zombie render runtime: `src/render/zombieRender.js`

## Интеграция
- `drawZombieEntity`/`drawZombieSprite`/`drawZombieFallback` в `game.js` делегируются в `Game.ZombieRender` через `ensureZombieRenderRuntimeController()` с fallback на встроенный код.
- Talents v2 status icons рендерятся в `game.js::draw()` через `Game.TalentsV2.renderStatusIcons(...)` только в world-render боя (не в UI/hangar).
- Fade трупов применяется в `src/render/zombieRender.js` через `ctx.globalAlpha` в конце corpse-life (`assets/zombies.json: corpseFadeOutSec`).

## Правила
- `draw()` только рисует; обновления состояния  вне отрисовки.
- В горячем пути избегать новых объектов и массивов на кадр.
- Использовать существующие JSON-конфиги (`assets/ground.json`, `assets/decor.json`, `assets/fence.json`).
