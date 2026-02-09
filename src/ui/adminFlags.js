/**
 * AdminFlags — debug-only UI for feature flags.
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
    if (!global.document || !global.Game || !global.Game.Flags) return;

    var panel = global.document.getElementById('debugSectionLogs');
    if (!panel || global.document.getElementById('adminFlags')) return;

    var root = global.document.createElement('div');
    root.id = 'adminFlags';
    root.className = 'debugFlags';
    root.style.marginTop = '8px';

    var header = global.document.createElement('div');
    header.className = 'debugRow';
    header.innerHTML = '<span class="debugLabel">Feature Flags</span>';

    var refreshBtn = global.document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'debugBtn';
    refreshBtn.textContent = 'Refresh';
    refreshBtn.addEventListener('click', function () { renderList(root); });

    var resetBtn = global.document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'debugBtn danger';
    resetBtn.textContent = 'Clear overrides';
    resetBtn.addEventListener('click', function () {
      global.Game.Flags.clearOverrides();
      renderList(root);
    });

    header.appendChild(refreshBtn);
    header.appendChild(resetBtn);
    root.appendChild(header);

    var meta = global.document.createElement('div');
    meta.id = 'adminFlagsMeta';
    meta.className = 'debugRow';
    meta.style.fontSize = '10px';
    meta.style.color = 'var(--muted)';
    root.appendChild(meta);

    var list = global.document.createElement('div');
    list.id = 'adminFlagsList';
    root.appendChild(list);

    panel.appendChild(root);
    renderList(root);
  }

  function renderList(root) {
    var Flags = global.Game && global.Game.Flags;
    if (!Flags) return;
    var list = root.querySelector('#adminFlagsList');
    if (!list) return;
    list.innerHTML = '';

    var meta = root.querySelector('#adminFlagsMeta');
    var userId = Flags.getUserId ? Flags.getUserId() : '';
    if (meta) meta.textContent = userId ? ('User: ' + userId) : 'User: (none)';

    var items = Flags.list();
    if (!items.length) {
      var empty = global.document.createElement('div');
      empty.className = 'debugRow';
      empty.textContent = 'No flags defined.';
      list.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var row = global.document.createElement('div');
      row.className = 'debugRow';

      var label = global.document.createElement('span');
      label.className = 'debugLabel';
      label.textContent = item.name;
      label.title = item.description || '';

      var status = global.document.createElement('span');
      status.style.fontSize = '10px';
      status.style.color = 'var(--muted)';
      var rolloutText = item.rollout == null ? 'n/a' : (item.rollout + '%');
      var valueText = item.value ? 'ON' : 'OFF';
      status.textContent = ' rollout ' + rolloutText + ', bucket ' + item.bucket + ' => ' + valueText;

      var select = global.document.createElement('select');
      select.className = 'debugSelect';
      select.style.width = 'auto';
      select.style.marginLeft = '6px';

      var optAuto = new Option('auto', 'auto');
      var optOn = new Option('force on', 'on');
      var optOff = new Option('force off', 'off');
      select.appendChild(optAuto);
      select.appendChild(optOn);
      select.appendChild(optOff);

      if (item.override === true) select.value = 'on';
      else if (item.override === false) select.value = 'off';
      else select.value = 'auto';

      select.addEventListener('change', function () {
        if (select.value === 'auto') Flags.setOverride(item.name, null);
        else if (select.value === 'on') Flags.setOverride(item.name, true);
        else Flags.setOverride(item.name, false);
        renderList(root);
      });

      row.appendChild(label);
      row.appendChild(status);
      row.appendChild(select);
      list.appendChild(row);
    });
  }

  global.Game = global.Game || {};
  global.Game.AdminFlags = { init: init };
})(typeof window !== 'undefined' ? window : this);
