(function (global) {
  'use strict';

  var MODE_STANDBY = 'standby';
  var MODE_REPAIR = 'repair';

  var SUBSTATE_REPAIR_PATROL = 'repair_patrol';
  var SUBSTATE_REPAIR_MOVE_TO_TARGET = 'repair_moveToTarget';
  var SUBSTATE_REPAIR_WORK = 'repair_work';

  var LEGACY_SUBSTATE_MAP = {
    patrol: SUBSTATE_REPAIR_PATROL,
    flyToTarget: SUBSTATE_REPAIR_MOVE_TO_TARGET,
    repairing: SUBSTATE_REPAIR_WORK,
    returnToBase: SUBSTATE_REPAIR_PATROL,
  };

  var REPAIR_SCAN_PERIOD_SEC = 0.5;
  var REPAIR_PATROL_SPEED_MULT = 0.5;
  var REPAIR_ARRIVE_EPSILON_PX = 6;
  var DRONE_SLOT_COUNT = 9;
  var DRONE_SLOT_DRAG_THRESHOLD_PX = 6;
  var DRONE_SLOT_GAP_PX = 10;
  var DRONE_SLOT_LAYOUT = [
    { slotIndex: 0, side: 'top', lane: 0 },
    { slotIndex: 1, side: 'top', lane: 1 },
    { slotIndex: 2, side: 'top', lane: 2 },
    { slotIndex: 3, side: 'left', lane: 0 },
    { slotIndex: 4, side: 'left', lane: 1 },
    { slotIndex: 5, side: 'left', lane: 2 },
    { slotIndex: 6, side: 'right', lane: 0 },
    { slotIndex: 7, side: 'right', lane: 1 },
    { slotIndex: 8, side: 'right', lane: 2 },
  ];

  var _slotDragState = null;
  var _selectedSlotIndex = null;

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

  function ensureState(state) {
    if (!state || typeof state !== 'object') return;
    if (!Array.isArray(state.drones)) state.drones = [];
  }

  function isValidSlotIndex(slotIndex) {
    return Number.isFinite(slotIndex) && slotIndex >= 0 && slotIndex < DRONE_SLOT_COUNT;
  }

  function getDroneBySlotIndex(state, slotIndex) {
    if (!state || !Array.isArray(state.drones) || !isValidSlotIndex(slotIndex)) return null;
    for (var i = 0; i < state.drones.length; i++) {
      var drone = state.drones[i];
      if (drone && drone.slotIndex === slotIndex) return drone;
    }
    return null;
  }

  function findFirstFreeSlotIndex(state) {
    if (!state || !Array.isArray(state.drones)) return 0;
    var occupied = Object.create(null);
    for (var i = 0; i < state.drones.length; i++) {
      var drone = state.drones[i];
      if (drone && isValidSlotIndex(drone.slotIndex)) occupied[drone.slotIndex] = true;
    }
    for (var slotIndex = 0; slotIndex < DRONE_SLOT_COUNT; slotIndex++) {
      if (!occupied[slotIndex]) return slotIndex;
    }
    return null;
  }

  function assignMissingDroneSlots(state) {
    if (!state || !Array.isArray(state.drones)) return;

    var occupied = Object.create(null);
    for (var i = 0; i < state.drones.length; i++) {
      var drone = state.drones[i];
      if (!drone) continue;
      if (!isValidSlotIndex(drone.slotIndex) || occupied[drone.slotIndex]) {
        drone.slotIndex = null;
        continue;
      }
      occupied[drone.slotIndex] = true;
    }

    for (var j = 0; j < state.drones.length; j++) {
      var pending = state.drones[j];
      if (!pending || isValidSlotIndex(pending.slotIndex)) continue;
      for (var slotIndex = 0; slotIndex < DRONE_SLOT_COUNT; slotIndex++) {
        if (!occupied[slotIndex]) {
          pending.slotIndex = slotIndex;
          occupied[slotIndex] = true;
          break;
        }
      }
    }
  }

  function getHangarRect(state, options) {
    var boardRect = options && options.boardRect && typeof options.boardRect === 'object'
      ? options.boardRect
      : (state && state.boardRect && typeof state.boardRect === 'object' ? state.boardRect : null);
    if (boardRect
      && Number.isFinite(boardRect.x)
      && Number.isFinite(boardRect.y)
      && Number.isFinite(boardRect.w)
      && Number.isFinite(boardRect.h)
      && boardRect.w > 0
      && boardRect.h > 0) {
      return {
        x: boardRect.x,
        y: boardRect.y,
        w: boardRect.w,
        h: boardRect.h,
      };
    }

    var sc = state && state.supercomputer && typeof state.supercomputer === 'object' ? state.supercomputer : null;
    var fallbackW = 196;
    var fallbackH = 196;
    var baseX = Number.isFinite(sc && sc.x) ? sc.x : fallbackW * 0.5;
    var baseY = Number.isFinite(sc && sc.y) ? sc.y : fallbackH * 0.5;
    return {
      x: baseX - fallbackW * 0.5,
      y: baseY - fallbackH - 72,
      w: fallbackW,
      h: fallbackH,
    };
  }

  function getDroneSlotsLayout(state, options) {
    var rect = getHangarRect(state, options);
    var balScale = Number.isFinite(options && options.balScale) ? Math.max(0.5, options.balScale) : 1;
    var slotGap = DRONE_SLOT_GAP_PX;
    var maxTopSlotSize = Math.max(14, (rect.w - slotGap * 2) / 3);
    var maxSideSlotSize = Math.max(14, (rect.h - slotGap * 2) / 3);
    var minSlotSize = Math.max(16, 18 * balScale);
    var maxSlotSize = Math.max(minSlotSize, Math.max(24, 29 * balScale));
    var slotSize = Math.min(maxSlotSize, Math.max(minSlotSize, Math.min(maxTopSlotSize, maxSideSlotSize, Math.min(rect.w, rect.h) * 0.12)));
    var borderGap = Math.max(2, 3 * balScale);
    var groupSpan = slotSize * 3 + slotGap * 2;
    var topStartX = rect.x + (rect.w - groupSpan) * 0.5;
    var sideStartY = rect.y + (rect.h - groupSpan) * 0.5;
    var slots = [];

    for (var i = 0; i < DRONE_SLOT_LAYOUT.length; i++) {
      var def = DRONE_SLOT_LAYOUT[i];
      var cx = rect.x + rect.w * 0.5;
      var cy = rect.y + rect.h * 0.5;
      if (def.side === 'top') {
        cx = topStartX + def.lane * (slotSize + slotGap) + slotSize * 0.5;
        cy = rect.y - slotSize * 0.5 - borderGap;
      } else if (def.side === 'left') {
        cx = rect.x - slotSize * 0.5 - borderGap;
        cy = sideStartY + def.lane * (slotSize + slotGap) + slotSize * 0.5;
      } else if (def.side === 'right') {
        cx = rect.x + rect.w + slotSize * 0.5 + borderGap;
        cy = sideStartY + def.lane * (slotSize + slotGap) + slotSize * 0.5;
      }
      slots.push({
        slotIndex: def.slotIndex,
        side: def.side,
        lane: def.lane,
        cx: cx,
        cy: cy,
        x: cx - slotSize * 0.5,
        y: cy - slotSize * 0.5,
        w: slotSize,
        h: slotSize,
      });
    }

    return slots;
  }

  function hasAssignedRepairDrone(state) {
    if (!state || !Array.isArray(state.drones)) return false;
    for (var i = 0; i < state.drones.length; i++) {
      if (state.drones[i] && state.drones[i].mode === MODE_REPAIR) return true;
    }
    return false;
  }

  function resolveHangarDroneAnimName(drone) {
    if (!drone) return 'wait';
    return drone.mode === MODE_REPAIR ? 'work' : 'wait';
  }

  function resolveWorldDroneAnimName(drone) {
    if (!drone) return 'wait';
    if (drone.mode === MODE_REPAIR) {
      return drone.substate === SUBSTATE_REPAIR_WORK ? 'repair' : 'fly';
    }
    return 'wait';
  }

  function drawSlotActivityOverlay(ctx, slot, nowSec) {
    if (!ctx || !slot) return;
    var overlayApi = global.Game && global.Game.SlotActivityOverlay;
    var radius = Math.max(5, slot.w * 0.2);
    if (overlayApi && typeof overlayApi.draw === 'function') {
      overlayApi.draw(ctx, slot.x, slot.y, slot.w, slot.h, radius, {
        baseAlpha: 0.52,
        brightAlpha: 0.18,
        darkAlpha: 0.16,
        borderAlpha: 0.78,
        seed: slot.slotIndex * 101 + Math.floor(slot.x) * 17 + Math.floor(slot.y) * 29,
      });
      return;
    }

    ctx.save();
    drawRoundedRect(ctx, slot.x, slot.y, slot.w, slot.h, radius);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,152,0,0.52)';
    ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    ctx.restore();
  }

  function syncDroneBasePositionFromSlot(state, drone, options) {
    if (!drone || !isValidSlotIndex(drone.slotIndex)) return false;
    var slots = getDroneSlotsLayout(state, options);
    var slot = slots[drone.slotIndex];
    if (!slot) return false;

    if (!drone.basePos || typeof drone.basePos !== 'object') {
      drone.basePos = { x: slot.cx, y: slot.cy };
    } else {
      drone.basePos.x = slot.cx;
      drone.basePos.y = slot.cy;
    }

    if (!drone.pos || typeof drone.pos !== 'object') {
      drone.pos = { x: slot.cx, y: slot.cy };
    }
    return true;
  }

  function snapDroneToAssignedSlot(state, drone, options) {
    if (!syncDroneBasePositionFromSlot(state, drone, options)) return false;
    drone.pos.x = drone.basePos.x;
    drone.pos.y = drone.basePos.y;
    return true;
  }

  function ensureRepairClaimsStore(state) {
    if (!state || typeof state !== 'object') return null;
    if (!state.fence || typeof state.fence !== 'object') state.fence = {};
    if (!state.fence.repairClaims || typeof state.fence.repairClaims !== 'object') state.fence.repairClaims = {};
    return state.fence.repairClaims;
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

  function getClaimOwner(state, segmentId) {
    if (segmentId == null) return null;
    var claims = ensureRepairClaimsStore(state);
    if (claims && claims[segmentId] != null) return claims[segmentId];
    var seg = getSegmentById(state, segmentId);
    if (seg && seg.reservedByDroneId != null) return seg.reservedByDroneId;
    return null;
  }

  function setClaim(state, segmentId, droneId) {
    if (segmentId == null || droneId == null) return;
    var claims = ensureRepairClaimsStore(state);
    if (claims) claims[segmentId] = droneId;
    var seg = getSegmentById(state, segmentId);
    if (seg) seg.reservedByDroneId = droneId;
  }

  function clearClaim(state, segmentId, droneId) {
    if (segmentId == null) return;
    var claims = ensureRepairClaimsStore(state);
    if (claims && claims[segmentId] != null) {
      if (droneId == null || claims[segmentId] === droneId) delete claims[segmentId];
    }
    var seg = getSegmentById(state, segmentId);
    if (seg && (droneId == null || seg.reservedByDroneId === droneId)) seg.reservedByDroneId = null;
  }

  function clearClaimForDrone(state, drone) {
    if (!drone) return;
    if (drone.reservedSegmentId != null) clearClaim(state, drone.reservedSegmentId, drone.id);
    drone.reservedSegmentId = null;
  }

  function releaseRepairState(state, drone) {
    clearClaimForDrone(state, drone);
    drone.targetSegmentId = null;
    drone.repair = null;
  }

  function normalizeSubstate(mode, substate) {
    if (mode !== MODE_REPAIR) return SUBSTATE_REPAIR_PATROL;
    var next = typeof substate === 'string' ? substate : SUBSTATE_REPAIR_PATROL;
    if (LEGACY_SUBSTATE_MAP[next]) next = LEGACY_SUBSTATE_MAP[next];
    if (next !== SUBSTATE_REPAIR_PATROL && next !== SUBSTATE_REPAIR_MOVE_TO_TARGET && next !== SUBSTATE_REPAIR_WORK) {
      next = SUBSTATE_REPAIR_PATROL;
    }
    return next;
  }

  function normalizeBasePosition(state, drone) {
    var resolvedBySlot = syncDroneBasePositionFromSlot(state, drone, null);
    var sc = state && state.supercomputer && typeof state.supercomputer === 'object' ? state.supercomputer : null;
    var baseX = resolvedBySlot
      ? drone.basePos.x
      : (Number.isFinite(sc && sc.x) ? sc.x : Number.isFinite(drone.basePos && drone.basePos.x) ? drone.basePos.x : 0);
    var baseY = resolvedBySlot
      ? drone.basePos.y
      : (Number.isFinite(sc && sc.y) ? sc.y : Number.isFinite(drone.basePos && drone.basePos.y) ? drone.basePos.y : 0);
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
    var substate = normalizeSubstate(mode, src.substate);

    var drone = {
      id: typeof src.id === 'string' && src.id.length > 0 ? src.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('dron_' + Date.now() + '_' + Math.floor(Math.random() * 100000))),
      level: Math.max(1, toSafeInt(src.level, fallbackLevel || 1)),
      mode: mode,
      substate: substate,
      pos: src.pos && typeof src.pos === 'object' ? { x: src.pos.x, y: src.pos.y } : { x: 0, y: 0 },
      basePos: src.basePos && typeof src.basePos === 'object' ? { x: src.basePos.x, y: src.basePos.y } : { x: 0, y: 0 },
      targetSegmentId: src.targetSegmentId != null ? src.targetSegmentId : null,
      reservedSegmentId: src.reservedSegmentId != null ? src.reservedSegmentId : null,
      repair: src.repair && typeof src.repair === 'object' ? src.repair : null,
      slotIndex: isValidSlotIndex(src.slotIndex) ? src.slotIndex : null,
      patrolSeed: Number.isFinite(src.patrolSeed) ? src.patrolSeed : Math.random() * Math.PI * 2,
      nextRepairScanAtSec: Number.isFinite(src.nextRepairScanAtSec) ? src.nextRepairScanAtSec : 0,
      patrolPerimeterProgressPx: Number.isFinite(src.patrolPerimeterProgressPx) ? src.patrolPerimeterProgressPx : Math.random() * 100,
    };

    normalizeBasePosition(state, drone);
    return drone;
  }

  function clearAllReservations(state) {
    var claims = ensureRepairClaimsStore(state);
    if (claims) {
      for (var key in claims) {
        if (Object.prototype.hasOwnProperty.call(claims, key)) delete claims[key];
      }
    }
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
      if (drone.mode === MODE_REPAIR) {
        releaseRepairState(state, drone);
        drone.substate = SUBSTATE_REPAIR_PATROL;
      }
      state.drones.push(drone);
    }
    assignMissingDroneSlots(state);
    for (var j = 0; j < state.drones.length; j++) {
      var restored = state.drones[j];
      if (!restored) continue;
      if (restored.mode !== MODE_REPAIR) snapDroneToAssignedSlot(state, restored, null);
    }
  }

  function getFenceOrigin(options) {
    var opts = options || {};
    var o = opts.fenceOrigin && typeof opts.fenceOrigin === 'object' ? opts.fenceOrigin : null;
    return {
      x: Number.isFinite(o && o.x) ? o.x : 0,
      y: Number.isFinite(o && o.y) ? o.y : 0,
    };
  }

  function getSegmentTargetPoint(segment) {
    if (!segment) return null;
    var aabb = segment.holeAabb || segment.segmentAabb || null;
    if (aabb && Number.isFinite(aabb.minX) && Number.isFinite(aabb.maxX) && Number.isFinite(aabb.minY) && Number.isFinite(aabb.maxY)) {
      return {
        x: (aabb.minX + aabb.maxX) * 0.5,
        y: (aabb.minY + aabb.maxY) * 0.5,
      };
    }
    if (Number.isFinite(segment.x) && Number.isFinite(segment.y)) return { x: segment.x, y: segment.y };
    return null;
  }

  function getSegmentWorldTarget(segment, options) {
    var local = getSegmentTargetPoint(segment);
    if (!local) return null;
    var origin = getFenceOrigin(options);
    return {
      x: origin.x + local.x,
      y: origin.y + local.y,
    };
  }

  function distanceSq(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return dx * dx + dy * dy;
  }

  function sortSegmentId(a, b) {
    var left = a && a.id != null ? String(a.id) : '';
    var right = b && b.id != null ? String(b.id) : '';
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }

  function pickBestRepairTarget(state, drone, options) {
    if (!state || !Array.isArray(state.fenceSegments) || !state.fenceSegments.length) return null;
    var best = null;

    for (var i = 0; i < state.fenceSegments.length; i++) {
      var seg = state.fenceSegments[i];
      if (!seg || !Number.isFinite(seg.hp) || !Number.isFinite(seg.maxHp) || seg.maxHp <= 0) continue;
      if (seg.hp >= seg.maxHp) continue;

      var owner = getClaimOwner(state, seg.id);
      if (owner != null && owner !== drone.id) continue;

      var target = getSegmentWorldTarget(seg, options);
      if (!target) continue;

      var missingHp = Math.max(0, seg.maxHp - seg.hp);
      if (missingHp <= 0) continue;
      var distSq = distanceSq(drone.pos.x, drone.pos.y, target.x, target.y);

      var candidate = {
        segment: seg,
        targetX: target.x,
        targetY: target.y,
        missingHp: missingHp,
        distSq: distSq,
      };

      if (!best) {
        best = candidate;
        continue;
      }

      if (candidate.missingHp > best.missingHp) {
        best = candidate;
        continue;
      }
      if (candidate.missingHp < best.missingHp) continue;

      if (candidate.distSq < best.distSq) {
        best = candidate;
        continue;
      }
      if (candidate.distSq > best.distSq) continue;

      if (sortSegmentId(candidate.segment, best.segment) < 0) best = candidate;
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

  function evaluateRepairAction(state, drone, fenceRepairCost, dronConfig, runtimeOptions) {
    var picked = pickBestRepairTarget(state, drone, runtimeOptions);
    if (!picked || !picked.segment) return { enabled: false, reason: 'no_target', segment: null, plan: null };
    var plan = computeRepairPlan(drone, picked.segment, fenceRepairCost, dronConfig);
    if (!plan) return { enabled: false, reason: 'no_target', segment: null, plan: null };
    return { enabled: true, reason: '', segment: picked.segment, plan: plan };
  }

  function setStandbyMode(state, drone) {
    releaseRepairState(state, drone);
    drone.mode = MODE_STANDBY;
    drone.substate = SUBSTATE_REPAIR_PATROL;
    drone.nextRepairScanAtSec = 0;
  }

  function setRepairMode(drone, nowSec) {
    drone.mode = MODE_REPAIR;
    drone.substate = SUBSTATE_REPAIR_PATROL;
    drone.nextRepairScanAtSec = Number.isFinite(nowSec) ? nowSec : 0;
    drone.repair = null;
  }

  function claimTargetSegment(state, drone, segment) {
    if (!state || !drone || !segment || segment.id == null) return false;
    var owner = getClaimOwner(state, segment.id);
    if (owner != null && owner !== drone.id) return false;
    clearClaimForDrone(state, drone);
    setClaim(state, segment.id, drone.id);
    drone.targetSegmentId = segment.id;
    drone.reservedSegmentId = segment.id;
    return true;
  }

  function clampDroneToBounds(drone, worldBounds) {
    if (!drone || !worldBounds || typeof worldBounds !== 'object') return;
    if (Number.isFinite(worldBounds.minX) && Number.isFinite(worldBounds.maxX)) {
      drone.pos.x = clamp(drone.pos.x, worldBounds.minX, worldBounds.maxX);
    }
    if (Number.isFinite(worldBounds.minY) && Number.isFinite(worldBounds.maxY)) {
      drone.pos.y = clamp(drone.pos.y, worldBounds.minY, worldBounds.maxY);
    }
  }

  function moveTowards(drone, tx, ty, speed, dt, worldBounds) {
    var dx = tx - drone.pos.x;
    var dy = ty - drone.pos.y;
    var dist = Math.hypot(dx, dy);
    if (dist <= 0.0001) return 0;
    var maxStep = Math.max(0, speed * dt);
    if (dist <= maxStep || maxStep <= 0) {
      drone.pos.x = tx;
      drone.pos.y = ty;
      clampDroneToBounds(drone, worldBounds);
      return 0;
    }
    var k = maxStep / dist;
    drone.pos.x += dx * k;
    drone.pos.y += dy * k;
    clampDroneToBounds(drone, worldBounds);
    return dist - maxStep;
  }

  function computeFencePerimeterBounds(state, options, fallbackX, fallbackY) {
    var minX = Infinity;
    var maxX = -Infinity;
    var minY = Infinity;
    var maxY = -Infinity;
    var origin = getFenceOrigin(options);

    if (state && Array.isArray(state.fenceSegments)) {
      for (var i = 0; i < state.fenceSegments.length; i++) {
        var seg = state.fenceSegments[i];
        if (!seg) continue;
        var aabb = seg.holeAabb || seg.segmentAabb || null;
        if (aabb && Number.isFinite(aabb.minX) && Number.isFinite(aabb.maxX) && Number.isFinite(aabb.minY) && Number.isFinite(aabb.maxY)) {
          minX = Math.min(minX, origin.x + aabb.minX);
          maxX = Math.max(maxX, origin.x + aabb.maxX);
          minY = Math.min(minY, origin.y + aabb.minY);
          maxY = Math.max(maxY, origin.y + aabb.maxY);
          continue;
        }
        if (Number.isFinite(seg.x) && Number.isFinite(seg.y)) {
          var wx = origin.x + seg.x;
          var wy = origin.y + seg.y;
          minX = Math.min(minX, wx);
          maxX = Math.max(maxX, wx);
          minY = Math.min(minY, wy);
          maxY = Math.max(maxY, wy);
        }
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
      return {
        minX: fallbackX - 34,
        maxX: fallbackX + 34,
        minY: fallbackY - 22,
        maxY: fallbackY + 22,
      };
    }

    var pad = 14;
    return {
      minX: minX - pad,
      maxX: maxX + pad,
      minY: minY - pad,
      maxY: maxY + pad,
    };
  }

  function updateStandbyPatrol(drone, nowSec, speed, dt, worldBounds) {
    drone.pos.x = drone.basePos.x;
    drone.pos.y = drone.basePos.y;
    clampDroneToBounds(drone, worldBounds);
  }

  function pointOnPerimeter(bounds, progress) {
    var width = Math.max(2, bounds.maxX - bounds.minX);
    var height = Math.max(2, bounds.maxY - bounds.minY);
    var perimeter = Math.max(1, 2 * (width + height));
    var p = progress % perimeter;
    if (p < 0) p += perimeter;

    if (p <= width) return { x: bounds.minX + p, y: bounds.minY };
    p -= width;
    if (p <= height) return { x: bounds.maxX, y: bounds.minY + p };
    p -= height;
    if (p <= width) return { x: bounds.maxX - p, y: bounds.maxY };
    p -= width;
    return { x: bounds.minX, y: bounds.maxY - p };
  }

  function tryAcquireRepairTarget(state, drone, runtimeOptions) {
    var picked = pickBestRepairTarget(state, drone, runtimeOptions);
    if (!picked || !picked.segment) return false;
    if (!claimTargetSegment(state, drone, picked.segment)) return false;
    drone.substate = SUBSTATE_REPAIR_MOVE_TO_TARGET;
    drone.repair = null;
    return true;
  }

  function updateRepairPatrol(state, drone, nowSec, speed, dt, runtimeOptions) {
    var bounds = computeFencePerimeterBounds(state, runtimeOptions, drone.basePos.x, drone.basePos.y);
    var width = Math.max(2, bounds.maxX - bounds.minX);
    var height = Math.max(2, bounds.maxY - bounds.minY);
    var perimeter = Math.max(1, 2 * (width + height));

    if (!Number.isFinite(drone.patrolPerimeterProgressPx)) drone.patrolPerimeterProgressPx = Math.random() * perimeter;
    drone.patrolPerimeterProgressPx = (drone.patrolPerimeterProgressPx + Math.max(0, speed * dt * REPAIR_PATROL_SPEED_MULT)) % perimeter;
    var target = pointOnPerimeter(bounds, drone.patrolPerimeterProgressPx);
    moveTowards(drone, target.x, target.y, speed * REPAIR_PATROL_SPEED_MULT, dt, runtimeOptions.worldBounds);

    if (!Number.isFinite(drone.nextRepairScanAtSec)) drone.nextRepairScanAtSec = nowSec;
    if (nowSec < drone.nextRepairScanAtSec) return;
    drone.nextRepairScanAtSec = nowSec + REPAIR_SCAN_PERIOD_SEC;
    tryAcquireRepairTarget(state, drone, runtimeOptions);
  }

  function ensureReservationConsistency(state) {
    if (!state || !Array.isArray(state.fenceSegments) || !Array.isArray(state.drones)) return;

    var claims = ensureRepairClaimsStore(state) || {};
    for (var key in claims) {
      if (!Object.prototype.hasOwnProperty.call(claims, key)) continue;
      if (!getDroneById(state, claims[key]) || !getSegmentById(state, key)) delete claims[key];
    }

    for (var i = 0; i < state.fenceSegments.length; i++) {
      var seg = state.fenceSegments[i];
      if (!seg || seg.id == null) continue;
      var owner = claims[seg.id] != null ? claims[seg.id] : null;
      seg.reservedByDroneId = owner;
    }
  }

  function clearTargetAndClaim(state, drone) {
    clearClaimForDrone(state, drone);
    drone.targetSegmentId = null;
    drone.repair = null;
  }

  function shouldKeepCurrentTarget(state, drone) {
    var seg = getSegmentById(state, drone.targetSegmentId);
    if (!seg || !Number.isFinite(seg.hp) || !Number.isFinite(seg.maxHp) || seg.hp >= seg.maxHp) return false;
    var owner = getClaimOwner(state, seg.id);
    if (owner != null && owner !== drone.id) return false;
    return true;
  }

  function enterRepairWork(state, drone, nowSec, fenceRepairCost, dronConfig) {
    var seg = getSegmentById(state, drone.targetSegmentId);
    if (!seg || seg.hp >= seg.maxHp) {
      clearTargetAndClaim(state, drone);
      drone.substate = SUBSTATE_REPAIR_PATROL;
      return;
    }
    setClaim(state, seg.id, drone.id);
    drone.reservedSegmentId = seg.id;

    var plan = computeRepairPlan(drone, seg, fenceRepairCost, dronConfig);
    if (!plan) {
      clearTargetAndClaim(state, drone);
      drone.substate = SUBSTATE_REPAIR_PATROL;
      return;
    }
    plan.repairStartTimeSec = nowSec;
    plan.coinsSpentPrev = 0;
    drone.repair = plan;
    drone.substate = SUBSTATE_REPAIR_WORK;
  }

  function stepMoveToTarget(state, drone, nowSec, speed, dt, runtimeOptions) {
    if (!shouldKeepCurrentTarget(state, drone)) {
      clearTargetAndClaim(state, drone);
      if (!tryAcquireRepairTarget(state, drone, runtimeOptions)) {
        drone.substate = SUBSTATE_REPAIR_PATROL;
      }
      return;
    }

    var seg = getSegmentById(state, drone.targetSegmentId);
    setClaim(state, seg.id, drone.id);
    drone.reservedSegmentId = seg.id;
    var target = getSegmentWorldTarget(seg, runtimeOptions);
    if (!target) {
      clearTargetAndClaim(state, drone);
      drone.substate = SUBSTATE_REPAIR_PATROL;
      return;
    }

    var remain = moveTowards(drone, target.x, target.y, speed, dt, runtimeOptions.worldBounds);
    if (remain <= REPAIR_ARRIVE_EPSILON_PX) {
      enterRepairWork(state, drone, nowSec, runtimeOptions.fenceRepairCost, runtimeOptions.dronConfig);
    }
  }

  function freezeRepairTimeByCoins(repair, nowSec) {
    if (!repair) return;
    var total = Math.max(1, Number(repair.totalCostCoins) || 1);
    var duration = Math.max(0.01, Number(repair.repairDurationSec) || 0.01);
    var paidProgress = clamp((Number(repair.coinsSpentPrev) || 0) / total, 0, 1);
    repair.repairStartTimeSec = nowSec - paidProgress * duration;
  }

  function stepRepairWork(state, drone, nowSec, runtimeOptions) {
    if (!shouldKeepCurrentTarget(state, drone)) {
      clearTargetAndClaim(state, drone);
      if (!tryAcquireRepairTarget(state, drone, runtimeOptions)) drone.substate = SUBSTATE_REPAIR_PATROL;
      return;
    }

    var seg = getSegmentById(state, drone.targetSegmentId);
    setClaim(state, seg.id, drone.id);
    drone.reservedSegmentId = seg.id;

    var repair = drone.repair;
    if (!repair || typeof repair !== 'object') {
      enterRepairWork(state, drone, nowSec, runtimeOptions.fenceRepairCost, runtimeOptions.dronConfig);
      repair = drone.repair;
      if (!repair) return;
    }

    var duration = Math.max(0.01, Number(repair.repairDurationSec) || 0.01);
    var t = clamp((nowSec - repair.repairStartTimeSec) / duration, 0, 1);
    var totalCost = Math.max(1, Number(repair.totalCostCoins) || 1);
    var desiredCoins = Math.floor(totalCost * t);
    var spentPrev = Math.max(0, Math.floor(Number(repair.coinsSpentPrev) || 0));
    var deltaCoins = desiredCoins - spentPrev;

    if (deltaCoins > 0) {
      var availableCoins = Math.max(0, Math.floor(Number(state.coins) || 0));
      if (availableCoins < deltaCoins) {
        freezeRepairTimeByCoins(repair, nowSec);
        return;
      }
      state.coins = Math.max(0, availableCoins - deltaCoins);
      repair.coinsSpentPrev = spentPrev + deltaCoins;
    }

    var hpStart = clamp(Number(repair.startHp) || 0, 0, seg.maxHp);
    var paidProgress = clamp((Number(repair.coinsSpentPrev) || 0) / totalCost, 0, 1);
    var hpTarget = Math.round(hpStart + (repair.maxHp - hpStart) * paidProgress);
    var wasBroken = !!seg.broken;
    seg.hp = clamp(hpTarget, 0, seg.maxHp);
    seg.broken = seg.hp <= 0;
    if (seg.broken !== wasBroken && typeof runtimeOptions.onFenceSegmentStateChanged === 'function') {
      runtimeOptions.onFenceSegmentStateChanged(seg);
    }

    if (seg.hp >= seg.maxHp) {
      var wasBrokenAtCap = !!seg.broken;
      seg.hp = seg.maxHp;
      seg.broken = false;
      if (seg.broken !== wasBrokenAtCap && typeof runtimeOptions.onFenceSegmentStateChanged === 'function') {
        runtimeOptions.onFenceSegmentStateChanged(seg);
      }
      clearTargetAndClaim(state, drone);
      if (!tryAcquireRepairTarget(state, drone, runtimeOptions)) {
        drone.substate = SUBSTATE_REPAIR_PATROL;
      }
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
      drone.substate = SUBSTATE_REPAIR_PATROL;
      releaseRepairState(state, drone);
      updateStandbyPatrol(drone, nowSec, moveSpeed, dt, options.worldBounds);
      return;
    }

    drone.substate = normalizeSubstate(MODE_REPAIR, drone.substate);

    if (drone.substate === SUBSTATE_REPAIR_PATROL) {
      releaseRepairState(state, drone);
      updateRepairPatrol(state, drone, nowSec, moveSpeed, dt, options);
      return;
    }

    if (drone.substate === SUBSTATE_REPAIR_MOVE_TO_TARGET) {
      stepMoveToTarget(state, drone, nowSec, moveSpeed, dt, options);
      return;
    }

    if (drone.substate === SUBSTATE_REPAIR_WORK) {
      stepRepairWork(state, drone, nowSec, options);
      return;
    }

    drone.substate = SUBSTATE_REPAIR_PATROL;
  }

  function step(options) {
    var opts = options || {};
    var state = opts.state;
    if (!state) return;
    ensureState(state);
    assignMissingDroneSlots(state);
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
        fenceOrigin: opts.fenceOrigin,
        worldBounds: opts.worldBounds,
        onFenceSegmentStateChanged: opts.onFenceSegmentStateChanged,
      }, drone);
    }
  }

  function tryAbsorbIncomingDroneIntoFullSlots(state, level, maxLevel) {
    if (!state || !Array.isArray(state.drones)) return null;
    for (var i = 0; i < state.drones.length; i++) {
      var drone = state.drones[i];
      if (!drone || !isValidSlotIndex(drone.slotIndex) || drone.level !== level) continue;
      drone.level = clamp(drone.level + 1, 1, Math.max(1, maxLevel));
      setStandbyMode(state, drone);
      snapDroneToAssignedSlot(state, drone, null);
      return drone;
    }
    return null;
  }

  function addDron(state, level, options) {
    ensureState(state);
    assignMissingDroneSlots(state);

    var opts = options || {};
    var dronConfig = opts.dronConfig || {};
    var maxLevel = Number.isFinite(dronConfig.maxLevel) ? Math.max(1, Math.floor(dronConfig.maxLevel)) : 10;
    var lvl = clamp(toSafeInt(level, 1), 1, maxLevel);
    var freeSlotIndex = findFirstFreeSlotIndex(state);
    if (freeSlotIndex == null) {
      return tryAbsorbIncomingDroneIntoFullSlots(state, lvl, maxLevel);
    }

    var drone = sanitizeDrone(state, {
      level: lvl,
      mode: MODE_STANDBY,
      substate: SUBSTATE_REPAIR_PATROL,
      slotIndex: freeSlotIndex,
      basePos: state.supercomputer ? { x: state.supercomputer.x, y: state.supercomputer.y } : { x: 0, y: 0 },
      pos: state.supercomputer ? { x: state.supercomputer.x, y: state.supercomputer.y } : { x: 0, y: 0 },
      patrolSeed: Math.random() * Math.PI * 2,
      nextRepairScanAtSec: 0,
      patrolPerimeterProgressPx: Math.random() * 100,
    }, lvl);

    state.drones.push(drone);
    snapDroneToAssignedSlot(state, drone, opts);
    return drone;
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

  function drawDroneSlotLevelLabel(ctx, slot, level) {
    if (!ctx || !slot || !Number.isFinite(level)) return;
    var tier = Math.floor((level - 1) / 3);
    var badge = ['rgba(0, 0, 0, 0)','rgba(0,0,0,.35)','rgba(110,168,255,.22)','rgba(125,255,178,.22)','rgba(185,139,255,.22)'][clamp(tier, 0, 4)];
    var labelY = slot.y + slot.h - Math.max(6, slot.h * 0.16);
    var badgeW = Math.max(26, Math.min(32, slot.w + 6));
    var badgeH = 16;

    ctx.save();
    ctx.fillStyle = badge;
    drawRoundedRect(ctx, slot.cx - badgeW * 0.5, labelY - badgeH * 0.5, badgeW, badgeH, 8);
    ctx.fill();
    ctx.fillStyle = '#eaf1ff';
    ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getLevelShortLabel(global) + level, slot.cx, labelY);
    ctx.restore();
  }

  function getLevelShortLabel(global) {
    var i18n = global && global.Game && global.Game.I18n;
    if (i18n && typeof i18n.t === 'function') {
      var translated = i18n.t('levelShort');
      if (typeof translated === 'string' && translated.length) return translated;
    }
    return 'Lv';
  }

  function drawDroneSpriteAt(ctx, x, y, animName, nowSec, balScale, dronSprites, renderOptions) {
    var options = renderOptions && typeof renderOptions === 'object' ? renderOptions : null;
    var cfg = dronSprites && dronSprites.config ? dronSprites.config : {};
    var resolvedAnimName = typeof animName === 'string' && animName ? animName : 'wait';
    var anim = dronSprites && dronSprites.getAnimation ? dronSprites.getAnimation(resolvedAnimName) : null;

    ctx.save();
    if (options && Number.isFinite(options.alpha)) ctx.globalAlpha = clamp(options.alpha, 0, 1);
    if (options && options.grayscale) ctx.filter = 'grayscale(1) brightness(0.8)';

    if (dronSprites && dronSprites.ready && dronSprites.atlasImg && anim && Array.isArray(anim.frames) && anim.frames.length) {
      var fps = Math.max(0.01, Number(anim.frameRateFps) || 6);
      var rawFrame = Math.floor(nowSec * fps);
      var frameIndex = anim.loop === false ? Math.min(anim.frames.length - 1, rawFrame) : (rawFrame % anim.frames.length);
      var frame = dronSprites.pickFrame ? dronSprites.pickFrame(anim.frames[frameIndex]) : null;
      if (frame) {
        var scale = (Number.isFinite(cfg.scale) ? cfg.scale : 1) * balScale * (options && Number.isFinite(options.scaleMul) ? options.scaleMul : 1);
        var anchor = cfg.anchor || { x: 0.5, y: 0.5 };
        ctx.drawImage(
          dronSprites.atlasImg,
          frame.x, frame.y, frame.w, frame.h,
          x - frame.w * scale * anchor.x,
          y - frame.h * scale * anchor.y,
          frame.w * scale,
          frame.h * scale
        );
        ctx.restore();
        return;
      }
    }

    ctx.fillStyle = 'rgba(177,203,255,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 10 * balScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDroneSlot(ctx, slot, drone, dragState, balScale, timeSec, dronSprites) {
    var isSelected = _selectedSlotIndex === slot.slotIndex;
    var isDragSource = !!(dragState && dragState.slotIndex === slot.slotIndex && dragState.moved);
    var isAssigned = !!(drone && drone.mode === MODE_REPAIR);
    var slotUiScale = Math.max(0.55, Math.min(1, slot.w / 34));
    var fill = drone ? 'rgba(19, 28, 36, 0.92)' : 'rgba(12, 16, 22, 0.72)';
    var stroke = !drone ? 'rgba(154,176,198,0.36)' : 'rgba(0,0,0,0)';

    ctx.save();
    drawRoundedRect(ctx, slot.x, slot.y, slot.w, slot.h, Math.max(5, slot.w * 0.2));
    ctx.fillStyle = fill;
    ctx.fill();

    if (stroke !== 'rgba(0,0,0,0)' || isDragSource) {
      ctx.lineWidth = isSelected ? Math.max(1.4, 2.1 * slotUiScale) : Math.max(1, 1.25 * slotUiScale);
      ctx.strokeStyle = isDragSource ? 'rgba(255,236,179,0.98)' : stroke;
      ctx.stroke();
    }

    if (drone) {
      if (!isDragSource) {
        drawDroneSpriteAt(ctx, slot.cx, slot.cy, resolveHangarDroneAnimName(drone), timeSec, balScale, dronSprites, {
          alpha: 0.92,
          scaleMul: Math.max(0.44, Math.min(0.6, slot.w / 42))
        });
      }

      drawDroneSlotLevelLabel(ctx, slot, drone.level);

      if (isAssigned) {
        drawSlotActivityOverlay(ctx, slot, timeSec);
      }
    }

    ctx.restore();
  }

  function drawDroneBody(ctx, drone, nowSec, balScale, dronSprites) {
    var modeAnimName = resolveWorldDroneAnimName(drone);
    drawDroneSpriteAt(ctx, drone.pos.x, drone.pos.y, modeAnimName, nowSec, balScale, dronSprites, null);
  }

  function draw(options) {
    var opts = options || {};
    var state = opts.state;
    var ctx = opts.ctx;
    if (!state || !Array.isArray(state.drones) || !ctx) return;

    var balScale = Number.isFinite(opts.balScale) ? opts.balScale : 1;
    var nowSec = Number.isFinite(opts.nowSec) ? opts.nowSec : 0;
    assignMissingDroneSlots(state);
    var slots = getDroneSlotsLayout(state, opts);

    for (var slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      var slot = slots[slotIndex];
      var slotDrone = getDroneBySlotIndex(state, slot.slotIndex);
      if (_slotDragState && _slotDragState.moved && slotDrone && slotDrone.slotIndex === _slotDragState.slotIndex) {
        slotDrone = null;
      }
      drawDroneSlot(ctx, slot, slotDrone, _slotDragState, balScale, nowSec, opts.dronSprites);
    }

    for (var i = 0; i < state.drones.length; i++) {
      var drone = state.drones[i];
      if (!drone) continue;
      if (drone.mode !== MODE_REPAIR) continue;

      if (_slotDragState && _slotDragState.moved && drone.slotIndex === _slotDragState.slotIndex) continue;
      drawDroneBody(ctx, drone, nowSec, balScale, opts.dronSprites);
    }

    if (_slotDragState && _slotDragState.moved) {
      var draggingDrone = getDroneBySlotIndex(state, _slotDragState.slotIndex);
      if (draggingDrone) {
        var ghostDrone = {
          pos: { x: _slotDragState.x, y: _slotDragState.y },
          mode: draggingDrone.mode,
          substate: draggingDrone.substate,
        };
        ctx.save();
        ctx.globalAlpha = 0.88;
        drawDroneBody(ctx, ghostDrone, nowSec, balScale, opts.dronSprites);
        ctx.restore();
      }
    }
  }

  function hitRect(rect, x, y) {
    return rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function getSlotAtPoint(state, x, y, options) {
    var slots = getDroneSlotsLayout(state, options);
    for (var i = 0; i < slots.length; i++) {
      if (hitRect(slots[i], x, y)) return slots[i];
    }
    return null;
  }

  function toggleSlotDroneMode(state, drone, fenceRepairCost, dronConfig, nowSec) {
    if (!drone) return false;
    if (drone.mode === MODE_REPAIR) {
      setStandbyMode(state, drone);
      snapDroneToAssignedSlot(state, drone, null);
      return true;
    }
    if (tryEnableRepairMode(state, drone, fenceRepairCost, dronConfig, nowSec)) return true;
    return false;
  }

  function removeDroneById(state, droneId) {
    if (!state || !Array.isArray(state.drones)) return false;
    for (var i = 0; i < state.drones.length; i++) {
      if (state.drones[i] && state.drones[i].id === droneId) {
        state.drones.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  function moveDroneToSlot(state, drone, slotIndex) {
    if (!drone || !isValidSlotIndex(slotIndex)) return false;
    drone.slotIndex = slotIndex;
    if (drone.mode !== MODE_REPAIR) snapDroneToAssignedSlot(state, drone, null);
    return true;
  }

  function mergeDroneSlots(state, sourceDrone, targetDrone, dronConfig) {
    if (!sourceDrone || !targetDrone) return false;
    var maxLevel = Number.isFinite(dronConfig && dronConfig.maxLevel) ? Math.max(1, Math.floor(dronConfig.maxLevel)) : 10;
    targetDrone.level = clamp(targetDrone.level + 1, 1, maxLevel);
    setStandbyMode(state, targetDrone);
    snapDroneToAssignedSlot(state, targetDrone, null);
    removeDroneById(state, sourceDrone.id);
    return true;
  }

  function tryEnableRepairMode(state, drone, fenceRepairCost, dronConfig, nowSec) {
    if (!state || !drone) return false;
    releaseRepairState(state, drone);
    setRepairMode(drone, Number.isFinite(nowSec) ? nowSec : 0);
    return true;
  }

  function handlePointerDown(options) {
    var opts = options || {};
    var state = opts.state;
    if (!state || !Array.isArray(state.drones)) return { handled: false, changed: false };
    assignMissingDroneSlots(state);

    var slot = getSlotAtPoint(state, opts.x, opts.y, opts);
    if (!slot) return { handled: false, changed: false };

    _selectedSlotIndex = slot.slotIndex;
    var drone = getDroneBySlotIndex(state, slot.slotIndex);
    if (drone) {
      _slotDragState = {
        slotIndex: slot.slotIndex,
        startX: opts.x,
        startY: opts.y,
        x: opts.x,
        y: opts.y,
        moved: false,
      };
    }
    return { handled: true, changed: false };
  }

  function handlePointerMove(options) {
    if (!_slotDragState) return { handled: false, changed: false };
    var opts = options || {};
    var dx = opts.x - _slotDragState.startX;
    var dy = opts.y - _slotDragState.startY;
    if (!_slotDragState.moved && Math.hypot(dx, dy) > DRONE_SLOT_DRAG_THRESHOLD_PX) {
      _slotDragState.moved = true;
    }
    _slotDragState.x = opts.x;
    _slotDragState.y = opts.y;
    return { handled: true, changed: _slotDragState.moved };
  }

  function handlePointerUp(options) {
    if (!_slotDragState) return { handled: false, changed: false };

    var opts = options || {};
    var state = opts.state;
    var sourceSlotIndex = _slotDragState.slotIndex;
    var wasMoved = _slotDragState.moved;
    _slotDragState = null;

    if (!state || !Array.isArray(state.drones)) return { handled: true, changed: false };
    assignMissingDroneSlots(state);

    var sourceDrone = getDroneBySlotIndex(state, sourceSlotIndex);
    if (!sourceDrone) return { handled: true, changed: false };

    if (!wasMoved) {
      return {
        handled: true,
        changed: toggleSlotDroneMode(state, sourceDrone, opts.fenceRepairCost, opts.dronConfig || {}, Number.isFinite(opts.nowSec) ? opts.nowSec : 0),
      };
    }

    var targetSlot = getSlotAtPoint(state, opts.x, opts.y, opts);
    if (!targetSlot || targetSlot.slotIndex === sourceSlotIndex) {
      if (sourceDrone.mode !== MODE_REPAIR) snapDroneToAssignedSlot(state, sourceDrone, opts);
      return { handled: true, changed: false };
    }

    var targetDrone = getDroneBySlotIndex(state, targetSlot.slotIndex);
    if (!targetDrone) {
      return { handled: true, changed: moveDroneToSlot(state, sourceDrone, targetSlot.slotIndex) };
    }

    if (targetDrone.level === sourceDrone.level) {
      return { handled: true, changed: mergeDroneSlots(state, sourceDrone, targetDrone, opts.dronConfig || {}) };
    }

    if (sourceDrone.mode !== MODE_REPAIR) snapDroneToAssignedSlot(state, sourceDrone, opts);
    return { handled: true, changed: false };
  }

  global.Game = global.Game || {};
  global.Game.Drones = {
    MODE_STANDBY: MODE_STANDBY,
    MODE_REPAIR: MODE_REPAIR,
    SUBSTATE_REPAIR_PATROL: SUBSTATE_REPAIR_PATROL,
    SUBSTATE_REPAIR_MOVE_TO_TARGET: SUBSTATE_REPAIR_MOVE_TO_TARGET,
    SUBSTATE_REPAIR_WORK: SUBSTATE_REPAIR_WORK,
    SUBSTATE_PATROL: SUBSTATE_REPAIR_PATROL,
    SUBSTATE_FLY_TO_TARGET: SUBSTATE_REPAIR_MOVE_TO_TARGET,
    SUBSTATE_REPAIRING: SUBSTATE_REPAIR_WORK,
    SUBSTATE_RETURN_TO_BASE: SUBSTATE_REPAIR_PATROL,
    ensureState: ensureState,
    sanitizeDrone: sanitizeDrone,
    restoreSavedDrones: restoreSavedDrones,
    clearAllReservations: clearAllReservations,
    getDroneLevelConfig: getDroneLevelConfig,
    evaluateRepairAction: evaluateRepairAction,
    tryEnableRepairMode: tryEnableRepairMode,
    DRONE_SLOT_COUNT: DRONE_SLOT_COUNT,
    isSlotIndexValid: isValidSlotIndex,
    addDron: addDron,
    step: step,
    draw: draw,
    _resolveHangarDroneAnimName: resolveHangarDroneAnimName,
    _resolveWorldDroneAnimName: resolveWorldDroneAnimName,
    handlePointerDown: handlePointerDown,
    handlePointerMove: handlePointerMove,
    handlePointerUp: handlePointerUp,
  };
})(typeof window !== 'undefined' ? window : this);