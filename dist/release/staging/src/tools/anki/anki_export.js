/**
 * Anki Exporter — генерация CSV/JSON карточек Anki из телеметрии / lesson progress.
 *
 * API:
 *   Game.AnkiExport.generate(format, options) — вернуть строку CSV или JSON
 *   Game.AnkiExport.download(format, options)  — скачать файл через <a> download
 *   Game.AnkiExport.hookUI()                  — привязать к кнопке #export-anki
 *
 * Карточки строятся из lesson progress (если доступен) и raw telemetry.
 * Front: вопрос/событие, Back: результат/ответ.
 *
 * CSV формат совместим с Anki import (tab-separated, два поля: Front\tBack).
 */
(function (global) {
  'use strict';

  /* ── Helpers ── */
  function escapeCSV(val) {
    var s = String(val == null ? '' : val);
    if (s.indexOf('\t') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Собрать «карточки» из lesson progress и telemetry.
   * Каждая карточка: { front: string, back: string, tags: string[] }
   */
  function buildCards(options) {
    var cards = [];
    var opts = options || {};

    // 1) Из LessonProgress (если есть)
    if (global.Game && global.Game.LessonProgress && global.Game.LessonProgress.getLessons) {
      var lessons = global.Game.LessonProgress.getLessons();
      for (var i = 0; i < lessons.length; i++) {
        var l = lessons[i];
        cards.push({
          front: 'Lesson: ' + escapeHTML(l.name) + ' — какой последний результат?',
          back: 'Score: ' + (l.lastScore != null ? l.lastScore : 'N/A') +
                ', Completed: ' + (l.completed ? 'Yes' : 'No'),
          tags: ['lesson', l.name.replace(/\s+/g, '_')]
        });
      }
    }

    // 2) Из TelemetryLogger (недавние события — группируем по типу)
    if (global.Game && global.Game.TelemetryLogger && global.Game.TelemetryLogger.getEntries) {
      var entries = global.Game.TelemetryLogger.getEntries();
      var grouped = {};
      for (var j = 0; j < entries.length; j++) {
        var e = entries[j];
        if (!grouped[e.event]) grouped[e.event] = 0;
        grouped[e.event]++;
      }
      for (var evName in grouped) {
        if (!grouped.hasOwnProperty(evName)) continue;
        cards.push({
          front: 'Event type: ' + escapeHTML(evName),
          back: 'Total occurrences: ' + grouped[evName],
          tags: ['telemetry', evName]
        });
      }
    }

    // 3) Из базовой Telemetry snapshot
    if (global.Game && global.Game.Telemetry && global.Game.Telemetry.snapshot) {
      var snap = global.Game.Telemetry.snapshot();
      if (snap.session) {
        for (var sk in snap.session) {
          if (!snap.session.hasOwnProperty(sk)) continue;
          // Avoid duplicating entries already added from TelemetryLogger
          var duplicate = false;
          for (var ci = 0; ci < cards.length; ci++) {
            if (cards[ci].front.indexOf(sk) !== -1 && cards[ci].tags.indexOf('telemetry') !== -1) {
              duplicate = true;
              break;
            }
          }
          if (!duplicate) {
            cards.push({
              front: 'Session metric: ' + escapeHTML(sk),
              back: 'Value: ' + snap.session[sk],
              tags: ['session', sk]
            });
          }
        }
      }
    }

    // Optional filter
    if (opts.tagFilter) {
      var keep = [];
      for (var fi = 0; fi < cards.length; fi++) {
        if (cards[fi].tags && cards[fi].tags.indexOf(opts.tagFilter) !== -1) {
          keep.push(cards[fi]);
        }
      }
      cards = keep;
    }

    return cards;
  }

  /**
   * Генерация строки.
   * @param {'csv'|'json'} [format='csv']
   * @param {object} [options]
   * @returns {string}
   */
  function generate(format, options) {
    var cards = buildCards(options);
    if (format === 'json') {
      return JSON.stringify(cards, null, 2);
    }
    // CSV tab-separated (Anki default)
    var lines = [];
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var tagsStr = c.tags ? c.tags.join(' ') : '';
      lines.push(escapeCSV(c.front) + '\t' + escapeCSV(c.back) + '\t' + escapeCSV(tagsStr));
    }
    return lines.join('\n');
  }

  /**
   * Скачать файл.
   * @param {'csv'|'json'} [format='csv']
   * @param {object} [options]
   */
  function download(format, options) {
    var fmt = format || 'csv';
    var content = generate(fmt, options);
    var mime = fmt === 'json' ? 'application/json' : 'text/csv';
    var ext = fmt === 'json' ? '.json' : '.csv';
    var filename = 'anki_export_' + new Date().toISOString().slice(0, 10) + ext;

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
    } catch (e) {
      // Fallback: open in new window
      if (global.open) {
        global.open('data:' + mime + ';charset=utf-8,' + encodeURIComponent(content));
      }
    }
  }

  /**
   * Привязать к кнопке #export-anki в DOM.
   */
  function hookUI() {
    var btn = document.getElementById('export-anki');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      // Определяем формат из data-атрибута или дефолт
      var fmt = btn.getAttribute('data-format') || 'csv';
      download(fmt);
      // Telemetry
      if (global.Game && global.Game.TelemetryLogger) {
        global.Game.TelemetryLogger.log('ankiExport', { format: fmt });
      }
    });
  }

  /* ── Export ── */
  global.Game = global.Game || {};
  global.Game.AnkiExport = {
    generate: generate,
    download: download,
    hookUI: hookUI,
    buildCards: buildCards,
    // testing
    _escapeCSV: escapeCSV,
  };

})(typeof window !== 'undefined' ? window : this);
