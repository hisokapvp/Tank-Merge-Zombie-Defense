/**
 * Модалка офлайн-награды: точные тексты, кнопка «Посмотреть и получить».
 * Рендер на canvas, hit-test кнопки.
 */
(function (global) {
  'use strict';

  var formatCompactRu = global.Game && global.Game.NumberFormat ? global.Game.NumberFormat.formatCompactRu : function (n) { return String(Math.round(n)); };

  var state = {
    visible: false,
    coins: 0,
    xp: 0,
    onConfirm: null,
    buttonRect: null,
    claiming: false,
  };

  var PAD = 24;
  var TITLE = 'Посмотри рекламу и получи упущенное';
  var SUB = 'Накопилось:';
  var COINS_LABEL = 'Монет - ';
  var XP_LABEL = 'Опыта - ';
  var BTN_TEXT = 'Посмотреть и получить';

  function showOfflineRewardsModal(opts) {
    state.visible = true;
    state.coins = opts && opts.coins != null ? opts.coins : 0;
    state.xp = opts && opts.xp != null ? opts.xp : 0;
    state.onConfirm = opts && typeof opts.onConfirm === 'function' ? opts.onConfirm : null;
    state.buttonRect = null;
    state.claiming = false;
  }

  function hideModal() {
    state.visible = false;
    state.onConfirm = null;
    state.buttonRect = null;
    state.claiming = false;
  }

  function setClaiming(claiming) {
    state.claiming = !!claiming;
  }

  function render(ctx, viewport) {
    if (!state.visible || !ctx) return;
    var w = viewport && viewport.w ? viewport.w : 800;
    var h = viewport && viewport.h ? viewport.h : 600;
    var panelW = Math.min(360, w - PAD * 2);
    var panelH = 220;
    var x0 = (w - panelW) / 2;
    var y0 = (h - panelH) / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(5, 10, 18, 0.7)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(17, 30, 55, 0.96)';
    roundRect(ctx, x0, y0, panelW, panelH, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    var y = y0 + 20;
    ctx.fillStyle = '#eaf1ff';
    ctx.font = 'bold 14px system-ui, Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(TITLE, x0 + panelW / 2, y);
    y += 22;
    ctx.font = '12px system-ui, Roboto, Arial';
    ctx.fillStyle = 'rgba(234,241,255,0.8)';
    ctx.fillText(SUB, x0 + panelW / 2, y);
    y += 18;
    ctx.fillText(COINS_LABEL + formatCompactRu(state.coins), x0 + panelW / 2, y);
    y += 16;
    ctx.fillText(XP_LABEL + formatCompactRu(state.xp), x0 + panelW / 2, y);
    y += 28;

    var btnW = Math.min(260, panelW - 32);
    var btnH = 40;
    var btnX = x0 + (panelW - btnW) / 2;
    var btnY = y;
    state.buttonRect = { x: btnX, y: btnY, w: btnW, h: btnH };

    ctx.fillStyle = state.claiming ? 'rgba(100,100,120,0.9)' : 'rgba(255, 184, 114, 0.95)';
    roundRect(ctx, btnX, btnY, btnW, btnH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#1b1008';
    ctx.font = 'bold 12px system-ui, Roboto, Arial';
    ctx.fillText(state.claiming ? '...' : BTN_TEXT, x0 + panelW / 2, btnY + btnH / 2 + 1);

    ctx.restore();
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
    var r = state.buttonRect;
    if (!r) return false;
    if (point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h) {
      if (state.onConfirm) state.onConfirm();
      return true;
    }
    return false;
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
    isVisible: isVisible,
  };
})(typeof window !== 'undefined' ? window : this);
