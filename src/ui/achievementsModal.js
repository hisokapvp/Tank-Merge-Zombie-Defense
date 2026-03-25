(function (global) {
  'use strict';

  function createController(options) {
    var opts = options || {};
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    var listEl = opts.listEl || (documentObj ? documentObj.getElementById('achievementsList') : null);
    if (!listEl) return null;

    var translate = typeof opts.translate === 'function'
      ? opts.translate
      : function (key) { return key || ''; };

    var openAchievementId = null;

    function getDescriptionId(achievementId) {
      var safeId = String(achievementId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      return 'achievementDesc_' + safeId;
    }

    function createMetaLine(text) {
      var line = documentObj.createElement('div');
      line.className = 'achievementMeta';
      line.textContent = String(text || '');
      return line;
    }

    function getAchievementDescription(def, target) {
      if (!def || typeof def !== 'object') return '';
      if (typeof def.descKey === 'string' && def.descKey) {
        return translate(def.descKey, '');
      }
      if (def.progressType === 'merges') {
        return translate('achievementDescriptionMergeTanks', { target: target });
      }
      if (def.progressType === 'purchases') {
        return translate('achievementDescriptionCreateTanks', { target: target });
      }
      return '';
    }

    function applyExpandedState() {
      var rows = listEl.querySelectorAll('.achievementRow[data-achievement-id]');
      var hasOpenRow = false;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var rowId = row.getAttribute('data-achievement-id');
        var isOpen = openAchievementId !== null && rowId === openAchievementId;
        if (isOpen) hasOpenRow = true;

        row.classList.toggle('is-open', isOpen);

        var desc = row.querySelector('.achievementDescriptionRow');
        if (desc) {
          desc.classList.toggle('is-collapsed', !isOpen);
          desc.setAttribute('aria-hidden', (!isOpen).toString());
        }

        var toggleBtn = row.querySelector('.achievementToggleBtn[data-achievement-toggle]');
        if (toggleBtn) {
          toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          toggleBtn.textContent = isOpen ? '−' : '+';
        }
      }
      if (!hasOpenRow) openAchievementId = null;
    }

    function toggleAchievementById(achievementId) {
      var id = String(achievementId || '');
      if (!id) return;
      openAchievementId = (openAchievementId === id) ? null : id;
      applyExpandedState();
    }

    function onListClick(event) {
      if (!event || !event.target || typeof event.target.closest !== 'function') return;
      var toggleBtn = event.target.closest('.achievementToggleBtn[data-achievement-toggle]');
      if (!toggleBtn || !listEl.contains(toggleBtn)) return;
      var achievementId = toggleBtn.getAttribute('data-achievement-toggle');
      toggleAchievementById(achievementId);
    }

    function renderList(params) {
      var input = params || {};
      var defs = Array.isArray(input.defs) ? input.defs : [];
      var unlocked = input.unlocked && typeof input.unlocked === 'object' ? input.unlocked : {};
      var getProgress = typeof input.getProgress === 'function'
        ? input.getProgress
        : function () { return 0; };

      listEl.innerHTML = '';

      for (var i = 0; i < defs.length; i++) {
        var def = defs[i] || {};
        var id = String(def.id || '');
        if (!id) continue;

        var done = !!unlocked[id];
        var target = Number.isFinite(def.target) ? Math.max(0, Math.floor(def.target)) : 0;
        var displayTarget = Number.isFinite(def.displayTarget) ? Math.max(0, Math.floor(def.displayTarget)) : target;
        var progressRaw = Number(getProgress(def));
        if (!Number.isFinite(progressRaw)) progressRaw = 0;
        var progress = Math.max(0, Math.min(displayTarget, Math.floor(progressRaw)));

        var row = documentObj.createElement('div');
        row.className = 'achievementRow' + (done ? ' done' : '');
        row.setAttribute('data-achievement-id', id);

        var headerRow = documentObj.createElement('div');
        headerRow.className = 'achievementHeaderRow';

        var titleEl = documentObj.createElement('div');
        titleEl.className = 'achievementName';
        titleEl.textContent = translate(def.titleKey);

        var doneBadge = null;
        if (done) {
          doneBadge = documentObj.createElement('span');
          doneBadge.className = 'achievementDoneBadge';
          doneBadge.textContent = translate('achievementStatusDone');
        }

        var toggleBtn = documentObj.createElement('button');
        toggleBtn.className = 'achievementToggleBtn';
        toggleBtn.type = 'button';
        toggleBtn.textContent = '+';
        toggleBtn.setAttribute('data-achievement-toggle', id);
        toggleBtn.setAttribute('aria-expanded', 'false');
        var descId = getDescriptionId(id);
        toggleBtn.setAttribute('aria-controls', descId);
        toggleBtn.setAttribute('aria-label', titleEl.textContent || '+');

        headerRow.appendChild(titleEl);
        if (doneBadge) headerRow.appendChild(doneBadge);
        headerRow.appendChild(toggleBtn);

        var descRow = documentObj.createElement('div');
        descRow.className = 'achievementDescriptionRow is-collapsed';
        descRow.id = descId;
        descRow.setAttribute('aria-hidden', 'true');

        var description = getAchievementDescription(def, displayTarget);
        if (description) descRow.appendChild(createMetaLine(description));
        var fmt = (global.Game && global.Game.NumberFormat && typeof global.Game.NumberFormat.formatCompactRu === 'function')
          ? global.Game.NumberFormat.formatCompactRu
          : function (n) { return String(n); };
        descRow.appendChild(createMetaLine(translate('achievementProgress', { value: fmt(progress), target: fmt(displayTarget) })));
        descRow.appendChild(createMetaLine(translate('achievementReward', { reward: translate(def.rewardKey) })));

        row.appendChild(headerRow);
        row.appendChild(descRow);
        listEl.appendChild(row);
      }

      applyExpandedState();
    }

    function collapseAll() {
      openAchievementId = null;
      applyExpandedState();
    }

    listEl.addEventListener('click', onListClick);

    return {
      renderList: renderList,
      collapseAll: collapseAll,
    };
  }

  global.Game = global.Game || {};
  global.Game.AchievementsModal = {
    createController: createController,
  };
})(typeof window !== 'undefined' ? window : this);
