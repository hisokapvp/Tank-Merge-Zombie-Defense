/**
 * AnalyticsPanel — debug-only UI for analytics summary export.
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

  function init() {
    if (!isDebugMode()) return;
    if (!global.document || !global.Game || !global.Game.AnalyticsCollector) return;

    var panel = global.document.getElementById('debugSectionLogs');
    if (!panel || global.document.getElementById('analyticsPanel')) return;

    var root = global.document.createElement('div');
    root.id = 'analyticsPanel';
    root.className = 'debugTelemetry';
    root.style.marginTop = '8px';

    var header = global.document.createElement('div');
    header.className = 'debugRow';
    header.innerHTML = '<span class="debugLabel">Analytics</span>';

    var refreshBtn = makeBtn('Refresh', function () { render(root); });
    var exportJsonBtn = makeBtn('Export JSON', function () { download('json'); });
    var exportCsvBtn = makeBtn('Export CSV', function () { download('csv'); });
    var clearBtn = makeBtn('Clear', function () {
      global.Game.AnalyticsCollector.clear();
      render(root);
    });

    header.appendChild(refreshBtn);
    header.appendChild(exportJsonBtn);
    header.appendChild(exportCsvBtn);
    header.appendChild(clearBtn);
    root.appendChild(header);

    var meta = global.document.createElement('div');
    meta.id = 'analyticsPanelMeta';
    meta.className = 'debugRow';
    meta.style.fontSize = '10px';
    meta.style.color = 'var(--muted)';
    root.appendChild(meta);

    var pre = global.document.createElement('pre');
    pre.id = 'analyticsPanelPre';
    pre.style.cssText = 'max-height:200px;overflow:auto;background:rgba(0,0,0,.25);padding:4px 6px;border-radius:4px;white-space:pre-wrap;word-break:break-all;font-size:10px;line-height:1.3;margin:0;';
    root.appendChild(pre);

    panel.appendChild(root);
    render(root);
  }

  function render(root) {
    var pre = root.querySelector('#analyticsPanelPre');
    var meta = root.querySelector('#analyticsPanelMeta');
    if (!pre) return;
    var summary = global.Game.AnalyticsCollector.getSummary();
    if (meta && summary && summary.meta) {
      var last = summary.meta.lastEventAt ? summary.meta.lastEventAt : 'none';
      meta.textContent = 'Last event: ' + last;
    }
    pre.textContent = JSON.stringify(summary, null, 2);
  }

  function makeBtn(text, onClick) {
    var btn = global.document.createElement('button');
    btn.type = 'button';
    btn.className = 'debugBtn';
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function download(fmt) {
    var format = fmt || 'json';
    var content = global.Game.AnalyticsCollector.export(format);
    var mime = format === 'csv' ? 'text/csv' : 'application/json';
    var ext = format === 'csv' ? '.csv' : '.json';
    var filename = 'analytics_export_' + new Date().toISOString().slice(0, 10) + ext;

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
      if (global.open) {
        global.open('data:' + mime + ';charset=utf-8,' + encodeURIComponent(content));
      }
    }
  }

  global.Game = global.Game || {};
  global.Game.AnalyticsPanel = { init: init };

  if (global.document && global.setTimeout) {
    setTimeout(function () {
      try { init(); } catch (_) {}
    }, 0);
  }

})(typeof window !== 'undefined' ? window : this);
