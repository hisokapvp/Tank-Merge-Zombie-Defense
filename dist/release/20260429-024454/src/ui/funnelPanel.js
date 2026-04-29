/**
 * FunnelPanel — debug-only UI for funnel status.
 */
(function (global) {
  'use strict';

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

  function init() {
    if (!isDebugMode()) return;
    if (!global.document || !global.Game || !global.Game.Funnel) return;

    var panel = global.document.getElementById('debugSectionLogs');
    if (!panel || global.document.getElementById('funnelPanel')) return;

    var root = global.document.createElement('div');
    root.id = 'funnelPanel';
    root.className = 'debugTelemetry';
    root.style.marginTop = '8px';

    var header = global.document.createElement('div');
    header.className = 'debugRow';
    header.innerHTML = '<span class="debugLabel">' + t('funnelTitle', 'Funnel') + '</span>';

    var refreshBtn = makeBtn(t('funnelRefresh', 'Refresh'), function () { render(root); });
    var exportBtn = makeBtn(t('funnelExport', 'Export JSON'), function () { exportJson(); });
    var resetBtn = makeBtn(t('funnelReset', 'Reset funnel'), function () {
      global.Game.Funnel.reset();
      render(root);
    });

    header.appendChild(refreshBtn);
    header.appendChild(exportBtn);
    header.appendChild(resetBtn);
    root.appendChild(header);

    var list = global.document.createElement('div');
    list.id = 'funnelList';
    root.appendChild(list);

    panel.appendChild(root);
    render(root);
  }

  function render(root) {
    var list = root.querySelector('#funnelList');
    if (!list) return;
    list.innerHTML = '';

    var status = global.Game.Funnel.getStatus();
    var drop = global.Game.Funnel.getDropOff();

    status.forEach(function (step) {
      var row = global.document.createElement('div');
      row.className = 'debugRow funnelRow';
      var label = global.document.createElement('span');
      label.className = 'debugLabel';
      label.textContent = t(step.labelKey, step.id);
      var meta = global.document.createElement('span');
      meta.className = 'funnelMeta';
      if (step.completedAt) {
        var sec = step.elapsedMs != null ? Math.round(step.elapsedMs / 1000) : '-';
        meta.textContent = t('funnelCompleted', 'done') + ' @ ' + step.completedAt + ' (' + sec + 's)';
      } else {
        meta.textContent = (drop && drop.id === step.id) ? t('funnelDrop', 'drop-off') : t('funnelPending', 'pending');
      }
      row.appendChild(label);
      row.appendChild(meta);
      list.appendChild(row);
    });
  }

  function exportJson() {
    var payload = global.Game.Funnel.getStatus();
    var content = JSON.stringify(payload, null, 2);
    var filename = 'funnel_status_' + new Date().toISOString().slice(0, 10) + '.json';
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

  function makeBtn(text, onClick) {
    var btn = global.document.createElement('button');
    btn.type = 'button';
    btn.className = 'debugBtn';
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  global.Game = global.Game || {};
  global.Game.FunnelPanel = { init: init };

  if (global.document && global.setTimeout) {
    setTimeout(function () {
      try { init(); } catch (_) {}
    }, 0);
  }

})(typeof window !== 'undefined' ? window : this);
