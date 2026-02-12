/**
 * Модалка офлайн-награды: точные тексты, кнопка «Посмотреть и получить».
 * Рендер на canvas, hit-test кнопки.
 */
(function (global) {
  'use strict';

  var FALLBACK_STRINGS = {
    offlineOfferTitle: 'Посмотри рекламу и получи упущенное',
    offlineOfferSub: 'Накопилось:',
    offlineOfferCoins: 'Деньги: $ {value}',
    offlineOfferXp: 'Опыт: ⭐ {value}',
    offlineOfferClaim: 'Посмотреть и получить',
  };

  function formatTemplate(text, vars) {
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, function (m, key) {
      return vars[key] != null ? String(vars[key]) : m;
    });
  }

  function resolveT(key, vars) {
    var tFn = null;
    if (typeof global.t === 'function') tFn = global.t;
    else if (global.Game && global.Game.I18n && typeof global.Game.I18n.t === 'function') tFn = global.Game.I18n.t;
    else if (global.Game && typeof global.Game.t === 'function') tFn = global.Game.t;

    if (tFn) return tFn(key, vars || {});
    if (FALLBACK_STRINGS[key]) return formatTemplate(FALLBACK_STRINGS[key], vars);
    return key;
  }

  function resolveFormat() {
    var nf = global.Game && global.Game.NumberFormat ? global.Game.NumberFormat : null;
    if (nf) {
      if (typeof nf.formatShortNumber === 'function') return nf.formatShortNumber;
      if (typeof nf.formatCompactRu === 'function') return nf.formatCompactRu;
    }
    return function (n) { return String(Math.round(n)); };
  }

  var state = {
    visible: false,
    coins: 0,
    xp: 0,
    onConfirm: null,
    buttonRect: null,
    uiModel: null,
    claiming: false,
  };

  var PAD = 24;

  function showOfflineRewardsModal(opts) {
    state.visible = true;
    state.coins = opts && opts.coins != null ? opts.coins : 0;
    state.xp = opts && opts.xp != null ? opts.xp : 0;
    state.onConfirm = opts && typeof opts.onConfirm === 'function' ? opts.onConfirm : null;
    state.buttonRect = null;
    state.claiming = false;
    state.uiModel = null;
  }

  function hideModal() {
    state.visible = false;
    state.onConfirm = null;
    state.buttonRect = null;
    state.claiming = false;
    state.uiModel = null;
  }

  function setClaiming(claiming) {
    state.claiming = !!claiming;
  }

  function render(ctx, viewport) {
    if (!state.visible || !ctx) return;
    var ui = getUiModel(viewport);
    state.uiModel = ui;
    var w = ui.viewport.w;
    var h = ui.viewport.h;
    var panelW = ui.panel.w;
    var panelH = ui.panel.h;
    var x0 = ui.panel.x;
    var y0 = ui.panel.y;

    ctx.save();
    ctx.fillStyle = 'rgba(5, 10, 18, 0.7)';
    ctx.fillRect(0, 0, w, h);

    var panelGradient = typeof ctx.createLinearGradient === 'function'
      ? ctx.createLinearGradient(x0, y0, x0 + panelW, y0 + panelH)
      : null;
    if (panelGradient) {
      panelGradient.addColorStop(0, 'rgba(30,20,14,.96)');
      panelGradient.addColorStop(1, 'rgba(12,9,7,.98)');
      ctx.fillStyle = panelGradient;
    } else {
      ctx.fillStyle = 'rgba(24, 16, 12, 0.97)';
    }
    roundRect(ctx, x0, y0, panelW, panelH, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 184, 114, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    var y = y0 + 34;
    ctx.fillStyle = '#eaf1ff';
    ctx.font = '900 18px Roboto, system-ui, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(ui.title, x0 + panelW / 2, y);
    y += 22;
    ctx.font = '12px Roboto, system-ui, Arial';
    ctx.fillStyle = 'rgba(234,241,255,0.8)';
    ctx.fillText(ui.sub, x0 + panelW / 2, y);

    ctx.fillStyle = 'rgba(13, 9, 6, 0.7)';
    roundRect(ctx, ui.accRect.x, ui.accRect.y, ui.accRect.w, ui.accRect.h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 184, 114, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(234,241,255,0.95)';
    ctx.font = '700 13px Roboto, system-ui, Arial';
    ctx.fillText(ui.coinsText, x0 + panelW / 2, ui.coinsY);
    ctx.fillText(ui.xpText, x0 + panelW / 2, ui.xpY);

    state.buttonRect = ui.claimRect;

    var claimGradient = !state.claiming && typeof ctx.createLinearGradient === 'function'
      ? ctx.createLinearGradient(ui.claimRect.x, ui.claimRect.y, ui.claimRect.x + ui.claimRect.w, ui.claimRect.y + ui.claimRect.h)
      : null;
    if (state.claiming) {
      ctx.fillStyle = 'rgba(100,100,120,0.9)';
    } else if (claimGradient) {
      claimGradient.addColorStop(0, 'rgba(255,211,158,0.96)');
      claimGradient.addColorStop(1, 'rgba(255,140,90,0.96)');
      ctx.fillStyle = claimGradient;
    } else {
      ctx.fillStyle = 'rgba(255, 184, 114, 0.95)';
    }
    roundRect(ctx, ui.claimRect.x, ui.claimRect.y, ui.claimRect.w, ui.claimRect.h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#1b1008';
    ctx.font = 'bold 12px system-ui, Roboto, Arial';
    ctx.fillText(ui.claimText, x0 + panelW / 2, ui.claimRect.y + ui.claimRect.h / 2 + 4);

    ctx.strokeStyle = 'rgba(234,241,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ui.closeRect.x + 6, ui.closeRect.y + 6);
    ctx.lineTo(ui.closeRect.x + ui.closeRect.w - 6, ui.closeRect.y + ui.closeRect.h - 6);
    ctx.moveTo(ui.closeRect.x + ui.closeRect.w - 6, ui.closeRect.y + 6);
    ctx.lineTo(ui.closeRect.x + 6, ui.closeRect.y + ui.closeRect.h - 6);
    ctx.stroke();

    ctx.restore();
  }

  function getUiModel(viewport) {
    var w = viewport && viewport.w ? viewport.w : 800;
    var h = viewport && viewport.h ? viewport.h : 600;
    var panelW = Math.min(520, Math.max(320, w * 0.86));
    panelW = Math.min(panelW, w - PAD * 2);
    var panelH = Math.min(306, Math.max(264, h - PAD * 2));
    var x0 = (w - panelW) / 2;
    var y0 = (h - panelH) / 2;
    var formatNumber = resolveFormat();
    var coinsValue = formatNumber(state.coins);
    var xpValue = formatNumber(state.xp);
    var btnW = Math.min(320, panelW - 32);
    var btnH = 42;
    var btnX = x0 + (panelW - btnW) / 2;
    var btnY = y0 + panelH - btnH - 16;
    var accW = panelW - 48;
    var accH = 86;
    var accX = x0 + (panelW - accW) / 2;
    var accY = y0 + Math.round((panelH - accH) / 2) - 4;
    var closeSize = 22;
    var closePad = 10;

    return {
      viewport: { w: w, h: h },
      panel: { x: x0, y: y0, w: panelW, h: panelH },
      title: resolveT('offlineOfferTitle'),
      sub: resolveT('offlineOfferSub'),
      coinsText: resolveT('offlineOfferCoins', { value: coinsValue }),
      xpText: resolveT('offlineOfferXp', { value: xpValue }),
      claimText: state.claiming ? '...' : resolveT('offlineOfferClaim'),
      accRect: { x: accX, y: accY, w: accW, h: accH },
      coinsY: accY + 33,
      xpY: accY + 62,
      claimRect: { x: btnX, y: btnY, w: btnW, h: btnH },
      closeRect: { x: x0 + panelW - closeSize - closePad, y: y0 + closePad, w: closeSize, h: closeSize },
    };
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /**
   * @param {{ x: number, y: number }} point
   * @returns {boolean} true если клик обработан (по кнопке)
   */
  function handleInput(point) {
    if (!state.visible || !point) return false;
    if (state.claiming) return true;
    var ui = state.uiModel;
    var claim = ui ? ui.claimRect : state.buttonRect;
    var close = ui ? ui.closeRect : null;

    if (close && point.x >= close.x && point.x <= close.x + close.w && point.y >= close.y && point.y <= close.y + close.h) {
      hideModal();
      return true;
    }

    if (claim && point.x >= claim.x && point.x <= claim.x + claim.w && point.y >= claim.y && point.y <= claim.y + claim.h) {
      if (state.onConfirm) state.onConfirm();
      return true;
    }

    return true;
  }

  function isVisible() {
    return state.visible;
  }

  global.Game = global.Game || {};
  global.Game.OfflineModal = {
    showOfflineRewardsModal: showOfflineRewardsModal,
    hideModal: hideModal,
    setClaiming: setClaiming,
    render: render,
    handleInput: handleInput,
    getUiModel: getUiModel,
    isVisible: isVisible,
  };
})(typeof window !== 'undefined' ? window : this);
