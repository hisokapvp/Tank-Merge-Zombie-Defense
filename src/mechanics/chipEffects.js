/**
 * ChipEffects — runtime engine that applies active chip modifiers
 * from hangar cells to the tank combat pipeline.
 *
 * Modifier effects (modId 1–14):
 *  1  Double Shot       — 2 projectiles per barrel, each targeting a different distant enemy; full barrel dmg per projectile
 *  2  Double Chain      — on-hit spawns a chain projectile to a new target (≥12px away), up to 2 bounces
 *  3  Double Matryoshka — big shot (×1.25 visual size, ×2 dmg) spawns small child on impact toward a different target (≥12px away)
 *  4  Small Repulse     — on-hit: +0.5× extra dmg & push zombies 10px away
 *  5  Small Vacuum      — on-hit: +0.5× extra dmg & pull ALL zombies within 50px toward impact point
 *  6  Small Combo       — every 4th shot fires 3 rapid shots at ×1.25 dmg
 *  7  Arcade Chaos      — each shot randomly picks one pattern from group A (mods 1–9)
 *  8  Small Nuke        — once per 30s: nuclear shot with ×3 blast, 100px radius
 *  9  Small Calming     — hit zombies stop attacking for 0.5s; max once per zombie
 * 10  Fire Pool         — impact leaves burning ground zone (sprite-based)
 * 11  Ice Zone          — impact leaves heavy-slow zone (sprite-based)
 * 12  Electro Node      — creates a point that periodically zaps nearest enemy
 * 13  Laser Mark        — marks target; hitting mark = ×2 dmg & ×2 aoe radius
 * 14  Acid Pool         — impact leaves acid pool: small dmg + light slow (sprite)
 */
(function (global) {
  'use strict';

  /* ────────── config loaded from assets/chips.json ────────── */
  var _chipsCfg = null;

  function loadChipsCfg(cfg) { _chipsCfg = cfg; }
  function getChipsCfg() { return _chipsCfg; }
  function getModCfg(modId) { return _chipsCfg && _chipsCfg.modifiers ? _chipsCfg.modifiers[String(modId)] : null; }

  /* ────────── per-cell combo counter (mod 6) ────────── */
  var _comboCounters = {};       // cellIndex → shotCount
  /* ────────── per-cell nuke cooldown (mod 8) ────────── */
  var _nukeCooldowns = {};       // cellIndex → nextAllowedTimeSec
  /* ────────── per-zombie calming set (mod 9) ────────── */
  var _calmedZombieIds = {};     // zombieId → true
  /* ────────── active electro nodes (mod 12) ────────── */
  var _electroNodes = [];
  /* ────────── active laser marks (mod 13) ────────── */
  var _laserMarks = [];

  /* ================== helpers ================== */

  function _now() { return typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000; }

  function getActiveChipMods(cellIndex) {
    var ui = global.Game && global.Game.HangarChipsUI;
    if (!ui || typeof ui.getCells !== 'function') return [];
    var cells = ui.getCells();
    if (!cells || !cells[cellIndex]) return [];
    return cells[cellIndex].activeModifiers || [];
  }

  function hasChipMod(cellIndex, modId) {
    var mods = getActiveChipMods(cellIndex);
    for (var i = 0; i < mods.length; i++) {
      if (mods[i].modId === modId) return true;
    }
    return false;
  }

  function getActiveModIds(cellIndex) {
    var mods = getActiveChipMods(cellIndex);
    var ids = [];
    for (var i = 0; i < mods.length; i++) ids.push(mods[i].modId);
    return ids;
  }

  /* ─── group-A mods for Arcade Chaos (mod 7) ─── */
  var GROUP_A_MODS = [1, 2, 3, 4, 5, 6, 8, 9];

  /* ================== SHOT MODIFIER ================== */

  /**
   * Called from fireTankProjectile BEFORE spawning projectiles.
   * Returns an object describing modifications to the shot.
   *
   * @param {object} opts
   *   - cellIndex {number}
   *   - tank {object}
   *   - stats {object}  (dmg, fr, aoe, prof, bulletCfg …)
   *   - targets {array}  zombie target pool
   *   - sx, sy {number}  muzzle position
   * @returns {object} shotMods
   */
  function applyShotModifiers(opts) {
    var cellIndex = opts.cellIndex;
    var modIds = getActiveModIds(cellIndex);
    if (!modIds.length) return null;

    /* Mod 7 — Arcade Chaos: replace active mods with one random from group A */
    if (modIds.indexOf(7) !== -1) {
      var pick = GROUP_A_MODS[Math.floor(Math.random() * GROUP_A_MODS.length)];
      modIds = [pick];  // this shot uses a random pattern
    }

    var result = {
      extraProjectiles: 0,        // mod 1
      chainJumps: 0,              // mod 2
      isMatryoshka: false,        // mod 3
      matryoshkaDmgMul: 1,
      matryoshkaSizeMul: 1,
      pushDistance: 0,            // mod 4
      pushExtraDmgMul: 0,
      pullDistance: 0,            // mod 5
      pullExtraDmgMul: 0,
      comboShots: 0,              // mod 6
      comboDmgMul: 1,
      isNuke: false,              // mod 8
      nukeDmgMul: 1,
      nukeRadius: 0,
      isCalming: false,           // mod 9
      calmDuration: 0,
      firePool: false,            // mod 10
      iceZone: false,             // mod 11
      electroNode: false,         // mod 12
      laserMark: false,           // mod 13
      acidPool: false,            // mod 14
      activeModIds: modIds
    };

    for (var i = 0; i < modIds.length; i++) {
      var m = modIds[i];
      switch (m) {
        case 1: // Double Shot
          result.extraProjectiles = 1; // +1 projectile per barrel
          break;

        case 2: // Double Chain
          result.chainJumps = 2;
          break;

        case 3: // Double Matryoshka
          result.isMatryoshka = true;
          result.matryoshkaDmgMul = 2;
          result.matryoshkaSizeMul = 1.25;
          break;

        case 4: // Small Repulse
          result.pushDistance = 10;
          result.pushExtraDmgMul = 0.5;
          break;

        case 5: // Small Vacuum
          result.pullDistance = 50;
          result.pullExtraDmgMul = 0.5;
          break;

        case 6: // Small Combo Counter
          if (!_comboCounters[cellIndex]) _comboCounters[cellIndex] = 0;
          _comboCounters[cellIndex]++;
          if (_comboCounters[cellIndex] >= 4) {
            _comboCounters[cellIndex] = 0;
            result.comboShots = 3;
            result.comboDmgMul = 1.25;
          }
          break;

        case 8: // Small Nuke
          var now = _now();
          if (!_nukeCooldowns[cellIndex] || now >= _nukeCooldowns[cellIndex]) {
            result.isNuke = true;
            result.nukeDmgMul = 3;
            result.nukeRadius = 100;
            _nukeCooldowns[cellIndex] = now + 30;
          }
          break;

        case 9: // Small Calming
          result.isCalming = true;
          result.calmDuration = 0.5;
          break;

        case 10: // Fire Pool
          result.firePool = true;
          break;

        case 11: // Ice Zone
          result.iceZone = true;
          break;

        case 12: // Electro Node
          result.electroNode = true;
          break;

        case 13: // Laser Mark
          result.laserMark = true;
          break;

        case 14: // Acid Pool
          result.acidPool = true;
          break;
      }
    }
    return result;
  }

  /* ================== IMPACT EFFECTS ================== */

  /**
   * Called from impactAt after base damage is applied.
   * Handles all on-hit chip effects.
   *
   * @param {object} opts
   *   - x, y {number}       impact coordinates
   *   - b {object}          projectile object
   *   - shotMods {object}   result from applyShotModifiers (stored on projectile)
   *   - zombies {array}     state.zombies
   *   - getZombiePos {fn}   zombiePos function
   *   - applyDamage {fn}    applyDamageToZombie function
   *   - addDecal {fn}       addDecal function
   *   - burst {fn}          burst particle function
   *   - addDamageNumber {fn}
   *   - spawnProjectile {fn} for matryoshka child
   *   - impacts {array}     state.impacts
   */
  function applyImpactEffects(opts) {
    var sm = opts.shotMods;
    if (!sm) return;
    var x = opts.x, y = opts.y;
    var b = opts.b;
    var zombies = opts.zombies;
    var getPos = opts.getZombiePos;

    /* ─── Mod 2: chain jumps ─── */
    if (sm.chainJumps > 0) {
      _applyChainJumps(x, y, b, sm.chainJumps, opts);
    }

    /* ─── Mod 3: Matryoshka child ─── */
    if (sm.isMatryoshka && opts.spawnProjectile) {
      _spawnMatryoshkaChild(x, y, b, opts);
    }

    /* ─── Mod 4: Repulse ─── */
    if (sm.pushDistance > 0) {
      _applyPushPull(x, y, b, sm.pushDistance, sm.pushExtraDmgMul, 'push', opts);
    }

    /* ─── Mod 5: Vacuum ─── */
    if (sm.pullDistance > 0) {
      _applyVacuum(x, y, b, sm.pullDistance, sm.pullExtraDmgMul, opts);
    }

    /* ─── Mod 9: Calming ─── */
    if (sm.isCalming) {
      _applyCalming(x, y, b, sm.calmDuration, opts);
    }

    /* ─── Mod 10: Fire Pool ─── */
    if (sm.firePool && opts.addDecal) {
      var fireCfg = getModCfg(10);
      var eff = fireCfg && fireCfg.effect;
      opts.addDecal({
        kind: 'chipPool', subKind: 'fire', x: x, y: y,
        r: eff ? eff.poolRadius : 40,
        life: eff ? eff.poolLife : 4.0,
        dps: b.dmg * (eff ? eff.poolDpsMul : 0.30),
        color: eff ? eff.color : 'rgba(255,99,72,0.25)',
        chipModId: 10
      });
    }

    /* ─── Mod 11: Ice Zone ─── */
    if (sm.iceZone && opts.addDecal) {
      var iceCfg = getModCfg(11);
      var iceEff = iceCfg && iceCfg.effect;
      opts.addDecal({
        kind: 'chipPool', subKind: 'ice', x: x, y: y,
        r: iceEff ? iceEff.poolRadius : 45,
        life: iceEff ? iceEff.poolLife : 4.5,
        dps: 0,
        slowFactor: iceEff ? iceEff.slowFactor : 0.35,
        color: iceEff ? iceEff.color : 'rgba(112,161,255,0.2)',
        chipModId: 11
      });
    }

    /* ─── Mod 12: Electro Node ─── */
    if (sm.electroNode) {
      var elCfg = getModCfg(12);
      var elEff = elCfg && elCfg.effect;
      _electroNodes.push({
        x: x, y: y,
        life: elEff ? elEff.nodeLife : 5.0,
        interval: elEff ? elEff.nodeInterval : 0.8,
        range: elEff ? elEff.nodeRange : 60,
        dmg: b.dmg * (elEff ? elEff.nodeDmgMul : 0.35),
        timer: 0,
        chipModId: 12
      });
    }

    /* ─── Mod 13: Laser Mark ─── */
    if (sm.laserMark) {
      var laCfg = getModCfg(13);
      var laEff = laCfg && laCfg.effect;
      _laserMarks.push({
        x: x, y: y,
        life: laEff ? laEff.markLife : 3.0,
        damageMul: laEff ? laEff.damageMul : 2.0,
        aoeMul: laEff ? laEff.aoeMul : 2.0,
        r: 18,
        chipModId: 13
      });
    }

    /* ─── Mod 14: Acid Pool ─── */
    if (sm.acidPool && opts.addDecal) {
      var acidCfg = getModCfg(14);
      var acidEff = acidCfg && acidCfg.effect;
      opts.addDecal({
        kind: 'chipPool', subKind: 'acid', x: x, y: y,
        r: acidEff ? acidEff.poolRadius : 38,
        life: acidEff ? acidEff.poolLife : 3.5,
        dps: b.dmg * (acidEff ? acidEff.poolDpsMul : 0.15),
        slowFactor: acidEff ? acidEff.slowFactor : 0.15,
        color: acidEff ? acidEff.color : 'rgba(184,255,59,0.2)',
        chipModId: 14
      });
    }
  }

  /* ─── chain jumps (mod 2) — spawn a projectile to a different target ─── */
  function _applyChainJumps(x, y, b, jumps, opts) {
    var zombies = opts.zombies;
    var getPos = opts.getZombiePos;
    if (!opts.spawnProjectile) return;

    // Find nearest alive zombie at least 12px from impact point
    var best = null, bestD = Infinity;
    for (var j = 0; j < zombies.length; j++) {
      var z = zombies[j];
      if (z.state === 'dying') continue;
      var p = getPos(z);
      var d = Math.hypot(p.x - x, p.y - y);
      if (d >= 12 && d <= 150 && d < bestD) { best = z; bestD = d; }
    }
    if (!best) return;

    var tp = getPos(best);
    // spawn chain projectile that flies to new target
    opts.spawnProjectile({
      fromX: x, fromY: y,
      toZombieId: best.id, toX: tp.x, toY: tp.y,
      level: b.level,
      dmg: b.dmg,
      aoe: b.aoe,
      prof: b.prof,
      bulletCfg: b.bulletCfg,
      effectIntensity: (b.effectIntensity || 1) * 0.9,
      shotId: (b.shotId || 0) + 0.1,
      isTankAttackingZombie: false,
      tank: b.tank,
      chipShotMods: jumps > 1 ? {
        chainJumps: jumps - 1,
        extraProjectiles: 0,
        isMatryoshka: false,
        matryoshkaDmgMul: 1,
        matryoshkaSizeMul: 1,
        pushDistance: 0,
        pushExtraDmgMul: 0,
        pullDistance: 0,
        pullExtraDmgMul: 0,
        comboShots: 0,
        comboDmgMul: 1,
        isNuke: false,
        nukeDmgMul: 1,
        nukeRadius: 0,
        isCalming: false,
        calmDuration: 0,
        firePool: false,
        iceZone: false,
        electroNode: false,
        laserMark: false,
        acidPool: false,
        activeModIds: [2]
      } : null,
      isChainChild: true
    });
  }

  /* ─── matryoshka child (mod 3) — spawn small child to a DIFFERENT target ─── */
  function _spawnMatryoshkaChild(x, y, b, opts) {
    var zombies = opts.zombies;
    var getPos = opts.getZombiePos;
    // find nearest alive zombie at least 12px from impact point
    var best = null, bestD = Infinity;
    for (var i = 0; i < zombies.length; i++) {
      var z = zombies[i];
      if (z.state === 'dying') continue;
      var p = getPos(z);
      var d = Math.hypot(p.x - x, p.y - y);
      if (d >= 12 && d < bestD) { best = z; bestD = d; }
    }
    if (!best) return;
    var tp = getPos(best);
    opts.spawnProjectile({
      fromX: x, fromY: y,
      toZombieId: best.id, toX: tp.x, toY: tp.y,
      level: b.level,
      dmg: (b.dmg / (b.chipShotMods && b.chipShotMods.matryoshkaDmgMul || 2)), // child = base dmg
      aoe: b.aoe,
      prof: b.prof,
      bulletCfg: b.bulletCfg,
      effectIntensity: (b.effectIntensity || 1) * 0.8,
      shotId: (b.shotId || 0) + 0.5,
      isTankAttackingZombie: false,
      tank: b.tank,
      chipShotMods: null, // child has no further chip effects
      isMatryoshkaChild: true
    });
  }

  /* ─── push (mod 4) ─── */
  /* Zombies use polar coordinates (z.r, z.theta) around center.
     Push = increase z.r (away from center = toward edge). */
  function _applyPushPull(x, y, b, distance, extraDmgMul, direction, opts) {
    var zombies = opts.zombies;
    var getPos = opts.getZombiePos;
    var applyDmg = opts.applyDamage;
    var addNum = opts.addDamageNumber;

    for (var i = 0; i < zombies.length; i++) {
      var z = zombies[i];
      if (z.state === 'dying') continue;
      var p = getPos(z);
      var d = Math.hypot(p.x - x, p.y - y);
      if (d > b.aoe) continue;

      // extra damage
      if (extraDmgMul > 0) {
        var extraDmg = Math.round(b.dmg * extraDmgMul);
        if (applyDmg) applyDmg(z, extraDmg, 'tank');
        if (addNum) addNum(p.x, p.y, extraDmg, false);
      }

      // displacement via polar z.r (push outward / pull inward)
      if (Number.isFinite(z.r)) {
        var sign = direction === 'push' ? 1 : -1;
        z.r = Math.max(0, z.r + distance * sign);
      }
    }
  }

  /* ─── vacuum (mod 5) — pull all zombies in radius toward impact point ─── */
  function _applyVacuum(x, y, b, pullRadius, extraDmgMul, opts) {
    var zombies = opts.zombies;
    var getPos = opts.getZombiePos;
    var applyDmg = opts.applyDamage;
    var addNum = opts.addDamageNumber;

    for (var i = 0; i < zombies.length; i++) {
      var z = zombies[i];
      if (z.state === 'dying') continue;
      var p = getPos(z);
      var d = Math.hypot(p.x - x, p.y - y);
      if (d > pullRadius || d < 1) continue;

      // extra damage
      if (extraDmgMul > 0) {
        var extraDmg = Math.round(b.dmg * extraDmgMul);
        if (applyDmg) applyDmg(z, extraDmg, 'tank');
        if (addNum) addNum(p.x, p.y, extraDmg, false);
      }

      // Pull toward impact point (x, y) in Cartesian, convert back to polar
      var pullStrength = Math.min(d * 0.6, 15); // pull up to 15px or 60% of distance
      var dirX = (x - p.x) / d;
      var dirY = (y - p.y) / d;
      var newX = p.x + dirX * pullStrength;
      var newY = p.y + dirY * pullStrength;

      if (Number.isFinite(z.r) && Number.isFinite(z.theta)) {
        // Derive center from current polar position
        var cx = p.x - Math.cos(z.theta) * z.r;
        var cy = p.y - Math.sin(z.theta) * z.r;
        z.r = Math.max(0, Math.hypot(newX - cx, newY - cy));
        z.theta = Math.atan2(newY - cy, newX - cx);
      }
    }
  }

  /* ─── calming (mod 9) ─── */
  function _applyCalming(x, y, b, duration, opts) {
    var zombies = opts.zombies;
    var getPos = opts.getZombiePos;
    var now = _now();

    for (var i = 0; i < zombies.length; i++) {
      var z = zombies[i];
      if (z.state === 'dying') continue;
      var p = getPos(z);
      var d = Math.hypot(p.x - x, p.y - y);
      if (d > b.aoe) continue;
      // max once per zombie per wave
      if (_calmedZombieIds[z.id]) continue;
      _calmedZombieIds[z.id] = true;
      z.calmUntil = now + duration;
    }
  }

  /* ================== STEP TICK (called every frame) ================== */

  /**
   * Called from main game loop each frame.
   *
   * @param {number} dt — delta time in seconds
   * @param {object} opts
   *   - zombies {array}
   *   - getZombiePos {fn}
   *   - applyDamage {fn}
   *   - addDamageNumber {fn}
   *   - impacts {array}
   */
  function stepChipEffects(dt, opts) {
    _stepElectroNodes(dt, opts);
    _stepLaserMarks(dt);
  }

  function _stepElectroNodes(dt, opts) {
    var next = [];
    for (var i = 0; i < _electroNodes.length; i++) {
      var node = _electroNodes[i];
      node.life -= dt;
      if (node.life <= 0) continue;
      node.timer -= dt;
      if (node.timer <= 0) {
        node.timer = node.interval;
        // zap nearest
        var zombies = opts.zombies;
        var getPos = opts.getZombiePos;
        var best = null, bestD = Infinity;
        for (var j = 0; j < zombies.length; j++) {
          var z = zombies[j];
          if (z.state === 'dying') continue;
          var p = getPos(z);
          var d = Math.hypot(p.x - node.x, p.y - node.y);
          if (d <= node.range && d < bestD) { best = z; bestD = d; }
        }
        if (best) {
          var bp = getPos(best);
          var dmg = Math.round(node.dmg);
          if (opts.applyDamage) opts.applyDamage(best, dmg, 'tank');
          if (opts.addDamageNumber) opts.addDamageNumber(bp.x, bp.y, dmg, false);
          if (opts.impacts) {
            opts.impacts.push({ x: node.x, y: node.y, tx: bp.x, ty: bp.y, life: 0.08, max: 0.08, kind: 'chipElectro' });
          }
        }
      }
      next.push(node);
    }
    _electroNodes = next;
  }

  function _stepLaserMarks(dt) {
    var next = [];
    for (var i = 0; i < _laserMarks.length; i++) {
      var mark = _laserMarks[i];
      mark.life -= dt;
      if (mark.life > 0) next.push(mark);
    }
    _laserMarks = next;
  }

  /* ─── check laser mark boost for a hit ─── */
  function checkLaserMarkBoost(x, y) {
    for (var i = 0; i < _laserMarks.length; i++) {
      var m = _laserMarks[i];
      if (Math.hypot(x - m.x, y - m.y) <= m.r) {
        // consume mark
        _laserMarks.splice(i, 1);
        return { damageMul: m.damageMul, aoeMul: m.aoeMul };
      }
    }
    return null;
  }

  /* ================== DECAL STEP EXTENSION ================== */

  /**
   * Extra step processing for chip-created decals (ice slow, acid slow)
   * Called from stepDecals.
   *
   * @param {object} d     — decal object
   * @param {number} dt
   * @param {object} opts  — { zombies, getZombiePos }
   */
  function stepChipDecal(d, dt, opts) {
    if (d.kind !== 'chipPool') return;
    var zombies = opts.zombies;
    var getPos = opts.getZombiePos;

    for (var i = 0; i < zombies.length; i++) {
      var z = zombies[i];
      if (z.state === 'dying') continue;
      var p = getPos(z);
      var dist = Math.hypot(p.x - d.x, p.y - d.y);
      if (dist > d.r) continue;

      // slow from ice or acid
      if (d.slowFactor && d.slowFactor > 0) {
        z.chipSlowUntil = _now() + 0.2; // re-apply each frame
        z.chipSlowFactor = Math.min(z.chipSlowFactor || 1, 1 - d.slowFactor);
      }
    }
  }

  /* ================== RESET (on wave / game reset) ================== */

  function reset() {
    _comboCounters = {};
    _nukeCooldowns = {};
    _calmedZombieIds = {};
    _electroNodes = [];
    _laserMarks = [];
  }

  /* ================== Getters for render ================== */

  function getElectroNodes() { return _electroNodes; }
  function getLaserMarks() { return _laserMarks; }

  /* ================== PUBLIC API ================== */

  global.Game = global.Game || {};
  global.Game.ChipEffects = {
    loadChipsCfg: loadChipsCfg,
    getChipsCfg: getChipsCfg,
    getModCfg: getModCfg,
    getActiveChipMods: getActiveChipMods,
    hasChipMod: hasChipMod,
    getActiveModIds: getActiveModIds,
    applyShotModifiers: applyShotModifiers,
    applyImpactEffects: applyImpactEffects,
    checkLaserMarkBoost: checkLaserMarkBoost,
    stepChipEffects: stepChipEffects,
    stepChipDecal: stepChipDecal,
    reset: reset,
    getElectroNodes: getElectroNodes,
    getLaserMarks: getLaserMarks,
    GROUP_A_MODS: GROUP_A_MODS
  };

})(typeof window !== 'undefined' ? window : this);
