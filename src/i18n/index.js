/**
 * Simple JSON-driven i18n loader.
 */
(function (global) {
  'use strict';

  var strings = { ru: {}, en: {} };
  var fallback = null;
  var currentLang = 'ru';
  var ready = false;
  var readyCallbacks = [];

  function normalizeLang(lang) {
    return (lang === 'en' || lang === 'ru') ? lang : 'ru';
  }

  function setLanguage(lang) {
    var next = normalizeLang(lang);
    currentLang = next;
    try { global.localStorage && global.localStorage.setItem('lang', next); } catch (_) {}
    if (global.document && global.document.documentElement) {
      global.document.documentElement.lang = next;
    }
    return true;
  }

  function getLanguage() {
    return currentLang;
  }

  function setFallback(dict) {
    fallback = dict || null;
  }

  function translate(key, vars) {
    var dict = strings[currentLang] || {};
    var fb = fallback ? (fallback[currentLang] || fallback.ru || {}) : {};
    var text = (dict && dict[key]) || (fb && fb[key]) || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        text = text.replaceAll('{' + k + '}', String(vars[k]));
      });
    }
    return text;
  }

  function onReady(cb) {
    if (ready) { cb(); return; }
    readyCallbacks.push(cb);
  }

  function finalizeReady() {
    ready = true;
    while (readyCallbacks.length) {
      var cb = readyCallbacks.shift();
      try { cb(); } catch (_) {}
    }
  }

  function loadJson(lang, url) {
    if (!global.fetch) return Promise.resolve(null);
    return global.fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (data && typeof data === 'object') strings[lang] = data;
        return data;
      })
      .catch(function () { return null; });
  }

  function init() {
    var saved = null;
    try { saved = global.localStorage && global.localStorage.getItem('lang'); } catch (_) {}
    if (saved) currentLang = normalizeLang(saved);

    if (!global.fetch) {
      finalizeReady();
      return;
    }
    Promise.all([
      loadJson('ru', 'src/i18n/ru.json'),
      loadJson('en', 'src/i18n/en.json')
    ]).then(function () {
      finalizeReady();
    });
  }

  global.Game = global.Game || {};
  global.Game.I18n = {
    init: init,
    t: translate,
    setLanguage: setLanguage,
    getLanguage: getLanguage,
    setFallback: setFallback,
    onReady: onReady
  };

  init();
})(typeof window !== 'undefined' ? window : this);
