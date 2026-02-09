/**
 * LessonProgress — панель прогресса уроков.
 *
 * Показывает список уроков, последний score, кнопки Repeat и Export Anki.
 * Интегрируется с Game.LessonManager (если есть) и Game.Storage.
 *
 * API:
 *   Game.LessonProgress.init()            — создать UI, загрузить данные
 *   Game.LessonProgress.show()            — показать панель
 *   Game.LessonProgress.hide()            — скрыть панель
 *   Game.LessonProgress.toggle()          — переключить видимость
 *   Game.LessonProgress.getLessons()      — получить массив уроков
 *   Game.LessonProgress.updateLesson(name, score) — обновить результат урока
 *   Game.LessonProgress.completeLesson(name, score) — пометить урок завершённым
 *   Game.LessonProgress.resetAll()        — сброс прогресса
 *   Game.LessonProgress.save()            — сохранить в localStorage
 *   Game.LessonProgress.load()            — загрузить из localStorage
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'lesson_progress';

  // Default lessons (расширяемые через setLessons)
  var DEFAULT_LESSONS = [
    { name: 'Basics: Merge Tanks',    completed: false, lastScore: null },
    { name: 'Combat: Fire Patterns',  completed: false, lastScore: null },
    { name: 'Economy: Coin Strategy', completed: false, lastScore: null },
    { name: 'Defense: Zombie Waves',  completed: false, lastScore: null },
    { name: 'Advanced: Multi-Barrel', completed: false, lastScore: null },
  ];

  var lessons = [];
  var panelEl = null;
  var listEl = null;
  var visible = false;

  /* ── Helpers ── */
  function safeParse(raw, fb) {
    try { return raw ? JSON.parse(raw) : fb; }
    catch (_) { return fb; }
  }

  function deepClone(arr) {
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      out.push({
        name: arr[i].name,
        completed: !!arr[i].completed,
        lastScore: arr[i].lastScore != null ? arr[i].lastScore : null,
      });
    }
    return out;
  }

  /* ── Persistence ── */
  function save() {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
      }
    } catch (_) {}
  }

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      var data = safeParse(raw, null);
      if (Array.isArray(data) && data.length > 0) {
        lessons = deepClone(data);
        return;
      }
    } catch (_) {}
    lessons = deepClone(DEFAULT_LESSONS);
  }

  /* ── Lesson manipulation ── */
  function findLesson(name) {
    for (var i = 0; i < lessons.length; i++) {
      if (lessons[i].name === name) return lessons[i];
    }
    return null;
  }

  function updateLesson(name, score) {
    var l = findLesson(name);
    if (!l) {
      l = { name: name, completed: false, lastScore: null };
      lessons.push(l);
    }
    l.lastScore = score;
    save();
    renderList();
    // Telemetry
    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('lessonUpdate', { lesson: name, score: score });
    }
  }

  function completeLesson(name, score) {
    var l = findLesson(name);
    if (!l) {
      l = { name: name, completed: false, lastScore: null };
      lessons.push(l);
    }
    l.completed = true;
    if (score !== undefined) l.lastScore = score;
    save();
    renderList();
    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('lessonComplete', { lesson: name, score: score });
    }
  }

  function repeatLesson(name) {
    // Notify LessonManager if present
    if (global.Game && global.Game.LessonManager && global.Game.LessonManager.start) {
      global.Game.LessonManager.start(name);
    }
    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('lessonRepeat', { lesson: name });
    }
  }

  function getLessons() {
    return deepClone(lessons);
  }

  function setLessons(arr) {
    if (Array.isArray(arr)) {
      lessons = deepClone(arr);
      save();
      renderList();
    }
  }

  function resetAll() {
    lessons = deepClone(DEFAULT_LESSONS);
    try {
      if (global.localStorage) global.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    renderList();
  }

  /* ── UI ── */
  function init() {
    load();
    panelEl = document.getElementById('lessonProgressPanel');
    if (!panelEl) return;
    listEl = panelEl.querySelector('.lessonProgress__list');

    // Toggle button
    var toggleBtn = document.getElementById('lessonProgressBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        toggle();
      });
    }

    // Close button
    var closeBtn = panelEl.querySelector('.lessonProgress__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        hide();
      });
    }

    renderList();
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';

    for (var i = 0; i < lessons.length; i++) {
      (function (lesson, idx) {
        var row = document.createElement('div');
        row.className = 'lessonProgress__item' + (lesson.completed ? ' lessonProgress__item_done' : '');

        var info = document.createElement('div');
        info.className = 'lessonProgress__info';

        var nameSpan = document.createElement('span');
        nameSpan.className = 'lessonProgress__name';
        nameSpan.textContent = (lesson.completed ? '✓ ' : '') + lesson.name;
        info.appendChild(nameSpan);

        var scoreSpan = document.createElement('span');
        scoreSpan.className = 'lessonProgress__score';
        scoreSpan.textContent = lesson.lastScore != null
          ? 'Score: ' + lesson.lastScore
          : '—';
        info.appendChild(scoreSpan);

        row.appendChild(info);

        var actions = document.createElement('div');
        actions.className = 'lessonProgress__actions';

        var repeatBtn = document.createElement('button');
        repeatBtn.type = 'button';
        repeatBtn.className = 'btn btnSecondary lessonProgress__repeatBtn';
        repeatBtn.textContent = 'Repeat';
        repeatBtn.addEventListener('click', function () {
          repeatLesson(lesson.name);
        });
        actions.appendChild(repeatBtn);

        var exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'btn btnSecondary lessonProgress__exportBtn';
        exportBtn.textContent = 'Anki';
        exportBtn.addEventListener('click', function () {
          if (global.Game && global.Game.AnkiExport) {
            global.Game.AnkiExport.download('csv', { tagFilter: 'lesson' });
          }
        });
        actions.appendChild(exportBtn);

        row.appendChild(actions);
        listEl.appendChild(row);
      })(lessons[i], i);
    }
  }

  function show() {
    if (panelEl) {
      panelEl.classList.remove('hidden');
      panelEl.setAttribute('aria-hidden', 'false');
    }
    visible = true;
  }

  function hide() {
    if (panelEl) {
      panelEl.classList.add('hidden');
      panelEl.setAttribute('aria-hidden', 'true');
    }
    visible = false;
  }

  function toggle() {
    visible ? hide() : show();
  }

  function isVisible() {
    return visible;
  }

  /* ── Export ── */
  global.Game = global.Game || {};
  global.Game.LessonProgress = {
    init: init,
    show: show,
    hide: hide,
    toggle: toggle,
    isVisible: isVisible,
    getLessons: getLessons,
    setLessons: setLessons,
    updateLesson: updateLesson,
    completeLesson: completeLesson,
    repeatLesson: repeatLesson,
    resetAll: resetAll,
    save: save,
    load: load,
    renderList: renderList,
    // testing
    _STORAGE_KEY: STORAGE_KEY,
    _DEFAULT_LESSONS: DEFAULT_LESSONS,
  };

})(typeof window !== 'undefined' ? window : this);
