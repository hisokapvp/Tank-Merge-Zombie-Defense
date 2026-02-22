# Configs

## assets/zombies.json

- `corpseDespawnSec` — время существования трупа **после** окончания death-анимации (сек).
- `corpseFadeOutSec` — длительность fade-out в конце life-time трупа (сек).

### Runtime-нормализация

- Оба значения приводятся к `Number` и clamp'ятся к `>= 0`.
- `corpseFadeOutSec` дополнительно clamp'ится до `corpseDespawnSec`.

### Поведение

- Общий life-time трупа до удаления: `deathAnimDuration + corpseDespawnSec`.
- Fade применяется только в хвосте life-time, линейно: `alpha = timeToRemove / corpseFadeOutSec`.
- При `corpseDespawnSec = 0` труп удаляется сразу после завершения death-анимации.

### Forced culling (лимит трупов)

- При превышении `corpseMaxCount` лишние трупы не удаляются мгновенно.
- Для них принудительно сокращается оставшийся таймер до ускоренного fade `~0.2s`, после чего удаление происходит штатным механизмом.
- Это сохраняет плавное исчезновение и избегает тяжёлых burst-удалений в один кадр.
