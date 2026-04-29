(function (global) {
  'use strict';

  function createElement(documentObj, tagName, options) {
    const opts = options || {};
    const namespace = typeof opts.namespace === 'string' ? opts.namespace : '';
    const element = namespace
      ? documentObj.createElementNS(namespace, tagName)
      : documentObj.createElement(tagName);
    if (opts.id) element.id = opts.id;
    if (opts.className) {
      if (namespace) element.setAttribute('class', opts.className);
      else element.className = opts.className;
    }
    if (opts.type && !namespace) element.type = opts.type;
    if (opts.textContent != null) element.textContent = opts.textContent;
    if (opts.attributes && typeof opts.attributes === 'object') {
      const keys = Object.keys(opts.attributes);
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        element.setAttribute(key, opts.attributes[key]);
      }
    }
    return element;
  }

  function appendChildren(parent, children) {
    if (!parent || !Array.isArray(children)) return parent;
    for (let index = 0; index < children.length; index++) {
      if (children[index]) parent.appendChild(children[index]);
    }
    return parent;
  }

  function ensureOverlay(options) {
    const opts = options || {};
    const documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    if (!documentObj || !documentObj.body || typeof documentObj.createElement !== 'function') return null;
    const mountEl = opts.mountEl && typeof opts.mountEl.appendChild === 'function'
      ? opts.mountEl
      : documentObj.body;

    const existing = documentObj.getElementById('talentOverlay');
    if (existing) {
      if (existing.parentNode !== mountEl) mountEl.appendChild(existing);
      return existing;
    }

    const translate = typeof opts.translate === 'function'
      ? opts.translate
      : function (key, fallback) { return fallback || key || ''; };
    const getBranchLabel = typeof opts.getBranchLabel === 'function'
      ? opts.getBranchLabel
      : function (branchId) { return String(branchId || ''); };
    const branchIds = Array.isArray(opts.branchIds) ? opts.branchIds : [];
    const onRequestClose = typeof opts.onRequestClose === 'function' ? opts.onRequestClose : function () {};
    const onApply = typeof opts.onApply === 'function' ? opts.onApply : function () {};
    const onResetAll = typeof opts.onResetAll === 'function' ? opts.onResetAll : function () {};
    const onUseActiveAbility = typeof opts.onUseActiveAbility === 'function' ? opts.onUseActiveAbility : function () {};
    const onResetBranch = typeof opts.onResetBranch === 'function' ? opts.onResetBranch : function () {};

    const overlay = createElement(documentObj, 'div', {
      id: 'talentOverlay',
      className: 'overlay hidden',
    });

    const modal = createElement(documentObj, 'div', {
      className: 'modal talentTreeModal',
      attributes: {
        role: 'dialog',
        'aria-modal': 'true',
      },
    });
    overlay.appendChild(modal);

    const header = createElement(documentObj, 'div', { className: 'modalHeader talentOverlayHeader' });
    const title = createElement(documentObj, 'div', {
      className: 'modalTitle',
      textContent: translate('talentTreeTitle', 'Upgrade Tree'),
    });
    const closeBtn = createElement(documentObj, 'button', {
      className: 'modalClose talentOverlayClose',
      type: 'button',
      textContent: '✕',
      attributes: {
        'aria-label': translate('menuClose', 'Close'),
      },
    });
    appendChildren(header, [title, closeBtn]);

    const body = createElement(documentObj, 'div', { className: 'modalBody talentTreeBody' });
    const branchesWrap = createElement(documentObj, 'div', {
      className: 'talentBranches',
      id: 'talentBranches',
    });
    body.appendChild(branchesWrap);

    const footer = createElement(documentObj, 'div', { className: 'talentFooter' });
    const summary = createElement(documentObj, 'div', {
      className: 'talentSummary',
      id: 'talentSummary',
    });
    const abilitySlots = createElement(documentObj, 'div', {
      className: 'talentAbilitySlots',
      id: 'talentAbilitySlots',
    });
    for (let branchIndex = 0; branchIndex < 3; branchIndex++) {
      const abilityButton = createElement(documentObj, 'button', {
        id: 'talentActive' + String(branchIndex),
        className: 'btn talentAbilitySlot',
        type: 'button',
        attributes: {
          'data-branch': String(branchIndex),
          title: '',
          'aria-label': 'Active ' + String(branchIndex),
        },
      });
      abilityButton.addEventListener('click', function () {
        onUseActiveAbility(branchIndex);
      });
      abilitySlots.appendChild(abilityButton);
    }

    const actions = createElement(documentObj, 'div', { className: 'talentActions' });
    const applyBtn = createElement(documentObj, 'button', {
      id: 'talentApply',
      className: 'btn btnPrimary',
      type: 'button',
      textContent: translate('talentApply', 'Apply'),
      attributes: {
        disabled: 'disabled',
      },
    });
    const resetAllBtn = createElement(documentObj, 'button', {
      id: 'talentResetAll',
      className: 'btn btnSecondary',
      type: 'button',
      textContent: translate('talentResetAll', 'Reset'),
    });
    applyBtn.addEventListener('click', onApply);
    resetAllBtn.addEventListener('click', onResetAll);
    appendChildren(actions, [applyBtn, resetAllBtn]);
    appendChildren(footer, [summary, abilitySlots, actions]);

    appendChildren(modal, [header, body, footer]);

    overlay.addEventListener('click', function (event) {
      if (event && event.target === overlay) onRequestClose();
    });
    closeBtn.addEventListener('click', onRequestClose);

    for (let branchIndex = 0; branchIndex < branchIds.length; branchIndex++) {
      const branchId = branchIds[branchIndex];
      const column = createElement(documentObj, 'div', {
        className: 'talentBranch',
        attributes: {
          'data-branch-id': branchId,
          'data-branch': String(branchIndex),
        },
      });

      const branchHeader = createElement(documentObj, 'div', { className: 'talentBranchHeader' });
      const branchTitle = createElement(documentObj, 'span', {
        className: 'talentBranchTitle',
        textContent: getBranchLabel(branchId),
      });
      const branchPoints = createElement(documentObj, 'span', {
        className: 'talentBranchPoints',
        id: 'branchPointsV2-' + branchId,
        textContent: '0',
      });
      appendChildren(branchHeader, [branchTitle, branchPoints]);

      const treeContainer = createElement(documentObj, 'div', { className: 'talentTreeContainer' });
      const treeSvg = createElement(documentObj, 'svg', {
        namespace: 'http://www.w3.org/2000/svg',
        className: 'talentTreeSvg',
        id: 'talentSvgV2-' + branchId,
        attributes: {
          'aria-hidden': 'true',
        },
      });
      const treeGrid = createElement(documentObj, 'div', {
        className: 'talentTreeGrid',
        id: 'talentGridV2-' + branchId,
      });
      if (treeGrid.style && typeof treeGrid.style.setProperty === 'function') {
        treeGrid.style.setProperty('--rows', '7');
      } else {
        treeGrid.setAttribute('style', '--rows: 7');
      }
      appendChildren(treeContainer, [treeSvg, treeGrid]);

      const branchReset = createElement(documentObj, 'button', {
        className: 'btn btnSecondary talentBranchReset',
        type: 'button',
        textContent: translate('talentReset', 'Reset branch'),
        attributes: {
          'data-branch-id': branchId,
        },
      });
      branchReset.addEventListener('click', function () {
        onResetBranch(branchId);
      });

      appendChildren(column, [branchHeader, treeContainer, branchReset]);
      branchesWrap.appendChild(column);
    }

    mountEl.appendChild(overlay);
    return overlay;
  }

  global.Game = global.Game || {};
  global.Game.TalentOverlayDom = {
    ensure: ensureOverlay,
  };
})(typeof window !== 'undefined' ? window : this);