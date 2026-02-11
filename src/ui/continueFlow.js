/**
 * Логика кнопки «Продолжить»:
 * 1) Блокирующая синхронизация прогресса с сервером (syncProgressBlocking).
 * 2) При отсутствии > 5 минут — показывать модалку офлайн-награды.
 */
(function (global) {
  'use strict';

  var OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;
  var DEFAULT_TIMEOUT = 5000;
  var MAX_RETRIES = 3;
  var SYNC_ENDPOINT = '/api/sync-progress';
  var SYNC_ENABLED = false; // Set to true when server API is available

  var Game = global.Game;
  var computeOfflineRewards = Game && Game.OfflineProgress ? Game.OfflineProgress.computeOfflineRewards : function () { return { coins: 0, xp: 0, elapsedMsUsed: 0 }; };
  var showOfflineModal = Game && Game.OfflineModal ? Game.OfflineModal.showOfflineRewardsModal : function () {};
  var isTankOnTrack = Game && Game.TrackQuery ? Game.TrackQuery.isTankOnTrack : function () { return false; };

  /**
   * Генерация уникального clientSyncId для idempotency.
   * @returns {string}
   */
  function generateSyncId() {
    return 'sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Отправляет прогресс на сервер и ждёт подтверждения.
   * @param {string} endpoint
   * @param {object} payload — данные прогресса
   * @param {number} [timeout=5000]
   * @returns {Promise<{status: 'ok'|'error', code?: number, message?: string}>}
   */
  function syncProgressBlocking(endpoint, payload, timeout) {
    var timeoutMs = (typeof timeout === 'number' && timeout > 0) ? timeout : DEFAULT_TIMEOUT;
    return new Promise(function (resolve) {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (controller) controller.abort();
        resolve({ status: 'error', code: 0, message: 'Timeout: сервер не ответил' });
      }, timeoutMs);

      var fetchOpts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      };
      if (controller) fetchOpts.signal = controller.signal;

      fetch(endpoint, fetchOpts)
        .then(function (response) {
          clearTimeout(timer);
          if (response.ok) {
            return response.json().then(function (data) {
              resolve({ status: 'ok', code: response.status, message: data && data.message || 'OK' });
            });
          }
          return response.text().then(function (text) {
            resolve({ status: 'error', code: response.status, message: text || ('HTTP ' + response.status) });
          });
        })
        .catch(function (err) {
          clearTimeout(timer);
          if (err && err.name === 'AbortError') {
            resolve({ status: 'error', code: 0, message: 'Timeout: запрос отменён' });
          } else {
            resolve({ status: 'error', code: 0, message: err ? err.message : 'Network error' });
          }
        });
    });
  }

  /**
   * Retry с экспоненциальной задержкой.
   * @param {string} endpoint
   * @param {object} payload
   * @param {number} timeout
   * @param {number} attempt — текущая попытка (1-based)
   * @returns {Promise<{status: 'ok'|'error', code?: number, message?: string, attempts: number}>}
   */
  function syncWithRetry(endpoint, payload, timeout, attempt) {
    attempt = attempt || 1;
    return syncProgressBlocking(endpoint, payload, timeout).then(function (result) {
      result.attempts = attempt;
      if (result.status === 'ok') {
        return result;
      }
      if (attempt >= MAX_RETRIES) {
        result.retriesExhausted = true;
        return result;
      }
      var delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(syncWithRetry(endpoint, payload, timeout, attempt + 1));
        }, delay);
      });
    });
  }

  // ─── Модальное окно синхронизации (DOM helpers) ───
  var syncModalEl = null;

  function createSyncModal() {
    if (syncModalEl) return syncModalEl;
    syncModalEl = document.createElement('div');
    syncModalEl.id = 'syncModal';
    syncModalEl.className = 'levelModal hidden';
    syncModalEl.setAttribute('aria-hidden', 'true');
    syncModalEl.innerHTML =
      '<div class="levelModal__backdrop"></div>' +
      '<div class="levelModal__panel" role="dialog" aria-modal="true">' +
        '<div class="levelModal__title" id="syncModalTitle">Синхронизация...</div>' +
        '<div class="levelModal__line" id="syncModalMessage"></div>' +
        '<div class="levelModal__actions" style="display:flex;gap:10px;justify-content:center;margin-top:12px">' +
          '<button id="syncRetryBtn" class="btn btnPrimary" type="button" style="display:none">Повторить</button>' +
          '<button id="syncCancelBtn" class="btn btnSecondary" type="button" style="display:none">Отмена</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(syncModalEl);
    return syncModalEl;
  }

  function showSyncModal(titleText, messageText, showButtons) {
    var modal = createSyncModal();
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    var title = document.getElementById('syncModalTitle');
    var message = document.getElementById('syncModalMessage');
    var retryBtn = document.getElementById('syncRetryBtn');
    var cancelBtn = document.getElementById('syncCancelBtn');
    if (title) title.textContent = titleText || 'Синхронизация...';
    if (message) message.textContent = messageText || '';
    if (retryBtn) retryBtn.style.display = showButtons ? '' : 'none';
    if (cancelBtn) cancelBtn.style.display = showButtons ? '' : 'none';
  }

  function hideSyncModal() {
    if (syncModalEl) {
      syncModalEl.classList.add('hidden');
      syncModalEl.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Вычислить elapsed с момента lastSeenAt.
   * @param {number} [lastSeenAt]
   * @returns {number} elapsedMs, >= 0
   */
  function getElapsedMs(lastSeenAt) {
    if (lastSeenAt == null || !Number.isFinite(lastSeenAt)) return 0;
    return Math.max(0, Date.now() - lastSeenAt);
  }

  /**
   * Нужно ли показать модалку офлайн при нажатии «Продолжить».
   * @param {number} [lastSeenAt]
   * @returns {boolean}
   */
  function shouldShowOfflineModal(lastSeenAt) {
    return getElapsedMs(lastSeenAt) > OFFLINE_THRESHOLD_MS;
  }

  /**
   * При нажатии «Продолжить»:
   * 1) Показать индикатор «Синхронизация...»
   * 2) syncProgressBlocking → при success → закрыть и продолжить
   * 3) При ошибке → показать модальное с Retry/Cancel
   *
   * @param {object} state — текущий state
   * @param {{ lastSeenAt?: number }} meta
   * @param {function} onCloseMenu
   * @param {function} onShowOfflineModal — вызвать с { coins, xp, onConfirm }
   */
  function onContinueClick(state, meta, onCloseMenu, onShowOfflineModal) {
    // If sync is disabled, skip directly to continue flow
    if (!SYNC_ENABLED) {
      console.log('[ContinueFlow] Sync disabled, proceeding without server sync');
      var elapsed = getElapsedMs(meta && meta.lastSeenAt);
      if (elapsed <= OFFLINE_THRESHOLD_MS) {
        onCloseMenu();
        return;
      }
      var rewards = computeOfflineRewards(state, elapsed);
      onCloseMenu();
      if (!rewards || (rewards.coins <= 0 && rewards.xp <= 0)) return;
      if (onShowOfflineModal) onShowOfflineModal({ coins: rewards.coins, xp: rewards.xp });
      return;
    }

    var clientSyncId = generateSyncId();
    var Storage = global.Game && global.Game.Storage;
    var payload = {
      clientSyncId: clientSyncId,
      state: Storage && Storage.serializeState ? Storage.serializeState(state) : state,
      timestamp: Date.now(),
    };

    console.log('[ContinueFlow] Sync attempt, clientSyncId:', clientSyncId);
    showSyncModal('Синхронизация...', 'Отправка прогресса на сервер...', false);

    function doSync() {
      syncProgressBlocking(SYNC_ENDPOINT, payload, DEFAULT_TIMEOUT).then(function (result) {
        console.log('[ContinueFlow] Sync result:', result, 'clientSyncId:', clientSyncId);

        if (result.status === 'ok') {
          hideSyncModal();
          // Успех — продолжаем
          var elapsed = getElapsedMs(meta && meta.lastSeenAt);
          if (elapsed <= OFFLINE_THRESHOLD_MS) {
            onCloseMenu();
            return;
          }
          var rewards = computeOfflineRewards(state, elapsed);
          onCloseMenu();
          if (!rewards || (rewards.coins <= 0 && rewards.xp <= 0)) return;
          if (onShowOfflineModal) onShowOfflineModal({ coins: rewards.coins, xp: rewards.xp });
          return;
        }

        // Ошибка — показать retry/cancel
        showSyncModal(
          'Ошибка синхронизации',
          result.message || 'Не удалось синхронизировать прогресс',
          true
        );

        var retryBtn = document.getElementById('syncRetryBtn');
        var cancelBtn = document.getElementById('syncCancelBtn');
        var retryCount = 0;

        function handleRetry() {
          retryCount++;
          if (retryCount >= MAX_RETRIES) {
            showSyncModal(
              'Ошибка синхронизации',
              'Превышено число попыток. Попробуйте позже или обратитесь в поддержку.',
              false
            );
            if (cancelBtn) cancelBtn.style.display = '';
            // Снимаем обработчик retry
            if (retryBtn) {
              retryBtn.style.display = 'none';
              retryBtn.removeEventListener('click', handleRetry);
            }
            return;
          }
          showSyncModal('Синхронизация...', 'Повторная попытка #' + (retryCount + 1) + '...', false);
          doSync();
        }

        function handleCancel() {
          hideSyncModal();
          // Остаёмся в меню — ничего не делаем
          if (retryBtn) retryBtn.removeEventListener('click', handleRetry);
          if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
        }

        if (retryBtn) {
          retryBtn.removeEventListener('click', handleRetry);
          retryBtn.addEventListener('click', handleRetry);
        }
        if (cancelBtn) {
          cancelBtn.removeEventListener('click', handleCancel);
          cancelBtn.addEventListener('click', handleCancel);
        }
      });
    }

    doSync();
  }

  global.Game = global.Game || {};
  global.Game.ContinueFlow = {
    getElapsedMs: getElapsedMs,
    shouldShowOfflineModal: shouldShowOfflineModal,
    onContinueClick: onContinueClick,
    syncProgressBlocking: syncProgressBlocking,
    syncWithRetry: syncWithRetry,
    generateSyncId: generateSyncId,
    OFFLINE_THRESHOLD_MS: OFFLINE_THRESHOLD_MS,
    DEFAULT_TIMEOUT: DEFAULT_TIMEOUT,
    MAX_RETRIES: MAX_RETRIES,
    SYNC_ENDPOINT: SYNC_ENDPOINT,
  };
})(typeof window !== 'undefined' ? window : this);
