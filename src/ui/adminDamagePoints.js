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

    function mount() {
      if (!global.document || !global.Game) return false;
      if (typeof global.Game.getDamagePoints !== 'function') return false;
      if (typeof global.Game.debugAdjustDamagePoints !== 'function') return false;

      var panel = global.document.getElementById('debugSectionLogs');
      if (!panel || global.document.getElementById('adminDamagePoints')) return false;

      var root = global.document.createElement('div');
      root.id = 'adminDamagePoints';
      root.className = 'debugTools';
      root.style.cssText = 'margin-top:8px;display:block;padding:8px;border:1px solid rgba(255,184,114,.2);border-radius:8px;background:rgba(0,0,0,.15);';

      var title = global.document.createElement('div');
      title.className = 'debugRow';
      title.innerHTML = '<strong>Damage Points (dev)</strong>';
      root.appendChild(title);

      var header = global.document.createElement('div');
      header.className = 'debugRow';
      header.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:6px;';

      var label = global.document.createElement('span');
      label.className = 'debugLabel';
      label.style.display = 'inline';
      label.style.marginRight = '4px';
      label.textContent = 'Damage Points';

      var input = global.document.createElement('input');
      input.id = 'adminDamagePointsInput';
      input.type = 'number';
      input.step = '1';
      input.value = '1';
      input.className = 'debugSelect';
      input.style.width = '90px';
      input.style.marginBottom = '0';

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
      value.style.marginBottom = '0';
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
    var maxAttempts = 20;
    function tryMountLater() {
      if (mount()) return;
      attempts += 1;
      if (attempts >= maxAttempts) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[AdminDamagePoints] mount failed after ' + maxAttempts + ' attempts. ' +
            'getDamagePoints=' + typeof (global.Game && global.Game.getDamagePoints) + ', ' +
            'debugSectionLogs=' + !!global.document.getElementById('debugSectionLogs'));
        }
        return;
      }
      global.setTimeout(tryMountLater, 150);
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
