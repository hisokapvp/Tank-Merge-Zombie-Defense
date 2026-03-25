(function (global) {
  'use strict';

  function createController(deps) {
    deps = deps || {};

    function pickCrateRewardLevel() {
      var state = deps.getState();
      var levels = state.cells.map(function (c) { return c.tank ? c.tank.level : null; }).filter(Boolean);
      var maxLevel = Math.max(state.maxTankLevelAchieved || 1, levels.length ? Math.max.apply(null, levels) : 1);
      if (maxLevel <= 1) return 1;
      var minLevel = Math.max(1, maxLevel - 4);
      var maxReward = Math.max(1, maxLevel - 3);
      var upper = Math.max(minLevel, maxReward);
      return minLevel + Math.floor(Math.random() * (upper - minLevel + 1));
    }

    function pickEmptyCell() {
      var state = deps.getState();
      var Garage = global.Game && global.Game.Garage;
      var empty = Garage
        ? state.cells.filter(function (c) { return Garage.isCellAvailableForTank(c, state); })
        : state.cells.filter(function (c) { return !c.tank; });
      if (!empty.length) return null;
      return empty[Math.floor(Math.random() * empty.length)];
    }

    function spawnCrate() {
      var state = deps.getState();
      var BAL = deps.getBalance();
      var cell = pickEmptyCell();
      if (!cell) return false;
      var targetX = cell.x + cell.w / 2;
      var targetY = cell.y + cell.h / 2;
      var size = BAL.crateSize;
      state.crate = {
        id: 'crate_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        x: targetX,
        y: -size,
        targetY: targetY,
        size: size,
        pulse: 0,
        animState: 'drop',
        animTimeSec: 0,
        isHover: false,
        isAlive: true,
        rewardLevel: pickCrateRewardLevel(),
        cellIndex: cell.i,
        claiming: false,
      };
      return true;
    }

    function getCrateAnimation(stateName) {
      var BonusBoxSprites = deps.getBonusBoxSprites();
      if (!(BonusBoxSprites && typeof BonusBoxSprites.getAnimation === 'function')) return null;
      return BonusBoxSprites.getAnimation(stateName) || BonusBoxSprites.getAnimation('idle');
    }

    function setCrateAnimationState(crate, nextState, resetTime) {
      if (!crate || typeof nextState !== 'string' || !nextState.length) return;
      if (crate.animState !== nextState) {
        crate.animState = nextState;
        crate.animTimeSec = 0;
        return;
      }
      if (resetTime) crate.animTimeSec = 0;
    }

    function crateHitTest(x, y) {
      var state = deps.getState();
      if (!state.crate) return false;
      var c = state.crate;
      var half = c.size * 0.5;
      return x >= c.x - half && x <= c.x + half && y >= c.y - half && y <= c.y + half;
    }

    function syncCrateHoverAt(x, y) {
      var state = deps.getState();
      var c = state.crate;
      if (!c || c.isAlive === false) return;
      var hovered = crateHitTest(x, y);
      if (hovered === c.isHover) return;
      c.isHover = hovered;
      if (hovered) {
        if (c.animState !== 'press' && c.animState !== 'drop') {
          setCrateAnimationState(c, 'hover', true);
        }
        return;
      }
      if (c.animState === 'hover') setCrateAnimationState(c, 'idle', true);
    }

    function maybeSpawnCrate() {
      var state = deps.getState();
      var BAL = deps.getBalance();
      var now = deps.nowSec();
      if (!state.nextCrateAt) state.nextCrateAt = now + BAL.crateIntervalSec;
      if (!state.crate && now >= state.nextCrateAt) {
        spawnCrate();
      }
    }

    function stepCrate(dt) {
      var state = deps.getState();
      var BAL = deps.getBalance();
      if (!state.crate) return;
      var c = state.crate;
      c.y = Math.min(c.targetY, c.y + BAL.crateDropSpeed * dt);
      c.pulse += dt * 4;
      c.animTimeSec = Number.isFinite(c.animTimeSec) ? (c.animTimeSec + dt) : dt;

      var anim = getCrateAnimation(c.animState);
      if (!anim || anim.loop !== false) return;
      var frameCount = Math.max(1, Array.isArray(anim.frames) ? anim.frames.length : 1);
      var fps = Math.max(0.01, Number(anim.frameRateFps) || 1);
      var durationSec = frameCount / fps;
      if (c.animTimeSec < durationSec) return;

      if (c.animState === 'drop') {
        setCrateAnimationState(c, 'idle', true);
      } else if (c.animState === 'press') {
        setCrateAnimationState(c, c.isHover ? 'hover' : 'idle', true);
      }
    }

    return {
      pickCrateRewardLevel: pickCrateRewardLevel,
      pickEmptyCell: pickEmptyCell,
      spawnCrate: spawnCrate,
      getCrateAnimation: getCrateAnimation,
      setCrateAnimationState: setCrateAnimationState,
      syncCrateHoverAt: syncCrateHoverAt,
      maybeSpawnCrate: maybeSpawnCrate,
      stepCrate: stepCrate,
      crateHitTest: crateHitTest,
    };
  }

  global.Game = global.Game || {};
  global.Game.CrateRuntime = {
    createController: createController,
  };
})(typeof window !== 'undefined' ? window : this);
