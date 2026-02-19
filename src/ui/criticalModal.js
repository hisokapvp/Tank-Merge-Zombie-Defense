(function (global) {
  'use strict';

  function createController(options) {
    var opts = options || {};
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    if (!documentObj) return null;

    var overlay = documentObj.getElementById('criticalOverlay');
    var logEl = documentObj.getElementById('criticalLog');
    var skipBtn = documentObj.getElementById('criticalSkipBtn');
    var closeXBtn = documentObj.getElementById('criticalCloseX');
    var restartBtn = documentObj.getElementById('criticalRestartBtn');
    var saveExitBtn = documentObj.getElementById('criticalSaveExitBtn');
    if (!overlay || !logEl || !skipBtn || !closeXBtn || !restartBtn || !saveExitBtn) return null;

    var tuning = (global.Game && global.Game.Config && global.Game.Config.CriticalModalTuning) || {};
    var charsPerSec = Number.isFinite(tuning.charsPerSec) ? Math.max(1, tuning.charsPerSec) : 20;
    var linePauseMs = Number.isFinite(tuning.linePauseMs) ? Math.max(0, Math.floor(tuning.linePauseMs)) : 200;
    var afterFinishPauseMs = Number.isFinite(tuning.afterFinishPauseMs) ? Math.max(0, Math.floor(tuning.afterFinishPauseMs)) : 0;

    var a11yOpen = opts.a11yOpen;
    var a11yClose = opts.a11yClose;
    var translate = typeof opts.translate === 'function' ? opts.translate : function (key) { return key || ''; };

    var state = {
      isOpen: false,
      isTyping: false,
      skipRequested: false,
      token: 0,
      onSaveExit: null,
      onRestart: null,
      lines: [],
    };

    function setFinalActionsVisible(visible) {
      closeXBtn.classList.toggle('hidden', !visible);
      restartBtn.classList.toggle('hidden', !visible);
      saveExitBtn.classList.toggle('hidden', !visible);
      closeXBtn.disabled = !visible;
      restartBtn.disabled = !visible;
      saveExitBtn.disabled = !visible;
    }

    function setSkipVisible(visible) {
      skipBtn.classList.toggle('hidden', !visible);
      skipBtn.disabled = !visible;
    }

    function scrollToBottom() {
      logEl.scrollTop = logEl.scrollHeight;
    }

    function appendText(text) {
      logEl.textContent += text;
      scrollToBottom();
    }

    function setOverlayOpen(open, initialFocus, onClose) {
      var nextOpen = !!open;
      overlay.classList.toggle('hidden', !nextOpen);
      overlay.setAttribute('aria-hidden', (!nextOpen).toString());
      if (nextOpen) {
        if (typeof a11yOpen === 'function') {
          a11yOpen(overlay, {
            initialFocus: initialFocus || skipBtn,
            onClose: onClose,
          });
        }
        return;
      }
      if (typeof a11yClose === 'function') a11yClose(overlay);
    }

    function buildLines(hasDrones) {
      var lines = [
        translate('criticalLogDetected'),
        translate('criticalLogThreshold'),
        translate('criticalLogAutosaveStart'),
        translate('criticalLogSaveErrorTanks'),
        translate('criticalLogTanksPurged'),
      ];
      if (hasDrones) {
        lines.push(translate('criticalLogDronesStandby'));
      }
      lines.push(translate('criticalLogActionPrompt'));
      return lines;
    }

    function waitMs(ms) {
      return new Promise(function (resolve) {
        if (ms <= 0) {
          resolve();
          return;
        }
        global.setTimeout(resolve, ms);
      });
    }

    async function printAll(token) {
      state.isTyping = true;
      var charsPerTick = 1;
      var delayMs = Math.max(16, Math.round(1000 / charsPerSec));
      var linePrefix = '';

      for (var li = 0; li < state.lines.length; li++) {
        if (token !== state.token || !state.isOpen) return;
        var line = linePrefix + state.lines[li] + '\n';
        linePrefix = '\n';
        if (state.skipRequested) {
          appendText(line);
          continue;
        }
        for (var ci = 0; ci < line.length; ci += charsPerTick) {
          if (token !== state.token || !state.isOpen) return;
          if (state.skipRequested) {
            appendText(line.slice(ci));
            break;
          }
          appendText(line.slice(ci, ci + charsPerTick));
          await waitMs(delayMs);
        }
        if (!state.skipRequested && linePauseMs > 0 && li < state.lines.length - 1) {
          await waitMs(linePauseMs);
        }
      }

      if (token !== state.token || !state.isOpen) return;
      state.isTyping = false;
      setSkipVisible(false);
      if (afterFinishPauseMs > 0) await waitMs(afterFinishPauseMs);
      if (token !== state.token || !state.isOpen) return;
      setFinalActionsVisible(true);
      restartBtn.focus();
    }

    function finishTypingImmediately() {
      if (!state.isOpen || !state.isTyping || state.skipRequested) return;
      state.skipRequested = true;
      setSkipVisible(false);
    }

    function handleSaveExit() {
      if (state.isTyping) return;
      if (typeof state.onSaveExit === 'function') state.onSaveExit();
    }

    function handleRestart() {
      if (state.isTyping) return;
      if (typeof state.onRestart === 'function') state.onRestart();
    }

    function closeInternal() {
      if (!state.isOpen) return;
      state.token += 1;
      state.isOpen = false;
      state.isTyping = false;
      state.skipRequested = false;
      setOverlayOpen(false);
      setSkipVisible(true);
      setFinalActionsVisible(false);
      logEl.textContent = '';
      state.onSaveExit = null;
      state.onRestart = null;
      state.lines = [];
    }

    async function open(openOptions) {
      var params = openOptions || {};
      if (state.isOpen) return;
      state.token += 1;
      var token = state.token;
      state.isOpen = true;
      state.skipRequested = false;
      state.isTyping = false;
      state.onSaveExit = typeof params.onSaveExit === 'function' ? params.onSaveExit : null;
      state.onRestart = typeof params.onRestart === 'function' ? params.onRestart : null;
      state.lines = buildLines(!!params.hasDrones);
      logEl.textContent = '';
      setFinalActionsVisible(false);
      setSkipVisible(true);
      setOverlayOpen(true, skipBtn, function () {
        handleSaveExit();
      });
      await printAll(token);
    }

    skipBtn.addEventListener('click', finishTypingImmediately);
    closeXBtn.addEventListener('click', handleSaveExit);
    restartBtn.addEventListener('click', handleRestart);
    saveExitBtn.addEventListener('click', handleSaveExit);

    return {
      open: open,
      close: closeInternal,
      isOpen: function () { return !!state.isOpen; },
    };
  }

  global.Game = global.Game || {};
  global.Game.CriticalModal = {
    createController: createController,
  };
})(typeof window !== 'undefined' ? window : this);
