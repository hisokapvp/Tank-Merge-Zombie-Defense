# Упаковка и публикация Tank Merge Zombie Defense

> Подробное руководство по сборке и выпуску игры на всех платформах: Web/Яндекс,
> Steam (десктоп), Google Play (Android) и App Store (iOS). Написано для человека,
> который раньше не публиковал игры — с объяснением «что, зачем и сколько стоит».
>
> 📋 **Фактический результат первого прогона сборок** (что реально собрано, что
> заблокировано и как разблокировать) — см. [BUILD_REPORT.md](BUILD_REPORT.md).

---

## 1. Как всё устроено (общая картина)

Игра — это обычный браузерный HTML5-проект на Canvas 2D + Phaser 3. **В самой игре
нет сборки**: `index.html` подключает скрипты напрямую, `game.js` их запускает.
Никакого npm, webpack или bundler в рантайме игры нет и быть не должно.

Чтобы выпустить игру в магазины, её нужно «завернуть» в нативную оболочку
(Electron для десктопа, Capacitor для телефонов). Весь инструментарий для этого
лежит **только** в каталоге `packaging/` — это единственное место, где разрешён
`npm` и `package.json`.

Важно: каталог `packaging/` **никогда не попадает в веб-сборку**. Скрипт
`ci/build_release.mjs` пропускает в бандл только `src/`, `assets/`, `vendor/` и
несколько корневых файлов. Поэтому добавление npm-зависимостей в `packaging/`
никак не влияет на веб- и Яндекс-версию.

```
Исходники игры (без сборки)
        │
        ▼
ci/build_release.mjs ──► dist/native/web/   (чистый веб-бандл)
        │                      │
        │                      ├──► Electron ──► Steam (десктоп)
        │                      ├──► Capacitor ──► Google Play (Android)
        │                      └──► Capacitor ──► App Store (iOS)
        ▼
ops/package/release.mjs  ◄── единая команда выпуска для всех целей
```

Платформенный слой `src/platform/platform.js` (`Game.Platform`) определяет, где
запущена игра (`yandex | electron | android | ios | web`), и подключает нужный
бэкенд для платежей, облачных сохранений и жизненного цикла. На вебе это
Яндекс-SDK, в нативных сборках — объект `window.__TMZD_NATIVE_BRIDGE__`,
который внедряет оболочка (`preload.js` для Electron, `native-bridge.js` для
Capacitor).

### Что делает каждая подкоманда и где появляется результат

Единая команда — `node ops/package/release.mjs <цель>`. Запускать её нужно из
**корня репозитория** (`D:\Tank-Merge-Zombie-Defense`). Каждая подкоманда сначала
поднимает версию (`?v=` токен в `index.html`), прогоняет тесты (если не указан
`--skip-tests`), собирает чистый веб-бандл, а затем — артефакт платформы:

| Подкоманда | Что собирает | ТОЧНЫЙ путь результата |
|---|---|---|
| `web` | веб-бандл (обычный) | папка `dist/release/web/` + zip рядом `dist/release/web.zip` |
| `web --yandex` | веб-бандл с Яндекс-SDK | папка `dist/release/web-yandex/` + zip |
| `steam` | десктоп Windows (portable, без подписи) | файл `dist/native/desktop/win-portable/Tank Merge Zombie Defense.exe` |
| `android` | мобильный бандл Google Play | файл `.aab` в `dist/native/android/` |
| `ios` | подготовка проекта iOS, сборка в облаке | `.ipa` создаётся на облачном Mac (Codemagic), **не** в `dist/` |
| `all` | всё по очереди | все пути выше |

> Если команда отработала, но «билд не появился» — смотрите **последнюю строку
> вывода**: команда всегда печатает либо точный путь артефакта (`ARTIFACT ...`),
> либо причину блокировки (`BLOCKED ...`) с инструкцией, как разблокировать.
> Молчаливого «ничего не произошло» больше нет.

---

## 2. Сколько это стоит (аккаунты разработчика)

| Платформа | Аккаунт | Стоимость |
|---|---|---|
| Steam | Steamworks, плата за каждое приложение | **$100** за приложение (возвращается после $1000 выручки) |
| Google Play | Google Play Console | **$25** один раз, навсегда |
| App Store | Apple Developer Program | **$99 в год** |
| Яндекс Игры | бесплатно | $0 |

RevenueCat (объединяет покупки Google Play и App Store) имеет бесплатный тариф
до определённого оборота — на старте платить не нужно.

Codemagic (облачная сборка для iOS, т.к. локального Mac нет) имеет бесплатные
минуты сборки в месяц; их обычно хватает для редких релизов.

---

## 3. Что нужно установить (prerequisites)

Общее для всех платформ:
- **Node.js 20+** — для сборочных скриптов.
- **bash** — тесты гоняются через `bash ci/run_tests.sh` (на Windows подойдёт Git Bash).

По платформам:

| Платформа | Дополнительно |
|---|---|
| Web/Яндекс | ничего, только Node |
| Steam | `cd packaging && npm install` (electron, electron-builder, steamworks.js); `steamcmd` для загрузки. Подробности и точный путь `.exe` — §5.2 |
| Android | `cd packaging && npm install`; **JDK 17** + **Android SDK** (Studio или cmdline-tools) + `ANDROID_HOME` + принятые лицензии + keystore. Полная пошаговая установка — §5.3 |
| iOS | `@capacitor/*`; **macOS обязателен** для `.ipa` (Xcode + CocoaPods) — либо облачный Mac через Codemagic без своего Mac. Полностью — §5.4 |

---

## 4. Секреты и переменные окружения

Эти значения **никогда не коммитятся в репозиторий**. Задавайте их в переменных
окружения локально или в секретах CI.

### Android
| Переменная | Назначение |
|---|---|
| `TMZD_ANDROID_KEYSTORE` | путь к `.jks`/`.keystore` файлу подписи |
| `TMZD_ANDROID_KEYSTORE_PASSWORD` | пароль хранилища |
| `TMZD_ANDROID_KEY_ALIAS` | алиас ключа |
| `TMZD_ANDROID_KEY_PASSWORD` | пароль ключа |
| `TMZD_REVENUECAT_ANDROID_KEY` | публичный SDK-ключ RevenueCat (Google Play) |

### iOS
| Переменная | Назначение |
|---|---|
| `TMZD_REVENUECAT_IOS_KEY` | публичный SDK-ключ RevenueCat (App Store) |
| `TMZD_CODEMAGIC_TOKEN` | API-токен Codemagic (чтобы запускать сборку из консоли) |
| `TMZD_CODEMAGIC_APP_ID` | id приложения в Codemagic |
| `APP_STORE_CONNECT_KEY_ID` / `APP_STORE_CONNECT_ISSUER_ID` / `APP_STORE_CONNECT_PRIVATE_KEY` | ключ App Store Connect для подписи и загрузки (в секретах Codemagic) |

### Steam
| Переменная | Назначение |
|---|---|
| `TMZD_STEAM_USER` | аккаунт билд-машины Steam (пароль/2FA вводится интерактивно) |
| `TMZD_STEAM_APPID` | App ID игры в Steam |

> Никогда не выводите эти значения в логи и не передавайте их через чат-инструменты.
> Пароли вводите прямо в терминале.

---

## 5. Первый запуск по платформам

### 5.1 Web / Яндекс
```bash
node ops/package/release.mjs web            # обычный веб-бандл
node ops/package/release.mjs web --yandex   # вариант с Яндекс-SDK
```
**Где результат:** папка `dist/release/web/` (для `--yandex` — `dist/release/web-yandex/`)
и zip-архив рядом. В конце команда печатает строки `web ARTIFACT (folder): ...`
и `web ARTIFACT (zip): ...` — это и есть точные пути.

**Как проверить:** загрузите zip в кабинет Яндекс Игр (Web/Яндекс) или раздайте
папку обычным веб-сервером. Не открывайте `index.html` двойным кликом из папки —
`file://` ломает загрузку ассетов (нужен http:// или нативная оболочка).

### 5.2 Steam (десктоп Windows)

**Команда (из корня репозитория):**
```bash
node ops/package/release.mjs steam
```

**Что реально происходит по шагам:**
1. собирается чистый веб-бандл;
2. собирается **portable-версия для Windows** — готовый к запуску `.exe` без
   установщика и без подписи (обходит ограничение electron-builder, см. ниже);
3. делается **попытка** собрать подписанный установщик (NSIS) — но на обычном
   Windows-аккаунте она обычно блокируется (это нормально и **не мешает** выпуску).

**ТОЧНЫЙ путь готового билда:**
```
dist\native\desktop\win-portable\Tank Merge Zombie Defense.exe
```
Это самодостаточная portable-сборка (~180 МБ, ~600 файлов рядом в той же папке).
Чтобы запустить игру — просто двойной клик по этому `.exe`. В конце работы команда
печатает строку `steam ARTIFACT (portable, unsigned, runnable): <путь>`.

**Почему подписанный установщик блокируется (и это ок).** electron-builder при
сборке NSIS-установщика распаковывает пакет `winCodeSign`, внутри которого есть
символические ссылки для macOS (`.dylib`). Создание симлинков в Windows требует
привилегии **SeCreateSymbolicLinkPrivilege**, которой нет у обычного аккаунта.
Поэтому шаг падает, и команда печатает понятное сообщение `BLOCKED` с причиной и
инструкцией. **portable `.exe` при этом уже собран и полностью рабочий.**

**Как разблокировать подписанный установщик (по желанию):**
- включите **Режим разработчика**: Параметры → Конфиденциальность и защита →
  Для разработчиков → Режим разработчика → Вкл; **или**
- запустите терминал «От имени администратора»;
- затем повторите `node ops/package/release.mjs steam`.

**Важно про прошлую жалобу.** Раньше подкоманда `steam` вызывала только
electron-builder, и на обычном аккаунте она падала на полпути: версия
поднималась, веб-бандл собирался, а десктоп-артефакт **не появлялся** и пути не
было видно — отсюда ощущение «что-то делалось, но билда нет». Теперь команда
сначала собирает рабочий portable `.exe`, попытку подписи делает best-effort
(не фатально) и **всегда** печатает точный путь артефакта.

**Как выложить в Steam:**
1. Зарегистрируйте приложение в Steamworks (Partner), получите **App ID** ($100 за приложение).
2. Пропишите реальные `AppID` / Depot / `ContentRoot` в `packaging/steam/app_build.vdf`
   (ContentRoot должен указывать на папку `win-portable`).
3. Установите консольный `steamcmd` (см. таблицу ресурсов в §11).
4. Задайте `TMZD_STEAM_USER` (пароль/2FA вводятся интерактивно, не логируются) и загрузите:
   ```bash
   node ops/package/release.mjs steam --upload
   ```
   Команда вызовет `steamcmd +login <user> +run_app_build app_build.vdf +quit`.
   Альтернатива — загрузить депот вручную через Steamworks Partner UI.


### 5.3 Android (Google Play) — подробно, с нуля

Здесь нужно поставить инструменты Android **один раз**. Дальше сборка — одна команда.

#### Шаг 1. Установить JDK 17 (Java)
Capacitor/Gradle для актуального Android требуют именно **JDK 17** (не 8, не 21).
- Скачайте **Eclipse Temurin JDK 17 (LTS)** с [adoptium.net](https://adoptium.net/temurin/releases/?version=17)
  (Windows x64, установщик `.msi`). При установке отметьте «Set JAVA_HOME».
- Проверка в терминале:
  ```powershell
  java -version        # должно показать "17.x"
  echo $env:JAVA_HOME  # путь вида C:\Program Files\Eclipse Adoptium\jdk-17...
  ```
- Если `JAVA_HOME` не задан — задайте вручную (Параметры → Система → О системе →
  Дополнительные параметры → Переменные среды → создать `JAVA_HOME` = папка JDK).

#### Шаг 2. Установить Android SDK
Два варианта — выберите один:

**Вариант A (проще): Android Studio.**
- Скачайте [Android Studio](https://developer.android.com/studio), установите.
- При первом запуске мастер сам поставит SDK, platform-tools и эмулятор.
- SDK по умолчанию ставится в `C:\Users\<вы>\AppData\Local\Android\Sdk`.

**Вариант B (без IDE): только command-line tools.**
- Скачайте «Command line tools only» со страницы [Android Studio](https://developer.android.com/studio#command-line-tools-only).
- Распакуйте в `C:\Android\cmdline-tools\latest\` (важно: подпапка должна
  называться именно `latest`).

#### Шаг 3. Задать переменные окружения SDK
Создайте переменные среды (Параметры → Переменные среды) и добавьте пути в `Path`:
```
ANDROID_HOME      = C:\Users\<вы>\AppData\Local\Android\Sdk   (или C:\Android)
ANDROID_SDK_ROOT  = тот же путь, что ANDROID_HOME
```
Добавьте в `Path`:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\cmdline-tools\latest\bin
```
Перезапустите терминал, чтобы переменные подхватились.

#### Шаг 4. Поставить нужные компоненты SDK и принять лицензии
```powershell
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
sdkmanager --licenses      # нажимайте y на каждый запрос — без этого Gradle не соберёт
```
(`android-34` / `build-tools;34.0.0` — целевые версии; если Gradle попросит
другую — поставьте ту, что он назовёт.)

#### Шаг 5. Подготовить подпись (keystore)
Google Play принимает только подписанные релизные бандлы. Создайте keystore **один
раз** и храните его в надёжном месте (потеря = невозможность обновлять игру):
```powershell
keytool -genkey -v -keystore tmzd.keystore -alias tmzd -keyalg RSA -keysize 2048 -validity 10000
```
Затем задайте переменные окружения подписи (см. §4):
`TMZD_ANDROID_KEYSTORE`, `TMZD_ANDROID_KEYSTORE_PASSWORD`, `TMZD_ANDROID_KEY_ALIAS`,
`TMZD_ANDROID_KEY_PASSWORD`, и `TMZD_REVENUECAT_ANDROID_KEY` для покупок.

#### Шаг 6. Установить npm-зависимости упаковщика
```powershell
cd packaging
npm install
cd ..
```

#### Шаг 7. Собрать
```powershell
node ops/package/release.mjs android
```
**Где результат:** файл `.aab` в `dist/native/android/`. Команда печатает его путь.
Загрузите этот `.aab` в Google Play Console.

Дополнительно:
- `node ops/package/release.mjs android --debug` — собрать **отладочный** APK без
  подписи (для теста на телефоне; путь печатается в выводе).
- `node packaging/scripts/build-android.mjs --no-build` — только подготовить
  Gradle-проект и открыть его в Android Studio вручную.

#### Частые ошибки Android и их решения
| Ошибка | Решение |
|---|---|
| `JAVA_HOME is not set` / неверная версия Java | поставьте JDK 17, задайте `JAVA_HOME` (Шаг 1) |
| `SDK location not found` / `ANDROID_HOME` пуст | задайте `ANDROID_HOME`/`ANDROID_SDK_ROOT` (Шаг 3) |
| `You have not accepted the license agreements` | выполните `sdkmanager --licenses` и согласитесь (Шаг 4) |
| `Failed to find Build Tools revision X` | `sdkmanager "build-tools;X"` именно той версии, что просит Gradle |
| Gradle падает на подписи | не заданы `TMZD_ANDROID_KEYSTORE*`; для теста используйте `--debug` |
| `sdkmanager` не найден | проверьте, что путь к `cmdline-tools\latest\bin` в `Path` |

### 5.4 iOS (App Store) — подробно

У iOS жёсткое требование: **финальная сборка, подпись и архив (`.ipa`) делаются
только на macOS**, потому что инструменты `xcodebuild` и `CocoaPods` существуют
только под macOS — на Windows их запустить нельзя. Есть два пути.

#### Путь A. Если у вас есть Mac
1. Заплатите **$99/год** в [Apple Developer Program](https://developer.apple.com/programs/).
2. Поставьте **Xcode** из Mac App Store, затем инструменты командной строки:
   ```bash
   xcode-select --install
   ```
3. Поставьте **CocoaPods** (менеджер нативных зависимостей iOS):
   ```bash
   sudo gem install cocoapods     # или: brew install cocoapods
   ```
4. Подготовьте проект (можно на любой ОС, но дальше нужен Mac):
   ```bash
   node ops/package/release.mjs ios --prepare-only
   ```
5. На Mac установите Pods и откройте проект:
   ```bash
   cd packaging/capacitor/ios/App
   pod install
   open App.xcworkspace          # ВАЖНО: .xcworkspace, не .xcodeproj
   ```
6. В Xcode: выберите команду подписи (Signing & Capabilities → ваш Team из Apple
   Developer), задайте Bundle ID (`com.tmzd.game`), настройте provisioning profile.
7. Соберите архив:
   - в Xcode: Product → Archive → Distribute App → App Store Connect; **или**
   - в терминале:
     ```bash
     xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
       -archivePath build/App.xcarchive archive
     xcodebuild -exportArchive -archivePath build/App.xcarchive \
       -exportPath build/ipa -exportOptionsPlist exportOptions.plist
     ```
   На выходе — `.ipa` в `build/ipa/`. Загрузите его в App Store Connect (Transporter
   или `xcrun altool`).

#### Путь B. Если Mac нет — облачная сборка Codemagic (рекомендуется)
Проект уже настроен под Codemagic — файл `packaging/capacitor/codemagic.yaml`.
Облачный Mac сам сделает `pod install`, архив, подпись и заливку в TestFlight.
1. Заплатите **$99/год** в Apple Developer Program, заведите App в
   [App Store Connect](https://appstoreconnect.apple.com/).
2. Зарегистрируйтесь в [Codemagic](https://codemagic.io/), подключите ваш git-репозиторий.
3. В Codemagic создайте группу секретов `tmzd_ios` и добавьте туда ключ
   **App Store Connect API** (`APP_STORE_CONNECT_KEY_ID`, `_ISSUER_ID`,
   `_PRIVATE_KEY`) и `TMZD_REVENUECAT_IOS_KEY` (см. `codemagic.yaml`).
4. Подготовьте проект локально (любая ОС):
   ```bash
   node ops/package/release.mjs ios --prepare-only
   ```
5. Запустите облачную сборку одним из способов:
   - push git-тега вида `ios-v1.0.0` (Codemagic ловит теги), **или**
   - кнопкой в дашборде Codemagic (workflow `ios-appstore`), **или**
   - `node ops/package/release.mjs ios` с заданными `TMZD_CODEMAGIC_TOKEN` и
     `TMZD_CODEMAGIC_APP_ID`.
6. Сборка зальёт билд в **TestFlight**. Когда будете готовы к публикации в
   App Store — выставьте `submit_to_app_store: true` в `codemagic.yaml`.

> Почему `.ipa` нет в `dist/`: его собирает облачный (или ваш) Mac, а не локальный
> Windows. Подкоманда `ios` это явно печатает в выводе, чтобы не было ощущения
> «ничего не собралось».


---

## 6. Выпуск одной командой

`ops/package/release.mjs` поднимает версию (cache-bust токен в `index.html`),
прогоняет тесты, собирает веб-бандл и артефакт нужной платформы:

```bash
node ops/package/release.mjs web      --yandex
node ops/package/release.mjs steam    --upload
node ops/package/release.mjs android  --debug
node ops/package/release.mjs ios      --prepare-only
node ops/package/release.mjs all                       # все платформы по очереди
node ops/package/release.mjs web --bump 20260601-rc1   # явный токен версии
```

Флаги:
- `--bump <token>` — переписать токен `?v=...` во всех ссылках `index.html`.
  Без него ставится дата-штамп `ГГГГММДД-release-ЧЧММСС`.
- `--skip-tests` — пропустить тесты (не рекомендуется для реального релиза).
- `--yandex` (web) — собрать вариант с Яндекс-SDK.
- `--upload` (steam) — выгрузить депот через `steamcmd`.
- `--debug` / `--no-build` (android) — отладочный AAB / только подготовка проекта.
- `--prepare-only` (ios) — только подготовка, без запуска облачной сборки.

---

## 7. Монетизация (внутриигровые покупки)

Каталог покупок описан в `assets/shop.json` (бандлы `small_chip_pack`,
`medium_chip_pack`, `large_chip_pack`). Сопоставление с продуктами магазинов —
в `packaging/capacitor/revenuecat-products.json`.

| Платформа | Что доступно | Как реализовано |
|---|---|---|
| Google Play | **полные расходуемые IAP** | RevenueCat (`@revenuecat/purchases-capacitor`) |
| App Store | **полные расходуемые IAP** | RevenueCat (тот же код, тот же мост) |
| Steam | **только premium/DLC-владение** на старте | `bridge.payments.ownsDlc` |
| Яндекс | как настроено в Яндекс-SDK | существующий веб-сим |

**Почему Steam отличается.** Расходуемые микротранзакции в Steam
(`ISteamMicroTxn`) требуют доверенного серверного бэкенда. Поэтому на старте в
Steam-версии включается только владение premium/DLC, а полноценная продажа
наборов фишек на десктопе откладывается до появления бэкенда. На мобильных
платформах RevenueCat снимает эту проблему и даёт полные расходуемые покупки
сразу.

Чтобы добавить новый товар: добавьте бандл в `assets/shop.json`, затем продукт в
`revenuecat-products.json` (поля `shopBundleId` → `revenueCatProductId`), и
создайте такой же product id в Google Play Console и App Store Connect.

---

## 8. Производительность ≠ упаковка (важно)

> Если на «тяжёлых» апгрейдах (много объектов, массовая гибель зомби) игра
> начинает лагать — **оболочка это не чинит**. Electron и Capacitor лишь
> запускают тот же самый игровой код в WebView/Chromium. Лаги — это
> **алгоритмическая проблема горячего пути** (`loop`, `draw`, `step*`), а не
> вопрос упаковки.

Это отдельная задача оптимизации, и она не входит в данную упаковочную работу.
Что с этим делать (отдельным треком):
- профилировать `loop` / `draw` / `step*` и искать выделения памяти в горячем пути
  (по инвариантам проекта hot-path должен избегать heap allocations);
- проверять, что `draw()` только рисует и не мутирует состояние;
- смотреть baseline-замеры в `artifacts/perf-baseline-*.md`.

Никакая нативная сборка не ускорит неоптимальный игровой цикл — нужна именно
оптимизация кода игры.

---

## 9. Типичные проблемы (troubleshooting)

| Симптом | Причина и решение |
|---|---|
| Ассеты не грузятся под `file://`, ошибки CORS | Нативные оболочки отдают бандл через протокол `app://`, а не `file://`. Не открывайте `dist/native/web/index.html` напрямую двойным кликом — используйте оболочку. |
| Чёрный экран / нет GPU в Electron | Проверьте `getRenderConfig()` (`powerPreference`), драйверы GPU; на некоторых VM нужен софт-рендер. |
| Gradle падает на подписи AAB | Не заданы `TMZD_ANDROID_KEYSTORE*`. Для теста используйте `--debug` (без подписи). |
| iOS: ошибка provisioning/подписи | Проверьте интеграцию App Store Connect API key в Codemagic и `BUNDLE_ID` в `codemagic.yaml`. |
| RevenueCat покупки не работают | Не задан `TMZD_REVENUECAT_*_KEY` — мост деградирует в no-op (игра не падает, но IAP недоступны). Проверьте product id в `revenuecat-products.json`. |
| `npm` ругается в корне репозитория | npm разрешён **только** в `packaging/`. Запускайте `npm` из `packaging/`. |
| После обновления ассетов старая версия в кэше | Поднимите версию: `node ops/package/release.mjs web --bump <новый-токен>`. |
| `steam`: «команда что-то делала, но билд не появился» | Раньше подкоманда падала на electron-builder без понятного пути. Исправлено: теперь `steam` собирает portable `.exe` в `dist\native\desktop\win-portable\`, печатает его точный путь и `BLOCKED`-подсказку про подпись. Если видите `"C:\Program" is not recognized` — обновите репозиторий: фикс quoting в `ops/package/release.mjs` (`run()`). |
| Web/Яндекс: пропала кнопка магазина (`#hudShopButton`) | Generic-бандл подставляет пустой `__YANDEX_SDK_URL__` → SDK не грузился. Исправлено guard'ом `if (!sdkUrl \|\| sdkUrl.charAt(0) === '_')` в `index.html`; пересоберите бандл `node packaging/scripts/build-web-bundle.mjs`. Подробности — [BUILD_REPORT.md](BUILD_REPORT.md) (D1). |
| Desktop `.exe`: чёрный экран, скрипты не исполняются | `app://` отдавал `.js` как `application/octet-stream`. Исправлено картой `MIME_TYPES` и переопределением `Content-Type` в `packaging/electron/main.js`. Подробности — [BUILD_REPORT.md](BUILD_REPORT.md) (D3). |
| Yandex: `_crpd` octet-stream / `size24\|size36` 404 в консоли | Платформенный шум Яндекса (его preloader и иконки консоли), не наш дефект — в бандле этих ссылок нет. См. [BUILD_REPORT.md](BUILD_REPORT.md) (D2). |

---

## 10. Карта файлов упаковки

| Файл | Назначение |
|---|---|
| `packaging/package.json` | npm-скрипты и зависимости (electron, capacitor, revenuecat) |
| `packaging/scripts/build-web-bundle.mjs` | чистый веб-бандл (npm-free) |
| `packaging/scripts/build-android.mjs` | сборка подписанного Android AAB |
| `packaging/scripts/build-ios.mjs` | подготовка iOS + запуск облачной сборки |
| `packaging/capacitor/capacitor.config.ts` | конфиг Capacitor (appId, webDir) |
| `packaging/capacitor/revenuecat-products.json` | карта товаров магазин → RevenueCat |
| `packaging/capacitor/native-bridge.js` | мобильный `window.__TMZD_NATIVE_BRIDGE__` |
| `packaging/capacitor/codemagic.yaml` | облачная macOS-сборка для iOS |
| `packaging/electron/` | десктопная оболочка и Steam |
| `ops/package/release.mjs` | единая команда выпуска для всех платформ |
| `src/platform/platform.js` | платформенный слой `Game.Platform` |

Краткая техническая версия — в [`packaging/README.md`](../packaging/README.md).

---

## 11. Внешние ресурсы по платформам

Прямые ссылки на всё, что нужно скачать или зарегистрировать, по платформам:

| Платформа | Что | Ссылка / где взять |
|---|---|---|
| Все | Node.js 20+ | https://nodejs.org/ |
| Steam | аккаунт издателя ($100/приложение) | https://partner.steamgames.com/ |
| Steam | консоль загрузки депотов `steamcmd` | https://developer.valvesoftware.com/wiki/SteamCMD |
| Steam | обойти блок подписи (NSIS) | включить Режим разработчика Windows или запустить терминал «От администратора» (см. §5.2) |
| Android | JDK 17 (Temurin) | https://adoptium.net/temurin/releases/?version=17 |
| Android | Android Studio + SDK | https://developer.android.com/studio |
| Android | только command-line tools | https://developer.android.com/studio#command-line-tools-only |
| Android | Google Play Console ($25 разово) | https://play.google.com/console |
| iOS | Apple Developer Program ($99/год) | https://developer.apple.com/programs/ |
| iOS | Xcode (только macOS) | Mac App Store |
| iOS | CocoaPods | https://cocoapods.org/ (`sudo gem install cocoapods`) |
| iOS | App Store Connect | https://appstoreconnect.apple.com/ |
| iOS | Codemagic (облачный Mac, без своего Mac) | https://codemagic.io/ |
| Android+iOS | RevenueCat (внутриигровые покупки) | https://www.revenuecat.com/ |
| Web | Яндекс Игры (консоль разработчика) | https://yandex.ru/dev/games/ |

Фактический результат первого реального прогона всех сборок (что собралось, что
заблокировано и почему) — [BUILD_REPORT.md](BUILD_REPORT.md).

