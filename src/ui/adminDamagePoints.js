/**
 * AdminDamagePoints — debug-only UI for adjusting damage points.
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

  function isDevOnly() {
    try {
      var loc = global.location || {};
      var host = String(loc.hostname || '');
      var protocol = String(loc.protocol || '');
      if (protocol === 'file:') return true;
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true;
      if (host.slice(-6) === '.local') return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  function parseDelta(rawValue) {
    var delta = Math.floor(Number(rawValue));
    if (!Number.isFinite(delta)) return 0;
    return delta;
  }

  function init() {
    if (!isDebugMode()) return;
    if (!global.document || !global.Game) return;
    if (typeof global.Game.getDamagePoints !== 'function') return;
    if (typeof global.Game.debugAdjustDamagePoints !== 'function') return;

    function mount() {
      var panel = global.document.getElementById('debugSectionLogs');
      if (!panel || global.document.getElementById('adminDamagePoints')) return false;

      var root = global.document.createElement('div');
      root.id = 'adminDamagePoints';
      root.className = 'debugTools';
      root.style.marginTop = '8px';
      root.style.display = 'block';

      var title = global.document.createElement('div');
      title.className = 'debugRow';
      title.innerHTML = '<strong>Damage Points (dev)</strong>';
      root.appendChild(title);

      var header = global.document.createElement('div');
      header.className = 'debugRow';

      var label = global.document.createElement('span');
      label.className = 'debugLabel';
      label.textContent = 'Damage Points';

      var input = global.document.createElement('input');
      input.id = 'adminDamagePointsInput';
      input.type = 'number';
      input.step = '1';
      input.value = '1';
      input.className = 'debugSelect';
      input.style.width = '90px';
      input.style.marginLeft = '6px';

      var addBtn = global.document.createElement('button');
      addBtn.id = 'adminDamagePointsAdd';
      addBtn.type = 'button';
      addBtn.className = 'debugBtn';
      addBtn.textContent = '+Add';

      var subBtn = global.document.createElement('button');
      subBtn.id = 'adminDamagePointsSub';
      subBtn.type = 'button';
      subBtn.className = 'debugBtn danger';
      subBtn.textContent = '-Add';

      header.appendChild(label);
      header.appendChild(input);
      header.appendChild(addBtn);
      header.appendChild(subBtn);
      root.appendChild(header);

      var value = global.document.createElement('div');
      value.id = 'adminDamagePointsValue';
      value.className = 'debugRow';
      value.style.fontSize = '10px';
      value.style.color = 'var(--muted)';
      root.appendChild(value);

      function refreshValue() {
        var count = Math.max(0, Math.floor(Number(global.Game.getDamagePoints()) || 0));
        value.textContent = 'Current: ' + String(count);
      }

      function applyDelta(sign) {
        var delta = parseDelta(input.value);
        if (!delta) {
          refreshValue();
          return;
        }
        global.Game.debugAdjustDamagePoints(sign * delta);
        refreshValue();
      }

      addBtn.addEventListener('click', function () {
        applyDelta(1);
      });
      subBtn.addEventListener('click', function () {
        applyDelta(-1);
      });

      var telemetryMount = global.document.getElementById('debugTelemetryMount');
      if (telemetryMount && telemetryMount.parentNode === panel && typeof panel.insertBefore === 'function') {
        panel.insertBefore(root, telemetryMount);
      } else {
        panel.appendChild(root);
      }
      refreshValue();
      return true;
    }

    if (mount()) return;
    var attempts = 0;
    var maxAttempts = 12;
    function tryMountLater() {
      if (mount()) return;
      attempts += 1;
      if (attempts >= maxAttempts) return;
      global.setTimeout(tryMountLater, 100);
    }
    tryMountLater();
  }

  global.Game = global.Game || {};
  global.Game.AdminDamagePoints = {
    init: init,
    isDebugMode: isDebugMode,
    isDevOnly: isDevOnly,
    parseDelta: parseDelta,
  };
})(typeof window !== 'undefined' ? window : this);
