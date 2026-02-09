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
    { id: 'basics_merge_tanks', name: 'Basics: Merge Tanks', completed: false, lastScore: null },
    { id: 'combat_fire_patterns', name: 'Combat: Fire Patterns', completed: false, lastScore: null },
    { id: 'economy_coin_strategy', name: 'Economy: Coin Strategy', completed: false, lastScore: null },
    { id: 'defense_zombie_waves', name: 'Defense: Zombie Waves', completed: false, lastScore: null },
    { id: 'advanced_multi_barrel', name: 'Advanced: Multi-Barrel', completed: false, lastScore: null },
  ];

  var lessons = [];
  var panelEl = null;
  var listEl = null;
  var visible = false;
  var nextReviewEl = null;
  var repeatNextBtn = null;
  var exportScheduleBtn = null;
  var importScheduleInput = null;
  var previewBtn = null;
  var previewEl = null;
  var statusEl = null;

  /* ── Helpers ── */
  function safeParse(raw, fb) {
    try { return raw ? JSON.parse(raw) : fb; }
    catch (_) { return fb; }
  }

  function deepClone(arr) {
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      out.push({
        id: arr[i].id || null,
        name: arr[i].name,
        completed: !!arr[i].completed,
        lastScore: arr[i].lastScore != null ? arr[i].lastScore : null,
      });
    }
    return out;
  }

  function getCatalogDefaults() {
    if (global.Game && global.Game.LessonCatalog && global.Game.LessonCatalog.listLessons) {
      var catalog = global.Game.LessonCatalog.listLessons();
      var out = [];
      for (var i = 0; i < catalog.length; i++) {
        out.push({ id: catalog[i].id, name: catalog[i].name, completed: false, lastScore: null });
      }
      return out;
    }
    return deepClone(DEFAULT_LESSONS);
  }

  function applyCatalogIds(arr) {
    if (!Array.isArray(arr)) return arr;
    if (!(global.Game && global.Game.LessonCatalog && global.Game.LessonCatalog.listLessons)) return arr;
    var catalog = global.Game.LessonCatalog.listLessons();
    var nameMap = {};
    for (var i = 0; i < catalog.length; i++) {
      nameMap[catalog[i].name] = catalog[i].id;
    }
    for (var j = 0; j < arr.length; j++) {
      if (!arr[j].id && nameMap[arr[j].name]) {
        arr[j].id = nameMap[arr[j].name];
      }
    }
    return arr;
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
        lessons = applyCatalogIds(deepClone(data));
        return;
      }
    } catch (_) {}
    lessons = getCatalogDefaults();
  }

  /* ── Lesson manipulation ── */
  function findLesson(nameOrId) {
    for (var i = 0; i < lessons.length; i++) {
      if (lessons[i].id === nameOrId || lessons[i].name === nameOrId) return lessons[i];
    }
    return null;
  }

  function getLessonDisplayName(id) {
    var lesson = findLesson(id);
    return lesson ? lesson.name : String(id);
  }

  function getScheduler() {
    return global.Game && global.Game.SRS ? global.Game.SRS : null;
  }

  function scoreToGrade(score) {
    if (!Number.isFinite(score)) return 3;
    if (score >= 90) return 5;
    if (score >= 75) return 4;
    if (score >= 60) return 3;
    if (score >= 40) return 2;
    if (score >= 20) return 1;
    return 0;
  }

  function formatRelativeMs(ms) {
    var totalSec = Math.max(0, Math.floor(ms / 1000));
    var hours = Math.floor(totalSec / 3600);
    var mins = Math.floor((totalSec % 3600) / 60);
    var days = Math.floor(hours / 24);
    if (days > 0) return days + 'd ' + (hours % 24) + 'h';
    if (hours > 0) return hours + 'h ' + mins + 'm';
    return mins + 'm';
  }

  function formatDueText(dueAt, now) {
    if (!Number.isFinite(dueAt)) return 'Next: not scheduled';
    if (dueAt <= now) return 'Next: due now';
    return 'Next: in ' + formatRelativeMs(dueAt - now);
  }

  function updateLesson(name, score) {
    var l = findLesson(name);
    if (!l) {
      l = { id: null, name: name, completed: false, lastScore: null };
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
      l = { id: null, name: name, completed: false, lastScore: null };
      lessons.push(l);
    }
    l.completed = true;
    if (score !== undefined) l.lastScore = score;
    save();
    var srs = getScheduler();
    if (srs && srs.recordReview) {
      srs.recordReview(l.id || l.name, scoreToGrade(score));
    }
    renderList();
    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('lessonComplete', { lesson: name, score: score });
    }
  }

  function repeatLesson(name) {
    var l = findLesson(name);
    var lessonName = l ? l.name : name;
    // Notify LessonManager if present
    if (global.Game && global.Game.LessonManager && global.Game.LessonManager.start) {
      global.Game.LessonManager.start(lessonName);
    }
    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('lessonRepeat', { lesson: lessonName });
    }
  }

  function getLessons() {
    return deepClone(lessons);
  }

  function setLessons(arr) {
    if (Array.isArray(arr)) {
      lessons = applyCatalogIds(deepClone(arr));
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
    nextReviewEl = document.getElementById('lessonNextReviewText');
    repeatNextBtn = document.getElementById('lessonRepeatNextBtn');
    exportScheduleBtn = document.getElementById('lessonExportScheduleBtn');
    importScheduleInput = document.getElementById('lessonImportScheduleInput');
    previewBtn = document.getElementById('lessonAnkiPreviewBtn');
    previewEl = document.getElementById('lessonAnkiPreview');
    statusEl = document.getElementById('lessonScheduleStatus');

    var srs = getScheduler();
    if (srs && srs.init) srs.init();

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

    if (repeatNextBtn) {
      repeatNextBtn.addEventListener('click', function () {
        repeatNextDue();
      });
    }

    if (exportScheduleBtn) {
      exportScheduleBtn.addEventListener('click', function () {
        exportSchedule();
      });
    }

    if (importScheduleInput) {
      importScheduleInput.addEventListener('change', function (e) {
        var file = e.target && e.target.files ? e.target.files[0] : null;
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          importSchedule(reader.result);
        };
        reader.readAsText(file);
        importScheduleInput.value = '';
      });
    }

    if (previewBtn) {
      previewBtn.addEventListener('click', function () {
        togglePreview();
      });
    }

    renderList();
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    var now = Date.now();
    var srs = getScheduler();

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

        var nextSpan = document.createElement('span');
        nextSpan.className = 'lessonProgress__nextReview';
        if (srs && srs.getItem) {
          var sched = srs.getItem(lesson.id || lesson.name);
          if (sched && Number.isFinite(sched.dueAt)) {
            nextSpan.textContent = formatDueText(sched.dueAt, now);
            if (sched.dueAt <= now) {
              nextSpan.className += ' lessonProgress__nextReview_due';
            }
          } else {
            nextSpan.textContent = 'Next: not scheduled';
          }
        } else {
          nextSpan.textContent = 'Next: —';
        }
        info.appendChild(nextSpan);

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
    refreshScheduleSummary();
  }

  function refreshScheduleSummary() {
    if (!nextReviewEl) return;
    var srs = getScheduler();
    if (!srs || !srs.getNextReview) {
      nextReviewEl.textContent = 'Next review: —';
      return;
    }
    var now = Date.now();
    var next = srs.getNextReview(now);
    if (!next) {
      nextReviewEl.textContent = 'Next review: none';
      return;
    }
    var name = getLessonDisplayName(next.id);
    var label = formatDueText(next.dueAt, now).replace('Next: ', '');
    nextReviewEl.textContent = 'Next review: ' + name + ' (' + label + ')';
  }

  function repeatNextDue() {
    var srs = getScheduler();
    if (!srs || !srs.getNextReview) return;
    var next = srs.getNextReview(Date.now());
    if (!next) return;
    repeatLesson(next.id);
    if (srs.scheduleNow) srs.scheduleNow(next.id);
  }

  function downloadText(content, filename, mime) {
    try {
      var blob = new Blob([content], { type: mime + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (_) {}
  }

  function exportSchedule() {
    var srs = getScheduler();
    if (!srs || !srs.exportSchedule) return;
    var content = srs.exportSchedule();
    var filename = 'srs_schedule_' + new Date().toISOString().slice(0, 10) + '.json';
    downloadText(content, filename, 'application/json');
    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('scheduleExport', { format: 'json' });
    }
  }

  function importSchedule(raw) {
    var srs = getScheduler();
    if (!srs || !srs.importSchedule) return;
    var count = srs.importSchedule(raw);
    if (statusEl) {
      statusEl.textContent = 'Imported schedule items: ' + count;
    }
    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('scheduleImport', { count: count });
    }
    renderList();
  }

  function togglePreview() {
    if (!previewEl || !previewBtn) return;
    var isHidden = previewEl.classList.contains('hidden');
    if (isHidden) {
      var importer = global.Game && global.Game.AnkiImporter;
      previewEl.textContent = importer && importer.preview
        ? importer.preview('csv', { limit: 8 })
        : 'Preview unavailable.';
      previewEl.classList.remove('hidden');
      previewBtn.textContent = 'Hide Preview';
    } else {
      previewEl.classList.add('hidden');
      previewBtn.textContent = 'Preview Anki';
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
