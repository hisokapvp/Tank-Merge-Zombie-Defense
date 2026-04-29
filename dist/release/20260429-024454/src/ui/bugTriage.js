/**
 * BugTriage — minimal debug-only triage list.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'bug_triage_v1';
  var bugs = [];

  var STATUSES = [
    { id: 'new', label: 'New' },
    { id: 'triage', label: 'Triaging' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'fixed', label: 'Fixed' },
    { id: 'wontfix', label: 'Won\'t fix' },
  ];

  var PRIORITIES = [
    { id: 'p0', label: 'P0' },
    { id: 'p1', label: 'P1' },
    { id: 'p2', label: 'P2' },
    { id: 'p3', label: 'P3' },
  ];

  var REPRO = [
    { id: 'always', label: 'Always' },
    { id: 'sometimes', label: 'Sometimes' },
    { id: 'unknown', label: 'Unknown' },
  ];

  var SYSTEMS = [
    { id: 'ui', label: 'UI' },
    { id: 'combat', label: 'Combat' },
    { id: 'economy', label: 'Economy' },
    { id: 'performance', label: 'Performance' },
    { id: 'save', label: 'Save/Load' },
    { id: 'ads', label: 'Ads' },
    { id: 'audio', label: 'Audio' },
    { id: 'input', label: 'Input' },
    { id: 'other', label: 'Other' },
  ];

  function isDebugMode() {
    try {
      var params = new URLSearchParams(global.location && global.location.search ? global.location.search : '');
      var v = params.get('debug');
      return v === '1' || v === 'true';
    } catch (_) {
      return false;
    }
  }

  function t(key, fallback) {
    var i18n = global.Game && global.Game.I18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback || key;
  }

  function safeParse(raw, fb) {
    try { return raw ? JSON.parse(raw) : fb; }
    catch (_) { return fb; }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      var data = safeParse(raw, null);
      if (Array.isArray(data)) bugs = data;
    } catch (_) {}
  }

  function save() {
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, JSON.stringify(bugs));
    } catch (_) {}
  }

  function addBug(data) {
    var entry = Object.assign({}, data);
    entry.id = 'bug_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    entry.createdAt = nowIso();
    bugs.push(entry);
    save();

    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('bugReportCreate', {
        id: entry.id,
        priority: entry.priority,
        status: entry.status,
        system: entry.system,
        repro: entry.repro,
      });
    }
    if (global.Game && global.Game.AnalyticsCollector) {
      global.Game.AnalyticsCollector.track('bugReportCreate', { system: entry.system, priority: entry.priority });
    }
  }

  function updateBug(id, patch) {
    var idx = bugs.findIndex(function (b) { return b.id === id; });
    if (idx < 0) return;
    bugs[idx] = Object.assign({}, bugs[idx], patch || {});
    save();
  }

  function removeBug(id) {
    bugs = bugs.filter(function (b) { return b.id !== id; });
    save();
  }

  function attachTelemetry(id) {
    var idx = bugs.findIndex(function (b) { return b.id === id; });
    if (idx < 0) return;
    var snapshot = global.Game && global.Game.Telemetry && global.Game.Telemetry.snapshot ? global.Game.Telemetry.snapshot() : null;
    bugs[idx].telemetry = snapshot;
    bugs[idx].telemetryAt = nowIso();
    save();
  }

  function init() {
    if (!isDebugMode()) return;
    if (!global.document) return;

    load();

    var panel = global.document.getElementById('debugSectionLogs');
    if (!panel || global.document.getElementById('bugTriagePanel')) return;

    var root = global.document.createElement('div');
    root.id = 'bugTriagePanel';
    root.className = 'debugTelemetry';
    root.style.marginTop = '8px';

    var header = global.document.createElement('div');
    header.className = 'debugRow';
    header.innerHTML = '<span class="debugLabel">' + t('triageTitle', 'Bug triage') + '</span>';

    var exportBtn = makeBtn(t('triageExport', 'Export JSON'), function () { exportJson(); });
    var clearBtn = makeBtn(t('triageClear', 'Clear all'), function () { bugs = []; save(); render(root); });

    header.appendChild(exportBtn);
    header.appendChild(clearBtn);
    root.appendChild(header);

    var form = buildForm(root);
    root.appendChild(form);

    var list = global.document.createElement('div');
    list.id = 'triageList';
    root.appendChild(list);

    panel.appendChild(root);
    render(root);
  }

  function buildForm(root) {
    var wrap = global.document.createElement('div');
    wrap.className = 'triageForm';

    var title = inputField('triageTitleLabel', 'Title', 'text');
    var notes = textareaField('triageNotesLabel', 'Notes');
    var status = selectField('triageStatusLabel', 'Status', STATUSES);
    var priority = selectField('triagePriorityLabel', 'Priority', PRIORITIES);
    var repro = selectField('triageReproLabel', 'Repro', REPRO);
    var system = selectField('triageSystemLabel', 'System', SYSTEMS);

    var submit = makeBtn(t('triageAdd', 'Add bug'), function () {
      if (!title.input.value.trim()) return;
      addBug({
        title: title.input.value.trim(),
        notes: notes.input.value.trim(),
        status: status.input.value,
        priority: priority.input.value,
        repro: repro.input.value,
        system: system.input.value,
      });
      title.input.value = '';
      notes.input.value = '';
      render(root);
    });

    wrap.appendChild(title.wrap);
    wrap.appendChild(status.wrap);
    wrap.appendChild(priority.wrap);
    wrap.appendChild(repro.wrap);
    wrap.appendChild(system.wrap);
    wrap.appendChild(notes.wrap);
    wrap.appendChild(submit);

    return wrap;
  }

  function render(root) {
    var list = root.querySelector('#triageList');
    if (!list) return;
    list.innerHTML = '';

    if (!bugs.length) {
      var empty = global.document.createElement('div');
      empty.className = 'debugRow';
      empty.textContent = t('triageEmpty', 'No bugs tracked.');
      list.appendChild(empty);
      return;
    }

    bugs.forEach(function (bug) {
      var row = global.document.createElement('div');
      row.className = 'triageRow';

      var title = global.document.createElement('div');
      title.className = 'triageTitle';
      title.textContent = bug.title;

      var meta = global.document.createElement('div');
      meta.className = 'triageMeta';
      meta.textContent = bug.system + ' • ' + bug.priority + ' • ' + bug.repro + ' • ' + bug.status;

      var controls = global.document.createElement('div');
      controls.className = 'triageControls';

      var statusSel = buildSelect(STATUSES, bug.status);
      statusSel.addEventListener('change', function () {
        updateBug(bug.id, { status: statusSel.value });
        render(root);
      });

      var prioritySel = buildSelect(PRIORITIES, bug.priority);
      prioritySel.addEventListener('change', function () {
        updateBug(bug.id, { priority: prioritySel.value });
        render(root);
      });

      var reproSel = buildSelect(REPRO, bug.repro);
      reproSel.addEventListener('change', function () {
        updateBug(bug.id, { repro: reproSel.value });
        render(root);
      });

      var systemSel = buildSelect(SYSTEMS, bug.system);
      systemSel.addEventListener('change', function () {
        updateBug(bug.id, { system: systemSel.value });
        render(root);
      });

      var attachBtn = makeBtn(t('triageAttachTelemetry', 'Attach telemetry'), function () {
        attachTelemetry(bug.id);
        render(root);
      });
      attachBtn.classList.add('secondary');

      var removeBtn = makeBtn(t('triageRemove', 'Remove'), function () {
        removeBug(bug.id);
        render(root);
      });
      removeBtn.classList.add('danger');

      controls.appendChild(statusSel);
      controls.appendChild(prioritySel);
      controls.appendChild(reproSel);
      controls.appendChild(systemSel);
      controls.appendChild(attachBtn);
      controls.appendChild(removeBtn);

      if (bug.notes) {
        var notes = global.document.createElement('div');
        notes.className = 'triageMeta';
        notes.textContent = bug.notes;
        row.appendChild(notes);
      }

      if (bug.telemetryAt) {
        var telem = global.document.createElement('div');
        telem.className = 'triageMeta triageTelemetry';
        telem.textContent = t('triageTelemetryAttached', 'Telemetry attached') + ': ' + bug.telemetryAt;
        row.appendChild(telem);
      }

      row.appendChild(title);
      row.appendChild(meta);
      row.appendChild(controls);
      list.appendChild(row);
    });
  }

  function exportJson() {
    var content = JSON.stringify(bugs, null, 2);
    var filename = 'bug_triage_' + new Date().toISOString().slice(0, 10) + '.json';
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
    } catch (e) {
      if (global.open) global.open('data:application/json;charset=utf-8,' + encodeURIComponent(content));
    }
  }

  function inputField(labelKey, fallback, type) {
    var wrap = global.document.createElement('label');
    wrap.className = 'triageField';
    var span = global.document.createElement('span');
    span.textContent = t(labelKey, fallback);
    var input = global.document.createElement('input');
    input.type = type || 'text';
    wrap.appendChild(span);
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function textareaField(labelKey, fallback) {
    var wrap = global.document.createElement('label');
    wrap.className = 'triageField';
    var span = global.document.createElement('span');
    span.textContent = t(labelKey, fallback);
    var input = global.document.createElement('textarea');
    input.rows = 2;
    wrap.appendChild(span);
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function selectField(labelKey, fallback, items) {
    var wrap = global.document.createElement('label');
    wrap.className = 'triageField';
    var span = global.document.createElement('span');
    span.textContent = t(labelKey, fallback);
    var input = buildSelect(items, items[0].id);
    wrap.appendChild(span);
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function buildSelect(items, value) {
    var sel = global.document.createElement('select');
    sel.className = 'debugSelect';
    items.forEach(function (item) {
      sel.appendChild(new Option(item.label, item.id));
    });
    sel.value = value || items[0].id;
    return sel;
  }

  function makeBtn(text, onClick) {
    var btn = global.document.createElement('button');
    btn.type = 'button';
    btn.className = 'debugBtn';
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  global.Game = global.Game || {};
  global.Game.BugTriage = { init: init };

  if (global.document && global.setTimeout) {
    setTimeout(function () {
      try { init(); } catch (_) {}
    }, 0);
  }

})(typeof window !== 'undefined' ? window : this);
