/**
 * TankPortrait — render tank preview portraits using tanks.json sprites.
 */
(function (global) {
	'use strict';

	var spriteMetaCache = new Map();

	var AuraStyleByBand = [
		null,
		{ color: 'rgba(180,255,200,.22)', radius: 20, alpha: 0.18, pulseSpeed: 4 },
		{ color: 'rgba(140,230,255,.24)', radius: 24, alpha: 0.2, pulseSpeed: 4 },
		{ color: 'rgba(100,180,255,.26)', radius: 28, alpha: 0.22, pulseSpeed: 3 },
		{ color: 'rgba(186,140,255,.28)', radius: 32, alpha: 0.24, pulseSpeed: 3 },
		{ color: 'rgba(255,230,140,.3)', radius: 36, alpha: 0.26, pulseSpeed: 2.5 },
		{ color: 'rgba(255,248,220,.35)', radius: 40, alpha: 0.3, pulseSpeed: 2 }
	];

	function getSpriteMeta(cfg) {
		if (!cfg) return null;
		if (spriteMetaCache.has(cfg)) return spriteMetaCache.get(cfg);

		var frame = cfg.frame || {};
		var meta = {
			frameX: frame.x || 0,
			frameY: frame.y || 0,
			frameW: cfg.frameWidth || frame.w || 0,
			frameH: cfg.frameHeight || frame.h || 0,
			frames: cfg.frames || 1,
			anchor: cfg.anchor || { x: 0.5, y: 0.6 },
			scale: cfg.scale != null ? cfg.scale : 1,
			animSpeed: cfg.animSpeed || 0,
			frameList: Array.isArray(cfg.frames) ? cfg.frames : null,
			frameOrder: cfg.animation && Array.isArray(cfg.animation.frameOrder) ? cfg.animation.frameOrder : null,
			frameRate: cfg.animation && cfg.animation.frameRate ? cfg.animation.frameRate : null
		};

		if (meta.frameList && meta.frameList.length) {
			meta.frames = meta.frameOrder ? meta.frameOrder.length : meta.frameList.length;
			if (!meta.frameW || !meta.frameH) {
				meta.frameW = cfg.frameWidth || frame.w || 0;
				meta.frameH = cfg.frameHeight || frame.h || 0;
			}
		}

		spriteMetaCache.set(cfg, meta);
		return meta;
	}

	function getPortraitScale(spec, maxW, maxH, scaleMul) {
		if (!spec || !spec.body || !spec.body.cfg) return 1;
		var meta = getSpriteMeta(spec.body.cfg);
		var bodyW = meta ? meta.frameW : 0;
		var bodyH = meta ? meta.frameH : 0;
		if (!bodyW || !bodyH) return 1;
		var base = Math.min(maxW / bodyW, maxH / bodyH);
		return base * (scaleMul != null ? scaleMul : 1);
	}

	function drawSprite(ctx, sprite, frameIdx, scale) {
		if (!sprite || !sprite.cfg || !sprite.img) return false;
		var meta = getSpriteMeta(sprite.cfg);
		if (!meta || !meta.frameW || !meta.frameH) return false;

		var frames = meta.frames || 1;
		var frame = frames > 1 ? (Math.floor(frameIdx || 0) % frames) : 0;
		var sx = meta.frameX + frame * meta.frameW;
		var sy = meta.frameY;

		if (meta.frameList && meta.frameList.length) {
			var logicalIndex = meta.frameOrder ? meta.frameOrder[frame % meta.frameOrder.length] : frame;
			var pos = meta.frameList[logicalIndex] || meta.frameList[0];
			sx = pos.x != null ? pos.x : sx;
			sy = pos.y != null ? pos.y : sy;
		}

		var drawW = meta.frameW * scale * meta.scale;
		var drawH = meta.frameH * scale * meta.scale;
		var anchor = meta.anchor || { x: 0.5, y: 0.6 };
		ctx.drawImage(
			sprite.img,
			sx,
			sy,
			meta.frameW,
			meta.frameH,
			-drawW * anchor.x,
			-drawH * anchor.y,
			drawW,
			drawH
		);
		return true;
	}

	function drawProceduralAura(ctx, band, timeSec) {
		if (!band || band < 1 || band > 6) return;
		var style = AuraStyleByBand[band];
		if (!style) return;
		var t = timeSec || 0;
		var alpha = style.alpha;
		var scale = 0.85 + 0.15 * Math.sin(t * (style.pulseSpeed || 4));
		var r = style.radius * scale;
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.fillStyle = style.color;
		ctx.beginPath();
		ctx.arc(0, 0, r, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	function drawFallbackTank(ctx, level, scale) {
		var tier = Math.floor((level - 1) / 3);
		var colors = ['#b83232', '#c63a3a', '#d14646', '#e05a5a', '#f07171'];
		var hull = colors[Math.min(tier, colors.length - 1)];

		ctx.save();
		ctx.scale(scale * 0.8, scale * 0.8);
		ctx.fillStyle = 'rgba(0,0,0,.35)';
		roundRect(ctx, -22, 8, 44, 10, 5);
		ctx.fill();
		ctx.fillStyle = hull;
		roundRect(ctx, -20, -12, 40, 24, 6);
		ctx.fill();
		ctx.fillStyle = shadeColor(hull, -18);
		ctx.beginPath();
		ctx.arc(0, -2, 10, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = shadeColor(hull, -30);
		roundRect(ctx, 5, -5, 25, 6, 2);
		ctx.fill();
		ctx.restore();
	}

	function renderTankPortrait(ctx, spec, opts) {
		if (!ctx || !spec) return false;
		opts = opts || {};
		var x = opts.x || 0;
		var y = opts.y || 0;
		var maxW = opts.maxW || 60;
		var maxH = opts.maxH || 45;
		var frameIdx = opts.frameIdx || {};
		var level = spec.level || 1;
		var baseScale = getPortraitScale(spec, maxW, maxH, opts.scale || 1);

		ctx.save();
		ctx.translate(x, y);
		if (opts.rotation) ctx.rotate(opts.rotation);
		if (opts.alpha != null) ctx.globalAlpha = opts.alpha;

		if (spec.aura || spec.auraBand) {
			if (spec.aura && spec.aura.img) {
				drawSprite(ctx, spec.aura, frameIdx.aura || 0, baseScale * 0.8);
			} else {
				drawProceduralAura(ctx, spec.auraBand, opts.timeSec || 0);
			}
		}

		if (spec.body && spec.body.img && spec.cannon && spec.cannon.img) {
			drawSprite(ctx, spec.body, frameIdx.body || 0, baseScale);
			drawSprite(ctx, spec.cannon, frameIdx.cannon || 0, baseScale);
		} else {
			drawFallbackTank(ctx, level, baseScale);
		}

		ctx.restore();
		return true;
	}

	function roundRect(ctx, x, y, w, h, r) {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + r);
		ctx.lineTo(x + w, y + h - r);
		ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
		ctx.lineTo(x + r, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.closePath();
	}

	function shadeColor(color, percent) {
		var num = parseInt(color.replace('#', ''), 16);
		var amt = Math.round(2.55 * percent);
		var R = (num >> 16) + amt;
		var G = (num >> 8 & 0x00FF) + amt;
		var B = (num & 0x0000FF) + amt;
		R = Math.max(0, Math.min(255, R));
		G = Math.max(0, Math.min(255, G));
		B = Math.max(0, Math.min(255, B));
		return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
	}

	global.Game = global.Game || {};
	global.Game.TankPortrait = {
		renderTankPortrait: renderTankPortrait,
		getPortraitScale: getPortraitScale
	};
})(typeof window !== 'undefined' ? window : this);
