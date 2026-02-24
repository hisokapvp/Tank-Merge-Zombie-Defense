# REFERENCE — Библиотекарь (v1.1)

## Цель
Универсальная навигация по пунктам ТЗ **для любых игровых проектов**:
- указать файлы/папки **внутри repo/root** (репозиторий по url или локальная папка)
- дать устойчивые ориентиры: `anchor`
- дать поисковые подсказки: `hints` (ключевые слова/regex/строковые литералы)
- оценить уверенность: `conf` (0..1)
- экономить токены: `shared.targets` + ссылки по `ref`
- директивы типа `Use context7` сохраняются как подсказка, не обязательство

---

## Repo: url и/или localPath
- Для GitHub/remote: `repo.url`
- Для локальной разработки: `repo.localPath`
  - Windows пример (в JSON нужно экранировать `\`): `"D:\\Tank-Merge-Zombie-Defense"`
  - Unix пример: `"/home/user/Tank-Merge-Zombie-Defense"`

---

## Input schema
См. `references/schema-input.json`

## Output schema
См. `references/schema-output.json`

---

## Обязательные правила (без вопросов)
1) Никогда не задавать вопросы пользователю.
2) Всегда возвращать **best-guess** (даже при низкой уверенности).
3) Если в пункте указан файл → target с `why=DIRECT_FILE_MENTION`, `conf>=0.85`.
4) Иначе: best-guess 2–6 целей + сильные `hints` (ключевые слова, строковые литералы, вероятные сущности).
5) Повторы вынести в `shared.targets` и ссылаться по `{ "ref": "Sx" }`.
6) Для “удалить аккуратно” добавить `risk=["carefulRemoval","uiRegression"]` и `hints` на поиск всех хвостов (UI, handlers, configs, localization).
7) Поле `file` в targets — **путь относительно корня repo** (или паттерн типа `src/**`), а не абсолютный путь OS.

---

## Рекомендуемые shared.targets (паттерн, если нет явных файлов)
- `README.md` — обзор/структура/entrypoints (если есть)
- `src/**` или `Scripts/**` или `Assets/**` — основные модули (по структуре проекта)
- `assets/**` / `Textures/**` / `Art/**` — графика/атласы/иконки (если есть)
- `docs/**` — внутренние доки (если есть)

---

## Мини-пример ответа (валидный)
```json
{
  "skill": "Библиотекарь",
  "version": "1.1",
  "repo": { "localPath": "D:\\\\Tank-Merge-Zombie-Defense" },
  "tooling": {
    "directives": ["context7"],
    "recommended": ["file_tree", "text_search", "open_file", "context7"]
  },
  "shared": {
    "targets": [
      { "ref": "S1", "file": "src/**", "anchor": "game modules", "hints": ["zombie","wall","ui","modal"], "conf": 0.5, "why": "CROSS_CUTTING_CONCERN" }
    ]
  },
  "items": [
    {
      "id": "4",
      "summary": "Удалить кнопку Boost аккуратно",
      "targets": [
        { "file": "src/**", "anchor": "boost button", "hints": ["Boost","button","onClick","handler"], "conf": 0.4, "why": "STRING_LITERAL_SEARCH", "risk": ["carefulRemoval","uiRegression"] },
        { "ref": "S1" }
      ]
    }
  ]
}
```
