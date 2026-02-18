/**
 * Feedback Widget — programmatic modal + localStorage persistence.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'feedback_reports_v1';
  var MAX_ENTRIES = 200;

  var entries = [];
  var dirty = false;
  var flushTimer = null;
  var modalEl = null;
  var initialized = false;
  var actionsBound = false;

  function nowIso() {
    return new Date().toISOString();
  }

  function safeParse(raw, fb) {
    try { return raw ? JSON.parse(raw) : fb; }
    catch (_) { return fb; }
  }

  function t(key, vars) {
    var i18n = global.Game && global.Game.I18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, vars || {});
    return key;
  }

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      var data = safeParse(raw, null);
      if (Array.isArray(data)) entries = data;
    } catch (_) {}
  }

  function save() {
    if (!dirty) return;
    dirty = false;
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      }
    } catch (_) {}
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () {
      flushTimer = null;
      save();
    }, 0);
  }

  function submitFeedback(payload) {
    var message = payload && payload.message ? String(payload.message).trim() : '';
    if (!message) return { ok: false, reason: 'empty' };
    var rating = payload && payload.rating != null ? Number(payload.rating) : null;
    var category = payload && payload.category ? String(payload.category) : 'general';
    var context = payload && payload.context ? payload.context : null;

    var entry = {
      id: 'fb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      ts: nowIso(),
      message: message,
      rating: Number.isFinite(rating) ? rating : null,
      category: category,
      context: context,
    };

    entries.push(entry);
    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(entries.length - MAX_ENTRIES);
    }

    dirty = true;
    scheduleFlush();

    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('feedbackSubmit', {
        rating: entry.rating,
        messageLen: entry.message.length,
        category: entry.category,
      });
    }
    if (global.Game && global.Game.AnalyticsCollector) {
      global.Game.AnalyticsCollector.track('feedbackSubmit', {
        rating: entry.rating,
        category: entry.category,
      });
    }

    return { ok: true, entry: entry };
  }

  function getEntries() {
    return JSON.parse(JSON.stringify(entries));
  }

  function ensureStyles() {
    if (!global.document || global.document.getElementById('feedbackWidgetStyles')) return;
    var style = global.document.createElement('style');
    style.id = 'feedbackWidgetStyles';
    style.textContent =
      '.feedbackModal{' +
      'position:fixed;inset:0;display:none;align-items:center;justify-content:center;' +
      'background:rgba(6,10,18,.55);z-index:9999;' +
      '}' +
      '.feedbackModal.active{display:flex;}' +
      '.feedbackPanel{' +
      'background:#152034;color:#eaf1ff;border-radius:12px;padding:16px;min-width:260px;max-width:420px;' +
      'box-shadow:0 10px 24px rgba(0,0,0,.35);' +
      '}' +
      '.feedbackPanel h3{margin:0 0 8px 0;font-size:16px;}' +
      '.feedbackPanel textarea{' +
      'width:100%;min-height:90px;border-radius:8px;border:1px solid rgba(255,255,255,.2);' +
      'background:#0f1625;color:#eaf1ff;padding:8px;resize:vertical;' +
      '}' +
      '.feedbackRow{display:flex;gap:8px;align-items:center;margin-top:10px;}' +
      '.feedbackRow select,.feedbackRow input{' +
      'background:#0f1625;color:#eaf1ff;border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:4px 6px;' +
      '}' +
      '.feedbackActions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;}' +
      '.feedbackActions button{' +
      'background:#ffb872;color:#1b1008;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;' +
      '}' +
      '.feedbackActions .secondary{' +
      'background:transparent;color:#eaf1ff;border:1px solid rgba(255,255,255,.2);' +
      '}';
    (global.document.head || global.document.body).appendChild(style);
  }

  function ensureModal() {
    if (!global.document || !global.document.body) return null;
    if (modalEl) return modalEl;

    modalEl = global.document.createElement('div');
    modalEl.className = 'feedbackModal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'feedbackTitle');
    modalEl.innerHTML =
      '<div class="feedbackPanel">' +
        '<h3 id="feedbackTitle"></h3>' +
        '<textarea id="feedbackMessage"></textarea>' +
        '<div class="feedbackRow">' +
          '<label for="feedbackCategory" id="feedbackCategoryLabel"></label>' +
          '<select id="feedbackCategory">' +
            '<option value="general" id="feedbackCategoryGeneral"></option>' +
            '<option value="bug" id="feedbackCategoryBug"></option>' +
            '<option value="balance" id="feedbackCategoryBalance"></option>' +
            '<option value="ui" id="feedbackCategoryUi"></option>' +
          '</select>' +
          '<label for="feedbackRating" id="feedbackRatingLabel"></label>' +
          '<input id="feedbackRating" type="number" min="1" max="5" value="5" style="width:60px" />' +
        '</div>' +
        '<div class="feedbackActions">' +
          '<button type="button" class="secondary" id="feedbackCancel"></button>' +
          '<button type="button" id="feedbackSubmit"></button>' +
        '</div>' +
        '<div id="feedbackStatus" style="margin-top:8px;font-size:12px;color:#9fb3d9"></div>' +
      '</div>';

    global.document.body.appendChild(modalEl);
    bindModalActions();
    refreshTexts();
    return modalEl;
  }

  function bindModalActions() {
    if (!modalEl || actionsBound) return;

    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) hideModal();
    });

    var cancelBtn = modalEl.querySelector('#feedbackCancel');
    var submitBtn = modalEl.querySelector('#feedbackSubmit');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { hideModal(); });
    if (submitBtn) submitBtn.addEventListener('click', function () { handleSubmit(); });

    actionsBound = true;
  }

  function refreshTexts() {
    if (!modalEl) return;

    var titleEl = modalEl.querySelector('#feedbackTitle');
    var msgEl = modalEl.querySelector('#feedbackMessage');
    var categoryLabelEl = modalEl.querySelector('#feedbackCategoryLabel');
    var ratingLabelEl = modalEl.querySelector('#feedbackRatingLabel');
    var cancelEl = modalEl.querySelector('#feedbackCancel');
    var submitEl = modalEl.querySelector('#feedbackSubmit');
    var categoryGeneralEl = modalEl.querySelector('#feedbackCategoryGeneral');
    var categoryBugEl = modalEl.querySelector('#feedbackCategoryBug');
    var categoryBalanceEl = modalEl.querySelector('#feedbackCategoryBalance');
    var categoryUiEl = modalEl.querySelector('#feedbackCategoryUi');

    if (titleEl) titleEl.textContent = t('feedbackTitle');
    if (msgEl) msgEl.setAttribute('placeholder', t('feedbackMessagePlaceholder'));
    if (categoryLabelEl) categoryLabelEl.textContent = t('feedbackCategoryLabel');
    if (ratingLabelEl) ratingLabelEl.textContent = t('feedbackRatingLabel');
    if (cancelEl) cancelEl.textContent = t('feedbackCancel');
    if (submitEl) submitEl.textContent = t('feedbackSend');
    if (categoryGeneralEl) categoryGeneralEl.textContent = t('feedbackCategoryGeneral');
    if (categoryBugEl) categoryBugEl.textContent = t('feedbackCategoryBug');
    if (categoryBalanceEl) categoryBalanceEl.textContent = t('feedbackCategoryBalance');
    if (categoryUiEl) categoryUiEl.textContent = t('feedbackCategoryUi');
  }

  function handleSubmit() {
    if (!modalEl) return;
    var msgEl = modalEl.querySelector('#feedbackMessage');
    var catEl = modalEl.querySelector('#feedbackCategory');
    var ratingEl = modalEl.querySelector('#feedbackRating');
    var statusEl = modalEl.querySelector('#feedbackStatus');
    var message = msgEl ? msgEl.value : '';
    var category = catEl ? catEl.value : 'general';
    var rating = ratingEl ? ratingEl.value : null;
    var result = submitFeedback({ message: message, category: category, rating: rating });

    if (statusEl) {
      statusEl.textContent = result.ok ? t('feedbackSuccess') : t('feedbackValidationMessageRequired');
    }

    if (result.ok) {
      if (msgEl) msgEl.value = '';
      if (ratingEl) ratingEl.value = '5';
      setTimeout(hideModal, 600);
    }
  }

  function open() {
    ensureInit();
    ensureStyles();
    var modal = ensureModal();
    if (!modal) return;
    refreshTexts();
    modal.classList.add('active');

    if (global.Game && global.Game.TelemetryLogger) {
      global.Game.TelemetryLogger.log('feedbackOpen');
    }
    if (global.Game && global.Game.AnalyticsCollector) {
      global.Game.AnalyticsCollector.track('feedbackOpen');
    }
  }

  function showModal() {
    open();
  }

  function hideModal() {
    if (!modalEl) return;
    modalEl.classList.remove('active');
  }

  function destroy() {
    if (modalEl && modalEl.parentNode) {
      modalEl.parentNode.removeChild(modalEl);
    }
    modalEl = null;
    actionsBound = false;
  }

  function ensureInit() {
    if (initialized) return;
    initialized = true;
    load();
  }

  function init() {
    ensureInit();
  }

  global.Game = global.Game || {};
  global.Game.FeedbackWidget = {
    init: init,
    open: open,
    showModal: showModal,
    hideModal: hideModal,
    destroy: destroy,
    refreshTexts: refreshTexts,
    submitFeedback: submitFeedback,
    getEntries: getEntries,
    _STORAGE_KEY: STORAGE_KEY,
  };

  if (global.setTimeout) {
    setTimeout(function () {
      try { ensureInit(); } catch (_) {}
    }, 0);
  }

})(typeof window !== 'undefined' ? window : this);
