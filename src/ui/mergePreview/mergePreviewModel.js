(function (global) {
  'use strict';

  var MAX_SHOTS = 12;

  function createShotPool() {
    var shots = new Array(MAX_SHOTS);
    for (var i = 0; i < shots.length; i++) {
      shots[i] = { active: false, x: 0, y: 0, dx: 1, dy: 0, life: 0, maxLife: 0.2, tankIndex: 0 };
    }
    return shots;
  }

  function createModel() {
    return {
      time: 0,
      tanks: [
        { id: 'A', level: 1, spec: null },
        { id: 'B', level: 1, spec: null },
        { id: 'R', level: 1, spec: null }
      ],
      shots: createShotPool(),
      shotCursor: 0,
      layout: { w: 0, h: 0, leftX: 0, rightX: 0, centerX: 0, centerY: 0, sideMaxW: 0, sideMaxH: 0, resultMaxW: 0, resultMaxH: 0, labelY: 0 }
    };
  }

  function resetShots(model) {
    for (var i = 0; i < model.shots.length; i++) {
      model.shots[i].active = false;
      model.shots[i].life = 0;
    }
    model.shotCursor = 0;
  }

  function getFrames(cfg) {
    if (!cfg) return 1;
    if (Array.isArray(cfg.frames)) return cfg.frames.length || 1;
    return cfg.frames || 1;
  }

  function getAnimSpeed(cfg, fallback) {
    if (!cfg) return fallback || 0;
    if (cfg.animation && cfg.animation.frameRate) return cfg.animation.frameRate;
    if (cfg.animSpeed != null) return cfg.animSpeed;
    return fallback || 0;
  }

  function setupTank(model, index, level) {
    var TankConfig = global.Game && global.Game.TankConfig;
    var spec = TankConfig && TankConfig.getTankVisualSpec ? TankConfig.getTankVisualSpec(level) : null;
    var tank = model.tanks[index];
    tank.level = level;
    tank.spec = spec;
    tank.bodyAnim = 0;
    tank.cannonAnim = 0;
    tank.auraAnim = 0;
    tank.bodyFrame = 0;
    tank.cannonFrame = 0;
    tank.auraFrame = 0;
    tank.x = 0;
    tank.y = 0;
    tank.scale = 1;

    var bodyCfg = spec && spec.body ? spec.body.cfg : null;
    var cannonCfg = spec && spec.cannon ? spec.cannon.cfg : null;
    var auraCfg = spec && spec.aura ? spec.aura.cfg : null;

    tank.bodyFrames = getFrames(bodyCfg);
    tank.cannonFrames = getFrames(cannonCfg);
    tank.auraFrames = getFrames(auraCfg);
    tank.bodySpeed = getAnimSpeed(bodyCfg, 2);
    tank.cannonSpeed = getAnimSpeed(cannonCfg, 10);
    tank.auraSpeed = getAnimSpeed(auraCfg, 8);
    tank.fireFrame = cannonCfg && cannonCfg.fireFrame != null ? cannonCfg.fireFrame : 1;
    tank.muzzleX = cannonCfg && cannonCfg.muzzle ? cannonCfg.muzzle.x : 28;
    tank.muzzleY = cannonCfg && cannonCfg.muzzle ? cannonCfg.muzzle.y : 0;
    tank.fireCooldown = cannonCfg && (cannonCfg.frames || 1) > 1 ? 0 : 0.6;
    tank.fireTimer = 0.3 + index * 0.1;
  }

  function reset(model, opts) {
    opts = opts || {};
    var level = Math.max(1, Math.floor(opts.level || 1));
    var leftLevel = Math.max(1, level - 1);
    var rightLevel = Math.max(1, level - 1);
    setupTank(model, 0, leftLevel);
    setupTank(model, 1, rightLevel);
    setupTank(model, 2, level);
    model.time = 0;
    resetShots(model);
  }

  function setLayout(model, w, h) {
    if (!w || !h) return;
    var layout = model.layout;
    layout.w = w;
    layout.h = h;
    layout.centerX = w * 0.5;
    layout.centerY = h * 0.62;
    layout.leftX = w * 0.28;
    layout.rightX = w * 0.72;
    layout.sideMaxW = w * 0.34;
    layout.sideMaxH = h * 0.52;
    layout.resultMaxW = w * 0.48;
    layout.resultMaxH = h * 0.74;
    layout.labelY = h * 0.18;

    var TankPortrait = global.Game && global.Game.TankPortrait;
    for (var i = 0; i < model.tanks.length; i++) {
      var tank = model.tanks[i];
      var maxW = i === 2 ? layout.resultMaxW : layout.sideMaxW;
      var maxH = i === 2 ? layout.resultMaxH : layout.sideMaxH;
      var scale = TankPortrait && TankPortrait.getPortraitScale
        ? TankPortrait.getPortraitScale(tank.spec, maxW, maxH, 1)
        : 1;
      tank.scale = scale;
      tank.maxW = maxW;
      tank.maxH = maxH;
    }
  }

  function spawnShot(model, tankIndex) {
    var tank = model.tanks[tankIndex];
    if (!tank) return;
    var shot = model.shots[model.shotCursor];
    model.shotCursor = (model.shotCursor + 1) % model.shots.length;
    shot.active = true;
    shot.tankIndex = tankIndex;
    shot.life = 0.18;
    shot.maxLife = 0.18;
    shot.dx = 1;
    shot.dy = 0;
    shot.x = tank.x + tank.muzzleX * tank.scale;
    shot.y = tank.y + tank.muzzleY * tank.scale;
  }

  function update(model, dt) {
    if (!dt || dt <= 0) return;
    model.time += dt;

    for (var i = 0; i < model.tanks.length; i++) {
      var tank = model.tanks[i];
      var prevFrame = tank.cannonFrame;

      if (tank.bodyFrames > 1) {
        tank.bodyAnim += dt * tank.bodySpeed;
        tank.bodyFrame = Math.floor(tank.bodyAnim) % tank.bodyFrames;
      }

      if (tank.cannonFrames > 1) {
        tank.cannonAnim += dt * tank.cannonSpeed;
        tank.cannonFrame = Math.floor(tank.cannonAnim) % tank.cannonFrames;
        if (tank.cannonFrame === tank.fireFrame && prevFrame !== tank.fireFrame) {
          spawnShot(model, i);
        }
      } else {
        tank.fireTimer -= dt;
        if (tank.fireTimer <= 0) {
          tank.fireTimer = tank.fireCooldown;
          spawnShot(model, i);
        }
      }

      if (tank.auraFrames > 1) {
        tank.auraAnim += dt * tank.auraSpeed;
        tank.auraFrame = Math.floor(tank.auraAnim) % tank.auraFrames;
      }
    }

    for (var j = 0; j < model.shots.length; j++) {
      var shot = model.shots[j];
      if (!shot.active) continue;
      shot.life -= dt;
      if (shot.life <= 0) {
        shot.active = false;
      }
    }
  }

  function setTankPositions(model, leftX, rightX, centerX, centerY) {
    model.tanks[0].x = leftX;
    model.tanks[0].y = centerY;
    model.tanks[1].x = rightX;
    model.tanks[1].y = centerY;
    model.tanks[2].x = centerX;
    model.tanks[2].y = centerY;
  }

  global.Game = global.Game || {};
  global.Game.MergePreviewModel = {
    createModel: createModel,
    reset: reset,
    setLayout: setLayout,
    update: update,
    setTankPositions: setTankPositions
  };
})(typeof window !== 'undefined' ? window : this);
