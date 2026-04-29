/**
 * Lesson calendar UI (Pack 4).
 * Renders a simple upcoming schedule based on SRS export data.
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'lessonCalendarStyles';
  var DEFAULT_RANGE_DAYS = 7;

  function pad2(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function formatDayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function formatDayLabel(ts, nowTs) {
    var key = formatDayKey(ts);
    var nowKey = formatDayKey(nowTs);
    if (key === nowKey) return 'Today (' + key + ')';
    var tomorrow = new Date(nowTs);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (key === formatDayKey(tomorrow.getTime())) return 'Tomorrow (' + key + ')';
    return key;
  }

  function formatTime(ts) {
    var d = new Date(ts);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function safeParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  }

  function buildModel(items, nowTs, rangeDays, getLessonName) {
    var now = Number.isFinite(nowTs) ? nowTs : Date.now();
    var range = Number.isFinite(rangeDays) ? rangeDays : DEFAULT_RANGE_DAYS;
    var start = new Date(now);
    start.setHours(0, 0, 0, 0);
    var startMs = start.getTime();
    var endMs = startMs + range * 24 * 60 * 60 * 1000;

    var groups = {};
    var laterCount = 0;
    var totalCount = 0;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item || !Number.isFinite(item.dueAt)) continue;
      totalCount += 1;
      if (item.dueAt >= endMs) {
        laterCount += 1;
        continue;
      }
      if (item.dueAt < startMs) {
        item.dueAt = startMs;
      }
      var key = formatDayKey(item.dueAt);
      if (!groups[key]) {
        groups[key] = { key: key, label: formatDayLabel(item.dueAt, now), items: [] };
      }
      groups[key].items.push({
        id: item.id,
        name: getLessonName ? getLessonName(item.id) : String(item.id || ''),
        dueAt: item.dueAt,
        time: formatTime(item.dueAt),
        isDue: item.dueAt <= now
      });
    }

    var dayKeys = Object.keys(groups).sort();
    var days = [];
    for (var j = 0; j < dayKeys.length; j++) {
      var group = groups[dayKeys[j]];
      group.items.sort(function (a, b) { return a.dueAt - b.dueAt; });
      days.push(group);
    }

    return {
      days: days,
      laterCount: laterCount,
      totalCount: totalCount,
      rangeDays: range
    };
  }

  function readScheduleItems(srs) {
    if (!srs || typeof srs.exportSchedule !== 'function') return [];
    var raw = srs.exportSchedule();
    var data = safeParse(raw, null);
    if (!data || !data.items) return [];
    var out = [];
    for (var key in data.items) {
      if (!data.items.hasOwnProperty(key)) continue;
      var item = data.items[key];
      if (!item || !Number.isFinite(item.dueAt)) continue;
      out.push({ id: key, dueAt: item.dueAt });
    }
    out.sort(function (a, b) { return a.dueAt - b.dueAt; });
    return out;
  }

  function createEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function injectStyles() {
    if (!document || document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.lessonCalendar{margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);}' +
      '.lessonCalendar__header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}' +
      '.lessonCalendar__title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);}' +
      '.lessonCalendar__actions{display:flex;gap:6px;flex-wrap:wrap;}' +
      '.lessonCalendar__list{margin-top:8px;display:flex;flex-direction:column;gap:8px;max-height:180px;overflow:auto;}' +
      '.lessonCalendar__day{background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:6px 8px;display:flex;flex-direction:column;gap:6px;}' +
      '.lessonCalendar__dayLabel{font-size:11px;font-weight:700;color:var(--accent2);}' +
      '.lessonCalendar__item{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--text);}' +
      '.lessonCalendar__time{color:var(--muted);font-variant-numeric:tabular-nums;}' +
      '.lessonCalendar__item_due .lessonCalendar__time{color:var(--accent);}' +
      '.lessonCalendar__empty{font-size:12px;color:var(--muted);}' +
      '.lessonCalendar__fileInput{display:none;}' +
      '.lessonCalendar__status{margin-top:6px;font-size:11px;color:var(--muted);}' +
      '.lessonCalendar__fileBtn{position:relative;}';
    (document.head || document.body || document.documentElement).appendChild(style);
  }

  function CalendarUI(options) {
    this.options = options || {};
    this.panelEl = this.options.panelEl || null;
    this.srs = this.options.srs || null;
    this.getLessonName = this.options.getLessonName || null;
    this.onExport = this.options.onExport || null;
    this.onImport = this.options.onImport || null;
    this.rangeDays = this.options.rangeDays || DEFAULT_RANGE_DAYS;
    this.containerEl = null;
    this.listEl = null;
    this.statusEl = null;
    this.exportBtn = null;
    this.importInput = null;
  }

  CalendarUI.prototype.init = function () {
    if (!global.document || !document.createElement) return;
    injectStyles();

    if (!this.panelEl) {
      this.panelEl = document.getElementById('lessonProgressPanel');
    }
    if (!this.panelEl) return;

    var host = this.panelEl.querySelector('.lessonProgress__schedule') || this.panelEl;
    var existing = document.getElementById('lessonCalendar');
    if (existing) {
      this.containerEl = existing;
      this.listEl = existing.querySelector('.lessonCalendar__list');
      this.statusEl = existing.querySelector('.lessonCalendar__status');
      return;
    }

    var container = createEl('div', 'lessonCalendar');
    container.id = 'lessonCalendar';

    var header = createEl('div', 'lessonCalendar__header');
    var title = createEl('div', 'lessonCalendar__title', 'Schedule calendar');
    var actions = createEl('div', 'lessonCalendar__actions');

    var exportBtn = createEl('button', 'btn btnSecondary lessonCalendar__exportBtn', 'Export schedule');
    exportBtn.type = 'button';

    var importId = 'lessonCalendarImportInput';
    var importLabel = createEl('label', 'btn btnSecondary lessonCalendar__fileBtn', 'Import schedule');
    importLabel.setAttribute('for', importId);

    var importInput = createEl('input', 'lessonCalendar__fileInput');
    importInput.type = 'file';
    importInput.accept = 'application/json';
    importInput.id = importId;

    actions.appendChild(exportBtn);
    actions.appendChild(importLabel);
    actions.appendChild(importInput);
    header.appendChild(title);
    header.appendChild(actions);
    container.appendChild(header);

    var list = createEl('div', 'lessonCalendar__list');
    var status = createEl('div', 'lessonCalendar__status');
    container.appendChild(list);
    container.appendChild(status);

    host.appendChild(container);

    this.containerEl = container;
    this.listEl = list;
    this.statusEl = status;
    this.exportBtn = exportBtn;
    this.importInput = importInput;

    var self = this;
    exportBtn.addEventListener('click', function () {
      self.exportSchedule();
    });

    importInput.addEventListener('change', function (e) {
      var file = e.target && e.target.files ? e.target.files[0] : null;
      if (!file) return;
      if (typeof FileReader === 'undefined') return;
      var reader = new FileReader();
      reader.onload = function () {
        self.importSchedule(reader.result);
      };
      reader.readAsText(file);
      importInput.value = '';
    });
  };

  CalendarUI.prototype.exportSchedule = function () {
    if (this.onExport) {
      this.onExport();
      this.setStatus('Schedule exported');
      return;
    }
    if (!this.srs || typeof this.srs.exportSchedule !== 'function') return;
    var content = this.srs.exportSchedule();
    var filename = 'srs_schedule_' + new Date().toISOString().slice(0, 10) + '.json';
    try {
      var blob = new Blob([content], { type: 'application/json;charset=utf-8' });
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
      this.setStatus('Schedule exported');
    } catch (_) {}
  };

  CalendarUI.prototype.importSchedule = function (raw) {
    if (this.onImport) {
      var countFromHook = this.onImport(raw);
      this.render();
      return countFromHook;
    }
    if (!this.srs || typeof this.srs.importSchedule !== 'function') return 0;
    var count = this.srs.importSchedule(raw);
    this.setStatus('Imported schedule items: ' + count);
    this.render();
    return count;
  };

  CalendarUI.prototype.setStatus = function (text) {
    if (this.statusEl && text) this.statusEl.textContent = text;
  };

  CalendarUI.prototype.render = function () {
    if (!this.listEl) return;
    var items = readScheduleItems(this.srs);
    var model = buildModel(items, Date.now(), this.rangeDays, this.getLessonName);

    this.listEl.innerHTML = '';

    if (!model.totalCount) {
      this.listEl.appendChild(createEl('div', 'lessonCalendar__empty', 'No scheduled lessons yet.'));
      this.setStatus('Schedule empty');
      return;
    }

    if (!model.days.length) {
      this.listEl.appendChild(createEl('div', 'lessonCalendar__empty', 'No items in the next ' + model.rangeDays + ' days.'));
    }

    for (var i = 0; i < model.days.length; i++) {
      var day = model.days[i];
      var dayEl = createEl('div', 'lessonCalendar__day');
      dayEl.appendChild(createEl('div', 'lessonCalendar__dayLabel', day.label));

      for (var j = 0; j < day.items.length; j++) {
        var item = day.items[j];
        var itemEl = createEl('div', 'lessonCalendar__item' + (item.isDue ? ' lessonCalendar__item_due' : ''));
        itemEl.appendChild(createEl('div', 'lessonCalendar__name', item.name || item.id));
        itemEl.appendChild(createEl('div', 'lessonCalendar__time', item.time));
        dayEl.appendChild(itemEl);
      }
      this.listEl.appendChild(dayEl);
    }

    if (model.laterCount > 0) {
      this.listEl.appendChild(createEl('div', 'lessonCalendar__empty', 'Later items: ' + model.laterCount));
    }

    this.setStatus('Scheduled items: ' + model.totalCount);
  };

  CalendarUI.prototype.destroy = function () {
    if (!this.containerEl) return;
    this.containerEl.parentNode.removeChild(this.containerEl);
    this.containerEl = null;
    this.listEl = null;
    this.statusEl = null;
  };

  global.Game = global.Game || {};
  global.Game.CalendarUI = {
    create: function (options) { return new CalendarUI(options); },
    _buildModel: buildModel,
    _formatDayLabel: formatDayLabel
  };
})(typeof window !== 'undefined' ? window : this);
