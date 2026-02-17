(function (global) {
  'use strict';

  var MODE_STANDBY = 'standby';
  var MODE_REPAIR = 'repair';

  var SUBSTATE_PATROL = 'patrol';
  var SUBSTATE_FLY_TO_TARGET = 'flyToTarget';
  var SUBSTATE_REPAIRING = 'repairing';
  var SUBSTATE_RETURN_TO_BASE = 'returnToBase';

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function toSafeInt(value, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.floor(value);
  }

  function getDroneLevelConfig(dronConfig, level) {
    var cfg = dronConfig && dronConfig.levels && typeof dronConfig.levels === 'object' ? dronConfig.levels : null;
    var lvl = Math.max(1, toSafeInt(level, 1));
    if (cfg) {
      for (var i = lvl; i >= 1; i--) {
        if (cfg[i]) return cfg[i];
      }
    }
    return { moveSpeedPxSec: 72, repairSpeedMult: 1, costMult: 1 };
  }

  function getSegmentById(state, segmentId) {
    if (!state || !Array.isArray(state.fenceSegments) || segmentId == null) return null;
    var byId = state.fenceSegmentsMeta && state.fenceSegmentsMeta.byId ? state.fenceSegmentsMeta.byId : null;
    if (byId && byId[segmentId]) return byId[segmentId];
    for (var i = 0; i < state.fenceSegments.length; i++) {
      var seg = state.fenceSegments[i];
      if (seg && seg.id === segmentId) return seg;
    }
    return null;
  }

  function getDroneById(state, droneId) {
    if (!state || !Array.isArray(state.drones)) return null;
    for (var i = 0; i < state.drones.length; i++) {
      if (state.drones[i] && state.drones[i].id === droneId) return state.drones[i];
    }
    return null;
  }

  function clearReservation(state, drone) {
    if (!state || !drone || drone.reservedSegmentId == null) {
      if (drone) drone.reservedSegmentId = null;
      return;
    }
    var seg = getSegmentById(state, drone.reservedSegmentId);
    if (seg && seg.reservedByDroneId === drone.id) seg.reservedByDroneId = null;
    drone.reservedSegmentId = null;
  }

  function releaseRepairState(state, drone) {
    clearReservation(state, drone);
    drone.targetSegmentId = null;
    drone.repair = null;
  }

  function normalizeBasePosition(state, drone) {
    var sc = state && state.supercomputer && typeof state.supercomputer === 'object' ? state.supercomputer : null;
    var baseX = Number.isFinite(sc && sc.x) ? sc.x : Number.isFinite(drone.basePos && drone.basePos.x) ? drone.basePos.x : 0;
    var baseY = Number.isFinite(sc && sc.y) ? sc.y : Number.isFinite(drone.basePos && drone.basePos.y) ? drone.basePos.y : 0;
    drone.basePos = drone.basePos && typeof drone.basePos === 'object' ? drone.basePos : { x: baseX, y: baseY };
    drone.basePos.x = baseX;
    drone.basePos.y = baseY;
    if (!drone.pos || typeof drone.pos !== 'object') drone.pos = { x: baseX, y: baseY };
    if (!Number.isFinite(drone.pos.x)) drone.pos.x = baseX;
    if (!Number.isFinite(drone.pos.y)) drone.pos.y = baseY;
  }

  function sanitizeDrone(state, raw, fallbackLevel) {
    var src = raw && typeof raw === 'object' ? raw : {};
    var mode = src.mode === MODE_REPAIR ? MODE_REPAIR : MODE_STANDBY;
    var substate = typeof src.substate === 'string' ? src.substate : SUBSTATE_PATROL;
    if (mode === MODE_STANDBY) substate = SUBSTATE_PATROL;
    if (mode === MODE_REPAIR && substate !== SUBSTATE_PATROL && substate !== SUBSTATE_FLY_TO_TARGET && substate !== SUBSTATE_REPAIRING && substate !== SUBSTATE_RETURN_TO_BASE) {
      substate = SUBSTATE_FLY_TO_TARGET;
    }

    var drone = {
      id: typeof src.id === 'string' && src.id.length > 0 ? src.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('dron_' + Date.now() + '_' + Math.floor(Math.random() * 100000))),
      level: Math.max(1, toSafeInt(src.level, fallbackLevel || 1)),
      mode: mode,
      substate: substate,
      pos: src.pos && typeof src.pos === 'object' ? { x: src.pos.x, y: src.pos.y } : { x: 0, y: 0 },
      basePos: src.basePos && typeof src.basePos === 'object' ? { x: src.basePos.x, y: src.basePos.y } : { x: 0, y: 0 },
      targetSegmentId: null,
      reservedSegmentId: null,
      repair: null,
      patrolSeed: Number.isFinite(src.patrolSeed) ? src.patrolSeed : Math.random() * Math.PI * 2,
    };

    normalizeBasePosition(state, drone);
    if (mode === MODE_REPAIR) drone.substate = drone.substate === SUBSTATE_REPAIRING ? SUBSTATE_FLY_TO_TARGET : drone.substate;
    return drone;
  }

  function ensureState(state) {
    if (!state || typeof state !== 'object') return;
    if (!Array.isArray(state.drones)) state.drones = [];
  }

  function clearAllReservations(state) {
    if (!state || !Array.isArray(state.fenceSegments)) return;
    for (var i = 0; i < state.fenceSegments.length; i++) {
      var seg = state.fenceSegments[i];
      if (seg && seg.reservedByDroneId != null) seg.reservedByDroneId = null;
    }
  }

  function restoreSavedDrones(state, savedDrones) {
    ensureState(state);
    clearAllReservations(state);
    state.drones.length = 0;
    if (!Array.isArray(savedDrones)) return;
    for (var i = 0; i < savedDrones.length; i++) {
      var drone = sanitizeDrone(state, savedDrones[i], 1);
      if (drone.mode === MODE_REPAIR) drone.substate = SUBSTATE_FLY_TO_TARGET;
      state.drones.push(drone);
    }
  }

  function sortSegmentId(a, b) {
    var left = a && a.id != null ? String(a.id) : '';
    var right = b && b.id != null ? String(b.id) : '';
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }

  function pickMostDamagedFreeSegment(state, drone) {
    if (!state || !Array.isArray(state.fenceSegments) || !state.fenceSegments.length) return null;
    var best = null;
    var bestRatio = Infinity;

    for (var i = 0; i < state.fenceSegments.length; i++) {
      var seg = state.fenceSegments[i];
      if (!seg || !Number.isFinite(seg.hp) || !Number.isFinite(seg.maxHp) || seg.maxHp <= 0) continue;
      if (seg.hp >= seg.maxHp) continue;
      if (seg.reservedByDroneId != null && seg.reservedByDroneId !== drone.id) continue;

      var ratio = clamp(seg.hp / seg.maxHp, 0, 1);
      if (!best || ratio < bestRatio) {
        best = seg;
        bestRatio = ratio;
      } else if (best && ratio === bestRatio && sortSegmentId(seg, best) < 0) {
        best = seg;
      }
    }

    return best;
  }

  function computeRepairPlan(drone, segment, fenceRepairCost, dronConfig) {
    if (!drone || !segment) return null;
    var levelCfg = getDroneLevelConfig(dronConfig, drone.level);
    var maxHp = Math.max(1, Number(segment.maxHp) || 1);
    var hp = clamp(Number(segment.hp) || 0, 0, maxHp);
    var missingRatio = clamp((maxHp - hp) / maxHp, 0, 1);
    if (missingRatio <= 0) return null;

    var baseCost = Math.max(0, Math.floor(Number(fenceRepairCost) || 0));
    var costMult = Number.isFinite(levelCfg.costMult) && levelCfg.costMult > 0 ? levelCfg.costMult : 1;
    var totalCostCoins = Math.ceil(baseCost * missingRatio * costMult);
    if (totalCostCoins <= 0) totalCostCoins = 1;

    var baseRepairSec = Number.isFinite(dronConfig && dronConfig.baseRepairSec) && dronConfig.baseRepairSec > 0 ? dronConfig.baseRepairSec : 5;
    var repairSpeedMult = Number.isFinite(levelCfg.repairSpeedMult) && levelCfg.repairSpeedMult > 0 ? levelCfg.repairSpeedMult : 1;
    var repairDurationSec = baseRepairSec / repairSpeedMult;

    return {
      startHp: hp,
      maxHp: maxHp,
      totalCostCoins: totalCostCoins,
      repairDurationSec: Math.max(0.01, repairDurationSec),
      repairStartTimeSec: 0,
      coinsSpentPrev: 0,
    };
  }

  function evaluateRepairAction(state, drone, fenceRepairCost, dronConfig) {
    var segment = pickMostDamagedFreeSegment(state, drone);
    if (!segment) return { enabled: false, reason: 'no_target', segment: null, plan: null };
    var plan = computeRepairPlan(drone, segment, fenceRepairCost, dronConfig);
    if (!plan) return { enabled: false, reason: 'no_target', segment: null, plan: null };
    if ((state.coins || 0) < plan.totalCostCoins) return { enabled: false, reason: 'not_enough_coins', segment: segment, plan: plan };
    return { enabled: true, reason: '', segment: segment, plan: plan };
  }

  function setStandbyMode(state, drone) {
    releaseRepairState(state, drone);
    drone.mode = MODE_STANDBY;
    drone.substate = SUBSTATE_PATROL;
  }

  function setReturnToBase(state, drone) {
    clearReservation(state, drone);
    drone.targetSegmentId = null;
    drone.repair = null;
    drone.substate = SUBSTATE_RETURN_TO_BASE;
  }

  function reserveSegmentForDrone(drone, segment) {
    if (!drone || !segment) return false;
    segment.reservedByDroneId = drone.id;
    drone.targetSegmentId = segment.id;
    drone.reservedSegmentId = segment.id;
    return true;
  }

  function tryEnableRepairMode(state, drone, fenceRepairCost, dronConfig) {
    if (!state || !drone) return false;
    clearReservation(state, drone);
    var check = evaluateRepairAction(state, drone, fenceRepairCost, dronConfig);
    if (!check.enabled || !check.segment) return false;
    reserveSegmentForDrone(drone, check.segment);
    drone.mode = MODE_REPAIR;
    drone.substate = SUBSTATE_FLY_TO_TARGET;
    drone.repair = null;
    return true;
  }

  function moveTowards(drone, tx, ty, speed, dt) {
    var dx = tx - drone.pos.x;
    var dy = ty - drone.pos.y;
    var dist = Math.hypot(dx, dy);
    if (dist <= 0.0001) return dist;
    var maxStep = Math.max(0, speed * dt);
    if (dist <= maxStep || maxStep <= 0) {
      drone.pos.x = tx;
      drone.pos.y = ty;
      return 0;
    }
    var k = maxStep / dist;
    drone.pos.x += dx * k;
    drone.pos.y += dy * k;
    return dist - maxStep;
  }

  function updatePatrol(drone, nowSec, speed, dt) {
    var radius = 20 + (Math.sin(drone.patrolSeed || 0) + 1) * 8;
    var angle = (drone.patrolSeed || 0) + nowSec * 0.8;
    var tx = drone.basePos.x + Math.cos(angle) * radius;
    var ty = drone.basePos.y + Math.sin(angle * 0.9) * radius * 0.6;
    moveTowards(drone, tx, ty, speed * 0.6, dt);
  }

  function ensureReservationConsistency(state) {
    if (!state || !Array.isArray(state.fenceSegments) || !Array.isArray(state.drones)) return;
    for (var i = 0; i < state.fenceSegments.length; i++) {
      var seg = state.fenceSegments[i];
      if (!seg) continue;
      if (seg.reservedByDroneId != null && !getDroneById(state, seg.reservedByDroneId)) seg.reservedByDroneId = null;
    }
  }

  function tryStartRepairing(state, drone, nowSec, fenceRepairCost, dronConfig) {
    var segment = getSegmentById(state, drone.targetSegmentId);
    if (!segment || segment.hp >= segment.maxHp || (segment.reservedByDroneId != null && segment.reservedByDroneId !== drone.id)) {
      clearReservation(state, drone);
      drone.targetSegmentId = null;
      drone.repair = null;
      return false;
    }
    if (segment.reservedByDroneId == null) segment.reservedByDroneId = drone.id;
    drone.reservedSegmentId = segment.id;

    var plan = computeRepairPlan(drone, segment, fenceRepairCost, dronConfig);
    if (!plan || state.coins < plan.totalCostCoins) {
      setReturnToBase(state, drone);
      return false;
    }
    plan.repairStartTimeSec = nowSec;
    plan.coinsSpentPrev = 0;
    drone.repair = plan;
    drone.substate = SUBSTATE_REPAIRING;
    return true;
  }

  function onRepairCompleted(state, drone, fenceRepairCost, dronConfig) {
    clearReservation(state, drone);
    drone.targetSegmentId = null;
    drone.repair = null;

    var check = evaluateRepairAction(state, drone, fenceRepairCost, dronConfig);
    if (!check.enabled || !check.segment) {
      setReturnToBase(state, drone);
      return;
    }
    reserveSegmentForDrone(drone, check.segment);
    drone.substate = SUBSTATE_FLY_TO_TARGET;
  }

  function stepRepairing(state, drone, nowSec, fenceRepairCost, dronConfig) {
    var seg = getSegmentById(state, drone.targetSegmentId);
    var repair = drone.repair;
    if (!seg || !repair || seg.hp >= seg.maxHp || (seg.reservedByDroneId != null && seg.reservedByDroneId !== drone.id)) {
      setReturnToBase(state, drone);
      return;
    }
    if (seg.reservedByDroneId == null) seg.reservedByDroneId = drone.id;
    drone.reservedSegmentId = seg.id;

    var duration = Math.max(0.01, Number(repair.repairDurationSec) || 0.01);
    var t = clamp((nowSec - repair.repairStartTimeSec) / duration, 0, 1);
    var hpTarget = Math.round(repair.startHp + (repair.maxHp - repair.startHp) * t);
    var coinsSpentTarget = Math.floor(repair.totalCostCoins * t);
    var deltaCoins = coinsSpentTarget - (repair.coinsSpentPrev || 0);

    if (deltaCoins > 0) {
      var canSpend = Math.max(0, Math.floor(state.coins));
      if (canSpend < deltaCoins) {
        var actuallySpent = canSpend;
        state.coins = Math.max(0, state.coins - actuallySpent);
        repair.coinsSpentPrev = (repair.coinsSpentPrev || 0) + actuallySpent;
        var tByCoins = repair.totalCostCoins > 0 ? clamp(repair.coinsSpentPrev / repair.totalCostCoins, 0, 1) : 0;
        hpTarget = Math.round(repair.startHp + (repair.maxHp - repair.startHp) * tByCoins);
        seg.hp = clamp(hpTarget, 0, seg.maxHp);
        seg.broken = seg.hp <= 0;
        if (state.coins <= 0 && seg.hp < seg.maxHp) {
          setReturnToBase(state, drone);
        }
        return;
      }
      state.coins -= deltaCoins;
      repair.coinsSpentPrev = coinsSpentTarget;
    }

    seg.hp = clamp(hpTarget, 0, seg.maxHp);
    seg.broken = seg.hp <= 0;

    if (seg.hp >= seg.maxHp) {
      seg.hp = seg.maxHp;
      seg.broken = false;
      onRepairCompleted(state, drone, fenceRepairCost, dronConfig);
      return;
    }

    if (state.coins <= 0 && seg.hp < seg.maxHp) {
      setReturnToBase(state, drone);
    }
  }

  function stepSingleDrone(options, drone) {
    var state = options.state;
    var dt = options.dt;
    var nowSec = options.nowSec;
    var dronConfig = options.dronConfig || {};
    var levelCfg = getDroneLevelConfig(dronConfig, drone.level);
    var moveSpeed = Number.isFinite(levelCfg.moveSpeedPxSec) && levelCfg.moveSpeedPxSec > 0 ? levelCfg.moveSpeedPxSec : 72;

    normalizeBasePosition(state, drone);

    if (drone.mode !== MODE_REPAIR) {
      drone.mode = MODE_STANDBY;
      drone.substate = SUBSTATE_PATROL;
      releaseRepairState(state, drone);
      updatePatrol(drone, nowSec, moveSpeed, dt);
      return;
    }

    if (drone.substate === SUBSTATE_PATROL) drone.substate = SUBSTATE_FLY_TO_TARGET;

    if (drone.substate === SUBSTATE_RETURN_TO_BASE) {
      var left = moveTowards(drone, drone.basePos.x, drone.basePos.y, moveSpeed, dt);
      if (left <= 4) {
        drone.mode = MODE_STANDBY;
        drone.substate = SUBSTATE_PATROL;
      }
      return;
    }

    if (drone.targetSegmentId == null) {
      var check = evaluateRepairAction(state, drone, options.fenceRepairCost, dronConfig);
      if (!check.enabled || !check.segment) {
        setReturnToBase(state, drone);
        return;
      }
      reserveSegmentForDrone(drone, check.segment);
      drone.substate = SUBSTATE_FLY_TO_TARGET;
      drone.repair = null;
    }

    if (drone.substate === SUBSTATE_FLY_TO_TARGET) {
      var segment = getSegmentById(state, drone.targetSegmentId);
      if (!segment || segment.hp >= segment.maxHp || (segment.reservedByDroneId != null && segment.reservedByDroneId !== drone.id)) {
        clearReservation(state, drone);
        drone.targetSegmentId = null;
        drone.repair = null;
        setReturnToBase(state, drone);
        return;
      }
      if (segment.reservedByDroneId == null) segment.reservedByDroneId = drone.id;
      drone.reservedSegmentId = segment.id;
      var remain = moveTowards(drone, segment.x, segment.y, moveSpeed, dt);
      if (remain <= 6) tryStartRepairing(state, drone, nowSec, options.fenceRepairCost, dronConfig);
      return;
    }

    if (drone.substate === SUBSTATE_REPAIRING) {
      stepRepairing(state, drone, nowSec, options.fenceRepairCost, dronConfig);
      return;
    }

    setReturnToBase(state, drone);
  }

  function step(options) {
    var opts = options || {};
    var state = opts.state;
    if (!state) return;
    ensureState(state);
    ensureReservationConsistency(state);

    var dt = Number.isFinite(opts.dt) ? Math.max(0, opts.dt) : 0;
    var nowSec = Number.isFinite(opts.nowSec) ? opts.nowSec : 0;

    for (var i = 0; i < state.drones.length; i++) {
      var drone = state.drones[i];
      if (!drone || typeof drone !== 'object') {
        state.drones[i] = sanitizeDrone(state, null, 1);
        drone = state.drones[i];
      }
      stepSingleDrone({
        state: state,
        dt: dt,
        nowSec: nowSec,
        fenceRepairCost: opts.fenceRepairCost,
        dronConfig: opts.dronConfig,
      }, drone);
    }
  }

  function addDron(state, level, options) {
    ensureState(state);
    var opts = options || {};
    var dronConfig = opts.dronConfig || {};
    var maxLevel = Number.isFinite(dronConfig.maxLevel) ? Math.max(1, Math.floor(dronConfig.maxLevel)) : 1;
    var lvl = clamp(toSafeInt(level, 1), 1, maxLevel);
    var drone = sanitizeDrone(state, {
      level: lvl,
      mode: MODE_STANDBY,
      substate: SUBSTATE_PATROL,
      basePos: state.supercomputer ? { x: state.supercomputer.x, y: state.supercomputer.y } : { x: 0, y: 0 },
      pos: state.supercomputer ? { x: state.supercomputer.x, y: state.supercomputer.y } : { x: 0, y: 0 },
      patrolSeed: Math.random() * Math.PI * 2,
    }, lvl);

    var idx = state.drones.length;
    drone.pos.x += ((idx % 3) - 1) * 18;
    drone.pos.y += (Math.floor(idx / 3) % 3) * 12;
    state.drones.push(drone);
    return drone;
  }

  function getIconsLayout(drone, dronConfig, balScale) {
    var iconSize = dronConfig && dronConfig.iconSize ? dronConfig.iconSize : { w: 20, h: 20 };
    var iconW = Math.max(10, (Number(iconSize.w) || 20) * balScale);
    var iconH = Math.max(10, (Number(iconSize.h) || 20) * balScale);
    var offsetY = (Number.isFinite(dronConfig && dronConfig.iconsOffsetY) ? dronConfig.iconsOffsetY : -32) * balScale;
    var gap = Math.max(3, 4 * balScale);
    var totalW = iconW * 2 + gap;
    var leftX = drone.pos.x - totalW * 0.5;
    var topY = drone.pos.y + offsetY;

    return {
      standby: { x: leftX, y: topY, w: iconW, h: iconH },
      repair: { x: leftX + iconW + gap, y: topY, w: iconW, h: iconH },
    };
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    var radius = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawIcon(ctx, rect, glyph, active, disabled) {
    var bg = disabled ? 'rgba(48,48,48,0.7)' : active ? 'rgba(255,184,114,0.35)' : 'rgba(20,26,36,0.72)';
    var stroke = active ? 'rgba(255,219,160,0.95)' : 'rgba(255,255,255,0.35)';
    ctx.save();
    drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.max(3, rect.h * 0.22));
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.globalAlpha = disabled ? 0.55 : 1;
    ctx.font = Math.floor(Math.max(10, rect.h * 0.7)) + 'px system-ui, Segoe UI Emoji, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4f6fb';
    ctx.fillText(glyph, rect.x + rect.w * 0.5, rect.y + rect.h * 0.52);
    ctx.restore();
  }

  function drawDroneBody(ctx, drone, nowSec, balScale, dronSprites) {
    var cfg = dronSprites && dronSprites.config ? dronSprites.config : {};
    var modeAnimName = drone.mode === MODE_REPAIR ? (drone.substate === SUBSTATE_REPAIRING ? 'repair' : 'fly') : 'idle';
    var anim = dronSprites && dronSprites.getAnimation ? dronSprites.getAnimation(modeAnimName) : null;

    if (dronSprites && dronSprites.ready && dronSprites.atlasImg && anim && Array.isArray(anim.frames) && anim.frames.length) {
      var fps = Math.max(0.01, Number(anim.frameRateFps) || 6);
      var rawFrame = Math.floor(nowSec * fps);
      var frameIndex = anim.loop === false ? Math.min(anim.frames.length - 1, rawFrame) : (rawFrame % anim.frames.length);
      var frame = dronSprites.pickFrame ? dronSprites.pickFrame(anim.frames[frameIndex]) : null;
      if (frame) {
        var scale = (Number.isFinite(cfg.scale) ? cfg.scale : 1) * balScale;
        var anchor = cfg.anchor || { x: 0.5, y: 0.5 };
        ctx.drawImage(
          dronSprites.atlasImg,
          frame.x, frame.y, frame.w, frame.h,
          drone.pos.x - frame.w * scale * anchor.x,
          drone.pos.y - frame.h * scale * anchor.y,
          frame.w * scale,
          frame.h * scale
        );
        return;
      }
    }

    ctx.save();
    ctx.fillStyle = drone.mode === MODE_REPAIR ? 'rgba(130,199,255,0.95)' : 'rgba(177,203,255,0.9)';
    ctx.beginPath();
    ctx.arc(drone.pos.x, drone.pos.y, 10 * balScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw(options) {
    var opts = options || {};
    var state = opts.state;
    var ctx = opts.ctx;
    if (!state || !Array.isArray(state.drones) || !ctx) return;

    var balScale = Number.isFinite(opts.balScale) ? opts.balScale : 1;
    var nowSec = Number.isFinite(opts.nowSec) ? opts.nowSec : 0;
    var dronConfig = opts.dronConfig || {};

    for (var i = 0; i < state.drones.length; i++) {
      var drone = state.drones[i];
      if (!drone) continue;

      drawDroneBody(ctx, drone, nowSec, balScale, opts.dronSprites);

      var layout = getIconsLayout(drone, dronConfig, balScale);
      var repairStatus = evaluateRepairAction(state, drone, opts.fenceRepairCost, dronConfig);
      drawIcon(ctx, layout.standby, '⏳', drone.mode === MODE_STANDBY, false);
      drawIcon(ctx, layout.repair, '🔧', drone.mode === MODE_REPAIR, !repairStatus.enabled && drone.mode !== MODE_REPAIR);

      drone._iconLayout = layout;
      drone._repairEnabled = !!repairStatus.enabled;
    }
  }

  function hitRect(rect, x, y) {
    return rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function handlePointerDown(options) {
    var opts = options || {};
    var state = opts.state;
    if (!state || !Array.isArray(state.drones)) return { handled: false, changed: false };
    var x = opts.x;
    var y = opts.y;
    var balScale = Number.isFinite(opts.balScale) ? opts.balScale : 1;
    var dronConfig = opts.dronConfig || {};

    for (var i = state.drones.length - 1; i >= 0; i--) {
      var drone = state.drones[i];
      if (!drone) continue;
      var layout = drone._iconLayout || getIconsLayout(drone, dronConfig, balScale);

      if (hitRect(layout.standby, x, y)) {
        if (drone.mode !== MODE_STANDBY || drone.substate !== SUBSTATE_PATROL) {
          setStandbyMode(state, drone);
          return { handled: true, changed: true };
        }
        return { handled: true, changed: false };
      }

      if (hitRect(layout.repair, x, y)) {
        var available = evaluateRepairAction(state, drone, opts.fenceRepairCost, dronConfig);
        if (!available.enabled && drone.mode !== MODE_REPAIR) return { handled: true, changed: false };
        if (drone.mode === MODE_REPAIR) {
          setStandbyMode(state, drone);
          return { handled: true, changed: true };
        }
        if (tryEnableRepairMode(state, drone, opts.fenceRepairCost, dronConfig)) return { handled: true, changed: true };
        return { handled: true, changed: false };
      }
    }

    return { handled: false, changed: false };
  }

  global.Game = global.Game || {};
  global.Game.Drones = {
    MODE_STANDBY: MODE_STANDBY,
    MODE_REPAIR: MODE_REPAIR,
    SUBSTATE_PATROL: SUBSTATE_PATROL,
    SUBSTATE_FLY_TO_TARGET: SUBSTATE_FLY_TO_TARGET,
    SUBSTATE_REPAIRING: SUBSTATE_REPAIRING,
    SUBSTATE_RETURN_TO_BASE: SUBSTATE_RETURN_TO_BASE,
    ensureState: ensureState,
    sanitizeDrone: sanitizeDrone,
    restoreSavedDrones: restoreSavedDrones,
    clearAllReservations: clearAllReservations,
    getDroneLevelConfig: getDroneLevelConfig,
    evaluateRepairAction: evaluateRepairAction,
    tryEnableRepairMode: tryEnableRepairMode,
    addDron: addDron,
    step: step,
    draw: draw,
    handlePointerDown: handlePointerDown,
  };
})(typeof window !== 'undefined' ? window : this);
