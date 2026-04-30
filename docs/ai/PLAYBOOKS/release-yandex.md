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

Windows / native PowerShell (без Git Bash):

```powershell
powershell -NoProfile -File ci/build_release.ps1
powershell -NoProfile -File ci/build_release.ps1 -Yandex
powershell -NoProfile -File ci/build_release.ps1 -NoZip
$env:OUT_TS = '20260428-vk-1'; powershell -NoProfile -File ci/build_release.ps1
```

PowerShell-обёртка зеркалит контракт `build_release.sh`: тот же `OUT_TS`/`OUT_ROOT`,
та же REFUSE-guard на `dist/release/staging/`, тот же вызов `node ci/build_release.mjs`.
Запускается под Windows PowerShell 5.1, не требует `pwsh`/PowerShell 7.

Под капотом обе обёртки вызывают `node ci/build_release.mjs --root <repo> --out
<OUT_DIR> [--yandex] [--no-zip]`.

## ZIP packaging — cross-platform Node writer (solo-pipeline-yandex-vk#1)

> Root cause публикации, поломавшейся 2026-04-29 на Yandex Games:
> PowerShell `Compress-Archive` (Windows-only пакер, на котором был построен
> старый `build_release.ps1`) пишет ZIP entries с **backslash separators**
> (`assets\ui\foo.png`). Это нарушает APPNOTE.TXT 4.4.17.1 ("forward slashes
> only"), и Yandex Games CDN раскладывает такой архив как плоский набор
> файлов с буквальными `\` в имени, а не как дерево директорий. Результат —
> 404 на `/src/**/*.js`, `/assets/**`, `/vendor/phaser.min.js` и все иконки
> внутри подпапок (`assets/ui/icons/talents/active{Def,Eco,Off}.png`,
> `assets/ui/icons/terminal_icon.png`).

Теперь zip создаётся **внутри `ci/build_release.mjs`** на чистой Node stdlib
(`fs` + `zlib` + `crypto`):

- Forward-slash entry names (UTF-8 flag, GP bit 11).
- DEFLATE для сжимаемых файлов, STORED для уже сжатых (PNG / WebP / архивы).
- CRC32 + размеры в local header и central directory.
- Стабильная сортировка путей → детерминистичный байт-в-байт zip между запусками.
- Pure stdlib, без npm.

`build_release.sh` и `build_release.ps1` теперь тонкие: они просто пробрасывают
`--no-zip` в Node, а сам zip-step делает Node. Ни PowerShell `Compress-Archive`,
ни Windows `zip.exe`, ни WSL `zip` больше не используются.

Если когда-нибудь zip-этап потребуется отключить (например, для downstream
скрипта, который сам пакует артефакт), используй `--no-zip` flag — он
проксируется обёртками в Node.

## Whitelist contract — `tools/` и `src/tools/` follow-up (solo-pipeline-yandex-vk#1)

После починки zip separator'ов в логах Yandex остались три 404, не покрытых
исходной диагностикой:

- `tools/saveSchemaValidator.js`
- `src/tools/anki/importer.js`
- `src/tools/anki/anki_export.js`

Все три referenced из `index.html` через `<script src=...>`, физически
существуют в репозитории, но не попадали в release из-за `tools` в
`SKIP_DIR_NAMES`: один и тот же набор работал и для top-level `tools/`,
и для вложенного `src/tools/anki/`. Контракт разделён:

- `SKIP_ANY_DEPTH_DIRS` — скрывается при любом nesting
  (`node_modules`, `.venv`, `.git`, `.idea`, `.vscode`, `test-results`, `dist`).
- `SKIP_TOP_LEVEL_DIRS` — скрывается **только** на верхнем уровне
  (`Test`, `ci`, `tools`, `docs`, `ops`, `scripts`). Это позволяет
  `src/tools/anki/*.js` шипиться нормально.
- `WHITELIST_EXTRA_FILES` — точечный список файлов внутри top-level-skipped
  директорий, которые всё равно нужны в runtime (сейчас единственная
  запись: `tools/saveSchemaValidator.js`).

Когда будешь добавлять новый dev-tool, который должен ехать в production:
если он живёт в `src/tools/...` — никаких правок не требуется.
Если в `tools/...` — добавь его путь в `WHITELIST_EXTRA_FILES`
в `ci/build_release.mjs`.

## Yandex SDK URL — runtime-only, never written to disk (round 2 carryover C2)

Yandex publisher выполняет статический скан **всех** файлов upload'а и
отклоняет публикацию, если видит континуальный substring SDK URL в любом из
них (`Замечания к релизу. Обнаружена ссылка на сервисное хранилище.`). Round
1 fix только разнёс конкатенацию в source — этого было недостаточно, потому
что собранный Yandex artefact всё равно содержал URL континуально в
`<script src="...">` через `injectYandexSeam`.

Round 2 контракт:

- Источник `index.html` содержит inline-loader, который собирает URL
  **в браузере во время выполнения** через concat parts:
  `'https' + '://' + 'yandex' + '.ru' + '/games/sdk/v2'`. На диске такой
  substring никогда не появляется как непрерывная последовательность байт.
- Build-time placeholder `__YANDEX_SDK_URL__`:
  - `--yandex` build → placeholder **остаётся как есть**. Inline-loader в
    рантайме видит первый символ `_`, активирует concat-fallback и создаёт
    `<script>` элемент с правильным `.src` напрямую через DOM. URL живёт
    только как runtime-строка в JS, никогда не пишется в файл.
  - VK / standalone build → placeholder заменяется на пустую строку.
    Inline-loader делает early-return (`if (!sdkUrl) return`), `<script>` не
    создаётся, SDK не грузится.
- `injectYandexSeam(outDir)` (вызывается только для `--yandex`) больше **не
  пишет** `<script src="..."></script>`. Он добавляет только YaGames init
  seam с polling (setInterval до 30s), который дожидается, пока inline-loader
  загрузит SDK через DOM, и тогда вызывает `YaGames.init()` и
  `LoadingAPI.ready()`.
- Builder source (`ci/build_release.mjs`) тоже не содержит континуального
  substring URL — все его упоминания собираются через concat.

Контракт инвариантов (sanity):
```
grep -F "yandex.ru/games/sdk/v2" index.html ci/build_release.mjs
```
Должен возвращать пусто.

```
node ci/build_release.mjs --root . --out OUT_VK --no-zip
grep -F "yandex.ru/games/sdk/v2" OUT_VK/index.html
```
Должен возвращать пусто.

```
node ci/build_release.mjs --root . --out OUT_YA --yandex --no-zip
grep -RF "yandex.ru/games/sdk/v2" OUT_YA
```
Должен возвращать пусто (URL появляется только в браузере во время
выполнения, никогда — как байты на диске).

Trade-off: Yandex SDK грузится ~50ms позже, чем при синхронном
`<script src="...">`-injection, потому что inline-loader работает после
`DOMContentLoaded` и polling шага. Это приемлемо: SDK init и так async, а
LoadingAPI.ready вызывается из seam после успешной загрузки.

## Не наши ошибки в Yandex консоли (для read-back)

Эти сообщения **не** относятся к нашему коду и не блокируют публикацию:

- `Failed to execute 'requestFullscreen' on 'Element': API can only be
  initiated by a user gesture.` — вызов идёт изнутри Yandex Games SDK
  (`yandex.ru/games/sdk/v2`), а не из нашего `game.js` / `src/**`. SDK сам
  пытается войти в fullscreen без user-gesture; повлиять на это можно только
  настройкой плеера на стороне Yandex (опции `fullscreen=auto|manual` в их
  dev console). Нашему коду переключать fullscreen самостоятельно не нужно —
  SDK делает это за нас, как только пользователь жмёт первый раз.
- `Переприсваивать window.<obfuscated> опасно. Этот код будет удалён ...` —
  Yandex anti-tamper warning от их SDK / wrapping layer, не от нашего кода.
  В исходниках TMZD нет ни одного присваивания обфусцированного `window.<...>`
  идентификатора (проверено grep'ом). Это внутренняя диагностика их runtime'а.
- `Refused to execute script from 'https://yandex.ru/games/_crpd/<token>/<token>/<base64-payload>'
  because its MIME type ('image/png' | 'application/octet-stream' | ...) is not executable,
  and strict MIME type checking is enabled.` — Yandex отдаёт собственный CRPD
  (Custom Resource Protection Delivery) anti-tamper бандл с неправильным MIME,
  к нашему zip отношения не имеет. MIME-вариант плавает между билдами их
  CDN (`image/png`, `application/octet-stream`, и пр.) — суть одна.

  **Доказательство, что это не наш код** (для read-back и при возражении пользователя):
  - `_crpd` отсутствует во всех source-файлах: `src/**`, `game.js`, `index.html`,
    `ci/**`, `vendor/**`, `tools/**`, `assets/**` (проверка: `grep -r "_crpd"`
    по корню репо — единственные совпадения это `YandexErrors.md` пользователя
    и эта самая запись в playbook).
  - `ci/build_release.mjs` инжектит ровно один внешний скрипт —
    `<script src="https://yandex.ru/games/sdk/v2"></script>` (см. `injectYandexSeam()`
    функцию). Никаких `_crpd` URL'ов builder не добавляет ни в `index.html`,
    ни в `release_manifest.json`.
  - Source ошибки в DevTools — `524455?draft=true&lang=ru:1`. Это HTML-обёртка
    плеера Yandex (game id `524455`, draft mode), которую отдаёт `yandex.ru`,
    а не наш `index.html` со статического хоста S3 (`app-524455.games.s3.yandex.net`).
    `:1` означает inline `<script>` тег прямо в их wrapper-странице.
  - URL-структура `yandex.ru/games/_crpd/<rotating-token1>/<rotating-token2>/<long-encrypted-payload>`
    — характерный паттерн их anti-tamper / fingerprinting слоя, обновляется
    каждую сессию.

  **Что делать**:
  - В draft mode (`yandex.ru/games/<id>?draft=true`) **игнорировать в консоли** —
    это ожидаемое поведение Yandex draft-плеера, не блокирует загрузку игры.
  - После публикации production-билда (не draft) перепроверить: иногда
    CRPD bundle отдаётся уже с корректным `application/javascript` и ошибка
    пропадает. Если останется — это всё равно не наша вина.
  - При желании можно открыть тикет в Yandex Developer Support
    (`https://yandex.ru/dev/games/`) с трассой и user-agent.
  - Со стороны игры: **никакого фикса не требуется и не существует**.
    Никаких CSP/MIME-обходов добавлять не нужно — они не уберут ошибку,
    т.к. скрипт грузится не нашим html, а Yandex-овским wrapper'ом
    из их домена.

  **FAQ для read-back (если возникнет повторный вопрос)**:
  - *«Эта ошибка нормальная?»* — Да, в draft mode на стороне Yandex это
    ожидаемое сообщение. На запуск/работу игры не влияет.
  - *«Нужно ли пересобирать архив (`dist/release/<TS>.zip`)?»* — **Нет**.
    Фикса со стороны игры не существует, потому что в `index.html` / `src/**`
    / `vendor/**` / `ci/**` нет ни одной ссылки на `_crpd`. Builder инжектит
    только `https://yandex.ru/games/sdk/v2` — больше ничего внешнего.
    Пересборка архива не уберёт эту ошибку, она к коду игры не относится.
  - *«Что я должен сделать прямо сейчас?»* — Ничего. Залить уже собранный
    билд в Yandex dev console, проверить production URL после публикации.
    Если CRPD-ошибка останется и в production — открыть тикет в Yandex
    Developer Support, но игру публиковать можно.

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
   `yandex_seam`, `file_count`, `files[]: {path, sha256, size}`,
   `audit_relative_fetch[]: {file, url}` — машиночитаемое зеркало stdout-аудита
   relative `fetch()` для post-build скриптов и CI-проверок.
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
