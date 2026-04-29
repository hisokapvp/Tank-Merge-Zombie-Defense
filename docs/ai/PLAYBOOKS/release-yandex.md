# Release playbook — generic static host (+ optional Yandex Games SDK seam)

> Scope: postmortem item 7 (`solo-pipeline-yandex-vk#2`) — выпуск свежего билда игры
> для произвольного стороннего сервера. По умолчанию билд **generic**: подходит
> любому HTTPS-хосту, отдающему статику. Yandex Games SDK добавляется
> отдельным opt-in флагом и НЕ является дефолтом.

## Hard invariants

- `dist/release/staging/` — release mirror; **не редактировать вручную**.
- Каждый запуск билдера создаёт новую timestamped папку `dist/release/<UTC>/`
  плюс одноимённый `.zip` рядом.
- Без minify, без source maps, без bundler — копия 1:1 для читаемых stack
  trace'ов в production.
- Whitelist копирует только runtime-нужное: `index.html`, `game.js`,
  `style.css`, `README.md`, `src/**`, `assets/**`, `vendor/**`. Всё остальное
  (`Test/`, `ci/`, `tools/`, `docs/`, `ops/`, `scripts/`, `node_modules/`,
  `.venv`, `dist/`, dotfiles, `*_README.md`, `triangular_chips_*.md`,
  `*.draft.json`) исключается.

## Команды

Generic build (по умолчанию):

```bash
bash ci/build_release.sh
```

С Yandex Games SDK seam:

```bash
bash ci/build_release.sh --yandex
```

Кастомный suffix у timestamped папки:

```bash
OUT_TS=20260428-vk-1 bash ci/build_release.sh
```

Без zip:

```bash
bash ci/build_release.sh --no-zip
```

Под капотом скрипт вызывает `node ci/build_release.mjs --root <repo> --out
<OUT_DIR> [--yandex]`.

## Что делает builder

1. Whitelist-копия в `dist/release/<TS>/`.
2. SHA-256 для каждого скопированного файла.
3. `?v=<sha8>` cache-busting — впрыскивается **только в копию** `index.html`
   на `<script src=...>`, `<link href=...>`, `<img src=...>` без явной `?v=`.
   Existing manual `?v=...` (например `fenceRepair.js?v=20260402-…`)
   сохраняются как есть.
4. Опционально (`--yandex`): добавляет `<script
   src="https://yandex.ru/games/sdk/v2"></script>` и failure-tolerant init
   снippet перед `</head>`. Если SDK не загрузился (локальный dev / не-Yandex
   хост), игра всё равно стартует.
5. Аудит relative `fetch('...')` в скопированном `game.js` — печатает в stdout
   для ручной проверки base-href совместимости.
6. `release_manifest.json` с полями `generated_at`, `git_sha`, `version`,
   `yandex_seam`, `file_count`, `files[]: {path, sha256, size}`.
7. `dist/release/<TS>.zip` рядом с папкой (если `--no-zip` не указан).

## Manual checklist перед публикацией

- [ ] Запустил `bash ci/build_release.sh` (или `--yandex` для Yandex Games).
- [ ] Проверил, что `dist/release/<TS>/release_manifest.json` содержит
      ожидаемое количество файлов и реальный `git_sha`.
- [ ] Открыл `dist/release/<TS>/index.html` локально (`python -m http.server`
      или эквивалент) и убедился, что игра стартует, ассеты грузятся,
      cache-bust query видны в DevTools Network.
- [ ] Просмотрел stdout аудита `[build_release] relative fetch() calls` —
      убедился, что все relative URL'ы совместимы с целевой base-href.
- [ ] (Yandex only) Внутри Yandex Games dev console прогрузил билд, проверил
      что `YaGames.init()` отрабатывает без ошибок, hooks `LoadingAPI.ready()`
      зовётся.
- [ ] Загрузил архив `dist/release/<TS>.zip` либо содержимое папки на целевой
      хост (любой статический HTTPS).

## Yandex SDK seam — TODO для production

Сейчас вшит только init-bridge. Реальные ad placements (rewarded /
fullscreen interstitials), purchases, leaderboards, save-cloud — это **manual
TODO**, не входит в minimum viable seam. Добавляются точечно через
`window.YaGamesSDK` после того как `window.__yaGamesReady` зарезолвится.

Документировано здесь намеренно, чтобы первый билд для Yandex был воспроизводим
и не зависел от ad-stack.

## Откат / повторный билд

- Откат не нужен: каждый билд — отдельная timestamped папка. Просто опубликуй
  предыдущую `dist/release/<previous-TS>/`.
- Никогда не перезаписывай `dist/release/staging/`.
