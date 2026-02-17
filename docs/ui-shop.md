# UI Shop: bulk-покупка танков

## Дополнительная прогресс-метрика: очки урона

- В модалке «Модификации танков и стен» отображается `damagePoints`.
- Формула: `damagePoints = floor(totalDamageDealtRaw / 10000)`.
- `totalDamageDealtRaw` — applied damage по зомби (без overkill), учитывается только источник `tank`.
- На `New game`/reset: `totalDamageDealtRaw = 0`, соответственно `damagePoints = 0`.

## Гейтинг по достижениям `creator_*`

| Состояние unlock | Tier | `maxByTier` | Видимость |
|---|---|---:|---|
| нет `creator_novice` | `none` | `0` | кнопка скрыта |
| `creator_novice` без `creator_pro` | `buy2` | `2` | кнопка видна |
| `creator_pro` без `creator_expert` | `buy5` | `5` | кнопка видна |
| `creator_expert` | `buyMax` | `freeSlots` | кнопка видна |

`buyer_*` больше не участвуют в bulk-buy (удалены из списка достижений).

## Формула количества

- Точное число к покупке: `X = min(maxByTier, freeSlots, affordableByCoins)`.
- `affordableByCoins` считается точной симуляцией последовательных покупок по текущей модели цены (с ростом цены на каждом танке), без мутаций `state`.
- Для текста кнопки используется `xDisplay = max(2, X)`.

## Состояние кнопки и клик

- Если `X < 2`, кнопка остаётся видимой, но `disabled = true`, label показывает «Купить 2 …», клик делает no-op.
- Если `X >= 2`, кнопка enabled, клик покупает ровно `X` танков в рамках текущего tier cap.
- Частичная bulk-покупка теперь разрешена в рамках тира: не нужно копить на фиксированный максимум (`2`/`5`/`all`), покупается фактически доступное `X`.
