# UI Talents v2 Integration

Краткий playbook для подключения UI дерева/активок и world-status иконок.

## 0) Overlay layout contract

- В модалке Talents v2 одновременно отображаются все 3 ветки (`offense/defense/economy`), без переключения вкладками.
- Каждая ветка рендерится отдельной колонкой с собственными:
  - `talentBranchTitle`
  - счетчиком потраченных очков ветки (`getBranchSpent(branchId)`)
  - контейнером дерева (`.talentTreeGrid`) и SVG-слоем связей (`.talentTreeSvg`).
- Контейнер дерева держит icon-shell через `--talent-node-icon-size: 40px`, а вертикальный шаг рядов намеренно ужат до `--talent-row-gap: clamp(14px, 2.8vh, 18px)`: [style.css](../style.css#L2076-L2084), [style.css](../style.css#L2181-L2191).
- Геометрия узлов берётся из `Game.TalentsV2.getTalentsByBranch(branchId)` → `node.layout` (`row`, `slot`, `parents`); при отсутствии layout используется fallback на legacy-layout `3-3-3-3-2-2-1`.
- Якорь каждой SVG-связи считается от центра `.talentNodeIcon` к центру `.talentNodeIcon`, а не от внешнего button-shell: [src/ui/talentOverlayRenderer.js](../src/ui/talentOverlayRenderer.js#L9-L21), [style.css](../style.css#L2227-L2241).
- SVG-связи обновляются при `updateTalentUI` и на `window.resize`.
- Базовые SVG-связи (`.talentEdge`) должны быть видимы сразу после `New game` (до первой покупки) и оставаться явно серыми по умолчанию: [style.css](../style.css#L2076-L2108).
- Зелёный glow/pulse разрешён только для outgoing edges от талантов с ненулевым applied rank: `drawBranchEdges()` помечает такие связи как `ready` или `active`, а `base` остаётся серой без ауры. Для `active` больше не используется travelling dash/particle flow; анимация сведена к pulse + jitter как эффекту тока/энергии: [src/ui/talentOverlayRenderer.js](../src/ui/talentOverlayRenderer.js#L91-L151), [style.css](../style.css#L2134-L2168).
- При `openTalents`/`closeTalents` и изменении видимого layout (включая сценарии `New`/`Load`) кэш геометрии связей должен инвалидироваться с пересчётом, чтобы линии не исчезали.
- Orchestration слоя redraw/update для overlay вынесена в `src/ui/talentOverlayUi.js`: модуль отвечает за summary, branch counters, node redraw, edge redraw и active slots, а `game.js` оставляет bootstrap/fallback helpers (`renderTalentNodesV2`, `drawTalentEdgesV2`, wiring к API).
- Состояние `applied` остаётся только зелёным, а `maxed` добавляет отдельный orange overlay именно на внутренний icon-shell через `.talentNode.maxed .talentNodeIcon::after`: [style.css](../style.css#L2275-L2307), [style.css](../style.css#L2325-L2350).

## 1) UI reasons (disabled buy)

- Источник: `Game.TalentsV2.canBuy(talentId)`.
- Reason-коды -> i18n ключи:
  - `tier_locked` -> `talentCantBuy_tierLocked`
  - `no_points` -> `talentCantBuy_noPoints`
  - `requires` -> `talentCantBuy_requires`
  - `max_rank` -> `talentCantBuy_maxRank`
- Для `requires` использовать `missingRequires[]`:
  - имя таланта: `Game.TalentsV2.getTalentUi(id).nameKey`.

## 2) Active UI contract

- Getter: `Game.TalentsV2.getActiveState(branchId, nowMs)`.
- Возвращает:
  - `unlocked`
  - `charges`
  - `chargesMax`
  - `nextRechargeAtMs`
  - `rechargeMs`
  - `untilMs`
  - `durationMs`
  - `isActive`
- Временные поля `untilMs`/`nextRechargeAtMs` нормализуются к epoch в миллисекундах (защита от смешения секунд и миллисекунд в save/runtime).
- Для индикации активной длительности в UI использовать нормализованный `untilMs`; если `untilMs` невалиден/выбивается по диапазону, допускается fallback от `durationMs` (`nowMs + durationMs`).
- Disabled:
  - `!unlocked || charges <= 0`
- При первом открытии активки (рост `chargesMax` с 0 до >0) слот должен получать стартовый заряд(ы) сразу, без перезапуска сессии.
- Таймер до заряда:
  - `ceil((nextRechargeAtMs - nowMs)/1000)`
- Stage HUD slots:
  - иконка активки берётся из локализованного имени таланта (`Game.TalentsV2.getTalentUi(activeTalentId).nameKey`) и маппится в `assets/Telent_icon/<name>.png`.
  - fallback при отсутствии нового ассета: `assets/ui/icons/talents/<icon>.png`.

## 3) Active activation in battle

- Offense: `Game.TalentsV2.activateOffenseActive(timeMs, { tank })`
- Defense: `Game.TalentsV2.activateDefenseActive(timeMs)`
- Economy: `Game.TalentsV2.activateEconomyActive(timeMs)`

Результат успешной активации:

- `charges` уменьшаются
- `untilMs` выставляется на duration
- recharge стартует через `nextRechargeAtMs`

## 4) Status icon renderer

- Контракт:
  - `Game.TalentsV2.renderStatusIcons({ canvasCtx, timeMs, camera, tanks, zombies, getTankPos?, getZombiePos? })`
- Важно:
  - вызывать только в боевом world-render
  - не вызывать в ангарном/UI-рендере

Приоритет и лимит:

- `stun > slow > mark > dot > buffs`
- максимум `3` иконки на entity
- По мере истечения эффекта иконка статуса получает white-fill прогресс (без чисел) как сектор по часовой стрелке с центром в середине иконки (`fill: 0 -> 1`).

Маппинг ассетов (`assets/ui/icons/status/*.png`):

- tank:
  - `armorPiercing` -> `status_armorPiercing`
  - `impulse` -> `status_impulse`
  - `killBounty` -> `status_killBounty`
  - `offenseActive` -> `status_activeOff`
  - `ramp` -> `status_ramp` (+ текст stacks 1..5)
- zombie:
  - acid dot -> `status_acid`
  - converted dot -> `status_convert`
  - mark -> `status_mark`
  - slow/stun -> `status_slow`/`status_stun`

## 5) Где вызывать

- `renderStatusIcons(...)`: после отрисовки танков/зомби, до overlay UI.
- `getActiveState(...)` для HUD/модалки: в UI update тике (кадр или polling 100-200ms).
- После покупки таланта: сразу обновить disabled state и reason tooltip/toast.
