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
    var enterCriticalPause = typeof opts.enterCriticalPause === 'function' ? opts.enterCriticalPause : null;
    var exitCriticalPause = typeof opts.exitCriticalPause === 'function' ? opts.exitCriticalPause : null;
    var applyCriticalAudioPolicy = typeof opts.applyCriticalAudioPolicy === 'function' ? opts.applyCriticalAudioPolicy : null;
    var restoreAudioAfterCritical = typeof opts.restoreAudioAfterCritical === 'function' ? opts.restoreAudioAfterCritical : null;

    var state = {
      isOpen: false,
      isTyping: false,
      skipRequested: false,
      token: 0,
      onSaveExit: null,
      onRestart: null,
      onClose: null,
      lines: [],
      criticalSessionActive: false,
      canRestart: true,
    };

    function setElementVisibility(el, visible) {
      if (!el) return;
      var isVisible = !!visible;
      el.classList.toggle('hidden', !isVisible);
      el.setAttribute('aria-hidden', (!isVisible).toString());
      if (isVisible) {
        el.style.display = '';
        el.removeAttribute('hidden');
        return;
      }
      el.style.display = 'none';
      el.setAttribute('hidden', 'hidden');
    }

    function setFinalActionsVisible(visible) {
      setElementVisibility(closeXBtn, visible);
      setElementVisibility(restartBtn, visible);
      setElementVisibility(saveExitBtn, visible);
      closeXBtn.disabled = !visible;
      restartBtn.disabled = !visible || !state.canRestart;
      saveExitBtn.disabled = !visible;
    }

    function setSkipVisible(visible) {
      setElementVisibility(skipBtn, visible);
      skipBtn.disabled = !visible;
    }

    function scrollToBottom() {
      logEl.scrollTop = logEl.scrollHeight;
    }

    function appendText(text) {
      logEl.textContent += text;
      scrollToBottom();
    }

    function buildFinalLogText() {
      var text = '';
      var linePrefix = '';
      for (var i = 0; i < state.lines.length; i++) {
        text += linePrefix + state.lines[i] + '\n';
        linePrefix = '\n';
      }
      return text;
    }

    function enterCriticalMode() {
      if (state.criticalSessionActive) return;
      if (enterCriticalPause) enterCriticalPause();
      if (applyCriticalAudioPolicy) applyCriticalAudioPolicy();
      state.criticalSessionActive = true;
    }

    function exitCriticalMode() {
      if (!state.criticalSessionActive) return;
      if (restoreAudioAfterCritical) restoreAudioAfterCritical();
      if (exitCriticalPause) exitCriticalPause();
      state.criticalSessionActive = false;
    }

    function setOverlayOpen(open, initialFocus, onClose) {
      var nextOpen = !!open;
      overlay.classList.toggle('hidden', !nextOpen);
      overlay.setAttribute('aria-hidden', (!nextOpen).toString());
      if (nextOpen) {
        documentObj.body.classList.add('critical-open');
        if (typeof a11yOpen === 'function') {
          a11yOpen(overlay, {
            initialFocus: initialFocus || skipBtn,
            onClose: onClose,
          });
        }
        return;
      }
      documentObj.body.classList.remove('critical-open');
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
      setSkipVisible(true);
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
      state.token += 1;
      logEl.textContent = buildFinalLogText();
      scrollToBottom();
      state.isTyping = false;
      setSkipVisible(false);
      setFinalActionsVisible(true);
      restartBtn.focus();
    }

    function handleSaveExit() {
      if (state.isTyping) return;
      var onSaveExit = state.onSaveExit;
      closeInternal();
      if (typeof onSaveExit === 'function') onSaveExit();
    }

    function handleClose() {
      if (state.isTyping) return;
      var onClose = state.onClose;
      closeInternal();
      if (typeof onClose === 'function') onClose();
    }

    function handleRestart() {
      if (state.isTyping) return;
      var onRestart = state.onRestart;
      closeInternal();
      if (typeof onRestart === 'function') onRestart();
    }

    function closeInternal() {
      if (!state.isOpen) return;
      state.token += 1;
      state.isOpen = false;
      state.isTyping = false;
      state.skipRequested = false;
      exitCriticalMode();
      setOverlayOpen(false);
      setSkipVisible(false);
      setFinalActionsVisible(false);
      logEl.textContent = '';
      state.onSaveExit = null;
      state.onRestart = null;
      state.onClose = null;
      state.lines = [];
      state.canRestart = true;
    }

    async function open(openOptions) {
      var params = openOptions || {};
      if (state.isOpen) return;
      enterCriticalMode();
      state.token += 1;
      var token = state.token;
      state.isOpen = true;
      state.skipRequested = false;
      state.isTyping = false;
      state.onSaveExit = typeof params.onSaveExit === 'function' ? params.onSaveExit : null;
      state.onRestart = typeof params.onRestart === 'function' ? params.onRestart : null;
      state.onClose = typeof params.onClose === 'function' ? params.onClose : null;
      state.canRestart = params.canRestart !== false;
      state.lines = buildLines(!!params.hasDrones);
      logEl.textContent = '';
      setFinalActionsVisible(false);
      setSkipVisible(false);
      setOverlayOpen(true, skipBtn, function () {
        handleClose();
      });
      await printAll(token);
    }

    skipBtn.addEventListener('click', finishTypingImmediately);
    closeXBtn.addEventListener('click', handleClose);
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
