/**
 * ExperimentsPanel — debug-only UI for experiments.
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
    if (!global.document || !global.Game || !global.Game.Experiments) return;

    var panel = global.document.getElementById('debugSectionLogs');
    if (!panel || global.document.getElementById('experimentsPanel')) return;

    var root = global.document.createElement('div');
    root.id = 'experimentsPanel';
    root.className = 'debugTelemetry';
    root.style.marginTop = '8px';

    var header = global.document.createElement('div');
    header.className = 'debugRow';
    header.innerHTML = '<span class="debugLabel">' + t('experimentsTitle', 'Experiments') + '</span>';

    var refreshBtn = makeBtn(t('experimentsRefresh', 'Refresh'), function () { render(root); });
    var clearBtn = makeBtn(t('experimentsClear', 'Clear assignments'), function () {
      global.Game.Experiments.clearAssignments();
      render(root);
    });
    var resetBtn = makeBtn(t('experimentsReset', 'Reset config'), function () {
      global.Game.Experiments.resetConfig();
      render(root);
    });

    header.appendChild(refreshBtn);
    header.appendChild(clearBtn);
    header.appendChild(resetBtn);
    root.appendChild(header);

    var list = global.document.createElement('div');
    list.id = 'experimentsList';
    root.appendChild(list);

    panel.appendChild(root);
    render(root);
  }

  function render(root) {
    var list = root.querySelector('#experimentsList');
    if (!list) return;
    list.innerHTML = '';

    var items = global.Game.Experiments.list();
    if (!items.length) {
      var empty = global.document.createElement('div');
      empty.className = 'debugRow';
      empty.textContent = t('experimentsEmpty', 'No experiments defined.');
      list.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var row = global.document.createElement('div');
      row.className = 'debugRow expRow';

      var label = global.document.createElement('span');
      label.className = 'debugLabel';
      label.textContent = item.id;
      label.title = item.description || '';

      var status = global.document.createElement('span');
      status.className = 'expMeta';
      status.textContent = 'enabled ' + (item.enabled ? 'on' : 'off') + ', assigned ' + (item.assigned || 'none') + ', value ' + item.value;

      var enabled = global.document.createElement('input');
      enabled.type = 'checkbox';
      enabled.checked = !!item.enabled;
      enabled.addEventListener('change', function () {
        global.Game.Experiments.setExperiment(item.id, { enabled: enabled.checked });
        render(root);
      });

      var enabledWrap = global.document.createElement('label');
      enabledWrap.className = 'expToggle';
      enabledWrap.appendChild(enabled);
      enabledWrap.appendChild(global.document.createTextNode(' ' + t('experimentsEnabled', 'Enabled')));

      var rollout = global.document.createElement('input');
      rollout.type = 'number';
      rollout.min = '0';
      rollout.max = '100';
      rollout.value = String(item.rollout || 0);
      rollout.className = 'expInput';
      rollout.addEventListener('change', function () {
        var v = Math.max(0, Math.min(100, Number(rollout.value) || 0));
        rollout.value = String(v);
        global.Game.Experiments.setExperiment(item.id, { rollout: v });
        render(root);
      });

      var variant = global.document.createElement('select');
      variant.className = 'debugSelect expSelect';
      variant.appendChild(new Option(t('experimentsAuto', 'auto'), 'auto'));
      item.variants.forEach(function (v) {
        variant.appendChild(new Option(v, v));
      });
      variant.value = item.forceVariant || 'auto';
      variant.addEventListener('change', function () {
        var v = variant.value === 'auto' ? null : variant.value;
        global.Game.Experiments.setExperiment(item.id, { forceVariant: v });
        render(root);
      });

      var metaWrap = global.document.createElement('div');
      metaWrap.className = 'expMetaWrap';
      metaWrap.appendChild(status);

      var controls = global.document.createElement('div');
      controls.className = 'expControls';
      controls.appendChild(enabledWrap);
      controls.appendChild(labelSpan(t('experimentsRollout', 'Rollout %'), rollout));
      controls.appendChild(labelSpan(t('experimentsForce', 'Force'), variant));

      row.appendChild(label);
      row.appendChild(metaWrap);
      row.appendChild(controls);
      list.appendChild(row);
    });
  }

  function labelSpan(text, node) {
    var wrap = global.document.createElement('label');
    wrap.className = 'expField';
    var span = global.document.createElement('span');
    span.textContent = text;
    wrap.appendChild(span);
    wrap.appendChild(node);
    return wrap;
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
  global.Game.ExperimentsPanel = { init: init };

  if (global.document && global.setTimeout) {
    setTimeout(function () {
      try { init(); } catch (_) {}
    }, 0);
  }

})(typeof window !== 'undefined' ? window : this);
