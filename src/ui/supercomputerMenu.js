(function (global) {
  'use strict';

  var WEAPON_ICON_ROT_DEG = -90;
  var sharedHelpModalEl = null;

  function fallbackHelpTranslate(_key, fallback) {
    return typeof fallback === 'string' ? fallback : '';
  }

  function getHelpLines(text) {
    if (typeof text !== 'string' || !text) return [];
    return text
      .split(/\r?\n/)
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return !!line; });
  }

  function appendHelpParagraphs(container, text) {
    if (!container || typeof text !== 'string' || !text) return;
    text
      .split(/\n{2,}/)
      .map(function (part) { return part.trim(); })
      .filter(function (part) { return !!part; })
      .forEach(function (part) {
        var paragraph = container.ownerDocument.createElement('p');
        paragraph.className = 'techModal__paragraph';
        paragraph.textContent = part;
        container.appendChild(paragraph);
      });
  }

  function appendHelpSectionContent(container, text) {
    if (!container) return;
    var lines = getHelpLines(text);
    if (!lines.length) return;
    if (lines.length === 1) {
      appendHelpParagraphs(container, lines[0]);
      return;
    }
    var list = container.ownerDocument.createElement('ul');
    list.className = 'techModal__list techModal__list--help';
    lines.forEach(function (line) {
      var item = container.ownerDocument.createElement('li');
      item.className = 'techModal__listItem techModal__listItem--help';
      item.textContent = line;
      list.appendChild(item);
    });
    container.appendChild(list);
  }

  function toggleSharedHelpSection(button) {
    if (!button || !button.ownerDocument) return;
    var expanded = button.getAttribute('aria-expanded') === 'true';
    var panelId = button.getAttribute('aria-controls');
    var panel = panelId ? button.ownerDocument.getElementById(panelId) : null;
    var nextExpanded = !expanded;
    button.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
    button.classList.toggle('is-expanded', nextExpanded);
    if (panel) {
      panel.hidden = !nextExpanded;
      panel.setAttribute('aria-hidden', nextExpanded ? 'false' : 'true');
    }
    var marker = button.querySelector('.techModal__accordionMarker');
    if (marker) marker.textContent = nextExpanded ? '−' : '+';
  }

  function populateSharedHelpContent(container, cfg, translate) {
    if (!container) return;
    var introText = translate(cfg.introKey || cfg.textKey, '');
    appendHelpParagraphs(container, introText);

    var sections = Array.isArray(cfg.sections) ? cfg.sections : [];
    if (!sections.length) return;

    var accordion = container.ownerDocument.createElement('div');
    accordion.className = 'techModal__accordion';
    sections.forEach(function (section, index) {
      var sectionTitle = translate(section.titleKey, section.title || '');
      var sectionText = translate(section.textKey, section.text || '');
      if (!sectionTitle && !sectionText) return;

      var sectionEl = container.ownerDocument.createElement('section');
      sectionEl.className = 'techModal__accordionSection';

      var button = container.ownerDocument.createElement('button');
      var panelId = 'supercomputerHelpSection' + index;
      button.type = 'button';
      button.className = 'techModal__accordionToggle uiButtonBehavior';
      button.setAttribute('data-sc-help-toggle', 'true');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', panelId);

      var titleSpan = container.ownerDocument.createElement('span');
      titleSpan.className = 'techModal__accordionTitle';
      titleSpan.textContent = sectionTitle;

      var markerSpan = container.ownerDocument.createElement('span');
      markerSpan.className = 'techModal__accordionMarker';
      markerSpan.setAttribute('aria-hidden', 'true');
      markerSpan.textContent = '+';

      button.appendChild(titleSpan);
      button.appendChild(markerSpan);

      var panel = container.ownerDocument.createElement('div');
      panel.id = panelId;
      panel.className = 'techModal__accordionPanel';
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
      appendHelpSectionContent(panel, sectionText);

      sectionEl.appendChild(button);
      sectionEl.appendChild(panel);
      accordion.appendChild(sectionEl);
    });

    if (accordion.childElementCount) container.appendChild(accordion);
  }

  function ensureSharedHelpModal(documentObj) {
    if (!documentObj || !documentObj.body) return null;
    if (sharedHelpModalEl && sharedHelpModalEl.ownerDocument === documentObj && sharedHelpModalEl.isConnected) {
      return sharedHelpModalEl;
    }
    sharedHelpModalEl = documentObj.createElement('div');
    sharedHelpModalEl.className = 'techModal__backdrop';
    sharedHelpModalEl.style.display = 'none';
    sharedHelpModalEl.setAttribute('aria-hidden', 'true');
    sharedHelpModalEl.addEventListener('click', function (evt) {
      var toggleTarget = evt && evt.target && evt.target.closest ? evt.target.closest('[data-sc-help-toggle]') : null;
      if (toggleTarget) {
        toggleSharedHelpSection(toggleTarget);
        return;
      }
      var closeTarget = evt && evt.target && evt.target.closest ? evt.target.closest('[data-sc-help-close]') : null;
      if (closeTarget || evt.target === sharedHelpModalEl) hideSharedHelpModal();
    });
    documentObj.body.appendChild(sharedHelpModalEl);
    return sharedHelpModalEl;
  }

  function hideSharedHelpModal() {
    if (!sharedHelpModalEl) return;
    sharedHelpModalEl.style.display = 'none';
    sharedHelpModalEl.setAttribute('aria-hidden', 'true');
    sharedHelpModalEl.innerHTML = '';
  }

  function syncSharedHelpButtonCopy(button, labelKey, translateFn) {
    if (!button) return;
    var translate = typeof translateFn === 'function' ? translateFn : fallbackHelpTranslate;
    var label = translate(labelKey, translate('techUnlockHelpTitle', 'Help'));
    button.setAttribute('aria-label', label);
    button.setAttribute('data-ui-tooltip', label);
    button.removeAttribute('title');
  }

  function showSharedHelpModal(config) {
    var cfg = config || {};
    var documentObj = cfg.documentObj || (typeof document !== 'undefined' ? document : null);
    if (!documentObj) return;
    var translate = typeof cfg.translate === 'function' ? cfg.translate : fallbackHelpTranslate;
    var modal = ensureSharedHelpModal(documentObj);
    if (!modal) return;
    var closeLabel = translate('techUnlockHelpClose', 'Close');
    var title = translate(cfg.titleKey || 'techUnlockHelpTitle', 'Help');
    var sectionTitle = translate(cfg.sectionTitleKey || cfg.titleKey || 'techUnlockHelpTitle', title);
    modal.innerHTML = '<div class="techModal__dialog techModal__dialog--wide techModal__dialog--craft techModal__dialog--help" role="dialog" aria-modal="true" aria-labelledby="supercomputerHelpTitle">'
      + '<button class="modalClose scModal__close techModal__close uiButtonBehavior" data-sc-help-close="true" type="button" aria-label="' + closeLabel + '"></button>'
      + '<div class="techModal__title techModal__title--help" id="supercomputerHelpTitle">' + title + '</div>'
      + '<div class="techModal__subtitle techModal__subtitle--help">' + sectionTitle + '</div>'
      + '<div class="techModal__text techModal__text--help"></div>'
      + '<div class="techModal__btns"><button class="btn scButton uiButtonBehavior techModal__noBtn" data-sc-help-close="true" type="button">' + closeLabel + '</button></div>'
      + '</div>';
    var textEl = modal.querySelector('.techModal__text--help');
    if (textEl) populateSharedHelpContent(textEl, cfg, translate);
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    if (global.Game && global.Game.ButtonBehavior && typeof global.Game.ButtonBehavior.decorateTree === 'function') {
      global.Game.ButtonBehavior.decorateTree(modal);
    }
    var closeBtn = modal.querySelector('[data-sc-help-close="true"]');
    if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
  }

  function setOverlayOpen(overlay, open, a11yOpen, a11yClose, options) {
    if (!overlay) return;
    var nextOpen = !!open;
    var wasOpen = !overlay.classList.contains('hidden') && overlay.getAttribute('aria-hidden') !== 'true';
    overlay.classList.toggle('hidden', !nextOpen);
    overlay.setAttribute('aria-hidden', (!nextOpen).toString());
    if (nextOpen) {
      if (!wasOpen && typeof a11yOpen === 'function') a11yOpen(overlay, options || {});
      return;
    }
    if (wasOpen && typeof a11yClose === 'function') a11yClose(overlay);
  }

  function createController(options) {
    var opts = options || {};
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    if (!documentObj) return null;

    var rootOverlay = documentObj.getElementById('supercomputerMenuOverlay');
    var hangarOverlay = documentObj.getElementById('modsHangarOverlay');
    var tankWallOverlay = documentObj.getElementById('modsTankWallOverlay');
    var rootPanel = rootOverlay ? rootOverlay.querySelector('.levelModal__panel.scModal') : null;
    var hangarPanel = hangarOverlay ? hangarOverlay.querySelector('.levelModal__panel.scModal') : null;
    var tankWallPanel = tankWallOverlay ? tankWallOverlay.querySelector('.levelModal__panel.scModal') : null;
    var rootView = documentObj.getElementById('supercomputerMenuRootView');
    var talentsView = documentObj.getElementById('supercomputerTalentsView');

    if (!rootOverlay || !hangarOverlay || !tankWallOverlay) return null;

    var a11yOpen = opts.a11yOpen;
    var a11yClose = opts.a11yClose;
    var onPauseLockChange = typeof opts.onPauseLockChange === 'function' ? opts.onPauseLockChange : function () {};
    var onViewChange = typeof opts.onViewChange === 'function' ? opts.onViewChange : function () {};
    var openTalents = typeof opts.openTalents === 'function' ? opts.openTalents : null;
    var closeTalents = typeof opts.closeTalents === 'function' ? opts.closeTalents : null;
    var getDamagePoints = typeof opts.getDamagePoints === 'function' ? opts.getDamagePoints : function () { return 0; };
    var getAppliedCannonUpgradeLevel = typeof opts.getAppliedCannonUpgradeLevel === 'function'
      ? opts.getAppliedCannonUpgradeLevel
      : function () { return 0; };
    var getCannonUpgradeStepCost = typeof opts.getCannonUpgradeStepCost === 'function'
      ? opts.getCannonUpgradeStepCost
      : function (_level, _appliedIndex) { return 0; };
    var getCannonUpgradeIconFrames = typeof opts.getCannonUpgradeIconFrames === 'function'
      ? opts.getCannonUpgradeIconFrames
      : function () { return 1; };
    var getCannonUpgradeIconFps = typeof opts.getCannonUpgradeIconFps === 'function'
      ? opts.getCannonUpgradeIconFps
      : function () { return 8; };
    var getCannonUpgradeConfig = typeof opts.getCannonUpgradeConfig === 'function'
      ? opts.getCannonUpgradeConfig
      : function () { return []; };
    var applyCannonUpgrade = typeof opts.applyCannonUpgrade === 'function'
      ? opts.applyCannonUpgrade
      : function () { return { ok: false }; };
    var getDronRuntimeConfig = typeof opts.getDronRuntimeConfig === 'function'
      ? opts.getDronRuntimeConfig
      : function () { return { levels: {}, maxLevel: 1, animations: {} }; };
    var getDronLevelsCount = typeof opts.getDronLevelsCount === 'function'
      ? opts.getDronLevelsCount
      : function () { return 1; };
    var getDronStatsForLevel = typeof opts.getDronStatsForLevel === 'function'
      ? opts.getDronStatsForLevel
      : function () { return { moveSpeedPxSec: 0, repairSpeedMult: 0, costMult: 0 }; };
    var getAppliedDronUpgradeLevel = typeof opts.getAppliedDronUpgradeLevel === 'function'
      ? opts.getAppliedDronUpgradeLevel
      : function () { return 0; };
    var getDronUpgradeStepCost = typeof opts.getDronUpgradeStepCost === 'function'
      ? opts.getDronUpgradeStepCost
      : function (_level, _appliedIndex) { return 0; };
    var getDronUpgradeIconFrames = typeof opts.getDronUpgradeIconFrames === 'function'
      ? opts.getDronUpgradeIconFrames
      : function () { return 1; };
    var getDronUpgradeIconFps = typeof opts.getDronUpgradeIconFps === 'function'
      ? opts.getDronUpgradeIconFps
      : function () { return 8; };
    var applyDronUpgrade = typeof opts.applyDronUpgrade === 'function'
      ? opts.applyDronUpgrade
      : function () { return { ok: false }; };
    var getFenceStats = typeof opts.getFenceStats === 'function' ? opts.getFenceStats : function () {
      return {
        level: 1,
        segmentMaxHp: 0,
        armorFlat: 0,
        hasNextLevel: false,
        canUpgrade: false,
        upgradeCostDamagePoints: null,
      };
    };
    var getFenceLevels = typeof opts.getFenceLevels === 'function' ? opts.getFenceLevels : function () { return []; };
    var getFenceConfig = typeof opts.getFenceConfig === 'function' ? opts.getFenceConfig : function () { return {}; };
    var getFenceStatsForLevel = typeof opts.getFenceStatsForLevel === 'function' ? opts.getFenceStatsForLevel : function () { return { baseHp: 0, baseArmor: 0, currentHp: 0, currentArmor: 0 }; };
    var getAppliedFenceUpgradeLevel = typeof opts.getAppliedFenceUpgradeLevel === 'function' ? opts.getAppliedFenceUpgradeLevel : function () { return 0; };
    var getFenceUpgradeStepCost = typeof opts.getFenceUpgradeStepCost === 'function' ? opts.getFenceUpgradeStepCost : function (_level, _statKey, _appliedIndex) { return 0; };
    var applyFenceUpgrade = typeof opts.applyFenceUpgrade === 'function' ? opts.applyFenceUpgrade : function () { return { ok: false }; };
    var upgradeFence = typeof opts.upgradeFence === 'function' ? opts.upgradeFence : function () { return false; };
    var translate = typeof opts.translate === 'function' ? opts.translate : function (_, vars) {
      var key = _ || '';
      if (key === 'modsGunsColType') return 'Cannon';
      if (key === 'modsGunsColLevel') return 'Lvl';
      if (key === 'modsGunsColAttackSpeed') return 'Attack speed';
      if (key === 'modsGunsColDamage') return 'Damage';
      if (key === 'modsGunsColUpgradeLevel') return 'Upgrade level';
      if (key === 'modsGunsColCost') return 'Cost';
      if (key === 'modsGunsColActions') return 'Actions';
      if (key === 'modsGunsUpgrade') return 'Upgrade';
      if (key === 'modsGunsReservedLabel') return 'Reserved points: ' + (vars && vars.count != null ? vars.count : 0);
      if (key === 'modsGunsNotEnoughDamagePoints') return 'Not enough damage points';
      if (key === 'modsGunsNoSprite') return 'No sprite';
      if (key === 'modsTabDrones') return 'Drones';
      if (key === 'modsDronesColMoveSpeed') return 'Move speed';
      if (key === 'modsDronesColRepairSpeed') return 'Repair speed';
      if (key === 'modsDronesColCostMult') return 'Cost mult';
      if (key === 'modsDronesUpgrade') return 'Upgrade';
      if (key === 'modsTabWalls') return 'Walls';
      if (key === 'modsWallsLevelLabel') return 'Wall level: ' + (vars && vars.level != null ? vars.level : 1);
      if (key === 'modsWallsSegmentHpLabel') return 'Segment HP: ' + (vars && vars.hp != null ? vars.hp : 0);
      if (key === 'modsWallsArmorLabel') return 'Armor: ' + (vars && vars.armor != null ? vars.armor : 0);
      if (key === 'modsWallsUpgradesLabel') return 'Upgrades';
      if (key === 'modsWallsCostLabel') return 'Cost';
      if (key === 'modsWallsActionLabel') return 'Action';
      if (key === 'modsWallsUpgradeCost') return 'Upgrade (' + (vars && vars.cost != null ? vars.cost : 0) + ')';
      if (key === 'modsWallsUpgradeMax') return 'Max level';
      if (key === 'modsWallsUpgrade') return 'Upgrade';
        if (key === 'talentApply') return 'Apply';
      if (key === 'techUnlockHelpTitle') return 'Help';
      if (key === 'techUnlockHelpClose') return 'Close';
      if (key === 'supercomputerTalentsHelpButton') return 'Upgrade tree help';
      if (key === 'supercomputerTalentsHelpText') return 'In this section, using upgrade points, you can improve the Supercomputer and increase your combat, defense, and economy potential';
      if (key === 'supercomputerTankWallHelpButton') return 'Tank and wall mods help';
      if (key === 'supercomputerTankWallHelpText') return 'In this section you can upgrade tank guns, drones, and defensive walls, improving their stats. Upgrades are applied immediately and affect all upgraded elements. Upgrade bonuses only apply within the upgraded level of tanks, drones, or walls.';
      if (key === 'modsTankWallTitle') return 'Tank and Wall Mods';
      if (key === 'talentTreeTitle') return 'Upgrade Tree';
      return 'Damage points: ' + (vars && vars.count != null ? vars.count : 0);
    };

    var tankWallStatCatalog = global.Game && global.Game.TankWallStatCatalog ? global.Game.TankWallStatCatalog : null;

    function cloneRenderStatDescriptors(stats) {
      var result = [];
      if (!Array.isArray(stats)) return result;
      for (var i = 0; i < stats.length; i++) {
        var source = stats[i];
        if (!source || typeof source.statKey !== 'string' || !source.statKey) continue;
        result.push({
          statKey: source.statKey,
          label: typeof source.label === 'string' ? source.label : source.statKey,
        });
      }
      return result;
    }

    function getTankWallStorageKeys(tabKey, fallbackKeys) {
      if (tankWallStatCatalog && typeof tankWallStatCatalog.getStorageKeys === 'function') {
        var keys = tankWallStatCatalog.getStorageKeys(tabKey);
        if (Array.isArray(keys) && keys.length) return keys;
      }
      return Array.isArray(fallbackKeys) ? fallbackKeys.slice() : [];
    }

    function getTankWallActionAttr(tabKey, fallbackAttr) {
      if (tankWallStatCatalog && typeof tankWallStatCatalog.getActionAttr === 'function') {
        var actionAttr = tankWallStatCatalog.getActionAttr(tabKey);
        if (typeof actionAttr === 'string' && actionAttr) return actionAttr;
      }
      return fallbackAttr;
    }

    function getTankWallRenderStats(tabKey, fallbackStats) {
      if (tankWallStatCatalog && typeof tankWallStatCatalog.getRenderStats === 'function') {
        var catalogStats = tankWallStatCatalog.getRenderStats(tabKey);
        if (Array.isArray(catalogStats) && catalogStats.length) {
          var resolved = [];
          for (var i = 0; i < catalogStats.length; i++) {
            var descriptor = catalogStats[i];
            if (!descriptor || typeof descriptor.statKey !== 'string' || !descriptor.statKey) continue;
            var label = typeof tankWallStatCatalog.getStatLabel === 'function'
              ? tankWallStatCatalog.getStatLabel(tabKey, descriptor.statKey, translate)
              : descriptor.statKey;
            resolved.push({ statKey: descriptor.statKey, label: label || descriptor.statKey });
          }
          if (resolved.length) return resolved;
        }
      }
      return cloneRenderStatDescriptors(fallbackStats);
    }

    function getRenderStatKeys(renderStats, fallbackKeys) {
      var keys = [];
      if (Array.isArray(renderStats)) {
        for (var i = 0; i < renderStats.length; i++) {
          if (!renderStats[i] || typeof renderStats[i].statKey !== 'string' || !renderStats[i].statKey) continue;
          keys.push(renderStats[i].statKey);
        }
      }
      return keys.length ? keys : (Array.isArray(fallbackKeys) ? fallbackKeys.slice() : []);
    }

    function buildTankWallStatCostMap(level, renderStats, appliedByStat, pendingEntry, stepCostGetter) {
      var costByStat = Object.create(null);
      if (!Array.isArray(renderStats)) return costByStat;
      for (var i = 0; i < renderStats.length; i++) {
        var statKey = renderStats[i] && renderStats[i].statKey;
        if (typeof statKey !== 'string' || !statKey) continue;
        var applied = toSafeNonNegativeInt(appliedByStat && appliedByStat[statKey]);
        var pending = toSafeNonNegativeInt(pendingEntry && pendingEntry[statKey]);
        costByStat[statKey] = stepCostGetter(level, statKey, applied + pending);
      }
      return costByStat;
    }

    var CANNON_STAT_KEYS = getTankWallStorageKeys('weapons', ['baseDamage', 'attackSpeed']);
    var DRON_STAT_KEYS = getTankWallStorageKeys('drones', ['moveSpeedPxSec', 'repairSpeedMult', 'costMult']);
    var FENCE_STAT_KEYS = getTankWallStorageKeys('walls', ['segmentMaxHp', 'armorFlat']);

    var state = {
      isOpen: false,
      view: 'closed',
      activeTankWallTab: 'weapons',
      pendingUpgradesByLevel: [],
      pendingDronUpgradesByLevel: [],
      pendingFenceUpgradesByLevel: [],
      expandedTankWallRows: { weapons: 0, drones: 0, walls: 0 },
      iconTickerId: null,
      rootBackdropCloseNeedsFreshPointerDown: false,
      rootBackdropPointerDownSinceOpen: false,
    };

    function isCoarsePointerViewport() {
      try {
        return !!(typeof global.matchMedia === 'function' && global.matchMedia('(hover: none) and (pointer: coarse)').matches);
      } catch (_err) {
        return false;
      }
    }

    function shouldUseFullscreenShell() {
      var viewportWidth = Number(global.innerWidth) || 0;
      return isCoarsePointerViewport() || (viewportWidth > 0 && viewportWidth < 1280);
    }

    function getEmbeddedTalentPanel() {
      var talentOverlay = documentObj.getElementById('talentOverlay');
      return talentOverlay ? talentOverlay.querySelector('.talentTreeModal') : null;
    }

    function toggleResponsiveClass(target, className, enabled) {
      if (!target || !className) return;
      target.classList.toggle(className, !!enabled);
    }

    function applyFullscreenShellState(entry) {
      if (!entry) return;
      toggleResponsiveClass(entry.overlay, 'levelModal--fullscreenShell', entry.enabled);
      toggleResponsiveClass(entry.panel, 'scModal--fullscreenShell', entry.enabled);
      if (entry.embeddedPanel) toggleResponsiveClass(entry.embeddedPanel, 'talentTreeModal--fullscreenShell', entry.enabled);
    }

    function buildFullscreenShellEntries(fullscreen) {
      return [
        {
          enabled: !!fullscreen && state.view === 'talents',
          overlay: rootOverlay,
          panel: rootPanel,
          embeddedPanel: getEmbeddedTalentPanel(),
        },
        {
          enabled: !!fullscreen && state.view === 'hangar',
          overlay: hangarOverlay,
          panel: hangarPanel,
        },
        {
          enabled: !!fullscreen && state.view === 'tankWall',
          overlay: tankWallOverlay,
          panel: tankWallPanel,
        },
      ];
    }

    function syncResponsiveShellState() {
      var fullscreen = shouldUseFullscreenShell();
      var entries = buildFullscreenShellEntries(fullscreen);
      for (var index = 0; index < entries.length; index++) {
        applyFullscreenShellState(entries[index]);
      }
    }

    var tankWallTabButtons = {
      weapons: documentObj.getElementById('modsTankWallTabGuns'),
      drones: documentObj.getElementById('modsTankWallTabDrones'),
      walls: documentObj.getElementById('modsTankWallTabWalls'),
    };

    var tankWallTabPanels = {
      weapons: documentObj.getElementById('modsTankWallPanelGuns'),
      drones: documentObj.getElementById('modsTankWallPanelDrones'),
      walls: documentObj.getElementById('modsTankWallPanelWalls'),
    };

    var gunsUi = {
      root: null,
      points: null,
      reserve: null,
      rows: null,
      initialized: false,
    };
    var wallsUi = {
      root: null,
      points: null,
      reserve: null,
      rows: null,
      initialized: false,
    };
    var dronsUi = {
      root: null,
      points: null,
      reserve: null,
      rows: null,
      initialized: false,
    };
    var gunsSpriteImageCache = Object.create(null);

    function setBodyScrollLock(locked) {
      if (!documentObj.body) return;
      if (locked) documentObj.body.classList.add('scmodal-open');
      else documentObj.body.classList.remove('scmodal-open');
    }

    function armRootBackdropCloseGuard(openOptions) {
      var opts = openOptions || {};
      state.rootBackdropPointerDownSinceOpen = false;
      state.rootBackdropCloseNeedsFreshPointerDown = opts.allowImmediateBackdropClose !== true;
    }

    function noteRootBackdropPointerDown(evt) {
      if (!(evt && evt.target && evt.target.dataset && evt.target.dataset.supercomputerRootClose === 'true')) return;
      state.rootBackdropPointerDownSinceOpen = true;
    }

    function shouldSuppressRootBackdropClose() {
      if (!state.rootBackdropCloseNeedsFreshPointerDown) return false;
      if (state.rootBackdropPointerDownSinceOpen) {
        state.rootBackdropCloseNeedsFreshPointerDown = false;
        return false;
      }
      state.rootBackdropCloseNeedsFreshPointerDown = false;
      return true;
    }

    function applyLayoutTuningVars() {
      var lt = (global.Game && global.Game.Config && global.Game.Config.LayoutTuning) || {};
      var rootEl = documentObj.documentElement;
      if (!rootEl || !rootEl.style) return;
      var tileWidth = Number(lt.supercomputerTileWidthPx);
      if (Number.isFinite(tileWidth) && tileWidth > 0) {
        rootEl.style.setProperty('--scRootTileWidthPx', String(Math.round(tileWidth)) + 'px');
      }
      var tileHeight = Number(lt.supercomputerTileHeightPx);
      if (Number.isFinite(tileHeight) && tileHeight > 0) {
        rootEl.style.setProperty('--scRootTileHeightPx', String(Math.round(tileHeight)) + 'px');
      }
      var tileIconSize = Number(lt.supercomputerTileIconSizePx);
      if (Number.isFinite(tileIconSize) && tileIconSize > 0) {
        rootEl.style.setProperty('--scTileIconSizePx', String(Math.round(tileIconSize)) + 'px');
      }
    }

    function ensureTalentsHeaderActions() {
      if (!rootPanel) return null;
      var headerActions = documentObj.getElementById('supercomputerTalentsHeaderActions');
      if (!headerActions) {
        headerActions = documentObj.createElement('div');
        headerActions.id = 'supercomputerTalentsHeaderActions';
        headerActions.className = 'scModal__headerActions supercomputerTalentsHeaderActions';
      }
      if (headerActions.parentNode !== rootPanel) rootPanel.appendChild(headerActions);
      return headerActions;
    }

    function syncTalentsHeaderActionsVisibility(isTalentsView) {
      var headerActions = documentObj.getElementById('supercomputerTalentsHeaderActions');
      if (!headerActions) return;
      headerActions.hidden = !isTalentsView;
      headerActions.setAttribute('aria-hidden', isTalentsView ? 'false' : 'true');
    }

    function ensureTalentsShellCloseButton(headerActions) {
      if (!headerActions) return null;
      var closeBtn = documentObj.getElementById('supercomputerTalentsShellCloseBtn');
      if (!closeBtn) {
        closeBtn = documentObj.createElement('button');
        closeBtn.id = 'supercomputerTalentsShellCloseBtn';
        closeBtn.type = 'button';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', function (evt) {
          evt.preventDefault();
          evt.stopPropagation();
          backFromChild();
        });
      }
      closeBtn.className = 'levelModal__close scModal__close supercomputerTalentsShellClose';
      closeBtn.setAttribute('data-font-floor-ignore', 'true');
      closeBtn.setAttribute('aria-label', translate('menuClose', 'Close'));
      if (closeBtn.parentNode !== headerActions) headerActions.appendChild(closeBtn);
      return closeBtn;
    }

    function ensureTalentsShellHelpButton(headerActions) {
      if (!headerActions) return null;
      var helpBtn = documentObj.getElementById('supercomputerTalentsHelpBtn');
      if (!helpBtn) {
        helpBtn = documentObj.createElement('button');
        helpBtn.id = 'supercomputerTalentsHelpBtn';
        helpBtn.type = 'button';
        helpBtn.textContent = '?';
        helpBtn.addEventListener('click', function (evt) {
          evt.preventDefault();
          evt.stopPropagation();
          showTechHelpModal({
            sectionTitleKey: 'talentTreeTitle',
            textKey: 'supercomputerTalentsHelpText',
          });
        });
      }
      helpBtn.className = 'btn scButton uiButtonBehavior hangarChipsHelpBtn supercomputerTalentsShellHelp';
      helpBtn.setAttribute('data-font-floor-ignore', 'true');
      if (helpBtn.parentNode !== headerActions) headerActions.appendChild(helpBtn);
      if (global.Game && global.Game.ButtonBehavior && typeof global.Game.ButtonBehavior.decorateTree === 'function') {
        global.Game.ButtonBehavior.decorateTree(helpBtn);
      }
      syncHelpButtonCopy(helpBtn, 'supercomputerTalentsHelpButton');
      return helpBtn;
    }

    function applySharedTalentModalClass() {
      var talentOverlay = documentObj.getElementById('talentOverlay');
      if (!talentOverlay) return;
      var panel = talentOverlay.querySelector('.modal');
      if (!panel) return;
      panel.classList.add('scModal');
      var embeddedCloseBtn = talentOverlay.querySelector('.talentOverlayClose')
        || talentOverlay.querySelector('.modalClose');
      if (embeddedCloseBtn) {
        embeddedCloseBtn.classList.add('levelModal__close');
        embeddedCloseBtn.classList.add('scModal__close');
        embeddedCloseBtn.classList.add('supercomputerTalentsEmbeddedClose');
        embeddedCloseBtn.setAttribute('data-font-floor-ignore', 'true');
      }
      var headerActions = ensureTalentsHeaderActions();
      var helpBtn = ensureTalentsShellHelpButton(headerActions);
      var closeBtn = ensureTalentsShellCloseButton(headerActions);
      if (headerActions && helpBtn) headerActions.appendChild(helpBtn);
      if (headerActions && closeBtn) headerActions.appendChild(closeBtn);
      syncTalentsHeaderActionsVisibility(state.view === 'talents');
    }

    function setRootViewMode(nextMode) {
      var isTalentsView = nextMode === 'talents';
      if (rootView) {
        rootView.classList.toggle('hidden', isTalentsView);
        rootView.setAttribute('aria-hidden', isTalentsView ? 'true' : 'false');
      }
      if (talentsView) {
        talentsView.classList.toggle('hidden', !isTalentsView);
        talentsView.setAttribute('aria-hidden', isTalentsView ? 'false' : 'true');
      }
      if (rootPanel) {
        rootPanel.classList.toggle('scModal--talentsView', isTalentsView);
      }
      syncTalentsHeaderActionsVisibility(isTalentsView);
    }

    function syncHelpButtonCopy(button, labelKey) {
      syncSharedHelpButtonCopy(button, labelKey, translate);
    }

    function showTechHelpModal(config) {
      if (!config) return;
      showSharedHelpModal({
        documentObj: documentObj,
        translate: translate,
        titleKey: config.titleKey,
        sectionTitleKey: config.sectionTitleKey,
        textKey: config.textKey,
      });
    }

    function setTankWallTab(nextTab, options) {
      var tab = nextTab === 'walls' ? 'walls' : (nextTab === 'drones' ? 'drones' : 'weapons');
      state.activeTankWallTab = tab;

      Object.keys(tankWallTabButtons).forEach(function (key) {
        var button = tankWallTabButtons[key];
        if (!button) return;
        var selected = key === tab;
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
        button.setAttribute('tabindex', selected ? '0' : '-1');
      });

      Object.keys(tankWallTabPanels).forEach(function (key) {
        var panel = tankWallTabPanels[key];
        if (!panel) return;
        panel.hidden = key !== tab;
      });

      if (tab === 'weapons') {
        renderGunsPanel();
        startGunsIconTicker();
      } else if (tab === 'drones') {
        renderDronsPanel();
        startGunsIconTicker();
      } else if (tab === 'walls') {
        renderWallsPanel();
        startGunsIconTicker();
      }

      var focusButton = options && options.focusButton;
      if (focusButton) {
        tankWallTabButtons[tab]?.focus();
      }
    }

    function updateDamagePointsLabel() {
      var fmt = (global.Game && global.Game.NumberFormat && typeof global.Game.NumberFormat.formatCompactRu === 'function')
        ? global.Game.NumberFormat.formatCompactRu
        : function (n) { return String(Math.round(n)); };
      var damagePointsEl = documentObj.getElementById('modsTankWallDamagePoints');
      var count = Math.max(0, Math.floor(getDamagePoints()));
      if (damagePointsEl) {
        damagePointsEl.textContent = translate('damagePointsLabel', { count: fmt(count) });
      }
      if (gunsUi.points) {
        gunsUi.points.textContent = translate('damagePointsLabel', { count: fmt(count) });
      }
      if (gunsUi.reserve) {
        gunsUi.reserve.textContent = translate('modsGunsReservedLabel', { count: fmt(getReservedDamagePoints()) });
      }
      if (dronsUi.points) {
        dronsUi.points.textContent = translate('damagePointsLabel', { count: fmt(count) });
      }
      if (dronsUi.reserve) {
        dronsUi.reserve.textContent = translate('modsGunsReservedLabel', { count: fmt(getReservedDronDamagePoints()) });
      }
      if (wallsUi.points) {
        wallsUi.points.textContent = translate('damagePointsLabel', { count: fmt(count) });
      }
      if (wallsUi.reserve) {
        wallsUi.reserve.textContent = translate('modsGunsReservedLabel', { count: fmt(getReservedFenceDamagePoints()) });
      }
    }

    function toSafeNonNegativeInt(value) {
      if (!Number.isFinite(value)) return 0;
      if (value <= 0) return 0;
      if (value >= Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
      return Math.floor(value);
    }

    function createPendingEntry(statKeys) {
      var entry = Object.create(null);
      for (var i = 0; i < statKeys.length; i++) entry[statKeys[i]] = 0;
      return entry;
    }

    function normalizePendingEntry(source, statKeys) {
      var entry = createPendingEntry(statKeys);
      if (!source || typeof source !== 'object') return entry;
      for (var i = 0; i < statKeys.length; i++) {
        var key = statKeys[i];
        entry[key] = toSafeNonNegativeInt(source[key]);
      }
      return entry;
    }

    function getGunsLevelsCount() {
      var cfg = getCannonUpgradeConfig();
      if (!Array.isArray(cfg) || !cfg.length) return 60;
      return Math.max(1, Math.min(60, cfg.length));
    }

    function ensurePendingEntriesSize(list, size, statKeys) {
      var next = Array(size);
      var source = Array.isArray(list) ? list : [];
      for (var i = 0; i < size; i++) {
        next[i] = normalizePendingEntry(source[i], statKeys);
      }
      return next;
    }

    function ensurePendingLevelsSize() {
      state.pendingUpgradesByLevel = ensurePendingEntriesSize(state.pendingUpgradesByLevel, getGunsLevelsCount(), CANNON_STAT_KEYS);
    }

    function ensurePendingDronLevelsSize() {
      var size = Math.max(1, Math.min(60, toSafeNonNegativeInt(getDronLevelsCount())));
      state.pendingDronUpgradesByLevel = ensurePendingEntriesSize(state.pendingDronUpgradesByLevel, size, DRON_STAT_KEYS);
    }

    function getFenceLevelsCount() {
      var levels = getFenceLevels();
      if (!Array.isArray(levels) || !levels.length) return 60;
      return Math.max(1, Math.min(60, levels.length));
    }

    function ensurePendingFenceLevelsSize() {
      state.pendingFenceUpgradesByLevel = ensurePendingEntriesSize(state.pendingFenceUpgradesByLevel, getFenceLevelsCount(), FENCE_STAT_KEYS);
    }

    function getPendingEntry(list, level, statKeys) {
      var idx = Math.max(1, Math.floor(level || 1)) - 1;
      if (!Array.isArray(list) || !list[idx]) return createPendingEntry(statKeys);
      return list[idx];
    }

    function getPendingStatValue(list, level, statKey, statKeys) {
      var entry = getPendingEntry(list, level, statKeys);
      return toSafeNonNegativeInt(entry[statKey]);
    }

    function setPendingStatValue(list, level, statKey, value, statKeys) {
      var idx = Math.max(1, Math.floor(level || 1)) - 1;
      if (!Array.isArray(list)) return;
      list[idx] = normalizePendingEntry(list[idx], statKeys);
      list[idx][statKey] = toSafeNonNegativeInt(value);
    }

    function getPendingEntryCount(entry, statKeys) {
      var total = 0;
      var safeEntry = normalizePendingEntry(entry, statKeys);
      for (var i = 0; i < statKeys.length; i++) total += toSafeNonNegativeInt(safeEntry[statKeys[i]]);
      return total;
    }

    function resetPendingEntries(list, statKeys) {
      if (!Array.isArray(list)) return;
      for (var i = 0; i < list.length; i++) list[i] = createPendingEntry(statKeys);
    }

    function getPendingEntryCost(level, entry, statKeys, appliedGetter, stepCostGetter) {
      var total = 0;
      var safeEntry = normalizePendingEntry(entry, statKeys);
      for (var i = 0; i < statKeys.length; i++) {
        var statKey = statKeys[i];
        var pendingCount = toSafeNonNegativeInt(safeEntry[statKey]);
        if (pendingCount <= 0) continue;
        var applied = toSafeNonNegativeInt(appliedGetter(level, statKey));
        for (var stepIndex = 0; stepIndex < pendingCount; stepIndex++) {
          total += toSafeNonNegativeInt(stepCostGetter(level, statKey, applied + stepIndex));
        }
      }
      return toSafeNonNegativeInt(total);
    }

    function getReservedEntryCost(list, statKeys, appliedGetter, stepCostGetter) {
      if (!Array.isArray(list)) return 0;
      var total = 0;
      for (var i = 0; i < list.length; i++) {
        total += getPendingEntryCost(i + 1, list[i], statKeys, appliedGetter, stepCostGetter);
      }
      return toSafeNonNegativeInt(total);
    }

    function getPendingCost(level, statKey, pendingCount) {
      var count = toSafeNonNegativeInt(pendingCount);
      if (count <= 0) return 0;
      var applied = toSafeNonNegativeInt(getAppliedCannonUpgradeLevel(level, statKey));
      var total = 0;
      for (var i = 0; i < count; i++) total += toSafeNonNegativeInt(getCannonUpgradeStepCost(level, statKey, applied + i));
      return toSafeNonNegativeInt(total);
    }

    function getReservedDamagePoints() {
      ensurePendingLevelsSize();
      return getReservedEntryCost(state.pendingUpgradesByLevel, CANNON_STAT_KEYS, getAppliedCannonUpgradeLevel, getCannonUpgradeStepCost);
    }

    function resetPendingUpgrades() {
      ensurePendingLevelsSize();
      resetPendingEntries(state.pendingUpgradesByLevel, CANNON_STAT_KEYS);
    }

    function getPendingDronAt(level, statKey) {
      ensurePendingDronLevelsSize();
      return getPendingStatValue(state.pendingDronUpgradesByLevel, level, statKey, DRON_STAT_KEYS);
    }

    function setPendingDronAt(level, statKey, value) {
      ensurePendingDronLevelsSize();
      setPendingStatValue(state.pendingDronUpgradesByLevel, level, statKey, value, DRON_STAT_KEYS);
    }

    function resetPendingDronUpgrades() {
      ensurePendingDronLevelsSize();
      resetPendingEntries(state.pendingDronUpgradesByLevel, DRON_STAT_KEYS);
    }

    function getPendingDronCost(level, statKey, pendingCount) {
      var count = toSafeNonNegativeInt(pendingCount);
      if (count <= 0) return 0;
      var applied = toSafeNonNegativeInt(getAppliedDronUpgradeLevel(level, statKey));
      var total = 0;
      for (var i = 0; i < count; i++) total += toSafeNonNegativeInt(getDronUpgradeStepCost(level, statKey, applied + i));
      return toSafeNonNegativeInt(total);
    }

    function getReservedDronDamagePoints() {
      ensurePendingDronLevelsSize();
      return getReservedEntryCost(state.pendingDronUpgradesByLevel, DRON_STAT_KEYS, getAppliedDronUpgradeLevel, getDronUpgradeStepCost);
    }

    function getPendingFenceAt(level, statKey) {
      ensurePendingFenceLevelsSize();
      return getPendingStatValue(state.pendingFenceUpgradesByLevel, level, statKey, FENCE_STAT_KEYS);
    }

    function setPendingFenceAt(level, statKey, value) {
      ensurePendingFenceLevelsSize();
      setPendingStatValue(state.pendingFenceUpgradesByLevel, level, statKey, value, FENCE_STAT_KEYS);
    }

    function resetPendingFenceUpgrades() {
      ensurePendingFenceLevelsSize();
      resetPendingEntries(state.pendingFenceUpgradesByLevel, FENCE_STAT_KEYS);
    }

    function getPendingFenceCost(level, statKey, pendingCount) {
      var count = toSafeNonNegativeInt(pendingCount);
      if (count <= 0) return 0;
      var applied = toSafeNonNegativeInt(getAppliedFenceUpgradeLevel(level, statKey));
      var total = 0;
      for (var i = 0; i < count; i++) total += toSafeNonNegativeInt(getFenceUpgradeStepCost(level, statKey, applied + i));
      return toSafeNonNegativeInt(total);
    }

    function getReservedFenceDamagePoints() {
      ensurePendingFenceLevelsSize();
      return getReservedEntryCost(state.pendingFenceUpgradesByLevel, FENCE_STAT_KEYS, getAppliedFenceUpgradeLevel, getFenceUpgradeStepCost);
    }

    function formatCompact(value) {
      var num = toSafeNonNegativeInt(value);
      var nf = global.Game && global.Game.NumberFormat ? global.Game.NumberFormat : null;
      if (nf && typeof nf.formatCompactRu === 'function') return nf.formatCompactRu(num);
      return String(num);
    }

    function formatAppliedPendingValue(applied, pending) {
      var base = String(toSafeNonNegativeInt(applied));
      if (toSafeNonNegativeInt(pending) <= 0) return base;
      return base + ' (+' + String(toSafeNonNegativeInt(pending)) + ')';
    }

    function formatAppliedPendingSummary(appliedByStat, pendingEntry, statKeys) {
      var parts = [];
      for (var i = 0; i < statKeys.length; i++) {
        var statKey = statKeys[i];
        parts.push(formatAppliedPendingValue(appliedByStat[statKey], pendingEntry[statKey]));
      }
      return parts.join(' / ');
    }

    function formatCostRange(costs) {
      var filtered = [];
      for (var i = 0; i < costs.length; i++) {
        var cost = toSafeNonNegativeInt(costs[i]);
        if (cost > 0) filtered.push(cost);
      }
      if (!filtered.length) return '0';
      var min = filtered[0];
      var max = filtered[0];
      for (var j = 1; j < filtered.length; j++) {
        if (filtered[j] < min) min = filtered[j];
        if (filtered[j] > max) max = filtered[j];
      }
      if (min === max) return formatCompact(min);
      return formatCompact(min) + '-' + formatCompact(max);
    }

    function getExpandedRow(tabKey) {
      return toSafeNonNegativeInt(state.expandedTankWallRows && state.expandedTankWallRows[tabKey]);
    }

    function setExpandedRow(tabKey, level) {
      if (!state.expandedTankWallRows || typeof state.expandedTankWallRows !== 'object') {
        state.expandedTankWallRows = { weapons: 0, drones: 0, walls: 0 };
      }
      state.expandedTankWallRows[tabKey] = toSafeNonNegativeInt(level);
    }

    function resetExpandedRows() {
      state.expandedTankWallRows = { weapons: 0, drones: 0, walls: 0 };
    }

    function buildStatControlHtml(config) {
      var appliedText = formatAppliedPendingValue(config.applied, config.pending);
      return '' +
        '<div class="scGunsStatControl" data-sc-upgrade-family="' + config.family + '" data-level="' + String(config.level) + '" data-stat-key="' + config.statKey + '">' +
          '<div class="scGunsStatControl__label">' + config.label + '</div>' +
          '<div class="scGunsStatControl__meta">' +
            '<span class="scGunsStatControl__pill">' + translate('modsGunsColUpgradeLevel') + ': ' + appliedText + '</span>' +
            '<span class="scGunsStatControl__pill">' + translate('modsGunsColCost') + ': ' + formatCompact(config.cost) + '</span>' +
          '</div>' +
          '<div class="scGunsStatControl__actions">' +
            '<button type="button" class="btn btnSecondary uiButtonBehavior scGunsActionBtn" ' + config.actionAttr + '="plus" data-level="' + String(config.level) + '" data-stat-key="' + config.statKey + '"' + (config.canAdd ? '' : ' disabled') + '>+</button>' +
            '<button type="button" class="btn btnSecondary uiButtonBehavior scGunsActionBtn" ' + config.actionAttr + '="minus" data-level="' + String(config.level) + '" data-stat-key="' + config.statKey + '"' + (config.pending > 0 ? '' : ' disabled') + '>-</button>' +
          '</div>' +
          '<div class="scGunsStatControl__apply">' +
            '<button type="button" class="btn btnPrimary uiButtonBehavior scGunsActionBtn' + (config.canApplyPending ? ' is-ready' : '') + '" ' + config.actionAttr + '="apply" data-level="' + String(config.level) + '" data-stat-key="' + config.statKey + '"' + (config.canApplyPending ? '' : ' disabled') + '>' + translate('talentApply') + '</button>' +
          '</div>' +
        '</div>';
    }

    function applyPendingStats(level, list, statKeys, appliedGetter, stepCostGetter, applyFn) {
      var pendingEntry = normalizePendingEntry(getPendingEntry(list, level, statKeys), statKeys);
      var totalPending = getPendingEntryCount(pendingEntry, statKeys);
      if (totalPending <= 0) return false;
      var totalCost = getPendingEntryCost(level, pendingEntry, statKeys, appliedGetter, stepCostGetter);
      var pointsAvailable = toSafeNonNegativeInt(getDamagePoints());
      if (pointsAvailable < totalCost) {
        if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
          global.Game.Toast.show(translate('modsGunsNotEnoughDamagePoints'), 1200);
        }
        return false;
      }
      var idx = Math.max(1, Math.floor(level || 1)) - 1;
      list[idx] = createPendingEntry(statKeys);
      for (var i = 0; i < statKeys.length; i++) {
        var statKey = statKeys[i];
        var pendingCount = toSafeNonNegativeInt(pendingEntry[statKey]);
        if (pendingCount <= 0) continue;
        var result = applyFn(level, statKey, pendingCount);
        if (!result || !result.ok) {
          list[idx] = pendingEntry;
          return false;
        }
      }
      return true;
    }

    function isElementVerticallyVisible(element, viewport) {
      if (!element || !viewport) return false;
      // Prefer bounding rect comparison for robustness (handles subpixel,
      // transforms and padding differences between browsers).
      if (typeof element.getBoundingClientRect === 'function' && typeof viewport.getBoundingClientRect === 'function') {
        var elRect = element.getBoundingClientRect();
        var vpRect = viewport.getBoundingClientRect();
        return elRect.bottom > vpRect.top && elRect.top < vpRect.bottom;
      }
      // Fallback to scrollTop/clientHeight arithmetic when bounding rects
      // are not available (older environments).
      var rowTop = element.offsetTop;
      var rowBottom = rowTop + element.offsetHeight;
      var viewTop = viewport.scrollTop;
      var viewBottom = viewTop + viewport.clientHeight;
      return rowBottom >= viewTop && rowTop <= viewBottom;
    }

    function getSpriteImageForSrc(src, onReady) {
      if (!src || typeof src !== 'string') return null;
      var cached = gunsSpriteImageCache[src] || null;
      if (cached && cached.complete) return cached;
      if (!cached) {
        cached = new global.Image();
        cached.decoding = 'async';
        cached.src = src;
        gunsSpriteImageCache[src] = cached;
      }
      if (typeof onReady === 'function') {
        var once = function () {
          cached.removeEventListener('load', once);
          onReady(cached);
        };
        cached.addEventListener('load', once);
      }
      return cached;
    }

    function drawGunsSpriteCanvas(node, frameIndex) {
      if (!node) return;
      var src = node.getAttribute('data-sprite-src') || '';
      var frameW = toSafeNonNegativeInt(Number(node.getAttribute('data-frame-w')));
      var frameH = toSafeNonNegativeInt(Number(node.getAttribute('data-frame-h')));
      var baseX = Number(node.getAttribute('data-frame-x'));
      var baseY = Number(node.getAttribute('data-frame-y'));
      var frames = toSafeNonNegativeInt(Number(node.getAttribute('data-anim-frames')));
      if (!src || frameW <= 0 || frameH <= 0 || !Number.isFinite(baseX) || !Number.isFinite(baseY)) return;
      if (frames <= 0) frames = 1;
      var img = getSpriteImageForSrc(src, function () {
        drawGunsSpriteCanvas(node, frameIndex);
      });
      if (!img || !img.complete) return;

      var lt = (global.Game && global.Game.Config && global.Game.Config.LayoutTuning) || {};
      var iconW = Number.isFinite(lt.weaponIconW) && lt.weaponIconW > 0 ? lt.weaponIconW : 60;
      var iconH = Number.isFinite(lt.weaponIconH) && lt.weaponIconH > 0 ? lt.weaponIconH : 45;

      var scaleAttr = Number(node.getAttribute('data-icon-scale'));
      if (Number.isFinite(scaleAttr) && scaleAttr > 0) {
        iconW = Math.round(iconW * scaleAttr);
        iconH = Math.round(iconH * scaleAttr);
      }

      if (node.width !== iconW) node.width = iconW;
      if (node.height !== iconH) node.height = iconH;

      var ctx = node.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, iconW, iconH);
      var safeFrame = Math.max(0, toSafeNonNegativeInt(frameIndex) % frames);
      var spriteX = Math.floor(baseX + frameW * safeFrame);
      var drawScale = Math.min(iconW / frameW, iconH / frameH);
      var drawW = frameW * drawScale;
      var drawH = frameH * drawScale;
      var cx = Math.round(iconW * 0.5);
      var cy = Math.round(iconH * 0.5);
      ctx.save();
      ctx.translate(cx, cy);
      var rotDegAttr = node.getAttribute('data-rot-deg');
      var rotDeg = rotDegAttr !== null && Number.isFinite(Number(rotDegAttr)) ? Number(rotDegAttr) : WEAPON_ICON_ROT_DEG;
      if (rotDeg !== 0) ctx.rotate(rotDeg * Math.PI / 180);
      ctx.drawImage(img, spriteX, Math.floor(baseY), frameW, frameH, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
      ctx.restore();
    }

    function tickGunsIconSprites() {
      if (state.view !== 'tankWall') return;
      var nowMs = Date.now();
      var ALWAYS_VISIBLE_ICON_ROWS = 4;

      if (state.activeTankWallTab === 'weapons' && gunsUi.rows) {
        var animatedNodes = gunsUi.rows.querySelectorAll('.scGunsTable__spriteCanvas[data-anim-frames]');
        if (animatedNodes && animatedNodes.length) {
          for (var i = 0; i < animatedNodes.length; i++) {
            var node = animatedNodes[i];
            var frames = toSafeNonNegativeInt(Number(node.getAttribute('data-anim-frames')));
            var fps = Number(node.getAttribute('data-anim-fps'));
            var rowNode = node.closest('.scGunsTable__row');
            var rowLevel = Number(rowNode && rowNode.getAttribute ? rowNode.getAttribute('data-level') : 0);
            var forceVisible = Number.isFinite(rowLevel) && rowLevel >= 1 && rowLevel <= ALWAYS_VISIBLE_ICON_ROWS;
            if (!forceVisible && rowNode && !isElementVerticallyVisible(rowNode, gunsUi.rows)) continue;
            var frameIndex = 0;
            if (frames > 1 && Number.isFinite(fps) && fps > 0) {
              frameIndex = Math.floor(nowMs * (fps / 1000)) % frames;
            }
            drawGunsSpriteCanvas(node, frameIndex);
          }
        }
      } else if (state.activeTankWallTab === 'drones' && dronsUi.rows) {
        var dronNodes = dronsUi.rows.querySelectorAll('.scGunsTable__spriteCanvas[data-anim-frames]');
        if (dronNodes && dronNodes.length) {
          for (var d = 0; d < dronNodes.length; d++) {
            var dNode = dronNodes[d];
            var dFrames = toSafeNonNegativeInt(Number(dNode.getAttribute('data-anim-frames')));
            var dFps = Number(dNode.getAttribute('data-anim-fps'));
            var dRowNode = dNode.closest('.scGunsTable__row');
            var dRowLevel = Number(dRowNode && dRowNode.getAttribute ? dRowNode.getAttribute('data-level') : 0);
            var dForceVisible = Number.isFinite(dRowLevel) && dRowLevel >= 1 && dRowLevel <= ALWAYS_VISIBLE_ICON_ROWS;
            if (!dForceVisible && dRowNode && !isElementVerticallyVisible(dRowNode, dronsUi.rows)) continue;
            var dFrameIndex = 0;
            if (dFrames > 1 && Number.isFinite(dFps) && dFps > 0) {
              dFrameIndex = Math.floor(nowMs * (dFps / 1000)) % dFrames;
            }
            drawGunsSpriteCanvas(dNode, dFrameIndex);
          }
        }
      } else if (state.activeTankWallTab === 'walls' && wallsUi.rows) {
        var wallNodes = wallsUi.rows.querySelectorAll('.scGunsTable__spriteCanvas');
        if (wallNodes && wallNodes.length) {
          for (var j = 0; j < wallNodes.length; j++) {
            var wNode = wallNodes[j];
            var wRowNode = wNode.closest('.scGunsTable__row');
            var wRowLevel = Number(wRowNode && wRowNode.getAttribute ? wRowNode.getAttribute('data-level') : 0);
            var wForceVisible = Number.isFinite(wRowLevel) && wRowLevel >= 1 && wRowLevel <= ALWAYS_VISIBLE_ICON_ROWS;
            if (!wForceVisible && wRowNode && !isElementVerticallyVisible(wRowNode, wallsUi.rows)) continue;
            drawGunsSpriteCanvas(wNode, 0);
          }
        }
      }
    }

    function startGunsIconTicker() {
      if (state.iconTickerId != null) return;
      state.iconTickerId = global.setInterval(tickGunsIconSprites, 50);
    }

    function stopGunsIconTicker() {
      if (state.iconTickerId == null) return;
      global.clearInterval(state.iconTickerId);
      state.iconTickerId = null;
    }

    function formatNumber(value) {
      var num = Number(value);
      if (!Number.isFinite(num)) return '—';
      if (Math.abs(num) >= 100) return String(Math.round(num));
      var fixed = num.toFixed(2);
      return fixed
        .replace(/\.00$/, '')
        .replace(/(\.\d)0$/, '$1');
    }

    function normalizeRootTilesSize() {
      var tilesWrap = documentObj.querySelector('#supercomputerMenuOverlay .scRootTiles');
      if (!tilesWrap) return;
      var tiles = tilesWrap.querySelectorAll('.scRootTile');
      if (!tiles || !tiles.length) return;
      for (var i = 0; i < tiles.length; i++) {
        tiles[i].style.setProperty('--scRootTileUniformHeight', 'auto');
      }
      var maxHeight = 0;
      for (var j = 0; j < tiles.length; j++) {
        maxHeight = Math.max(maxHeight, Math.ceil(tiles[j].getBoundingClientRect().height));
      }
      if (maxHeight <= 0) return;
      for (var k = 0; k < tiles.length; k++) {
        tiles[k].style.setProperty('--scRootTileUniformHeight', String(maxHeight) + 'px');
      }
    }

    function refreshRootTilesLayout() {
      if (!state.isOpen || state.view !== 'root') return;
      applyLayoutTuningVars();
      normalizeRootTilesSize();
    }

    function getTankLevelViewData(level) {
      var tankCfg = global.TankSprites && typeof global.TankSprites.getTank === 'function'
        ? global.TankSprites.getTank(level)
        : null;
      var cannonSprite = global.TankSprites && typeof global.TankSprites.pickCannon === 'function'
        ? global.TankSprites.pickCannon(level)
        : null;
      var stats = tankCfg && tankCfg.stats ? tankCfg.stats : null;
      var baseAttackSpeed = Number(stats && stats.attackSpeed);
      var baseDamage = Number(stats && stats.baseDamage);
      return {
        tankCfg: tankCfg,
        cannonSprite: cannonSprite,
        baseAttackSpeed: Number.isFinite(baseAttackSpeed) ? baseAttackSpeed : null,
        baseDamage: Number.isFinite(baseDamage) ? baseDamage : null,
      };
    }

    function ensureGunsPanelUI() {
      if (gunsUi.initialized) return;
      var panel = tankWallTabPanels.weapons;
      if (!panel) return;
      var weaponRenderStats = getTankWallRenderStats('weapons', [
        { statKey: 'attackSpeed', label: translate('modsGunsColAttackSpeed') },
        { statKey: 'baseDamage', label: translate('modsGunsColDamage') },
      ]);
      var weaponsActionAttr = getTankWallActionAttr('weapons', 'data-guns-action');

      panel.innerHTML = '';

      var pointsLine = documentObj.createElement('div');
      pointsLine.className = 'levelModal__line';
      pointsLine.id = 'modsTankWallGunsDamagePoints';

      var reserveLine = documentObj.createElement('div');
      reserveLine.className = 'levelModal__line';
      reserveLine.id = 'modsTankWallGunsReserved';

      var tableWrap = documentObj.createElement('div');
      tableWrap.className = 'scGunsTable scGunsTable_weapons';

      var tableHead = documentObj.createElement('div');
      tableHead.className = 'scGunsTable__head';
      tableHead.innerHTML = '' +
        '<div class="scGunsTable__cell scGunsTable__cell_level">' + translate('modsGunsColLevel') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_sprite">' + translate('modsGunsColType') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_stat">' + weaponRenderStats[0].label + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_stat">' + weaponRenderStats[1].label + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_upgrade">' + translate('modsGunsColUpgradeLevel') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_cost">' + translate('modsGunsColCost') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_actions">' + translate('modsGunsColActions') + '</div>';

      var tableRows = documentObj.createElement('div');
      tableRows.className = 'scGunsTable__rows';

      tableWrap.appendChild(tableHead);
      tableWrap.appendChild(tableRows);

      panel.appendChild(pointsLine);
      panel.appendChild(reserveLine);
      panel.appendChild(tableWrap);

      panel.addEventListener('click', function (evt) {
        var target = evt.target;
        if (!target || typeof target.closest !== 'function') return;
        var actionBtn = target.closest('[' + weaponsActionAttr + ']');
        if (!actionBtn) return;
        var level = Number(actionBtn.getAttribute('data-level'));
        if (!Number.isFinite(level) || level < 1 || level > getGunsLevelsCount()) return;
        var action = actionBtn.getAttribute(weaponsActionAttr);
        if (action === 'toggle') {
          if (getExpandedRow('weapons') !== level) {
            setExpandedRow('weapons', level);
          } else {
            var applied = applyPendingStats(level, state.pendingUpgradesByLevel, CANNON_STAT_KEYS, getAppliedCannonUpgradeLevel, getCannonUpgradeStepCost, applyCannonUpgrade);
            if (!applied) setExpandedRow('weapons', 0);
          }
          renderGunsPanel();
          return;
        }
        if (action === 'apply') {
          applyPendingStats(level, state.pendingUpgradesByLevel, CANNON_STAT_KEYS, getAppliedCannonUpgradeLevel, getCannonUpgradeStepCost, applyCannonUpgrade);
          renderGunsPanel();
          return;
        }
        var statKey = actionBtn.getAttribute('data-stat-key') || '';
        if (CANNON_STAT_KEYS.indexOf(statKey) === -1) return;
        if (action === 'plus') {
          var pending = getPendingStatValue(state.pendingUpgradesByLevel, level, statKey, CANNON_STAT_KEYS);
          var appliedLevel = toSafeNonNegativeInt(getAppliedCannonUpgradeLevel(level, statKey));
          var nextCost = toSafeNonNegativeInt(getCannonUpgradeStepCost(level, statKey, appliedLevel + pending));
          var available = toSafeNonNegativeInt(getDamagePoints());
          var reserved = getReservedDamagePoints();
          if (nextCost <= 0 || available - reserved < nextCost) {
            if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
              global.Game.Toast.show(translate('modsGunsNotEnoughDamagePoints'), 1200);
            }
            return;
          }
          setPendingStatValue(state.pendingUpgradesByLevel, level, statKey, pending + 1, CANNON_STAT_KEYS);
          renderGunsPanel();
          return;
        }
        if (action === 'minus') {
          var currentPending = getPendingStatValue(state.pendingUpgradesByLevel, level, statKey, CANNON_STAT_KEYS);
          if (currentPending <= 0) return;
          setPendingStatValue(state.pendingUpgradesByLevel, level, statKey, currentPending - 1, CANNON_STAT_KEYS);
          renderGunsPanel();
        }
      });

      gunsUi.root = panel;
      gunsUi.points = pointsLine;
      gunsUi.reserve = reserveLine;
      gunsUi.rows = tableRows;
      gunsUi.initialized = true;
    }

    function renderGunsPanel() {
      ensureGunsPanelUI();
      if (!gunsUi.initialized || !gunsUi.rows) return;
      ensurePendingLevelsSize();
      updateDamagePointsLabel();

      var cfg = getCannonUpgradeConfig();
      var levelsCount = getGunsLevelsCount();
      var rowsHtml = '';
      var availablePoints = toSafeNonNegativeInt(getDamagePoints());
      var reservedPoints = getReservedDamagePoints();
      var weaponRenderStats = getTankWallRenderStats('weapons', [
        { statKey: 'attackSpeed', label: translate('modsGunsColAttackSpeed') },
        { statKey: 'baseDamage', label: translate('modsGunsColDamage') },
      ]);
      var weaponRenderStatKeys = getRenderStatKeys(weaponRenderStats, CANNON_STAT_KEYS);
      var weaponsActionAttr = getTankWallActionAttr('weapons', 'data-guns-action');

      for (var i = 0; i < levelsCount; i++) {
        var level = i + 1;
        var rowCfg = cfg[i] || [level, 0, 0, 0, 0];
        var damageMulPer = Number(rowCfg[3]) || 0;
        var speedMulPer = Number(rowCfg[4]) || 0;
        var pendingEntry = normalizePendingEntry(getPendingEntry(state.pendingUpgradesByLevel, level, CANNON_STAT_KEYS), CANNON_STAT_KEYS);
        var appliedByStat = {
          attackSpeed: toSafeNonNegativeInt(getAppliedCannonUpgradeLevel(level, 'attackSpeed')),
          baseDamage: toSafeNonNegativeInt(getAppliedCannonUpgradeLevel(level, 'baseDamage')),
        };
        var viewData = getTankLevelViewData(level);
        var baseAttackSpeed = viewData.baseAttackSpeed;
        var baseDamage = viewData.baseDamage;
        var currentAttackSpeed = Number.isFinite(baseAttackSpeed)
          ? baseAttackSpeed * (1 + (appliedByStat.attackSpeed + pendingEntry.attackSpeed) * speedMulPer)
          : null;
        var currentDamage = Number.isFinite(baseDamage)
          ? baseDamage * (1 + (appliedByStat.baseDamage + pendingEntry.baseDamage) * damageMulPer)
          : null;
        var costByStat = buildTankWallStatCostMap(level, weaponRenderStats, appliedByStat, pendingEntry, getCannonUpgradeStepCost);
        var costValues = [];
        for (var weaponCostIndex = 0; weaponCostIndex < weaponRenderStats.length; weaponCostIndex++) {
          costValues.push(costByStat[weaponRenderStats[weaponCostIndex].statKey]);
        }
        var totalPendingCost = getPendingEntryCost(level, pendingEntry, CANNON_STAT_KEYS, getAppliedCannonUpgradeLevel, getCannonUpgradeStepCost);
        var upgradeText = formatAppliedPendingSummary(appliedByStat, pendingEntry, weaponRenderStatKeys);
        var expanded = getExpandedRow('weapons') === level;
        var canApply = totalPendingCost > 0 && availablePoints >= totalPendingCost;
        var spriteHtml = '';
        if (viewData.cannonSprite && viewData.cannonSprite.img && viewData.cannonSprite.cfg) {
          var src = viewData.cannonSprite.img.currentSrc || viewData.cannonSprite.img.src || '';
          var frame = viewData.cannonSprite.cfg.frame || { x: 0, y: 0, w: 64, h: 64 };
          var frameX = Number.isFinite(frame.x) ? Math.floor(frame.x) : 0;
          var frameY = Number.isFinite(frame.y) ? Math.floor(frame.y) : 0;
          var lt = (global.Game && global.Game.Config && global.Game.Config.LayoutTuning) || {};
          var tunedFrameW = Number(lt.weaponIconSpriteFrameW);
          var tunedFrameH = Number(lt.weaponIconSpriteFrameH);
          var frameW = Number.isFinite(tunedFrameW) && tunedFrameW > 0 ? Math.floor(tunedFrameW) : 128;
          var frameH = Number.isFinite(tunedFrameH) && tunedFrameH > 0 ? Math.floor(tunedFrameH) : 128;
          var spriteFrames = Number.isFinite(viewData.cannonSprite.cfg.frames) && viewData.cannonSprite.cfg.frames >= 1
            ? Math.floor(viewData.cannonSprite.cfg.frames)
            : 1;
          var balanceFrames = toSafeNonNegativeInt(getCannonUpgradeIconFrames(level));
          if (balanceFrames <= 0) balanceFrames = 1;
          var animFrames = Math.max(1, Math.min(spriteFrames, balanceFrames));
          var animFps = Number(getCannonUpgradeIconFps(level));
          if (!Number.isFinite(animFps) || animFps <= 0) animFps = 8;
          var iconW = Number.isFinite(lt.weaponIconW) && lt.weaponIconW > 0 ? lt.weaponIconW : 60;
          var iconH = Number.isFinite(lt.weaponIconH) && lt.weaponIconH > 0 ? lt.weaponIconH : 45;
          spriteHtml = '' +
            '<span class="scGunsTable__spriteBox" style="width:' + String(iconW) + 'px;height:' + String(iconH) + 'px">' +
              '<canvas class="scGunsTable__spriteCanvas"' +
                ' width="' + String(iconW) + '"' +
                ' height="' + String(iconH) + '"' +
                ' style="width:' + String(iconW) + 'px;height:' + String(iconH) + 'px"' +
                ' data-anim-frames="' + String(animFrames) + '"' +
                ' data-anim-fps="' + String(animFps) + '"' +
                ' data-sprite-src="' + src + '"' +
                ' data-frame-x="' + String(frameX) + '"' +
                ' data-frame-y="' + String(frameY) + '"' +
                ' data-frame-w="' + String(frameW) + '"' +
                ' data-frame-h="' + String(frameH) + '"' +
                ' data-rot-deg="-90"' +
              '></canvas>' +
            '</span>';
        } else {
          spriteHtml = '<span class="scGunsTable__spriteFallback">' + translate('modsGunsNoSprite') + '</span>';
        }
        rowsHtml += '' +
          '<div class="scGunsTable__row' + (expanded ? ' is-expanded' : '') + '" data-level="' + String(level) + '">' +
            '<div class="scGunsTable__cell scGunsTable__cell_level">' + String(level) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_sprite">' + spriteHtml + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_stat">' + formatNumber(baseAttackSpeed) + ' / ' + formatNumber(currentAttackSpeed) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_stat">' + formatNumber(baseDamage) + ' / ' + formatNumber(currentDamage) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_upgrade">' + upgradeText + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_cost">' + formatCostRange(costValues) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_actions">' +
              '<button type="button" class="btn btnPrimary uiButtonBehavior scGunsActionBtn' + (canApply ? ' is-ready' : '') + '" ' + weaponsActionAttr + '="toggle" data-level="' + String(level) + '" aria-expanded="' + (expanded ? 'true' : 'false') + '">' + translate('modsGunsUpgrade') + '</button>' +
            '</div>' +
          '</div>';
        if (expanded) {
          rowsHtml += '' +
            '<div class="scGunsTable__detailRow">' +
              '<div class="scGunsTable__detail scGunsTable__detail--2cols">';
          for (var weaponStatIndex = 0; weaponStatIndex < weaponRenderStats.length; weaponStatIndex++) {
            var weaponStat = weaponRenderStats[weaponStatIndex];
            var weaponCost = costByStat[weaponStat.statKey];
            rowsHtml += buildStatControlHtml({
              family: 'weapons',
              level: level,
              statKey: weaponStat.statKey,
              label: weaponStat.label,
              applied: appliedByStat[weaponStat.statKey],
              pending: pendingEntry[weaponStat.statKey],
              cost: weaponCost,
              canAdd: weaponCost > 0 && (availablePoints - reservedPoints) >= weaponCost,
              canApplyPending: canApply,
              actionAttr: weaponsActionAttr,
            });
          }
          rowsHtml += '' +
              '</div>' +
            '</div>';
        }
      }

      gunsUi.rows.innerHTML = rowsHtml;
      tickGunsIconSprites();
    }

    function ensureDronsPanelUI() {
      if (dronsUi.initialized) return;
      var panel = tankWallTabPanels.drones;
      if (!panel) return;
      var dronRenderStats = getTankWallRenderStats('drones', [
        { statKey: 'moveSpeedPxSec', label: translate('modsDronesColMoveSpeed') },
        { statKey: 'repairSpeedMult', label: translate('modsDronesColRepairSpeed') },
        { statKey: 'costMult', label: translate('modsDronesColCostMult') },
      ]);
      var dronActionAttr = getTankWallActionAttr('drones', 'data-dron-action');

      panel.innerHTML = '';

      var pointsLine = documentObj.createElement('div');
      pointsLine.className = 'levelModal__line';
      pointsLine.id = 'modsTankWallDronsDamagePoints';

      var reserveLine = documentObj.createElement('div');
      reserveLine.className = 'levelModal__line';
      reserveLine.id = 'modsTankWallDronsReserved';

      var tableWrap = documentObj.createElement('div');
      tableWrap.className = 'scGunsTable scGunsTable_drones';

      var tableHead = documentObj.createElement('div');
      tableHead.className = 'scGunsTable__head';
      tableHead.innerHTML = '' +
        '<div class="scGunsTable__cell scGunsTable__cell_level">' + translate('modsGunsColLevel') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_sprite">' + translate('modsTabDrones') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_stat">' + dronRenderStats[0].label + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_stat">' + dronRenderStats[1].label + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_stat scGunsTable__cell_headWrap">' + dronRenderStats[2].label + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_upgrade">' + translate('modsGunsColUpgradeLevel') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_cost">' + translate('modsGunsColCost') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_actions">' + translate('modsGunsColActions') + '</div>';

      var tableRows = documentObj.createElement('div');
      tableRows.className = 'scGunsTable__rows';

      tableWrap.appendChild(tableHead);
      tableWrap.appendChild(tableRows);

      panel.appendChild(pointsLine);
      panel.appendChild(reserveLine);
      panel.appendChild(tableWrap);

      panel.addEventListener('click', function (evt) {
        var target = evt.target;
        if (!target || typeof target.closest !== 'function') return;
        var actionBtn = target.closest('[' + dronActionAttr + ']');
        if (!actionBtn) return;
        var level = Number(actionBtn.getAttribute('data-level'));
        if (!Number.isFinite(level) || level < 1 || level > getDronLevelsCount()) return;
        var action = actionBtn.getAttribute(dronActionAttr);
        if (action === 'toggle') {
          if (getExpandedRow('drones') !== level) {
            setExpandedRow('drones', level);
          } else {
            var applied = applyPendingStats(level, state.pendingDronUpgradesByLevel, DRON_STAT_KEYS, getAppliedDronUpgradeLevel, getDronUpgradeStepCost, applyDronUpgrade);
            if (!applied) setExpandedRow('drones', 0);
          }
          renderDronsPanel();
          return;
        }
        if (action === 'apply') {
          applyPendingStats(level, state.pendingDronUpgradesByLevel, DRON_STAT_KEYS, getAppliedDronUpgradeLevel, getDronUpgradeStepCost, applyDronUpgrade);
          renderDronsPanel();
          return;
        }
        var statKey = actionBtn.getAttribute('data-stat-key') || '';
        if (DRON_STAT_KEYS.indexOf(statKey) === -1) return;
        if (action === 'plus') {
          var pending = getPendingStatValue(state.pendingDronUpgradesByLevel, level, statKey, DRON_STAT_KEYS);
          var appliedLevel = toSafeNonNegativeInt(getAppliedDronUpgradeLevel(level, statKey));
          var nextCost = toSafeNonNegativeInt(getDronUpgradeStepCost(level, statKey, appliedLevel + pending));
          var available = toSafeNonNegativeInt(getDamagePoints());
          var reserved = getReservedDronDamagePoints();
          if (nextCost <= 0 || available - reserved < nextCost) {
            if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
              global.Game.Toast.show(translate('modsGunsNotEnoughDamagePoints'), 1200);
            }
            return;
          }
          setPendingStatValue(state.pendingDronUpgradesByLevel, level, statKey, pending + 1, DRON_STAT_KEYS);
          renderDronsPanel();
          return;
        }
        if (action === 'minus') {
          var currentPending = getPendingStatValue(state.pendingDronUpgradesByLevel, level, statKey, DRON_STAT_KEYS);
          if (currentPending <= 0) return;
          setPendingStatValue(state.pendingDronUpgradesByLevel, level, statKey, currentPending - 1, DRON_STAT_KEYS);
          renderDronsPanel();
        }
      });

      dronsUi.root = panel;
      dronsUi.points = pointsLine;
      dronsUi.reserve = reserveLine;
      dronsUi.rows = tableRows;
      dronsUi.initialized = true;
    }

    function renderDronsPanel() {
      ensureDronsPanelUI();
      if (!dronsUi.initialized || !dronsUi.rows) return;
      ensurePendingDronLevelsSize();
      updateDamagePointsLabel();

      var levelsCount = Math.max(1, Math.min(60, toSafeNonNegativeInt(getDronLevelsCount())));
      var rowsHtml = '';
      var availablePoints = toSafeNonNegativeInt(getDamagePoints());
      var reservedPoints = getReservedDronDamagePoints();
      var dronCfg = getDronRuntimeConfig();
      var dronAnimations = dronCfg && dronCfg.animations && typeof dronCfg.animations === 'object' ? dronCfg.animations : {};
      var flyAnimFromSprites = global.DronSprites && typeof global.DronSprites.getAnimation === 'function'
        ? global.DronSprites.getAnimation('fly')
        : null;
      var flyAnim = flyAnimFromSprites && typeof flyAnimFromSprites === 'object'
        ? flyAnimFromSprites
        : (dronAnimations.fly && typeof dronAnimations.fly === 'object'
          ? dronAnimations.fly
          : (dronAnimations.repair && typeof dronAnimations.repair === 'object'
            ? dronAnimations.repair
            : (dronAnimations.idle && typeof dronAnimations.idle === 'object' ? dronAnimations.idle : null)));
      var atlasImg = global.DronSprites && global.DronSprites.atlasImg ? global.DronSprites.atlasImg : null;
      var atlasSrc = atlasImg && (atlasImg.currentSrc || atlasImg.src)
        ? (atlasImg.currentSrc || atlasImg.src)
        : ('assets/' + ((global.DronSprites && global.DronSprites.config && global.DronSprites.config.atlas) || dronCfg.atlas || dronCfg.png || 'dron_atlas.png'));
      var dronRenderStats = getTankWallRenderStats('drones', [
        { statKey: 'moveSpeedPxSec', label: translate('modsDronesColMoveSpeed') },
        { statKey: 'repairSpeedMult', label: translate('modsDronesColRepairSpeed') },
        { statKey: 'costMult', label: translate('modsDronesColCostMult') },
      ]);
      var dronRenderStatKeys = getRenderStatKeys(dronRenderStats, DRON_STAT_KEYS);
      var dronActionAttr = getTankWallActionAttr('drones', 'data-dron-action');

      var flyAnimFirstFrame = null;
      if (flyAnim && Array.isArray(flyAnim.frames) && flyAnim.frames.length > 0
          && global.DronSprites && typeof global.DronSprites.pickFrame === 'function') {
        flyAnimFirstFrame = global.DronSprites.pickFrame(flyAnim.frames[0]);
      }
      var frameX = flyAnimFirstFrame && Number.isFinite(flyAnimFirstFrame.x)
        ? Math.floor(flyAnimFirstFrame.x)
        : (Number.isFinite(flyAnim && flyAnim.x) ? Math.floor(flyAnim.x) : 0);
      var frameY = flyAnimFirstFrame && Number.isFinite(flyAnimFirstFrame.y)
        ? Math.floor(flyAnimFirstFrame.y)
        : (Number.isFinite(flyAnim && flyAnim.y) ? Math.floor(flyAnim.y) : 0);
      var frameW = flyAnimFirstFrame && Number.isFinite(flyAnimFirstFrame.w) && flyAnimFirstFrame.w > 0
        ? Math.floor(flyAnimFirstFrame.w)
        : (Number.isFinite(flyAnim && flyAnim.w) && flyAnim.w > 0 ? Math.floor(flyAnim.w) : 96);
      var frameH = flyAnimFirstFrame && Number.isFinite(flyAnimFirstFrame.h) && flyAnimFirstFrame.h > 0
        ? Math.floor(flyAnimFirstFrame.h)
        : (Number.isFinite(flyAnim && flyAnim.h) && flyAnim.h > 0 ? Math.floor(flyAnim.h) : 96);
      var baseAnimFrames = Array.isArray(flyAnim && flyAnim.frames)
        ? flyAnim.frames.length
        : (Number.isFinite(flyAnim && flyAnim.frames) && flyAnim.frames > 0 ? Math.floor(flyAnim.frames) : 1);
      var baseAnimFps = Number.isFinite(flyAnim && flyAnim.frameRateFps) && flyAnim.frameRateFps > 0 ? Number(flyAnim.frameRateFps) : 10;
      var lt = (global.Game && global.Game.Config && global.Game.Config.LayoutTuning) || {};
      var iconW = Number.isFinite(lt.weaponIconW) && lt.weaponIconW > 0 ? lt.weaponIconW : 60;
      var iconH = Number.isFinite(lt.weaponIconH) && lt.weaponIconH > 0 ? lt.weaponIconH : 45;
      var dronScale = Number.isFinite(lt.droneIconScale) && lt.droneIconScale > 0 ? lt.droneIconScale : 1;
      var dronIconW = Math.round(iconW * dronScale);
      var dronIconH = Math.round(iconH * dronScale);

      for (var i = 0; i < levelsCount; i++) {
        var level = i + 1;
        var pendingEntry = normalizePendingEntry(getPendingEntry(state.pendingDronUpgradesByLevel, level, DRON_STAT_KEYS), DRON_STAT_KEYS);
        var appliedByStat = {
          moveSpeedPxSec: toSafeNonNegativeInt(getAppliedDronUpgradeLevel(level, 'moveSpeedPxSec')),
          repairSpeedMult: toSafeNonNegativeInt(getAppliedDronUpgradeLevel(level, 'repairSpeedMult')),
          costMult: toSafeNonNegativeInt(getAppliedDronUpgradeLevel(level, 'costMult')),
        };
        var previewApplied = {
          moveSpeedPxSec: appliedByStat.moveSpeedPxSec + pendingEntry.moveSpeedPxSec,
          repairSpeedMult: appliedByStat.repairSpeedMult + pendingEntry.repairSpeedMult,
          costMult: appliedByStat.costMult + pendingEntry.costMult,
        };
        var baseStats = getDronStatsForLevel(level, 0) || {};
        var stats = getDronStatsForLevel(level, previewApplied) || {};
        var costByStat = buildTankWallStatCostMap(level, dronRenderStats, appliedByStat, pendingEntry, getDronUpgradeStepCost);
        var costValues = [];
        for (var dronCostIndex = 0; dronCostIndex < dronRenderStats.length; dronCostIndex++) {
          costValues.push(costByStat[dronRenderStats[dronCostIndex].statKey]);
        }
        var totalPendingCost = getPendingEntryCost(level, pendingEntry, DRON_STAT_KEYS, getAppliedDronUpgradeLevel, getDronUpgradeStepCost);
        var expanded = getExpandedRow('drones') === level;
        var canApply = totalPendingCost > 0 && availablePoints >= totalPendingCost;
        var upgradeText = formatAppliedPendingSummary(appliedByStat, pendingEntry, dronRenderStatKeys);
        var tunedFrames = toSafeNonNegativeInt(getDronUpgradeIconFrames(level));
        if (tunedFrames <= 0) tunedFrames = 1;
        var rowAnimFrames = Math.max(1, Math.min(baseAnimFrames, tunedFrames));
        var rowAnimFps = Number(getDronUpgradeIconFps(level));
        if (!Number.isFinite(rowAnimFps) || rowAnimFps <= 0) rowAnimFps = baseAnimFps;
        if (!Number.isFinite(rowAnimFps) || rowAnimFps <= 0) rowAnimFps = 10;

        var spriteHtml = '' +
          '<span class="scGunsTable__spriteBox" style="width:' + String(dronIconW) + 'px;height:' + String(dronIconH) + 'px">' +
            '<canvas class="scGunsTable__spriteCanvas"' +
              ' width="' + String(dronIconW) + '"' +
              ' height="' + String(dronIconH) + '"' +
              ' style="width:' + String(dronIconW) + 'px;height:' + String(dronIconH) + 'px"' +
              ' data-anim-frames="' + String(rowAnimFrames) + '"' +
              ' data-anim-fps="' + String(rowAnimFps) + '"' +
              ' data-sprite-src="' + atlasSrc + '"' +
              ' data-frame-x="' + String(frameX) + '"' +
              ' data-frame-y="' + String(frameY) + '"' +
              ' data-frame-w="' + String(frameW) + '"' +
              ' data-frame-h="' + String(frameH) + '"' +
              ' data-rot-deg="0"' +
              ' data-icon-scale="' + String(dronScale) + '"' +
            '></canvas>' +
          '</span>';

        rowsHtml += '' +
          '<div class="scGunsTable__row' + (expanded ? ' is-expanded' : '') + '" data-level="' + String(level) + '">' +
            '<div class="scGunsTable__cell scGunsTable__cell_level">' + String(level) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_sprite">' + spriteHtml + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_stat">' + formatNumber(baseStats.moveSpeedPxSec) + ' / ' + formatNumber(stats.moveSpeedPxSec) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_stat">' + formatNumber(baseStats.repairSpeedMult) + ' / ' + formatNumber(stats.repairSpeedMult) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_stat">' + formatNumber(baseStats.costMult) + ' / ' + formatNumber(stats.costMult) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_upgrade">' + upgradeText + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_cost">' + formatCostRange(costValues) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_actions">' +
              '<button type="button" class="btn btnPrimary uiButtonBehavior scGunsActionBtn' + (canApply ? ' is-ready' : '') + '" ' + dronActionAttr + '="toggle" data-level="' + String(level) + '" aria-expanded="' + (expanded ? 'true' : 'false') + '">' + translate('modsDronesUpgrade') + '</button>' +
            '</div>' +
          '</div>';
        if (expanded) {
          rowsHtml += '' +
            '<div class="scGunsTable__detailRow">' +
              '<div class="scGunsTable__detail scGunsTable__detail--3cols">';
          for (var dronStatIndex = 0; dronStatIndex < dronRenderStats.length; dronStatIndex++) {
            var dronStat = dronRenderStats[dronStatIndex];
            var dronCost = costByStat[dronStat.statKey];
            rowsHtml += buildStatControlHtml({
              family: 'drones',
              level: level,
              statKey: dronStat.statKey,
              label: dronStat.label,
              applied: appliedByStat[dronStat.statKey],
              pending: pendingEntry[dronStat.statKey],
              cost: dronCost,
              canAdd: dronCost > 0 && (availablePoints - reservedPoints) >= dronCost,
              canApplyPending: canApply,
              actionAttr: dronActionAttr,
            });
          }
          rowsHtml += '' +
              '</div>' +
            '</div>';
        }
      }

      dronsUi.rows.innerHTML = rowsHtml;
      tickGunsIconSprites();
    }

    function ensureWallsPanelUI() {
      if (wallsUi.initialized) return;
      var panel = tankWallTabPanels.walls;
      if (!panel) return;
      var wallRenderStats = getTankWallRenderStats('walls', [
        { statKey: 'segmentMaxHp', label: translate('modsWallsSegmentHpLabel', { hp: '' }).replace(':', '').trim() },
        { statKey: 'armorFlat', label: translate('modsWallsArmorLabel', { armor: '' }).replace(':', '').trim() },
      ]);
      var wallActionAttr = getTankWallActionAttr('walls', 'data-walls-action');

      panel.innerHTML = '';

      var pointsLine = documentObj.createElement('div');
      pointsLine.className = 'levelModal__line';
      pointsLine.id = 'modsTankWallWallsDamagePoints';

      var reserveLine = documentObj.createElement('div');
      reserveLine.className = 'levelModal__line';
      reserveLine.id = 'modsTankWallWallsReserved';

      var tableWrap = documentObj.createElement('div');
      tableWrap.className = 'scGunsTable';

      var tableHead = documentObj.createElement('div');
      tableHead.className = 'scGunsTable__head';
      tableHead.innerHTML = '' +
        '<div class="scGunsTable__cell scGunsTable__cell_level">' + translate('modsGunsColLevel') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_sprite">' + translate('modsTabWalls') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_stat">' + wallRenderStats[0].label + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_stat">' + wallRenderStats[1].label + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_upgrade">' + translate('modsGunsColUpgradeLevel') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_cost">' + translate('modsGunsColCost') + '</div>' +
        '<div class="scGunsTable__cell scGunsTable__cell_actions">' + translate('modsGunsColActions') + '</div>';

      var tableRows = documentObj.createElement('div');
      tableRows.className = 'scGunsTable__rows';

      tableWrap.appendChild(tableHead);
      tableWrap.appendChild(tableRows);

      panel.appendChild(pointsLine);
      panel.appendChild(reserveLine);
      panel.appendChild(tableWrap);

      panel.addEventListener('click', function (evt) {
        var target = evt.target;
        if (!target || typeof target.closest !== 'function') return;
        var actionBtn = target.closest('[' + wallActionAttr + ']');
        if (!actionBtn) return;
        var level = Number(actionBtn.getAttribute('data-level'));
        if (!Number.isFinite(level) || level < 1 || level > getFenceLevelsCount()) return;
        var action = actionBtn.getAttribute(wallActionAttr);
        if (action === 'toggle') {
          if (getExpandedRow('walls') !== level) {
            setExpandedRow('walls', level);
          } else {
            var applied = applyPendingStats(level, state.pendingFenceUpgradesByLevel, FENCE_STAT_KEYS, getAppliedFenceUpgradeLevel, getFenceUpgradeStepCost, applyFenceUpgrade);
            if (!applied) setExpandedRow('walls', 0);
          }
          renderWallsPanel();
          return;
        }
        if (action === 'apply') {
          applyPendingStats(level, state.pendingFenceUpgradesByLevel, FENCE_STAT_KEYS, getAppliedFenceUpgradeLevel, getFenceUpgradeStepCost, applyFenceUpgrade);
          renderWallsPanel();
          return;
        }
        var statKey = actionBtn.getAttribute('data-stat-key') || '';
        if (FENCE_STAT_KEYS.indexOf(statKey) === -1) return;
        if (action === 'plus') {
          var pending = getPendingStatValue(state.pendingFenceUpgradesByLevel, level, statKey, FENCE_STAT_KEYS);
          var appliedLevel = toSafeNonNegativeInt(getAppliedFenceUpgradeLevel(level, statKey));
          var nextCost = toSafeNonNegativeInt(getFenceUpgradeStepCost(level, statKey, appliedLevel + pending));
          var available = toSafeNonNegativeInt(getDamagePoints());
          var reserved = getReservedFenceDamagePoints();
          if (nextCost <= 0 || available - reserved < nextCost) {
            if (global.Game && global.Game.Toast && typeof global.Game.Toast.show === 'function') {
              global.Game.Toast.show(translate('modsGunsNotEnoughDamagePoints'), 1200);
            }
            return;
          }
          setPendingStatValue(state.pendingFenceUpgradesByLevel, level, statKey, pending + 1, FENCE_STAT_KEYS);
          renderWallsPanel();
          return;
        }
        if (action === 'minus') {
          var currentPending = getPendingStatValue(state.pendingFenceUpgradesByLevel, level, statKey, FENCE_STAT_KEYS);
          if (currentPending <= 0) return;
          setPendingStatValue(state.pendingFenceUpgradesByLevel, level, statKey, currentPending - 1, FENCE_STAT_KEYS);
          renderWallsPanel();
        }
      });

      wallsUi.root = panel;
      wallsUi.points = pointsLine;
      wallsUi.reserve = reserveLine;
      wallsUi.rows = tableRows;
      wallsUi.initialized = true;
    }

    function renderWallsPanel() {
      ensureWallsPanelUI();
      if (!wallsUi.initialized || !wallsUi.rows) return;
      ensurePendingFenceLevelsSize();
      updateDamagePointsLabel();

      var levels = getFenceLevels();
      var cfg = getFenceConfig();
      var levelsCount = getFenceLevelsCount();
      var rowsHtml = '';
      var availablePoints = toSafeNonNegativeInt(getDamagePoints());
      var reservedPoints = getReservedFenceDamagePoints();
      var wallRenderStats = getTankWallRenderStats('walls', [
        { statKey: 'segmentMaxHp', label: translate('modsWallsSegmentHpLabel', { hp: '' }).replace(':', '').trim() },
        { statKey: 'armorFlat', label: translate('modsWallsArmorLabel', { armor: '' }).replace(':', '').trim() },
      ]);
      var wallRenderStatKeys = getRenderStatKeys(wallRenderStats, FENCE_STAT_KEYS);
      var wallActionAttr = getTankWallActionAttr('walls', 'data-walls-action');

      var frames = Array.isArray(cfg.frames) ? cfg.frames : [];
      var frameById = Object.create(null);
      for (var j = 0; j < frames.length; j++) {
        var frameCfg = frames[j];
        if (!frameCfg || typeof frameCfg.id !== 'string' || !frameCfg.id) continue;
        frameById[frameCfg.id] = frameCfg;
      }

      function findFrameById(frameId) {
        if (!frameId || typeof frameId !== 'string') return null;
        return frameById[frameId] || null;
      }

      function readInlineFrame(frameCfg) {
        if (!frameCfg || typeof frameCfg !== 'object') return null;
        var x = Number(frameCfg.x);
        var y = Number(frameCfg.y);
        var w = Number(frameCfg.w);
        var h = Number(frameCfg.h);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
        return { x: Math.floor(x), y: Math.floor(y), w: Math.floor(w), h: Math.floor(h) };
      }

      for (var i = 0; i < levelsCount; i++) {
        var level = i + 1;
        var rowCfg = levels[i] || { segmentMaxHp: 0, armorFlat: 0, upgradeCostDamagePoints: 0 };
        var pendingEntry = normalizePendingEntry(getPendingEntry(state.pendingFenceUpgradesByLevel, level, FENCE_STAT_KEYS), FENCE_STAT_KEYS);
        var appliedByStat = {
          segmentMaxHp: toSafeNonNegativeInt(getAppliedFenceUpgradeLevel(level, 'segmentMaxHp')),
          armorFlat: toSafeNonNegativeInt(getAppliedFenceUpgradeLevel(level, 'armorFlat')),
        };
        var previewApplied = {
          segmentMaxHp: appliedByStat.segmentMaxHp + pendingEntry.segmentMaxHp,
          armorFlat: appliedByStat.armorFlat + pendingEntry.armorFlat,
        };

        var stats = getFenceStatsForLevel(level, previewApplied);
        var baseHp = stats.baseHp;
        var baseArmor = stats.baseArmor;
        var currentHp = stats.currentHp;
        var currentArmor = stats.currentArmor;
        var costByStat = buildTankWallStatCostMap(level, wallRenderStats, appliedByStat, pendingEntry, getFenceUpgradeStepCost);
        var costValues = [];
        for (var wallCostIndex = 0; wallCostIndex < wallRenderStats.length; wallCostIndex++) {
          costValues.push(costByStat[wallRenderStats[wallCostIndex].statKey]);
        }
        var totalPendingCost = getPendingEntryCost(level, pendingEntry, FENCE_STAT_KEYS, getAppliedFenceUpgradeLevel, getFenceUpgradeStepCost);
        var expanded = getExpandedRow('walls') === level;
        var canApply = totalPendingCost > 0 && availablePoints >= totalPendingCost;
        var upgradeText = formatAppliedPendingSummary(appliedByStat, pendingEntry, wallRenderStatKeys);

        var spriteHtml = '';
        var uiIcon = rowCfg && rowCfg.uiIcon && typeof rowCfg.uiIcon === 'object' ? rowCfg.uiIcon : null;
        var uiIconFrame = uiIcon && uiIcon.frame && typeof uiIcon.frame === 'object' ? uiIcon.frame : null;
        var inlineFrame = null;
        if (uiIconFrame) {
          var iconFrameId = (typeof uiIconFrame.id === 'string' && uiIconFrame.id) ? uiIconFrame.id : null;
          if (iconFrameId) inlineFrame = findFrameById(iconFrameId);
          if (!inlineFrame) inlineFrame = readInlineFrame(uiIconFrame);
        }
        if (!inlineFrame && rowCfg && rowCfg.uiFrame && typeof rowCfg.uiFrame === 'object') inlineFrame = readInlineFrame(rowCfg.uiFrame);
        var frameId = (uiIcon && typeof uiIcon.frameId === 'string' && uiIcon.frameId)
          ? uiIcon.frameId
          : ((rowCfg && typeof rowCfg.uiFrameId === 'string' && rowCfg.uiFrameId) ? rowCfg.uiFrameId : 'sideTop');
        var uiFrame = inlineFrame || findFrameById(frameId);
        if (!uiFrame && !inlineFrame) uiFrame = findFrameById('sideTop');

        if (uiFrame) {
          var atlasName = (uiIcon && typeof uiIcon.atlas === 'string' && uiIcon.atlas)
            ? uiIcon.atlas
            : ((rowCfg && typeof rowCfg.uiAtlas === 'string' && rowCfg.uiAtlas) ? rowCfg.uiAtlas : (rowCfg.atlas || cfg.atlas || 'fence_atlas.png'));
          var src = 'assets/' + atlasName;
          var frameX = Number.isFinite(uiFrame.x) ? Math.floor(uiFrame.x) : 0;
          var frameY = Number.isFinite(uiFrame.y) ? Math.floor(uiFrame.y) : 0;
          var frameW = Number.isFinite(uiFrame.w) && uiFrame.w > 0 ? Math.floor(uiFrame.w) : 64;
          var frameH = Number.isFinite(uiFrame.h) && uiFrame.h > 0 ? Math.floor(uiFrame.h) : 64;
          var lt = (global.Game && global.Game.Config && global.Game.Config.LayoutTuning) || {};
          var iconW = Number.isFinite(lt.weaponIconW) && lt.weaponIconW > 0 ? lt.weaponIconW : 60;
          var iconH = Number.isFinite(lt.weaponIconH) && lt.weaponIconH > 0 ? lt.weaponIconH : 45;
          spriteHtml = '' +
            '<span class="scGunsTable__spriteBox" style="width:' + String(iconW) + 'px;height:' + String(iconH) + 'px">' +
              '<canvas class="scGunsTable__spriteCanvas"' +
                ' width="' + String(iconW) + '"' +
                ' height="' + String(iconH) + '"' +
                ' style="width:' + String(iconW) + 'px;height:' + String(iconH) + 'px"' +
                ' data-anim-frames="1"' +
                ' data-sprite-src="' + src + '"' +
                ' data-frame-x="' + String(frameX) + '"' +
                ' data-frame-y="' + String(frameY) + '"' +
                ' data-frame-w="' + String(frameW) + '"' +
                ' data-frame-h="' + String(frameH) + '"' +
                ' data-rot-deg="0"' +
              '></canvas>' +
            '</span>';
        } else {
          spriteHtml = '<span class="scGunsTable__spriteFallback">' + translate('modsGunsNoSprite') + '</span>';
        }

        rowsHtml += '' +
          '<div class="scGunsTable__row' + (expanded ? ' is-expanded' : '') + '" data-level="' + String(level) + '">' +
            '<div class="scGunsTable__cell scGunsTable__cell_level">' + String(level) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_sprite">' + spriteHtml + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_stat">' + formatNumber(baseHp) + ' / ' + formatNumber(currentHp) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_stat">' + formatNumber(baseArmor) + ' / ' + formatNumber(currentArmor) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_upgrade">' + upgradeText + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_cost">' + formatCostRange(costValues) + '</div>' +
            '<div class="scGunsTable__cell scGunsTable__cell_actions">' +
              '<button type="button" class="btn btnPrimary uiButtonBehavior scGunsActionBtn' + (canApply ? ' is-ready' : '') + '" ' + wallActionAttr + '="toggle" data-level="' + String(level) + '" aria-expanded="' + (expanded ? 'true' : 'false') + '">' + translate('modsWallsUpgrade') + '</button>' +
            '</div>' +
          '</div>';
        if (expanded) {
          rowsHtml += '' +
            '<div class="scGunsTable__detailRow">' +
              '<div class="scGunsTable__detail scGunsTable__detail--2cols">';
          for (var wallStatIndex = 0; wallStatIndex < wallRenderStats.length; wallStatIndex++) {
            var wallStat = wallRenderStats[wallStatIndex];
            var wallCost = costByStat[wallStat.statKey];
            rowsHtml += buildStatControlHtml({
              family: 'walls',
              level: level,
              statKey: wallStat.statKey,
              label: wallStat.label,
              applied: appliedByStat[wallStat.statKey],
              pending: pendingEntry[wallStat.statKey],
              cost: wallCost,
              canAdd: wallCost > 0 && (availablePoints - reservedPoints) >= wallCost,
              canApplyPending: canApply,
              actionAttr: wallActionAttr,
            });
          }
          rowsHtml += '' +
              '</div>' +
            '</div>';
        }
      }

      wallsUi.rows.innerHTML = rowsHtml;
      tickGunsIconSprites();
    }

    function updateFenceStatsUI() {
      // Deprecated, replaced by renderWallsPanel
    }

    function openRoot(openOptions) {
      applyLayoutTuningVars();
      armRootBackdropCloseGuard(openOptions);
      if (!state.isOpen) {
        resetPendingUpgrades();
        resetPendingDronUpgrades();
        resetPendingFenceUpgrades();
        resetExpandedRows();
      }
      stopGunsIconTicker();
      if (state.view === 'talents' && closeTalents) closeTalents();
      setRootViewMode('root');
      setOverlayOpen(hangarOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(tankWallOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(rootOverlay, true, a11yOpen, a11yClose, {
        initialFocus: documentObj.getElementById('supercomputerOpenHangarMods'),
        onClose: closeAll,
      });
      state.isOpen = true;
      state.view = 'root';
      syncResponsiveShellState();
      normalizeRootTilesSize();
      setBodyScrollLock(true);
      onPauseLockChange(true);
    }

    function showHangarMods() {
      setOverlayOpen(rootOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(hangarOverlay, true, a11yOpen, a11yClose, {
        initialFocus: documentObj.getElementById('modsHangarBack'),
        onClose: backFromChild,
      });
      state.view = 'hangar';
      if (window.Game && Game.HangarChipsUI) {
        Game.HangarChipsUI.init();
        Game.HangarChipsUI.show();
      }
      syncResponsiveShellState();
      setBodyScrollLock(true);
      onViewChange('hangar');
    }

    function showTankWallMods() {
      syncHelpButtonCopy(documentObj.getElementById('modsTankWallHelpBtn'), 'supercomputerTankWallHelpButton');
      resetExpandedRows();
      setTankWallTab('weapons');
      ensurePendingLevelsSize();
      ensurePendingDronLevelsSize();
      ensurePendingFenceLevelsSize();
      updateDamagePointsLabel();
      renderGunsPanel();
      renderDronsPanel();
      renderWallsPanel();
      updateFenceStatsUI();

      setOverlayOpen(rootOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(tankWallOverlay, true, a11yOpen, a11yClose, {
        initialFocus: documentObj.getElementById('modsTankWallTabGuns'),
        onClose: backFromChild,
      });
      state.view = 'tankWall';
      syncResponsiveShellState();
      startGunsIconTicker();
      setBodyScrollLock(true);
    }

    function showTalents() {
      if (!openTalents) return;
      setOverlayOpen(hangarOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(tankWallOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(rootOverlay, true, a11yOpen, a11yClose, {
        initialFocus: documentObj.getElementById('supercomputerMenuClose'),
        onClose: closeAll,
      });
      setRootViewMode('talents');
      state.view = 'talents';
      openTalents({ onClose: backFromChild, embedded: true, skipSupercomputerRouting: true });
      applySharedTalentModalClass();
      syncResponsiveShellState();
      setBodyScrollLock(true);
      onPauseLockChange(true);
    }

    function openTalentsView() {
      if (!state.isOpen) openRoot();
      showTalents();
    }

    function backFromChild() {
      if (!state.isOpen) return;
      var prevView = state.view;
      if (state.view === 'hangar') {
        var chipsUi = global.Game && global.Game.HangarChipsUI;
        if (chipsUi && typeof chipsUi.resetTransientUiState === 'function') chipsUi.resetTransientUiState();
      }
      if (state.view === 'talents' && closeTalents) closeTalents();
      openRoot();
      onViewChange('root', prevView);
    }

    function closeAll() {
      if (!state.isOpen) return;
      var prevView = state.view;
      state.rootBackdropCloseNeedsFreshPointerDown = false;
      state.rootBackdropPointerDownSinceOpen = false;
      if (state.view === 'hangar') {
        var chipsUi = global.Game && global.Game.HangarChipsUI;
        if (chipsUi && typeof chipsUi.resetTransientUiState === 'function') chipsUi.resetTransientUiState();
      }
      if (state.view === 'talents' && closeTalents) closeTalents();
      setRootViewMode('root');
      stopGunsIconTicker();
      setOverlayOpen(rootOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(hangarOverlay, false, a11yOpen, a11yClose);
      setOverlayOpen(tankWallOverlay, false, a11yOpen, a11yClose);
      resetPendingUpgrades();
      resetPendingDronUpgrades();
      resetPendingFenceUpgrades();
      resetExpandedRows();
      state.isOpen = false;
      state.view = 'closed';
      syncResponsiveShellState();
      setBodyScrollLock(false);
      onPauseLockChange(false);
      onViewChange('closed', prevView);
    }

    documentObj.getElementById('supercomputerOpenHangarMods')?.addEventListener('click', showHangarMods);
    documentObj.getElementById('supercomputerOpenTankWallMods')?.addEventListener('click', showTankWallMods);
    documentObj.getElementById('supercomputerOpenTalents')?.addEventListener('click', showTalents);

    documentObj.getElementById('supercomputerMenuClose')?.addEventListener('click', closeAll);
    rootOverlay.addEventListener('pointerdown', function (evt) {
      noteRootBackdropPointerDown(evt);
    });
    rootOverlay.addEventListener('click', function (evt) {
      if (!(evt.target && evt.target.dataset && evt.target.dataset.supercomputerRootClose === 'true')) return;
      if (shouldSuppressRootBackdropClose()) {
        evt.preventDefault();
        evt.stopPropagation();
        return;
      }
      closeAll();
    });

    documentObj.getElementById('modsHangarClose')?.addEventListener('click', backFromChild);
    documentObj.getElementById('modsHangarBack')?.addEventListener('click', backFromChild);
    hangarOverlay.addEventListener('click', function (evt) {
      if (evt.target && evt.target.dataset && evt.target.dataset.modsHangarClose === 'true') backFromChild();
    });

    documentObj.getElementById('modsTankWallClose')?.addEventListener('click', backFromChild);
    documentObj.getElementById('modsTankWallBack')?.addEventListener('click', backFromChild);
    documentObj.getElementById('modsTankWallHelpBtn')?.addEventListener('click', function (evt) {
      evt.preventDefault();
      evt.stopPropagation();
      showTechHelpModal({
        sectionTitleKey: 'modsTankWallTitle',
        textKey: 'supercomputerTankWallHelpText',
      });
    });
    tankWallTabButtons.weapons?.addEventListener('click', function () { setTankWallTab('weapons', { focusButton: true }); });
    tankWallTabButtons.drones?.addEventListener('click', function () { setTankWallTab('drones', { focusButton: true }); });
    tankWallTabButtons.walls?.addEventListener('click', function () { setTankWallTab('walls', { focusButton: true }); });
    documentObj.getElementById('modsTankWallFenceUpgrade')?.addEventListener('click', function () {
      if (!upgradeFence()) return;
      updateDamagePointsLabel();
      updateFenceStatsUI();
    });
    tankWallOverlay.addEventListener('click', function (evt) {
      if (evt.target && evt.target.dataset && evt.target.dataset.modsTankWallClose === 'true') backFromChild();
    });
    global.addEventListener('resize', function () {
      refreshRootTilesLayout();
      syncResponsiveShellState();
    });

    return {
      openRoot: openRoot,
      openTalentsView: openTalentsView,
      closeAll: closeAll,
      isOpen: function () { return !!state.isOpen; },
      getView: function () { return state.view; },
      refreshDamagePointsIfVisible: function () {
        if (!state.isOpen || state.view !== 'tankWall') return;
        updateDamagePointsLabel();
        renderGunsPanel();
        renderDronsPanel();
        renderWallsPanel();
        updateFenceStatsUI();
      },
      refreshTankWallIfVisible: function () {
        if (!state.isOpen || state.view !== 'tankWall') return;
        updateDamagePointsLabel();
        renderGunsPanel();
        renderDronsPanel();
        renderWallsPanel();
        updateFenceStatsUI();
      },
    };
  }

  global.Game = global.Game || {};
  global.Game.SupercomputerMenu = {
    createController: createController,
    showSharedHelpModal: showSharedHelpModal,
    hideSharedHelpModal: hideSharedHelpModal,
    syncHelpButtonCopy: syncSharedHelpButtonCopy,
  };
})(typeof window !== 'undefined' ? window : this);
