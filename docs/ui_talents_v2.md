# UI Talents v2 Integration

Краткий playbook для подключения UI дерева/активок и world-status иконок.

## 0) Overlay layout contract

- В модалке Talents v2 одновременно отображаются все 3 ветки (`offense/defense/economy`), без переключения вкладками.
- Каждая ветка рендерится отдельной колонкой с собственными:
  - `talentBranchTitle`
  - счетчиком потраченных очков ветки (`getBranchSpent(branchId)`)
  - контейнером дерева (`.talentTreeGrid`) и SVG-слоем связей (`.talentTreeSvg`).
- Геометрия узлов берётся из `Game.TalentsV2.getTalentsByBranch(branchId)` → `node.layout` (`row`, `slot`, `parents`); при отсутствии layout используется fallback на legacy-layout `3-3-3-3-2-2-1`.
- SVG-связи обновляются при `updateTalentUI` и на `window.resize`.
- Базовые SVG-связи (`.talentEdge`) должны быть видимы сразу после `New game` (до первой покупки).
- При `openTalents`/`closeTalents` и изменении видимого layout (включая сценарии `New`/`Load`) кэш геометрии связей должен инвалидироваться с пересчётом, чтобы линии не исчезали.

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
- Disabled:
  - `!unlocked || charges <= 0`
- При первом открытии активки (рост `chargesMax` с 0 до >0) слот должен получать стартовый заряд(ы) сразу, без перезапуска сессии.
- Таймер до заряда:
  - `ceil((nextRechargeAtMs - nowMs)/1000)`
- Stage HUD slots:
  - иконка активки берётся из `Game.TalentsV2.getTalentUi(activeTalentId).icon` (`assets/ui/icons/talents/*.png`), а не из legacy `assets/active_*.png`.

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
