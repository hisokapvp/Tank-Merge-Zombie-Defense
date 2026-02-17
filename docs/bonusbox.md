# BonusBox (crate) animations

## Формат `assets/bonusbox.json`

- `atlas`: имя atlas-файла в `assets/` (например, `bonusbox_atlas.png`).
- `animations`:
  - `drop`: `{ x, y, w, h, frames, frameRateFps, loop:false }`
  - `idle`: `{ x, y, w, h, frames, frameRateFps, loop:true }`
  - `hover`: `{ x, y, w, h, frames, frameRateFps, loop:true }`
  - `press`: `{ x, y, w, h, frames, frameRateFps, loop:false }`

Опционально поддерживается legacy `frames[]` + ссылки по `id` в `animations.<name>.frames` (для старых конфигов).

## Правила state-machine

- Spawn:
  - при появлении crate всегда стартует `drop` (one-shot)
  - после завершения `drop` автоматически включается `idle`
- Hover:
  - enter: если сейчас не `drop` и не `press`, переключение в `hover`
  - leave: если сейчас `hover`, возврат в `idle`
- Pointerdown:
  - мгновенно запускает `press` (`animTimeSec = 0`)
  - параллельно запускается текущая логика открытия crate UI/выдачи награды (без ожидания конца `press`)
- Завершение one-shot:
  - `drop -> idle`
  - `press -> hover`, если курсор всё ещё над crate; иначе `press -> idle`

## Отрисовка

- Выбор кадра идёт по правилу:
  - `frameIndex = floor(animTimeSec * frameRateFps)`
  - для loop-клипов индекс берётся по модулю длины клипа
  - для one-shot клипов индекс clamp-ится к последнему кадру
- Кадр берётся из `framesById` и рисуется из atlas через `drawImage`.

## Важное примечание

- Если crate удаляется в момент клика/выдачи награды, анимация может прерваться раньше завершения — это допустимое поведение и не считается ошибкой.