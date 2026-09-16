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

    // Underground hangar fallback (crate lands in cell 15 when the upper hangar
    // is full). Returns the reward target cell INDEX (not the cell object), since
    // underground cells have no board geometry — they only exist inside the modal.
    function _getUndergroundCells(state) {
      var UH = global.Game && global.Game.UndergroundHangar;
      if (UH && typeof UH.ensureStateShape === 'function') UH.ensureStateShape(state);
      var ugh = state.undergroundHangar;
      return ugh && Array.isArray(ugh.cells) ? ugh.cells : null;
    }

    function pickUndergroundRewardIndex(state) {
      var cells = _getUndergroundCells(state);
      if (!cells || !cells.length) return -1;
      var empty = [];
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        if (c && !c.tank && !c.drone) empty.push(i);
      }
      if (!empty.length) return -1;
      return empty[Math.floor(Math.random() * empty.length)];
    }

    function getUndergroundCellIndex() {
      var UH = global.Game && global.Game.UndergroundHangar;
      var idx = Number(UH && UH.CELL_INDEX);
      return Number.isFinite(idx) ? Math.max(0, Math.floor(idx)) : 15;
    }

    function spawnCrate() {
      var state = deps.getState();
      var BAL = deps.getBalance();
      var cell = pickEmptyCell();
      var size = BAL.crateSize;
      var now = deps.nowSec();

      var hangar = 'main';
      var cellIndex = -1;
      var rewardHangarIndex = -1;

      if (cell) {
        cellIndex = cell.i;
      } else {
        // Upper hangar is full: fall back to the underground hangar by landing the
        // crate on cell 15 (the underground hangar canvas button).
        rewardHangarIndex = pickUndergroundRewardIndex(state);
        if (rewardHangarIndex < 0) return false;
        hangar = 'underground';
        cellIndex = getUndergroundCellIndex();
      }

      var targetCell = state.cells[cellIndex];
      if (!targetCell) return false;
      var targetX = targetCell.x + targetCell.w / 2;
      var targetY = targetCell.y + targetCell.h / 2;

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
        cellIndex: cellIndex,
        claiming: false,
        // Underground-crate extension (crate → underground hangar fallback).
        hangar: hangar,
        stage: hangar === 'underground' ? 'falling' : 'idle',
        rewardHangarIndex: rewardHangarIndex,
        visible: true,
        landedAt: 0,
        nextRetryAtSec: 0,
        gateOpened: false,
        gatesClosed: false,
        openDone: false,
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
      // Underground crate: pointer targeting is only enabled once the landing
      // choreography (open -> disappear -> close) has fully finished. During the
      // fall the crate must not steal the cell 15 click from the hangar button,
      // and afterwards it is the shared cell-15 entry point handled in game.js.
      if (c.hangar === 'underground' && c.stage !== 'idle') return false;
      if (c.claiming) return false;
      if (c.hangar === 'underground' && c.visible === false) return false;
      var half = c.size * 0.5;
      return x >= c.x - half && x <= c.x + half && y >= c.y - half && y <= c.y + half;
    }

    function syncCrateHoverAt(x, y) {
      var state = deps.getState();
      var c = state.crate;
      if (!c || c.isAlive === false) return;
      if (c.hangar === 'underground' && (c.stage !== 'idle' || c.visible === false)) return;
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
      // Retry gate: when both hangars are full, spawnCrate() bails out. Retry on a
      // short cadence instead of waiting a full crateIntervalSec, so the box shows
      // up as soon as a slot frees up.
      var maxWaitSec = Math.max(1, BAL.crateIntervalSec);
      var retrySec = BAL.crateSpawnRetrySec;
      if (!Number.isFinite(retrySec) || retrySec <= 0) retrySec = 5;
      var waitSec = Math.min(maxWaitSec, retrySec);
      if (!state.crate && now >= state.nextCrateAt) {
        if (spawnCrate()) return;
        state.nextCrateAt = now + waitSec;
      }
    }

    function stepCrate(dt) {
      var state = deps.getState();
      var BAL = deps.getBalance();
      if (!state.crate) return;
      var c = state.crate;
      var UH = global.Game && global.Game.UndergroundHangar;

      // Keep the landing position glued to cell 15 across resizes.
      if (c.hangar === 'underground') {
        var cell15 = state.cells[c.cellIndex];
        if (cell15) {
          c.x = cell15.x + cell15.w / 2;
          c.targetY = cell15.y + cell15.h / 2;
        }
        if (typeof c.visible !== 'boolean') c.visible = true;
        if (typeof c.stage !== 'string') c.stage = 'falling';
      }

      var landed = c.y >= c.targetY;
      if (!landed) {
        c.y = Math.min(c.targetY, c.y + BAL.crateDropSpeed * dt);
        landed = c.y >= c.targetY;
      }
      c.pulse += dt * 4;
      c.animTimeSec = Number.isFinite(c.animTimeSec) ? (c.animTimeSec + dt) : dt;

      var anim = getCrateAnimation(c.animState);
      if (anim && anim.loop === false) {
        var frameCount = Math.max(1, Array.isArray(anim.frames) ? anim.frames.length : 1);
        var fps = Math.max(0.01, Number(anim.frameRateFps) || 1);
        var durationSec = frameCount / fps;
        if (c.animTimeSec >= durationSec) {
          if (c.animState === 'drop') {
            setCrateAnimationState(c, 'idle', true);
          } else if (c.animState === 'press') {
            setCrateAnimationState(c, c.isHover ? 'hover' : 'idle', true);
          }
        }
      }

      if (c.hangar !== 'underground') return;
      if (c.stage === 'idle') return;

      if (c.stage === 'falling') {
        // Open the gates slightly BEFORE touchdown so the box reads as falling
        // straight into the underground hangar instead of landing on top of a
        // closed lid. Lead time = full 'click' clip + configured hold.
        var leadDist = 0;
        if (UH && typeof UH.getLandingLeadSec === 'function') {
          var leadSec = Number(UH.getLandingLeadSec());
          if (Number.isFinite(leadSec) && leadSec > 0) leadDist = leadSec * BAL.crateDropSpeed;
        }
        if (!c.gateOpened && leadDist > 0 && (c.targetY - c.y) <= leadDist
          && UH && typeof UH.playLandingOpen === 'function') {
          c.gateOpened = true;
          UH.playLandingOpen(function () {
            var live = state.crate;
            if (!live || live.id !== c.id) return;
            live.openDone = true;
            _tryCloseUndergroundGates(state, live, UH);
          });
        }
        if (!landed) return;
        c.landedAt = deps.nowSec();
        c.stage = 'landing';
        // The box disappears into the (already opening) hangar.
        c.visible = false;
        c.isHover = false;
        _tryCloseUndergroundGates(state, c, UH);
        return;
      }

      if (c.stage === 'landing' || c.stage === 'opening') {
        // Watchdog: never leave the crate stuck in a choreography stage (atlas or
        // FSM unavailable) — release the UH lock and fall through to idle so the
        // player can still claim the reward.
        var timeoutSec = Number(BAL.crateLandingTimeoutSec);
        if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) timeoutSec = 3;
        if (c.landedAt && (deps.nowSec() - c.landedAt) >= timeoutSec) {
          c.visible = false;
          c.stage = 'idle';
          c.gatesClosed = true;
          if (UH && typeof UH.isLandingActive === 'function' && UH.isLandingActive()
            && typeof UH.cancelLanding === 'function') {
            UH.cancelLanding();
          }
        }
      }
    }

    // Gates close only after the opening pass has finished AND the box has
    // already gone into the hangar, keeping the strict open -> disappear -> close
    // order.
    function _tryCloseUndergroundGates(state, c, UH) {
      if (!c || !c.gateOpened || !c.openDone || c.gatesClosed) return;
      if (c.stage === 'falling' || c.visible !== false) return;
      c.gatesClosed = true;
      if (UH && typeof UH.playLandingClose === 'function') {
        UH.playLandingClose(function () {
          var done = state.crate;
          if (!done || done.id !== c.id) return;
          done.stage = 'idle';
        });
        return;
      }
      // No close pass available: release the FSM lock explicitly, otherwise the
      // cell 15 hover would stay suppressed for the rest of the session.
      if (UH && typeof UH.cancelLanding === 'function') UH.cancelLanding();
      c.stage = 'idle';
    }

    return {
      pickCrateRewardLevel: pickCrateRewardLevel,
      pickEmptyCell: pickEmptyCell,
      pickUndergroundRewardIndex: pickUndergroundRewardIndex,
      getUndergroundCellIndex: getUndergroundCellIndex,
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
