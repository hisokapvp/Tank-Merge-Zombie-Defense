/**
 * Anki Importer (Pack 3).
 * Generates CSV/JSON from lesson catalog cards and provides previews.
 */
(function (global) {
  'use strict';

  function escapeCSV(val) {
    var s = String(val == null ? '' : val);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function normalizeTags(tags) {
    if (!tags) return [];
    var list = Array.isArray(tags) ? tags : [tags];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i]) out.push(String(list[i]));
    }
    return out;
  }

  function mapLessonToCard(lesson) {
    var tags = normalizeTags(lesson.tags);
    tags.push('lesson');
    return {
      front: lesson.name,
      back: lesson.summary || '',
      tags: tags,
      thumbnail: lesson.thumbnail || ''
    };
  }

  function buildCardsFromLessons(lessons) {
    var out = [];
    if (!Array.isArray(lessons)) return out;
    for (var i = 0; i < lessons.length; i++) {
      out.push(mapLessonToCard(lessons[i]));
    }
    return out;
  }

  function listCatalogLessons() {
    if (global.Game && global.Game.LessonCatalog && global.Game.LessonCatalog.listLessons) {
      return global.Game.LessonCatalog.listLessons();
    }
    return [];
  }

  function generateCSV(cards) {
    var lines = [];
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var tags = c.tags ? c.tags.join(' ') : '';
      lines.push(
        escapeCSV(c.front) + ',' +
        escapeCSV(c.back) + ',' +
        escapeCSV(tags) + ',' +
        escapeCSV(c.thumbnail || '')
      );
    }
    return lines.join('\n');
  }

  function generateJSON(cards) {
    return JSON.stringify(cards, null, 2);
  }

  /**
   * Generate import payload from cards.
   * @param {Array} cards
   * @param {'csv'|'json'} [format='csv']
   * @returns {string}
   */
  function generateImport(cards, format) {
    var fmt = format || 'csv';
    var safeCards = Array.isArray(cards) ? cards : [];
    if (fmt === 'json') return generateJSON(safeCards);
    return generateCSV(safeCards);
  }

  function preview(format, options) {
    var opts = options || {};
    var lessons = listCatalogLessons();
    var cards = buildCardsFromLessons(lessons);
    var limit = Number.isFinite(opts.limit) ? opts.limit : 8;
    if (limit > 0) cards = cards.slice(0, limit);
    return generateImport(cards, format || 'csv');
  }

  global.Game = global.Game || {};
  global.Game.AnkiImporter = {
    generateImport: generateImport,
    preview: preview,
    buildCardsFromLessons: buildCardsFromLessons,
    mapLessonToCard: mapLessonToCard,
    _escapeCSV: escapeCSV
  };
})(typeof window !== 'undefined' ? window : this);
