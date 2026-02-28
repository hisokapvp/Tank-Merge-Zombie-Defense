# Система: Render

## Где править
- Canvas root и слои: `src/render/canvasRoot.js`, `src/render/groundLayer.js`
- Земля/декор: `src/render/groundGen.js`, `src/render/fenceLayout.js`
- Спрайты: `src/render/spriteLoaders.js`
- Zombie render runtime: `src/render/zombieRender.js`

## Интеграция
- `drawZombieEntity` в `game.js` делегируется в `Game.ZombieRender` через `ensureZombieRenderRuntimeController()`. Устаревшие fallback-функции `drawZombieSprite`/`drawZombieFallback` удалены как мёртвый код (весь рендер зомби обрабатывается runtime-модулем).
- Talents v2 status icons рендерятся в `game.js::draw()` через `Game.TalentsV2.renderStatusIcons(...)` только в world-render боя (не в UI/hangar).
- Fade трупов применяется в `src/render/zombieRender.js` через `ctx.globalAlpha` в конце corpse-life (`assets/zombies.json: corpseFadeOutSec`).
- Fence render order в `game.js::draw()`:
	1) `renderFenceBase()`
	2) `renderZombiesAndCorpses()`
	3) `renderFenceHpBars()`
	4) `renderProjectilesAndEffects()`

	Это гарантирует видимость HP-баров поверх зомби/трупов и допускает перекрытие HP FX-слоем.

## Правила
- `draw()` только рисует; обновления состояния  вне отрисовки.
- В горячем пути избегать новых объектов и массивов на кадр.
- Использовать существующие JSON-конфиги (`assets/ground.json`, `assets/decor.json`, `assets/fence.json`).
