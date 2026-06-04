# BUILD REPORT — нативные сборки TMZD (первый прогон)

> Дата прогона: 2026-05-29 · Платформа сборки: **Windows** · Node `v24.13.0`, npm `11.6.2`
> Этот отчёт фиксирует фактический результат первого запуска полного pipeline нативной
> упаковки. Сборки доведены ровно настолько, насколько это физически возможно на текущей
> Windows-машине **без внешних аккаунтов, секретов и macOS**. Там, где сборка физически
> невозможна, зафиксирован точный проверяемый блокер и конкретные шаги разблокировки.
> Ничего не выдумано: каждый статус подтверждён реальным запуском соответствующего скрипта.

## Сводная таблица

| Платформа | Статус | Артефакт / расположение | Что блокирует | Точные шаги разблокировки |
|---|---|---|---|---|
| **Web (Yandex/VK)** | ✅ собрано | `dist/native/web/` — 538 файлов, `release_manifest.json`, `git_sha=7d58d62cc4f3` | — | Готово к деплою. `node packaging/scripts/build-web-bundle.mjs` пересобирает бандл. |
| **Windows Desktop (portable, Electron)** | ✅ собрано + проверено запуском реального `.exe` (D3, batch#6) | `dist/native/desktop/win-portable/Tank Merge Zombie Defense.exe` — всего 613 файлов | Без подписи (unsigned) | Запустить можно сразу: `dist/native/desktop/win-portable/Tank Merge Zombie Defense.exe`. Пересборка с фиксом D3: `node packaging/scripts/build-web-bundle.mjs` + `node packaging/scripts/assemble-portable-win.mjs`. Проверка реального `.exe` через `--remote-debugging-port` + CDP → рендер подтверждён (canvas нарисован, `window.Game` жив, 184 скрипта, 0 ошибок загрузки). Для подписи нужен code-signing сертификат (см. ниже). |
| **Windows Desktop (NSIS installer, подписанный)** | ⛔ blocked | — (электронная оболочка готова, шаг electron-builder падает) | electron-builder не может распаковать `winCodeSign` — создание darwin-симлинков (`libcrypto.dylib`, `libssl.dylib`) требует привилегии `SeCreateSymbolicLinkPrivilege`: «Клиент не обладает требуемыми правами». Эти симлинки относятся к macOS-подписи и в Windows-сборке не используются, но 7z-распаковщик падает на них. | 1) Включить **Developer Mode** (Параметры → Конфиденциальность и защита → Для разработчиков → Режим разработчика → Вкл), **или** 2) запустить терминал сборки **от имени администратора**, **или** 3) один раз вручную распаковать `winCodeSign` с правами админа. Затем `cd packaging && npm run build:win` создаст `nsis`+`portable` в `dist/native/desktop`. Для распространения дополнительно нужен code-signing сертификат (EV/OV). |
| **Steam** | 🟡 частично | Electron-оболочка готова (`packaging/electron/`, lazy `steamworks.js`), `app_build.vdf` подготовлен | Нет Steam Partner-аккаунта и `steamcmd`; депот не загружен | 1) Завести Steamworks Partner-аккаунт, получить `AppID`/`DepotID`. 2) Установить `steamcmd`. 3) Заполнить `app_build.vdf` реальными ID. 4) `steamcmd +login <account> +run_app_build app_build.vdf`. Перед этим получить подписанную/portable desktop-сборку (см. строки выше). |
| **Android (Google Play, AAB)** | ⛔ blocked на gradle (проект полностью собран в каркас) | Проект Capacitor: `packaging/capacitor/android/` (есть `app/build.gradle`, синхронизированы web-ассеты `app/src/main/assets/public/index.html`, внедрён native bridge, `gradlew.bat` присутствует) | Нет JDK (`java` ABSENT, `JAVA_HOME` пуст), нет Android SDK (`ANDROID_HOME`/`ANDROID_SDK_ROOT` пусты), нет `gradle` | 1) Установить **JDK 17** и задать `JAVA_HOME`. 2) Установить **Android SDK** (Android Studio или cmdline-tools), задать `ANDROID_HOME`. 3) Собрать debug-AAB: `node packaging/scripts/build-android.mjs --debug --skip-tests`. 4) Для релиза задать keystore-секреты `TMZD_ANDROID_KEYSTORE`, `TMZD_ANDROID_KEYSTORE_PASSWORD`, `TMZD_ANDROID_KEY_ALIAS`, `TMZD_ANDROID_KEY_PASSWORD` и (для IAP) `TMZD_REVENUECAT_ANDROID_KEY`, затем `node packaging/scripts/build-android.mjs`. |
| **iOS (App Store, IPA)** | ⛔ blocked (нет macOS; проект подготовлен) | Проект Capacitor: `packaging/capacitor/ios/` (есть `App/App.xcodeproj`, синхронизированы web-ассеты `App/App/public/index.html`, внедрён native bridge) | Сборка iOS физически требует macOS + Xcode. На Windows: `pod` ABSENT, `xcodebuild` ABSENT (CocoaPods/xcodebuild пропущены — это ожидаемо). Также нужны Apple Developer аккаунт и секреты Codemagic. | 1) Apple Developer Program ($99/год), bundle id, provisioning, App Store Connect API key. 2) Облачная сборка через Codemagic: `codemagic.yaml` готов — `git push` тега запускает workflow. Секреты: `TMZD_CODEMAGIC_TOKEN`, `TMZD_CODEMAGIC_APP_ID`, `TMZD_CODEMAGIC_WORKFLOW`, `TMZD_REVENUECAT_IOS_KEY`. 3) Альтернатива — собрать на Mac: `node packaging/scripts/build-ios.mjs` затем архив/подпись в Xcode. |

## Что реально выполнено в этом прогоне

1. **Окружение проверено** — Node/npm присутствуют; JDK, Android SDK, gradle, CocoaPods, Xcode подтверждённо отсутствуют (проверяемо).
2. **Web-бандл собран** — `dist/native/web/` (538 файлов, manifest, `git_sha=7d58d62cc4f3`).
3. **Зависимости упаковки установлены** — `packaging/` (`npm install`, 342 пакета, `electron.exe` на месте, `steamworks.js` ok).
4. **Portable Windows desktop-сборка собрана и проверена** — `assemble-portable-win.mjs` обходит заблокированный pipeline подписи electron-builder и собирает запускаемое (неподписанное) Electron-приложение из готового runtime. Структура проверена: exe на месте, `app/electron/main.js`, `app/dist/native/web/index.html`, `default_app.asar` удалён.
5. **Android-проект полностью собран в каркас** — `npx cap add android` + `cap sync android` + внедрение RevenueCat bridge прошли успешно; падение только на gradle из-за отсутствия JDK/SDK.
6. **iOS-проект подготовлен** — `npx cap add ios` + `cap sync ios` + внедрение bridge прошли успешно; pod install / xcodebuild пропущены (нет macOS).
7. **Регрессия зелёная** — `node Test/tests.js` → **85 passed, 0 failed**.

## Исправленные по ходу дефекты сборочных скриптов

- **Windows path-with-space bug** в `packaging/scripts/build-android.mjs` и `packaging/scripts/build-ios.mjs`: при `shell:true` cmd.exe заново парсил командную строку и ломался на пробеле в `C:\Program Files\nodejs\node.exe`. Добавлено квотирование `cmd`/аргументов с пробелами/спецсимволами под Windows.
- **Отсутствие npm-package root для Capacitor CLI**: добавлен `packaging/capacitor/package.json`, чтобы `cap add/sync` распознавали валидный корень npm-пакета (реальные зависимости резолвятся обходом вверх в `packaging/node_modules`).

## Исправленные рантайм-дефекты нативных сборок (D1–D3)

> Это дефекты поведения уже собранного бандла (не сборочных скриптов), найденные при
> прогоне Web/Яндекс и desktop `.exe`. Оба корневых фикта подтверждены: регрессия
> `node Test/tests.js` → **85 passed**, browser smoke по `dist/native/web/index.html`
> даёт 0 MIME/script-ошибок наших скриптов, `#hudShopButton` присутствует в DOM,
> а реконструкция SDK при пустом `sdkUrl` возвращает живой `https://yandex.ru/games/sdk/v2`.

- **D1 — пропала кнопка магазина в Web/Яндекс (root cause).** HUD-кнопка магазина
  (`#hudShopButton`, `src/ui/hudShopButton.js`) гейтится на `Game.YandexPayments.isReady()`,
  а готовность на реальном Яндекс-хосте зависит только от инлайн-загрузчика Yandex SDK
  в `index.html`. Generic-бандл (`ci/build_release.mjs`, используется
  `scripts/build-web-bundle.mjs` для `dist/native/web`) подставляет `__YANDEX_SDK_URL__` →
  пустую строку `''`, после чего старое условие `sdkUrl.charAt(0) === '_'` не срабатывало
  и реконструкция URL пропускалась → SDK не грузился → кнопка скрыта.
  **Фикс:** guard `if (!sdkUrl || sdkUrl.charAt(0) === '_')` в `index.html` (строка 51) и в
  пересобранном `dist/native/web/index.html`. До этого места выполнение доходит только
  после `if (!inYandex) return;`, поэтому VK/standalone поведение не меняется. После фикса
  бандл пересобран через `scripts/build-web-bundle.mjs`.
- **D3 — чёрный экран desktop `.exe` (НАСТОЯЩИЙ root cause, batch#6).** Предыдущие
  итерации (batch#4 MIME-карта, batch#5 «RENDERS_OK») **не устранили** дефект: пользователь
  при реальном запуске `.exe` по-прежнему видел чёрный экран. Верификация batch#5 была
  **false-positive** — она грузила вложенный бандл тем же offscreen Electron-рантаймом
  через суррогатный harness, а не запускала реальный упакованный `.exe`.
  **Реальная причина (воспроизведена запуском `.exe` с `--enable-logging --v=1` + CDP):**
  `WEB_ROOT` в `packaging/electron/main.js` вычислялся как фиксированный
  `path.resolve(__dirname, '..', '..', 'dist', 'native', 'web')` — подъём на **два**
  уровня. Относительная глубина бандла от `main.js` различается в dev и в упаковке:
  в dev `__dirname = packaging/electron`, и `../../dist/native/web` → `<repo>/dist/native/web` (верно);
  в упакованном portable `__dirname = resources/app/electron`, и `../..` уходит в
  `resources` мимо сегмента `app/`, давая `resources/dist/native/web` — несуществующий
  путь. Лог реального процесса: `FileURLLoader::Start: .../resources/dist/native/web/index.html`
  → `net::ERR_FILE_NOT_FOUND` → `Failed to load URL: app://tmzd/index.html with error: ERR_UNEXPECTED`
  → страница падала в `chrome-error://chromewebdata/` (0 скриптов, 0 canvas) = чёрный экран.
  MIME-фикс batch#4 был нерелевантен, потому что `index.html` вообще не находился.
  **Фикс:** `resolveWebRoot()` пробует packaged-путь (`<app>/dist/native/web`, один
  уровень вверх) и dev-путь (два уровня вверх) и выбирает тот, где реально есть
  `index.html` (`fs.existsSync`). Добавлены `did-fail-load` / `render-process-gone`
  логгеры в `createWindow`, чтобы будущие сбои загрузки были видимыми, а не молчаливым
  чёрным экраном. Исправлен вводящий в заблуждение комментарий в
  `packaging/scripts/assemble-portable-win.mjs`.
  **Рантайм-проверка реального `.exe` (2026-05-30, batch#6).** Пересобран штатным
  `node packaging/scripts/assemble-portable-win.mjs`, затем запущен **именно**
  `dist/native/desktop/win-portable/Tank Merge Zombie Defense.exe` с
  `--remote-debugging-port=9222 --enable-logging --v=1`; подключение по CDP к живому
  процессу. Результат: `location = app://tmzd/index.html` (не `chrome-error`),
  `canvas_count=3`, `canvas_painted=true`, `window.Game` присутствует с 40+ подсистемами,
  выполнилось 184 скрипта, заголовок «Merge Tank: Zombie invasion», `failed_requests=[]`,
  `render-process-gone=false`. Остались только безвредные warning'и (SfxRegistry
  validate-on-boot, font preload hints) — рендер не блокируют. Это измерение явно
  отличается от прежнего суррогатного: запускался реальный переименованный `.exe`, а не
  offscreen-окно поверх вложенного бандла.
  Остаточный риск: интерактивный скриншот окна не снимался (headless CDP-замер), но
  DOM/canvas/`Game` и origin `app://tmzd/index.html` подтверждены на живом процессе.
  Также `.wasm` в `MIME_TYPES` отсутствует, но в `dist/native/web` нет ни одного
  `.wasm`-ассета (проверено).
- **D2 — `yandex.ru/games/_crpd/*` octet-stream + `/games/app/size24|size36` 404
  (классификация: платформенный шум Яндекса, не наш дефект).** Это собственный preloader
  Яндекса и иконки консоли Яндекса; в нашем бандле нет ни этих ссылок, ни скриптов
  (проверено). Исправлять на нашей стороне нечего.

## Как воспроизвести

```powershell
# Web
node packaging/scripts/build-web-bundle.mjs

# Windows portable (неподписанный, без внешних зависимостей)
node packaging/scripts/assemble-portable-win.mjs

# Android каркас (без gradle-сборки)
node packaging/scripts/build-android.mjs --skip-tests --no-build

# iOS подготовка (без macOS-сборки)
node packaging/scripts/build-ios.mjs --skip-tests --prepare-only

# Регрессия
node Test/tests.js
```

## Итог

- **Готово к использованию сейчас:** Web-бандл и portable Windows desktop-сборка.
- **Готово к сборке после установки локального toolchain:** Android (нужны JDK 17 + Android SDK).
- **Готово к сборке только во внешней среде:** iOS (нужен macOS/Codemagic + Apple Developer), подписанный Windows NSIS-установщик (нужны Developer Mode/админ + сертификат), Steam-депот (нужен Partner-аккаунт + steamcmd).

Все блокеры из последней категории — это физические внешние требования (аккаунты, секреты, macOS, привилегии ОС), а не дефекты кода проекта.
