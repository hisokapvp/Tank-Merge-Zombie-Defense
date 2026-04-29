/**
 * Pack 2 — Enhanced Telemetry Logger.
 *
 * Расширяет Game.Telemetry дополнительным lesson-aware логированием,
 * consent-aware analytics contract и неблокирующим adapter batching.
 * Предоставляет:
 *   Game.TelemetryLogger.log(event, data)   — запись события с timestamp
 *   Game.TelemetryLogger.flush()            — сброс буфера в localStorage
 *   Game.TelemetryLogger.flushOutbound()    — неблокирующий flush adapter queues
 *   Game.TelemetryLogger.export(format)     — вернуть накопленные записи (json|csv)
 *   Game.TelemetryLogger.clear()            — очистка всех записей
 *   Game.TelemetryLogger.getEntries()       — получить массив записей (read-only копия)
 *   Game.TelemetryLogger.setLesson(name)    — установить текущий урок для тегирования
 *   Game.TelemetryLogger.setConsent(state)  — обновить consent/privacy state
 *   Game.TelemetryLogger.getHealthSnapshot() — rollout/read-back/stale health snapshot
 *
 * Записи хранятся в памяти и периодически flush-ятся в localStorage.
 * Ротация: если записей > MAX_ENTRIES, старые удаляются.
 * Async non-blocking: flush использует setTimeout(0) для неблокирующей записи.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'telemetry_log';
  var CONSENT_STORAGE_KEY = 'telemetry_consent_v1';
  var OUTBOUND_STORAGE_KEY = 'telemetry_outbound_state_v1';
  var HEALTH_STORAGE_KEY = 'telemetry_health_v1';
  var TAXONOMY_VERSION = 'tmzd-analytics-taxonomy.v1';
  var MAX_ENTRIES = 2000;
  var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  var FLUSH_INTERVAL_MS = 15000; // авто-flush каждые 15 с
  var BATCH_INTERVAL_MS = 5000;
  var MAX_PENDING_BATCH = 120;
  var MAX_BATCH_SIZE = 24;
  var STALE_AFTER_MS = 10 * 60 * 1000;
  var READBACK_STALE_AFTER_MS = 20 * 60 * 1000;
  var REVIEW_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
  var ROLLOUT_CACHE_TTL_MS = 1000;

  var EVENT_TAXONOMY = {
    session_start: {
      category: 'session',
      limitedByDefault: true,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Session bootstrap with save presence and runtime mode.'
    },
    session_resume: {
      category: 'session',
      limitedByDefault: true,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Returning player session restore.'
    },
    buyTank: {
      category: 'economy',
      limitedByDefault: true,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Tank purchase completed.'
    },
    merge: {
      category: 'economy',
      limitedByDefault: true,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Tank merge action completed.'
    },
    zombieKill: {
      category: 'combat',
      limitedByDefault: false,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Combat kill counter.'
    },
    shotFired: {
      category: 'combat',
      limitedByDefault: false,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Combat fire cadence.'
    },
    lessonComplete: {
      category: 'onboarding',
      limitedByDefault: true,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Tutorial lesson completion.'
    },
    funnelStep: {
      category: 'funnel',
      limitedByDefault: true,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Primary player funnel milestone.'
    },
    conversion: {
      category: 'funnel',
      limitedByDefault: true,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'First upgrade conversion marker.'
    },
    retentionReturn: {
      category: 'retention',
      limitedByDefault: true,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Return after inactive period.'
    },
    experimentAssign: {
      category: 'ops',
      limitedByDefault: true,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Sticky experiment assignment for rollout audit.'
    },
    analyticsRolloutStep: {
      category: 'ops',
      limitedByDefault: true,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Operator rollout/adoption milestone.'
    },
    analyticsReadBack: {
      category: 'ops',
      limitedByDefault: true,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Read-back verification signal.'
    },
    analyticsManualSmoke: {
      category: 'ops',
      limitedByDefault: true,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Manual smoke checklist completion.'
    },
    analyticsWeeklyReview: {
      category: 'ops',
      limitedByDefault: true,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Weekly adoption/quality review checkpoint.'
    },
    bugReportCreate: {
      category: 'quality',
      limitedByDefault: false,
      adapters: ['matomo', 'posthog'],
      privacy: 'aggregated',
      description: 'Bug report created from in-game triage UI.'
    }
  };

  var entries = [];
  var currentLesson = null;
  var flushTimer = null;
  var dirty = false;
  var consentState = null;
  var adapterState = {};
  var adapterQueues = {};
  var batchTimer = null;
  var pendingSequence = 0;
  var rolloutCache = null;
  var rolloutCacheTs = 0;
  var weeklyReviewState = null;
  var rolloutFunnelSyncActive = false;

  /* ── Helpers ── */
  function safeParse(raw, fb) {
    try { return raw ? JSON.parse(raw) : fb; }
    catch (_) { return fb; }
  }

  function now() {
    return new Date().toISOString();
  }

  function cloneArray(arr) {
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      var copy = { ts: e.ts, event: e.event };
      if (e.lesson) copy.lesson = e.lesson;
      if (e.data !== undefined) copy.data = e.data;
      if (e.category) copy.category = e.category;
      out.push(copy);
    }
    return out;
  }

  function parseTs(ts) {
    var ms = Date.parse(ts);
    return Number.isFinite(ms) ? ms : null;
  }

  function trimBuffer(buffer, nowMs, maxEntries, maxAgeMs) {
    var target = Array.isArray(buffer) ? buffer : entries;
    var now = typeof nowMs === 'number' ? nowMs : Date.now();
    var maxCount = typeof maxEntries === 'number' ? maxEntries : MAX_ENTRIES;
    var maxAge = typeof maxAgeMs === 'number' ? maxAgeMs : MAX_AGE_MS;
    var trimmed = [];

    for (var i = 0; i < target.length; i++) {
      var item = target[i];
      if (!item || !item.ts) continue;
      if (maxAge > 0) {
        var tsMs = parseTs(item.ts);
        if (tsMs == null) continue;
        if (now - tsMs > maxAge) continue;
      }
      trimmed.push(item);
    }

    trimmed.sort(function (left, right) {
      var leftMs = parseTs(left && left.ts);
      var rightMs = parseTs(right && right.ts);
      if (leftMs == null && rightMs == null) return 0;
      if (leftMs == null) return -1;
      if (rightMs == null) return 1;
      return leftMs - rightMs;
    });

    if (maxCount > 0 && trimmed.length > maxCount) {
      trimmed = trimmed.slice(trimmed.length - maxCount);
    }

    if (!Array.isArray(buffer)) entries = trimmed;
    return trimmed;
  }

  function shallowCopy(obj) {
    var out = {};
    if (!obj || typeof obj !== 'object') return out;
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) out[key] = obj[key];
    }
    return out;
  }

  function createDefaultConsent() {
    return {
      status: 'unknown',
      updatedAt: null,
      source: 'default',
    };
  }

  function createDefaultWeeklyReview() {
    return {
      at: null,
      note: '',
      manualSmokeAt: null,
      manualSmokeNote: '',
    };
  }

  function createAdapterConfig(name) {
    return {
      name: name,
      role: name === 'matomo' ? 'primary' : 'secondary',
      enabled: false,
      endpoint: '',
      batchSize: MAX_BATCH_SIZE,
      transport: null,
      headers: {},
      lastAttemptAt: null,
      lastBatchAt: null,
      lastReadBackAt: null,
      lastReadBackStatus: 'unknown',
      lastStatus: 'idle',
      lastError: '',
      sentCount: 0,
      droppedCount: 0,
      pendingCount: 0,
    };
  }

  function ensureAdapter(name) {
    if (!name) return null;
    if (!adapterState[name]) adapterState[name] = createAdapterConfig(name);
    if (!adapterQueues[name]) adapterQueues[name] = [];
    return adapterState[name];
  }

  function compactArray(values) {
    var out = [];
    for (var i = 0; i < values.length; i++) {
      if (values[i]) out.push(values[i]);
    }
    return out;
  }

  function resolveTaxonomy(event) {
    var direct = EVENT_TAXONOMY[event];
    if (direct) return direct;
    return {
      category: 'debug',
      limitedByDefault: false,
      adapters: [],
      privacy: 'local_only',
      description: 'Unregistered event remains local-only until taxonomy is updated.'
    };
  }

  function safeStorageSet(key, value) {
    try {
      if (global.localStorage) global.localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function safeStorageGet(key, fallback) {
    try {
      var raw = global.localStorage && global.localStorage.getItem(key);
      return safeParse(raw, fallback);
    } catch (_) {
      return fallback;
    }
  }

  function ensureOperationalState() {
    if (!consentState || typeof consentState !== 'object') {
      consentState = createDefaultConsent();
    }
    if (!weeklyReviewState || typeof weeklyReviewState !== 'object') {
      weeklyReviewState = createDefaultWeeklyReview();
    }
    ensureAdapter('matomo');
    ensureAdapter('posthog');
  }

  function syncCollectorSnapshot() {
    if (!global.Game || !global.Game.AnalyticsCollector || typeof global.Game.AnalyticsCollector.setAnalyticsRollout !== 'function') {
      return;
    }
    global.Game.AnalyticsCollector.setAnalyticsRollout(getHealthSnapshot());
  }

  function normalizeConsent(next) {
    var normalized = createDefaultConsent();
    if (next && typeof next === 'object') {
      var status = String(next.status || next.value || normalized.status).toLowerCase();
      if (status === 'limited' || status === 'full' || status === 'denied' || status === 'unknown') {
        normalized.status = status;
      }
      normalized.updatedAt = next.updatedAt || next.at || now();
      normalized.source = String(next.source || next.note || 'runtime').trim() || 'runtime';
    }
    return normalized;
  }

  function getConsent() {
    ensureOperationalState();
    return shallowCopy(consentState);
  }

  function setConsent(next) {
    ensureOperationalState();
    consentState = normalizeConsent(next);
    safeStorageSet(CONSENT_STORAGE_KEY, consentState);
    if (consentState.status === 'limited' || consentState.status === 'full') {
      if (global.Game && global.Game.Funnel && typeof global.Game.Funnel.trackAnalyticsStep === 'function') {
        global.Game.Funnel.trackAnalyticsStep('consent_recorded', { status: consentState.status, source: consentState.source }, true);
      }
    }
    persistOperationalState();
    syncCollectorSnapshot();
  }

  function applyAdapterOptions(adapter, options) {
    if (!adapter || !options || typeof options !== 'object') return;
    if (typeof options.endpoint === 'string') adapter.endpoint = options.endpoint.trim();
    if (typeof options.batchSize === 'number' && Number.isFinite(options.batchSize)) {
      adapter.batchSize = Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(options.batchSize)));
    }
    if (options.transport && typeof options.transport === 'function') adapter.transport = options.transport;
    if (options.headers && typeof options.headers === 'object') adapter.headers = shallowCopy(options.headers);
  }

  function configureAdapter(name, options) {
    var adapter = ensureAdapter(name);
    applyAdapterOptions(adapter, options);
    persistOperationalState();
    syncCollectorSnapshot();
  }

  function resolveFlagsSnapshot() {
    var flags = global.Game && global.Game.Flags;
    if (flags && typeof flags.getAnalyticsSnapshot === 'function') {
      return flags.getAnalyticsSnapshot();
    }
    return {
      enabled: !!(flags && flags.get && flags.get('tmzdAnalyticsEnabled')),
      limitedEvents: !(flags && flags.get && flags.get('tmzdAnalyticsLimitedEvents') === false),
      matomoPrimary: !!(flags && flags.get && flags.get('tmzdAnalyticsMatomoEnabled')),
      posthogSecondary: !!(flags && flags.get && flags.get('tmzdAnalyticsPostHogEnabled')),
      canary: !!(flags && flags.get && flags.get('tmzdAnalyticsCanary')),
      readBackVerification: !!(flags && flags.get && flags.get('tmzdAnalyticsReadBack')),
      flags: {}
    };
  }

  function resolveExperimentSnapshot() {
    var experiments = global.Game && global.Game.Experiments;
    if (experiments && typeof experiments.getAnalyticsRolloutState === 'function') {
      return experiments.getAnalyticsRolloutState();
    }
    return {
      id: 'tmzd_analytics_rollout',
      enabled: false,
      variant: 'control',
      canary: false,
      limitedEvents: true,
      readBackEnabled: false,
      primaryAdapter: '',
      secondaryAdapter: '',
      dualWrite: false,
      source: 'flags',
      flags: {}
    };
  }

  function syncAdapterActivation(rollout) {
    ensureOperationalState();
    var names = ['matomo', 'posthog'];
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var adapter = ensureAdapter(name);
      var enabled = rollout.activeAdapters.indexOf(name) !== -1;
      adapter.enabled = enabled;
      adapter.role = name === rollout.primaryAdapter ? 'primary' : (name === rollout.secondaryAdapter ? 'secondary' : adapter.role);
      if (!enabled && adapterQueues[name] && adapterQueues[name].length) {
        adapter.droppedCount += adapterQueues[name].length;
        adapterQueues[name] = [];
      }
      adapter.pendingCount = adapterQueues[name] ? adapterQueues[name].length : 0;
    }
  }

  function getRolloutState(force) {
    var nowMs = Date.now();
    if (!force && rolloutCache && nowMs - rolloutCacheTs < ROLLOUT_CACHE_TTL_MS) return rolloutCache;
    var flagsSnapshot = resolveFlagsSnapshot();
    var experimentSnapshot = resolveExperimentSnapshot();
    var enabled = !!flagsSnapshot.enabled;
    var primaryAdapter = '';
    var secondaryAdapter = '';

    if (enabled) {
      if (experimentSnapshot.canary) {
        primaryAdapter = experimentSnapshot.primaryAdapter || '';
        secondaryAdapter = experimentSnapshot.secondaryAdapter || '';
      } else {
        primaryAdapter = flagsSnapshot.matomoPrimary ? 'matomo' : '';
        secondaryAdapter = flagsSnapshot.posthogSecondary ? 'posthog' : '';
      }
    }

    rolloutCache = {
      generatedAt: now(),
      enabled: enabled,
      limitedEvents: flagsSnapshot.limitedEvents !== false,
      canary: !!experimentSnapshot.canary,
      readBackEnabled: !!flagsSnapshot.readBackVerification,
      primaryAdapter: primaryAdapter,
      secondaryAdapter: secondaryAdapter,
      activeAdapters: compactArray([primaryAdapter, secondaryAdapter]),
      batching: {
        batchSize: MAX_BATCH_SIZE,
        intervalMs: BATCH_INTERVAL_MS,
        maxPending: MAX_PENDING_BATCH,
      },
      experiment: {
        id: experimentSnapshot.id || 'tmzd_analytics_rollout',
        variant: experimentSnapshot.variant || 'control',
        source: experimentSnapshot.source || 'flags',
      },
      flags: flagsSnapshot.flags || {}
    };
    rolloutCacheTs = nowMs;
    syncAdapterActivation(rolloutCache);
    noteFunnelRolloutState(rolloutCache);
    return rolloutCache;
  }

  function noteFunnelRolloutState(rollout) {
    if (rolloutFunnelSyncActive) return;
    if (!global.Game || !global.Game.Funnel || typeof global.Game.Funnel.trackAnalyticsStep !== 'function') return;
    rolloutFunnelSyncActive = true;
    try {
      global.Game.Funnel.trackAnalyticsStep('taxonomy_registered', { version: TAXONOMY_VERSION }, false);
      if (rollout.primaryAdapter === 'matomo') {
        global.Game.Funnel.trackAnalyticsStep('matomo_primary_live', { canary: rollout.canary }, false);
      }
      if (rollout.secondaryAdapter === 'posthog') {
        global.Game.Funnel.trackAnalyticsStep('posthog_secondary_live', { canary: rollout.canary }, false);
      }
    } finally {
      rolloutFunnelSyncActive = false;
    }
  }

  function allowsRemoteAnalytics(taxonomy, rollout) {
    if (!taxonomy || taxonomy.privacy === 'local_only') return false;
    if (!rollout || !rollout.enabled || !rollout.activeAdapters.length) return false;
    if (consentState.status !== 'limited' && consentState.status !== 'full') return false;
    if (rollout.limitedEvents && !taxonomy.limitedByDefault) return false;
    return Array.isArray(taxonomy.adapters) && taxonomy.adapters.length > 0;
  }

  function buildOutboundEnvelope(entry, taxonomy, rollout) {
    pendingSequence += 1;
    return {
      id: 'tmzd-analytics-' + pendingSequence,
      ts: entry.ts,
      event: entry.event,
      category: taxonomy.category,
      lesson: entry.lesson || null,
      data: entry.data,
      consent: consentState.status,
      taxonomyVersion: TAXONOMY_VERSION,
      rolloutVariant: rollout.experiment.variant,
    };
  }

  function enqueueForAdapters(envelope, adapterNames) {
    for (var i = 0; i < adapterNames.length; i++) {
      var name = adapterNames[i];
      var adapter = ensureAdapter(name);
      if (!adapter.enabled) continue;
      var queue = adapterQueues[name];
      if (queue.length >= MAX_PENDING_BATCH) {
        queue.shift();
        adapter.droppedCount += 1;
      }
      queue.push(envelope);
      adapter.pendingCount = queue.length;
    }
    scheduleOutboundFlush();
  }

  function scheduleOutboundFlush() {
    if (batchTimer) return;
    batchTimer = setTimeout(function () {
      batchTimer = null;
      flushOutbound();
    }, BATCH_INTERVAL_MS);
  }

  function buildAdapterPayload(adapter, batch) {
    return {
      contract: 'tmzd-analytics-batch.v1',
      adapter: adapter.name,
      role: adapter.role,
      sentAt: now(),
      taxonomyVersion: TAXONOMY_VERSION,
      events: batch,
    };
  }

  function finalizeBatch(adapter, batch, status, errorText) {
    adapter.lastAttemptAt = now();
    adapter.lastBatchAt = now();
    adapter.lastStatus = status;
    adapter.lastError = errorText || '';
    adapter.sentCount += batch.length;
    adapter.pendingCount = adapterQueues[adapter.name] ? adapterQueues[adapter.name].length : 0;
    persistOperationalState();
    syncCollectorSnapshot();
  }

  function dispatchAdapterBatch(adapter, batch) {
    if (!batch.length) return;
    if (adapter.transport && typeof adapter.transport === 'function') {
      try {
        var result = adapter.transport(buildAdapterPayload(adapter, batch));
        if (result && typeof result.then === 'function') {
          result.then(function () {
            finalizeBatch(adapter, batch, 'delivered', '');
          }).catch(function (err) {
            finalizeBatch(adapter, batch, 'error', err && err.message ? err.message : String(err || 'transport failed'));
          });
          return;
        }
        finalizeBatch(adapter, batch, 'delivered', '');
        return;
      } catch (err) {
        finalizeBatch(adapter, batch, 'error', err && err.message ? err.message : String(err || 'transport failed'));
        return;
      }
    }

    if (adapter.endpoint && typeof global.fetch === 'function') {
      global.fetch(adapter.endpoint, {
        method: 'POST',
        headers: adapter.headers || {},
        body: JSON.stringify(buildAdapterPayload(adapter, batch)),
      }).then(function () {
        finalizeBatch(adapter, batch, 'delivered', '');
      }).catch(function (err) {
        finalizeBatch(adapter, batch, 'error', err && err.message ? err.message : String(err || 'fetch failed'));
      });
      return;
    }

    finalizeBatch(adapter, batch, adapter.endpoint ? 'queued' : 'dry_run', adapter.endpoint ? '' : 'endpoint not configured');
  }

  function flushOutbound() {
    ensureOperationalState();
    var rollout = getRolloutState(true);
    var names = rollout.activeAdapters.slice();
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var adapter = ensureAdapter(name);
      if (!adapter.enabled) continue;
      var queue = adapterQueues[name];
      if (!queue || !queue.length) continue;
      var size = Math.max(1, Math.min(adapter.batchSize || MAX_BATCH_SIZE, MAX_BATCH_SIZE));
      var batch = queue.splice(0, size);
      adapter.pendingCount = queue.length;
      dispatchAdapterBatch(adapter, batch);
    }
    persistOperationalState();
    syncCollectorSnapshot();
  }

  function markAdapterReadBack(name, payload) {
    var adapter = ensureAdapter(name);
    var stamp = payload && (payload.ts || payload.at) ? String(payload.ts || payload.at) : now();
    adapter.lastReadBackAt = stamp;
    adapter.lastReadBackStatus = String((payload && payload.status) || 'verified').trim() || 'verified';
    if (global.Game && global.Game.Funnel && typeof global.Game.Funnel.markReadBack === 'function') {
      global.Game.Funnel.markReadBack({ adapter: name, status: adapter.lastReadBackStatus });
    }
    if (global.Game && global.Game.AnalyticsCollector && typeof global.Game.AnalyticsCollector.markVerification === 'function') {
      global.Game.AnalyticsCollector.markVerification('read_back', { ts: stamp, status: adapter.lastReadBackStatus, adapter: name });
    }
    persistOperationalState();
    syncCollectorSnapshot();
  }

  function markManualSmoke(payload) {
    ensureOperationalState();
    weeklyReviewState.manualSmokeAt = payload && (payload.ts || payload.at) ? String(payload.ts || payload.at) : now();
    weeklyReviewState.manualSmokeNote = String((payload && (payload.note || payload.source)) || '').trim();
    if (global.Game && global.Game.Funnel && typeof global.Game.Funnel.markManualSmoke === 'function') {
      global.Game.Funnel.markManualSmoke({ note: weeklyReviewState.manualSmokeNote });
    }
    if (global.Game && global.Game.AnalyticsCollector && typeof global.Game.AnalyticsCollector.markVerification === 'function') {
      global.Game.AnalyticsCollector.markVerification('manual_smoke', { ts: weeklyReviewState.manualSmokeAt, note: weeklyReviewState.manualSmokeNote });
    }
    persistOperationalState();
    syncCollectorSnapshot();
  }

  function markWeeklyReview(payload) {
    ensureOperationalState();
    weeklyReviewState.at = payload && (payload.ts || payload.at) ? String(payload.ts || payload.at) : now();
    weeklyReviewState.note = String((payload && (payload.note || payload.source)) || '').trim();
    if (global.Game && global.Game.Funnel && typeof global.Game.Funnel.markWeeklyReview === 'function') {
      global.Game.Funnel.markWeeklyReview({ note: weeklyReviewState.note });
    }
    if (global.Game && global.Game.AnalyticsCollector && typeof global.Game.AnalyticsCollector.markVerification === 'function') {
      global.Game.AnalyticsCollector.markVerification('weekly_review', { ts: weeklyReviewState.at, note: weeklyReviewState.note });
    }
    persistOperationalState();
    syncCollectorSnapshot();
  }

  function readBackIsStale(adapter, nowMs) {
    var tsMs = adapter.lastReadBackAt ? Date.parse(adapter.lastReadBackAt) : NaN;
    if (!Number.isFinite(tsMs)) return true;
    return nowMs - tsMs > READBACK_STALE_AFTER_MS;
  }

  function reviewIsStale(stamp, nowMs) {
    var tsMs = stamp ? Date.parse(stamp) : NaN;
    if (!Number.isFinite(tsMs)) return true;
    return nowMs - tsMs > REVIEW_STALE_AFTER_MS;
  }

  function buildAdaptersSnapshot(nowMs) {
    var out = {};
    for (var name in adapterState) {
      if (!Object.prototype.hasOwnProperty.call(adapterState, name)) continue;
      var adapter = adapterState[name];
      out[name] = {
        enabled: !!adapter.enabled,
        role: adapter.role,
        endpointConfigured: !!adapter.endpoint,
        pendingCount: adapter.pendingCount,
        sentCount: adapter.sentCount,
        droppedCount: adapter.droppedCount,
        lastAttemptAt: adapter.lastAttemptAt,
        lastBatchAt: adapter.lastBatchAt,
        lastReadBackAt: adapter.lastReadBackAt,
        lastReadBackStatus: adapter.lastReadBackStatus,
        lastStatus: adapter.lastStatus,
        lastError: adapter.lastError,
        stale: {
          batch: !!adapter.enabled && !!adapter.lastBatchAt && nowMs - Date.parse(adapter.lastBatchAt) > STALE_AFTER_MS,
          readBack: !!adapter.enabled && readBackIsStale(adapter, nowMs),
        }
      };
    }
    return out;
  }

  function buildVerificationSnapshot() {
    ensureOperationalState();
    return {
      readBackAt: adapterState.matomo && adapterState.matomo.lastReadBackAt ? adapterState.matomo.lastReadBackAt : (adapterState.posthog && adapterState.posthog.lastReadBackAt ? adapterState.posthog.lastReadBackAt : null),
      readBackStatus: adapterState.matomo && adapterState.matomo.lastReadBackStatus !== 'unknown'
        ? adapterState.matomo.lastReadBackStatus
        : (adapterState.posthog ? adapterState.posthog.lastReadBackStatus : 'unknown'),
      manualSmokeAt: weeklyReviewState.manualSmokeAt,
      manualSmokeNote: weeklyReviewState.manualSmokeNote,
      weeklyReviewAt: weeklyReviewState.at,
      weeklyReviewNote: weeklyReviewState.note,
    };
  }

  function getHealthSnapshot() {
    ensureOperationalState();
    var rollout = getRolloutState(true);
    var nowMs = Date.now();
    var adapters = buildAdaptersSnapshot(nowMs);
    var verification = buildVerificationSnapshot();
    var reasons = [];
    if (reviewIsStale(weeklyReviewState.at, nowMs)) reasons.push('weekly_review_stale');
    if (reviewIsStale(weeklyReviewState.manualSmokeAt, nowMs)) reasons.push('manual_smoke_stale');
    if (rollout.readBackEnabled) {
      if ((rollout.primaryAdapter && adapters[rollout.primaryAdapter] && adapters[rollout.primaryAdapter].stale.readBack) ||
          (rollout.secondaryAdapter && adapters[rollout.secondaryAdapter] && adapters[rollout.secondaryAdapter].stale.readBack)) {
        reasons.push('read_back_stale');
      }
    }
    return {
      taxonomyVersion: TAXONOMY_VERSION,
      consent: getConsent(),
      rollout: rollout,
      adapters: adapters,
      verification: verification,
      stale: {
        overall: reasons.length > 0,
        reasons: reasons,
      }
    };
  }

  function persistOperationalState() {
    ensureOperationalState();
    var outboundState = {
      updatedAt: now(),
      queues: {
        matomo: adapterQueues.matomo ? adapterQueues.matomo.length : 0,
        posthog: adapterQueues.posthog ? adapterQueues.posthog.length : 0,
      },
      consent: consentState,
      weeklyReview: weeklyReviewState,
    };
    safeStorageSet(OUTBOUND_STORAGE_KEY, outboundState);
    safeStorageSet(HEALTH_STORAGE_KEY, getHealthSnapshot());
  }

  /* ── Core API ── */

  /**
   * Записать событие.
   * @param {string} event — тип события (merge, fire, kill, lessonStart, lessonEnd, ...)
   * @param {*} [data]     — произвольные данные
   */
  function log(event, data) {
    if (!event) return;
    ensureOperationalState();
    var taxonomy = resolveTaxonomy(event);
    var rollout = getRolloutState(false);
    var entry = { ts: now(), event: event, category: taxonomy.category };
    if (currentLesson) entry.lesson = currentLesson;
    if (data !== undefined) entry.data = data;
    entries.push(entry);
    dirty = true;
    entries = trimBuffer(entries, Date.now());
    // Notify base telemetry
    if (global.Game && global.Game.Telemetry && global.Game.Telemetry.event) {
      global.Game.Telemetry.event(event);
    }
    if (allowsRemoteAnalytics(taxonomy, rollout)) {
      enqueueForAdapters(buildOutboundEnvelope(entry, taxonomy, rollout), taxonomy.adapters || []);
    }
    persistOperationalState();
    syncCollectorSnapshot();
  }

  /**
   * Flush буфера в localStorage (неблокирующий).
   * @param {function} [cb] — callback после записи
   */
  function flush(cb) {
    if (!dirty && !cb) {
      persistOperationalState();
      return;
    }
    entries = trimBuffer(entries, Date.now());
    var snapshot = JSON.stringify(entries);
    dirty = false;
    setTimeout(function () {
      try {
        if (global.localStorage) {
          global.localStorage.setItem(STORAGE_KEY, snapshot);
        }
      } catch (e) {
        // localStorage quota — молча проглатываем
      }
      persistOperationalState();
      if (typeof cb === 'function') cb();
    }, 0);
  }

  /**
   * Экспорт записей.
   * @param {'json'|'csv'} [format='json']
   * @returns {string}
   */
  function exportEntries(format) {
    flush(); // ensure latest data persisted
    var data = cloneArray(entries);
    if (format === 'csv') {
      return entriesToCSV(data);
    }
    return JSON.stringify(data, null, 2);
  }

  /**
   * Конвертация массива записей в CSV-строку.
   */
  function entriesToCSV(arr) {
    var lines = ['timestamp,event,lesson,data'];
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      var dataStr = e.data !== undefined ? JSON.stringify(e.data) : '';
      lines.push(
        csvField(e.ts) + ',' +
        csvField(e.event) + ',' +
        csvField(e.lesson || '') + ',' +
        csvField(dataStr)
      );
    }
    return lines.join('\n');
  }

  /** Escape CSV field (RFC 4180). */
  function csvField(val) {
    var s = String(val);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /** Очистить все записи (memory + storage). */
  function clear() {
    entries = [];
    dirty = false;
    consentState = createDefaultConsent();
    weeklyReviewState = createDefaultWeeklyReview();
    adapterState = {};
    adapterQueues = {};
    ensureOperationalState();
    try {
      if (global.localStorage) {
        global.localStorage.removeItem(STORAGE_KEY);
        global.localStorage.removeItem(CONSENT_STORAGE_KEY);
        global.localStorage.removeItem(OUTBOUND_STORAGE_KEY);
        global.localStorage.removeItem(HEALTH_STORAGE_KEY);
      }
    } catch (_) {}
  }

  /** Вернуть копию массива записей. */
  function getEntries() {
    return cloneArray(entries);
  }

  /** Установить текущий урок. */
  function setLesson(name) {
    currentLesson = name || null;
  }

  /** Загрузить сохранённые записи из localStorage. */
  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      var data = safeParse(raw, null);
      if (Array.isArray(data)) {
        entries = trimBuffer(data, Date.now());
      }
    } catch (_) {}
    consentState = normalizeConsent(safeStorageGet(CONSENT_STORAGE_KEY, createDefaultConsent()));
    weeklyReviewState = safeStorageGet(OUTBOUND_STORAGE_KEY, {}).weeklyReview || createDefaultWeeklyReview();
    ensureOperationalState();
    persistOperationalState();
  }

  /** Запустить авто-flush таймер. */
  function startAutoFlush() {
    if (flushTimer) return;
    flushTimer = setInterval(function () {
      flush();
    }, FLUSH_INTERVAL_MS);
  }

  /** Остановить авто-flush. */
  function stopAutoFlush() {
    if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  }

  /** Init — загрузить + запустить таймер. */
  function init() {
    load();
    startAutoFlush();
    getRolloutState(true);
    persistOperationalState();
    syncCollectorSnapshot();
  }

  function getTaxonomy() {
    return safeParse(JSON.stringify(EVENT_TAXONOMY), {});
  }

  /* ── Export ── */
  global.Game = global.Game || {};
  global.Game.TelemetryLogger = {
    init: init,
    log: log,
    flush: flush,
    flushOutbound: flushOutbound,
    export: exportEntries,
    clear: clear,
    getEntries: getEntries,
    setLesson: setLesson,
    getTaxonomy: getTaxonomy,
    getConsent: getConsent,
    setConsent: setConsent,
    configureAdapter: configureAdapter,
    markAdapterReadBack: markAdapterReadBack,
    markManualSmoke: markManualSmoke,
    markWeeklyReview: markWeeklyReview,
    getHealthSnapshot: getHealthSnapshot,
    load: load,
    startAutoFlush: startAutoFlush,
    stopAutoFlush: stopAutoFlush,
    // testing
    _STORAGE_KEY: STORAGE_KEY,
    _CONSENT_STORAGE_KEY: CONSENT_STORAGE_KEY,
    _OUTBOUND_STORAGE_KEY: OUTBOUND_STORAGE_KEY,
    _HEALTH_STORAGE_KEY: HEALTH_STORAGE_KEY,
    _MAX_ENTRIES: MAX_ENTRIES,
    _MAX_AGE_MS: MAX_AGE_MS,
    _TAXONOMY_VERSION: TAXONOMY_VERSION,
    _EVENT_TAXONOMY: EVENT_TAXONOMY,
    _entriesToCSV: entriesToCSV,
    _csvField: csvField,
    trimBuffer: trimBuffer,
  };

})(typeof window !== 'undefined' ? window : this);
