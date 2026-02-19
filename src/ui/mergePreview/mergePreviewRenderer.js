/**
 * MergePreviewRenderer — render merge preview A/B/result with firing.
 */
(function (global) {
	'use strict';

	function drawShots(ctx, model, showA, showB, showR) {
		for (var i = 0; i < model.shots.length; i++) {
			var shot = model.shots[i];
			if (!shot.active) continue;
			if (shot.tankIndex === 0 && !showA) continue;
			if (shot.tankIndex === 1 && !showB) continue;
			if (shot.tankIndex === 2 && !showR) continue;
			var alpha = Math.max(0, shot.life / shot.maxLife);
			ctx.save();
			ctx.globalAlpha = alpha;
			ctx.strokeStyle = 'rgba(255,220,120,0.9)';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(shot.x, shot.y);
			ctx.lineTo(shot.x + shot.dx * 16, shot.y + shot.dy * 16);
			ctx.stroke();
			ctx.fillStyle = 'rgba(255,255,200,0.9)';
			ctx.beginPath();
			ctx.arc(shot.x, shot.y, 2 + 3 * alpha, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}
	}

	function render(ctx, model, state, phase, opts) {
		if (!ctx || !model) return;
		opts = opts || {};
		var TankPortrait = global.Game && global.Game.TankPortrait;
		if (!TankPortrait || !TankPortrait.renderTankPortrait) return;

		var layout = model.layout;
		var w = layout.w || ctx.canvas.width;
		var h = layout.h || ctx.canvas.height;
		ctx.clearRect(0, 0, w, h);

		var showResult = state !== 1 || phase > 0.7;
		var showSides = state === 1;
		var showRightHullShotFx = opts.showRightHullShotFx !== false;

		var leftX = model.tanks[0].x;
		var rightX = model.tanks[1].x;
		var centerX = model.tanks[2].x;

		if (showSides) {
			TankPortrait.renderTankPortrait(ctx, model.tanks[0].spec, {
				x: leftX,
				y: layout.centerY,
				maxW: model.tanks[0].maxW,
				maxH: model.tanks[0].maxH,
				frameIdx: { body: model.tanks[0].bodyFrame, cannon: model.tanks[0].cannonFrame, aura: model.tanks[0].auraFrame },
				timeSec: model.time
			});
			TankPortrait.renderTankPortrait(ctx, model.tanks[1].spec, {
				x: rightX,
				y: layout.centerY,
				maxW: model.tanks[1].maxW,
				maxH: model.tanks[1].maxH,
				frameIdx: { body: model.tanks[1].bodyFrame, cannon: model.tanks[1].cannonFrame, aura: model.tanks[1].auraFrame },
				timeSec: model.time
			});
		}

		if (showResult) {
			TankPortrait.renderTankPortrait(ctx, model.tanks[2].spec, {
				x: centerX,
				y: layout.centerY,
				maxW: model.tanks[2].maxW,
				maxH: model.tanks[2].maxH,
				frameIdx: { body: model.tanks[2].bodyFrame, cannon: model.tanks[2].cannonFrame, aura: model.tanks[2].auraFrame },
				timeSec: model.time
			});
		}

		drawShots(ctx, model, showSides, showSides && showRightHullShotFx, showResult);
	}

	global.Game = global.Game || {};
	global.Game.MergePreviewRenderer = {
		render: render
	};
})(typeof window !== 'undefined' ? window : this);
