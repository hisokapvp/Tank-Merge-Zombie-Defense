# Tank Merge: Zombie Defense

Merge-механика с башенной защитой против зомби.

## Быстрый старт

1. Открыть `index.html` в браузере
2. Или запустить локальный сервер: `npx serve .` и открыть `http://localhost:3000`

## Документация для контрибьюторов

- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
- [docs/CODE_STYLE.md](docs/CODE_STYLE.md)

## Debug режим

Добавьте `?debug=1` к URL для включения debug-панели и дополнительных инструментов:
- `http://localhost:3000?debug=1`

### Debug-команды

| Клавиша | Действие |
|---------|----------|
| P | Toggle zombie animation preview |
| A / ← | Предыдущий тип зомби (в preview) |
| D / → | Следующий тип зомби (в preview) |
| V | Cycle variant: walk → death → deathCommon |

## Тестирование

### Unit-тесты

```bash
node Test/tests.js
```

### Pack 2 тесты

```bash
node Test/pack2/mergeAnimRegression.test.js
node Test/pack2/fireLogicRegression.test.js
node Test/pack2/telemetryExport.test.js
```

### Pack 3 тесты

```bash
node Test/pack3/zombieSpawnAliveOnly.test.js
```

Ожидаемый результат: все тесты ✓ (PASSED).

### Pack 4 тесты

```bash
node Test/pack4/calendar.test.js
node Test/pack4/perf_stress.test.js
```

### Pack 5 тесты

```bash
node Test/pack5/perf_regression.test.js
```

### Pack 6 тесты

```bash
node Test/pack6/zombieRoad_visuals_removed.test.js
```

### Локальный CI

```bash
bash ci/check_style.sh
bash ci/run_tests.sh
```

### Release checklist

```bash
bash ci/release_checklist.sh
```

### Pre-commit hook

```bash
git config core.hooksPath hooks
chmod +x hooks/pre-commit
```

### Regression Checklist (5 систем)

Перед каждым релизом проверить следующие системы вручную:

---

#### 1. Spawn & Death Animation System

- [ ] **Зомби спавнятся** — появляются с края экрана и движутся к центру
- [ ] **Walk-анимация** — зомби анимированы при движении (не статичные спрайты)
- [ ] **Death-анимация** — при убийстве зомби воспроизводится death-анимация
- [ ] **70/30 split** — примерно 70% используют personal death, 30% common (проверить в ?debug=1)
- [ ] **Fallback** — если нет анимации смерти, зомби fade/tilt и исчезает

---

#### 2. Tank Merge & Combat System

- [ ] **Покупка танка** — кнопка "Купить танк" добавляет танк в свободную ячейку
- [ ] **Drag & drop merge** — перетаскивание одного танка на другой того же уровня объединяет их
- [ ] **Level cap** — танки не merge выше 60 уровня
- [ ] **Стрельба** — танки на орбите стреляют по зомби
- [ ] **Damage numbers** — отображаются числа урона над зомби

---

#### 3. Economy & Progression

- [ ] **Монеты за kills** — получение монет при убийстве зомби
- [ ] **XP система** — XP-бар заполняется, уровень игрока растёт
- [ ] **Level-up modal** — при достижении нового уровня показывается окно с наградой
- [ ] **Talent points** — очки талантов начисляются при level-up
- [ ] **Cost scaling** — цена нового танка соответствует формуле 50 * 2^(L-1)

---

#### 4. Save/Load & Offline Progress

- [ ] **Auto-save** — прогресс сохраняется автоматически каждые ~7 секунд
- [ ] **Page reload** — после перезагрузки страницы прогресс восстанавливается
- [ ] **Offline modal** — при возврате после >5 минут показывается offline-modal
- [ ] **Награда за offline** — offline progress начисляется корректно
- [ ] **Visibility change** — при сворачивании вкладки данные сохраняются

---

#### 5. UI & Debug Tools

- [ ] **Settings modal** — открывается по кнопке ⚙, есть настройки звука
- [ ] **Language switch** — переключение RU/EN работает
- [ ] **Debug panel** — при ?debug=1 отображается debug-панель справа
- [ ] **Zombie anim preview** — клавиша P открывает превью анимаций зомби
- [ ] **Responsive** — UI адаптируется к размеру окна

---

## Файловая структура

```
├── index.html          # Entry point
├── game.js             # Основной игровой код
├── style.css           # Стили
├── docs/
│   ├── CONTRIBUTING.md
│   └── CODE_STYLE.md
├── assets/             # Спрайты, JSON-конфиги
│   ├── zombies.json    # Конфиг зомби-типов и анимаций
│   ├── tanks.json      # Конфиг танков
│   └── ...
├── ci/
│   ├── check_style.sh
│   ├── run_tests.sh
│   └── release_checklist.sh
├── src/
│   ├── accessibility/  # A11y helpers
│   ├── mechanics/      # Игровая логика
│   │   ├── combat.js   # Дальность стрельбы, pickDeathAnim
│   │   ├── economy.js  # Цены, монеты
│   │   └── ...
│   ├── i18n/            # Локализация RU/EN
│   ├── persistence/    # Сохранение/загрузка
│   ├── render/         # Canvas rendering
│   ├── telemetry/      # Pack 2: расширенная телеметрия
│   │   └── telemetry.js
│   ├── tools/
│   │   └── anki/       # Pack 2: Anki export
│   │       └── anki_export.js
│   ├── ui/             # UI-компоненты
│   │   ├── lessonProgress.js    # Pack 2: панель уроков
│   │   ├── zombieAnimPreview.js # Debug preview анимаций
│   │   └── ...
│   └── utils/          # Утилиты
│       └── telemetry.js # Базовая телеметрия (debug)
└── Test/
    ├── tests.js        # Unit-тесты (Pack 1)
    ├── pack1/          # Pack 1 тесты
    ├── pack2/          # Pack 2 тесты
    │   ├── mergeAnimRegression.test.js
    │   ├── fireLogicRegression.test.js
    │   └── telemetryExport.test.js
    ├── pack3/          # Pack 3 тесты
    │   └── zombieSpawnAliveOnly.test.js
    ├── pack4/          # Pack 4 тесты
    │   ├── calendar.test.js
    │   └── perf_stress.test.js
    └── pack5/          # Pack 5 тесты
        └── perf_regression.test.js
```

## API (для тестирования)

### Game.Combat.pickDeathAnim(common, personal, rand01)

Детерминированный выбор death-анимации:
- `common` — общая анимация (ZombieSprites.deathCommon)
- `personal` — персональная анимация (type.death)
- `rand01` — число [0, 1) для детерминизма

Возвращает: `personal` при rand < 0.7, иначе `common`. Если один из них null — возвращает доступный. Если оба null — возвращает null.

### Game.ZombieAnimPreview (debug-only)

- `.init()` — инициализация (вызывается автоматически)
- `.isActive()` — проверка активности превью
- `.togglePreview()` — toggle on/off
- `.nextType()` / `.prevType()` — навигация по типам
- `.cycleVariant()` — cycle walk/death/deathCommon

## Changelog

### v4.x (Pack 2 — Telemetry, Anki, Lesson Progress)
- **TelemetryLogger** (`src/telemetry/telemetry.js`) — расширенное логирование с lesson-тегами, flush, export (JSON/CSV), ротация (max 2000 записей)
- **Anki Exporter** (`src/tools/anki/anki_export.js`) — генерация CSV/JSON карточек для Anki из telemetry и lesson progress; кнопка `#export-anki`
- **LessonProgress** (`src/ui/lessonProgress.js`) — панель прогресса уроков: список, score, кнопки Repeat и Export Anki
- Интеграция TelemetryLogger в merge popup, fire logic, buy/merge/kill events
- Pack 2 тесты: `Test/pack2/mergeAnimRegression.test.js`, `fireLogicRegression.test.js`, `telemetryExport.test.js`

### v5.x (Pack 4 — CI, Profiler, Calendar)
- **Local CI scripts** (`ci/run_tests.sh`, `ci/check_style.sh`) — запуск тестов и базовая проверка стиля
- **Pre-commit hook** (`hooks/pre-commit`) — локальная проверка стиля и тестов
- **Profiler** (`src/perf/profiler.js`) — lightweight метрики исполнения (count/avg/min/max)
- **Lesson Calendar UI** (`src/ui/calendar/calendar.js`) — список ближайших повторений и экспорт расписания
- Pack 4 тесты: `Test/pack4/calendar.test.js`, `perf_stress.test.js`

### v6.x (Pack 5 — Docs, Perf, i18n, A11y)
- **Contributor docs** (`docs/CONTRIBUTING.md`, `docs/CODE_STYLE.md`)
- **Release checklist** (`ci/release_checklist.sh`)
- **i18n** (`src/i18n/*.json`, `src/i18n/index.js`) — RU/EN strings
- **A11y helpers** (`src/accessibility/a11y.js`) — focus trap and ESC handling
- **Projectile pooling** (game.js + `src/perf/objectPool.js`) — reduced allocations
- Pack 5 тесты: `Test/pack5/perf_regression.test.js`

### v3.x (QA/Tools)
- Добавлен `pickDeathAnim` для детерминированного выбора death-анимации
- Unit-тесты для pickDeathAnim (включая boundary cases)
- Debug-only ZombieAnimPreview (toggle P)
- Regression checklist в README
