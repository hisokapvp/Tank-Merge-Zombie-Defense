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
 *  6  Small Combo       — every 4th shot fires 3 rapid shots at ×1.25 dmg; shots 1-3 fire 1 normal cascade projectile
 *  7  Arcade Chaos      — each shot randomly picks one pattern from group A (mods 1–9)
 *  8  Small Nuke        — once per 30s: nuclear shot with ×3 blast, 100px radius
 *  9  Small Calming     — hit zombies stop attacking for 0.5s; max once per zombie
 * 10  Fire Pool         — impact leaves burning ground zone (sprite-based)
 * 11  Ice Zone          — impact leaves heavy-slow zone (sprite-based)
 * 12  Electro Node      — creates a point that periodically zaps nearest enemy
 * 13  Laser Mark        — marks target; hitting mark = ×2 dmg & ×2 aoe radius
 * 14  Acid Pool         — impact leaves acid pool: small dmg + light slow (sprite)
 *
 * Tech-unlockable upgrades (15–30):
 * 15  Triple Shot       — 3 projectiles per barrel targeting different enemies
 * 16  Hex Shot          — 6 projectiles per barrel targeting different enemies
 * 17  Triple Chain      — on-hit chain with 3 bounces
 * 18  Hex Chain         — on-hit chain with 6 bounces
 * 19  Triple Matryoshka — big (×1.5, ×3 dmg) → medium (×1.25, ×2 dmg) → small (×1, ×1 dmg)
 * 20  Quad Matryoshka   — huge (×1.75, ×4 dmg) → big (×1.5, ×3 dmg) → medium (×1.25, ×2 dmg) → small (×1, ×1 dmg)
 * 21  Medium Repulse    — on-hit: +0.75× extra dmg & push 15px
 * 22  Large Repulse     — on-hit: +1× extra dmg & push 20px
 * 23  Medium Vacuum     — on-hit: +0.75× extra dmg & pull 15px
 * 24  Large Vacuum      — on-hit: +1× extra dmg & pull 20px
 * 25  Medium Combo      — every 4th shot: 3 rapid shots ×1.5 dmg; shots 1-3 fire 1 normal cascade projectile
 * 26  Large Combo       — every 4th shot: 4 rapid shots ×2 dmg; shots 1-3 fire 1 normal cascade projectile
 * 27  Medium Nuke       — once per 30s: ×4 dmg, 300px radius
 * 28  Large Nuke        — once per 30s: ×5 dmg, entire map radius
 * 29  Medium Calming    — 0.75s stun, max once per zombie
 * 30  Large Calming     — 1s stun, max once per zombie
 */
(function (global) {
  'use strict';

  /* ────────── config loaded from assets/chips.json ────────── */
  var _chipsCfg = null;

  /**
   * Minimum distance (px) between primary and secondary target for
   * the "Double Shot" (mod 1) modifier.  The second projectile will
   * only pick a zombie that is at least this far from every primary
   * target.  Increase to force more spread, decrease to relax it.
   */
  var DOUBLE_SHOT_MIN_TARGET_DISTANCE = 1000;

  /**
   * Configurable AoE radius (px) for calming effect per upgrade level.
   * Small = mod 9, Medium = mod 29, Large = mod 30.
   * Zombies within this radius from impact point will stop attacking.
   */
  var CALM_RADIUS_BY_LEVEL = {
    small: 40,     // mod 9  — Small Calming
    medium: 60,    // mod 29 — Medium Calming
    large: 80     // mod 30 — Large Calming
  };

  /* ────────── chip atlas image cache ────────── */
  var _chipAtlasImages = {};

  function loadChipsCfg(cfg) {
    _chipsCfg = cfg;
    _chipSpriteCache = {};
    _chipSfxRegistered = {};
    _preloadChipAtlasImages(cfg);
  }

  function _preloadChipAtlasImages(cfg) {
    if (!cfg || !cfg.modifiers || typeof cfg.modifiers !== 'object') return;
    var srcs = {};
    var keys = Object.keys(cfg.modifiers);
    for (var i = 0; i < keys.length; i++) {
      var mod = cfg.modifiers[keys[i]];
      if (mod && mod.bulletSprite && typeof mod.bulletSprite.src === 'string' && mod.bulletSprite.src) {
        srcs[mod.bulletSprite.src] = true;
      }
      if (mod && mod.impactSprite && typeof mod.impactSprite.src === 'string' && mod.impactSprite.src) {
        srcs[mod.impactSprite.src] = true;
      }
      if (mod && mod.impactSpriteNormal && typeof mod.impactSpriteNormal.src === 'string' && mod.impactSpriteNormal.src) {
        srcs[mod.impactSpriteNormal.src] = true;
      }
      if (mod && mod.effectSprite && typeof mod.effectSprite.src === 'string' && mod.effectSprite.src) {
        srcs[mod.effectSprite.src] = true;
      }
    }
    var srcList = Object.keys(srcs);
    for (var j = 0; j < srcList.length; j++) {
      if (_chipAtlasImages[srcList[j]]) continue;
      var img = new Image();
      img.src = 'assets/' + srcList[j];
      _chipAtlasImages[srcList[j]] = img;
    }
  }

  function getChipAtlasImage(src) {
    if (!src) return null;
    var img = _chipAtlasImages[src];
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  }

  function getChipsCfg() { return _chipsCfg; }
  function getModCfg(modId) { return _chipsCfg && _chipsCfg.modifiers ? _chipsCfg.modifiers[String(modId)] : null; }
  function getModEffectConfig(modId) {
    var cfg = getModCfg(modId);
    return cfg && cfg.effect && typeof cfg.effect === 'object' ? cfg.effect : null;
  }
  function isModEffectEnabled(modId) {
    var effectCfg = getModEffectConfig(modId);
    return !effectCfg || effectCfg.enabled !== false;
  }
  function resolveModEffectColor(modId, fallbackColor, explicitColor) {
    return explicitColor || fallbackColor;
  }

  /* ────────── per-modifier sprite / sfx helpers ────────── */
  var _chipSpriteCache = {};
  var _chipSfxRegistered = {};

  function _normalizeCustomSprite(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!raw.src || typeof raw.src !== 'string') return null;
    var frame = raw.frame;
    if (!frame || typeof frame !== 'object') return null;
    var x = Number(frame.x); var y = Number(frame.y);
    var w = Number(frame.w); var h = Number(frame.h);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) return null;
    if (!Number.isFinite(x)) x = 0;
    if (!Number.isFinite(y)) y = 0;
    var frames = Number.isFinite(raw.frames) ? Math.max(1, Math.floor(raw.frames)) : 1;
    var fps = Number.isFinite(raw.frameRateFps) ? Math.max(0.01, raw.frameRateFps) : 12;
    var anchor = raw.anchor && typeof raw.anchor === 'object'
      ? { x: Number.isFinite(raw.anchor.x) ? raw.anchor.x : 0.5, y: Number.isFinite(raw.anchor.y) ? raw.anchor.y : 0.5 }
      : { x: 0.5, y: 0.5 };
    var scale = Number.isFinite(raw.scale) ? Math.max(0.01, raw.scale) : 1;
    return {
      src: raw.src,
      frame: { x: x, y: y, w: w, h: h },
      frames: frames,
      frameRateFps: fps,
      anchor: anchor,
      scale: scale,
      loop: raw.loop !== false
    };
  }

  function getModBulletSprite(modId) {
    var key = 'b' + modId;
    if (key in _chipSpriteCache) return _chipSpriteCache[key];
    var cfg = getModCfg(modId);
    var result = cfg ? _normalizeCustomSprite(cfg.bulletSprite) : null;
    _chipSpriteCache[key] = result;
    return result;
  }

  function getModImpactSprite(modId) {
    var key = 'i' + modId;
    if (key in _chipSpriteCache) return _chipSpriteCache[key];
    var cfg = getModCfg(modId);
    var result = cfg ? _normalizeCustomSprite(cfg.impactSprite) : null;
    _chipSpriteCache[key] = result;
    return result;
  }

  function getModImpactSpriteNormal(modId) {
    var key = 'in' + modId;
    if (key in _chipSpriteCache) return _chipSpriteCache[key];
    var cfg = getModCfg(modId);
    var result = cfg ? _normalizeCustomSprite(cfg.impactSpriteNormal) : null;
    _chipSpriteCache[key] = result;
    return result;
  }

  function getModEffectSprite(modId) {
    var key = 'e' + modId;
    if (key in _chipSpriteCache) return _chipSpriteCache[key];
    if (!getModEffectConfig(modId)) {
      _chipSpriteCache[key] = null;
      return null;
    }
    var cfg = getModCfg(modId);
    var result = cfg ? _normalizeCustomSprite(cfg.effectSprite) : null;
    _chipSpriteCache[key] = result;
    return result;
  }

  function getModSfxConfig(modId) {
    var cfg = getModCfg(modId);
    if (!cfg || !cfg.sfx || typeof cfg.sfx !== 'object') return null;
    return cfg.sfx;
  }

  function normalizeActiveModIds(source) {
    if (Array.isArray(source)) return source;
    if (source && Array.isArray(source.activeModIds)) return source.activeModIds;
    return [];
  }

  function resolveChipSfxKey(modId, sfxKind) {
    var sfxCfg = getModSfxConfig(modId);
    if (!sfxCfg) return null;
    var value = sfxCfg[sfxKind];
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.length > 0) {
      var dynKey = '_chip_' + modId + '_' + sfxKind;
      if (!_chipSfxRegistered[dynKey]) {
        var sfxController = global.Game && global.Game.SfxPoolRuntime;
        if (sfxController && typeof sfxController.setSfxSources === 'function') {
          sfxController.setSfxSources(dynKey, value);
        }
        _chipSfxRegistered[dynKey] = true;
      }
      return dynKey;
    }
    return null;
  }

  function resolveChipShotSfx(activeModIds) {
    var resolvedModIds = normalizeActiveModIds(activeModIds);
    if (!resolvedModIds.length) return null;
    for (var i = 0; i < resolvedModIds.length; i++) {
      var key = resolveChipSfxKey(resolvedModIds[i], 'shoot');
      if (key) return key;
    }
    return null;
  }

  function resolveChipImpactSfx(activeModIds) {
    var resolvedModIds = normalizeActiveModIds(activeModIds);
    if (!resolvedModIds.length) return null;
    for (var i = 0; i < resolvedModIds.length; i++) {
      var key = resolveChipSfxKey(resolvedModIds[i], 'impact');
      if (key) return key;
    }
    return null;
  }

  function resolveBulletSpriteOverride(modId, shotMods) {
    var usesNuclearImpact = modId === 8 || modId === 27 || modId === 28;
    if (usesNuclearImpact && !(shotMods && shotMods.isNuke)) {
      return null;
    }
    return getModBulletSprite(modId);
  }

  function resolveImpactSpriteOverride(modId, shotMods) {
    var usesNuclearImpact = modId === 8 || modId === 27 || modId === 28;
    if (usesNuclearImpact && !(shotMods && shotMods.isNuke)) {
      return getModImpactSpriteNormal(modId);
    }
    return getModImpactSprite(modId);
  }

  function buildChipBulletCfgOverride(activeModIds, shotMods) {
    var resolvedModIds = normalizeActiveModIds(activeModIds);
    if (!resolvedModIds.length) return null;
    var bulletSprite = null;
    var impactSprite = null;
    for (var i = 0; i < resolvedModIds.length; i++) {
      if (!bulletSprite) bulletSprite = resolveBulletSpriteOverride(resolvedModIds[i], shotMods);
      if (!impactSprite) impactSprite = resolveImpactSpriteOverride(resolvedModIds[i], shotMods);
      if (bulletSprite && impactSprite) break;
    }
    if (!bulletSprite && !impactSprite) return null;
    return { bulletSprite: bulletSprite, impactSprite: impactSprite };
  }

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
  /* Only base mods; tech upgrades are NOT picked by Arcade Chaos */
  var GROUP_A_MODS = [1, 2, 3, 4, 5, 6, 8, 9];

  /* ================== SHOT MODIFIER ================== */

  /** Build an empty shotMods result with all properties at defaults. */
  function _buildEmptyResult() {
    return {
      extraProjectiles: 0,        // mod 1/15/16
      chainJumps: 0,              // mod 2/17/18
      isMatryoshka: false,        // mod 3/19/20
      matryoshkaDmgMul: 1,
      matryoshkaSizeMul: 1,
      matryoshkaDepth: 0,         // remaining child spawns (0=no child)
      matryoshkaChain: null,      // array of {dmgMul, sizeMul} for each child level
      pushDistance: 0,            // mod 4/21/22
      pushExtraDmgMul: 0,
      pushRadius: 0,               // AoE radius for push effect
      pullDistance: 0,            // mod 5/23/24
      pullExtraDmgMul: 0,
      comboShots: 0,              // mod 6/25/26
      comboDmgMul: 1,
      isNuke: false,              // mod 8/27/28
      nukeDmgMul: 1,
      nukeRadius: 0,
      isCalming: false,           // mod 9/29/30
      calmDuration: 0,
      calmRadius: 0,                // configurable AoE radius for calming
      firePool: false,            // mod 10
      iceZone: false,             // mod 11
      electroNode: false,         // mod 12
      laserMark: false,           // mod 13
      acidPool: false,            // mod 14
      activeModIds: [],
      cascadeLevel: 0,
      pendingCascadeMods: [],
      pendingYellowMods: [],
      cellIndex: -1
    };
  }

  /** Apply a single modId to an existing shotMods result object. */
  function _applyModToResult(result, modId, cellIndex) {
    switch (modId) {
      case 1: // Double Shot
        result.extraProjectiles = 1;
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
        result.pushDistance = 40;
        result.pushExtraDmgMul = 0.5;
        result.pushRadius = 40;
        break;
      case 5: // Small Vacuum
        result.pullDistance = 40;
        result.pullExtraDmgMul = 0.5;
        break;
      case 6: // Small Combo Counter
        if (!_comboCounters[cellIndex]) _comboCounters[cellIndex] = 0;
        _comboCounters[cellIndex]++;
        if (_comboCounters[cellIndex] >= 4) {
          _comboCounters[cellIndex] = 0;
          result.comboShots = 3;
          result.comboDmgMul = 3.75;
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
        result.calmDuration = 1;
        result.calmRadius = CALM_RADIUS_BY_LEVEL.small;
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
      /* ── Tech-unlockable upgrades (15–30) ── */
      case 15: // Triple Shot — 3 projectiles
        result.extraProjectiles = 2;
        break;
      case 16: // Hex Shot — 6 projectiles
        result.extraProjectiles = 5;
        break;
      case 17: // Triple Chain — 3 bounces
        result.chainJumps = 3;
        break;
      case 18: // Hex Chain — 6 bounces
        result.chainJumps = 6;
        break;
      case 19: // Triple Matryoshka — big(×1.5,×3) → med(×1.25,×2) → small(×1,×1)
        result.isMatryoshka = true;
        result.matryoshkaDmgMul = 3;
        result.matryoshkaSizeMul = 1.5;
        result.matryoshkaDepth = 2;
        result.matryoshkaChain = [
          { dmgMul: 2, sizeMul: 1.25 },
          { dmgMul: 1, sizeMul: 1.0 }
        ];
        break;
      case 20: // Quad Matryoshka — huge(×1.75,×4) → big(×1.5,×3) → med(×1.25,×2) → small(×1,×1)
        result.isMatryoshka = true;
        result.matryoshkaDmgMul = 4;
        result.matryoshkaSizeMul = 1.75;
        result.matryoshkaDepth = 3;
        result.matryoshkaChain = [
          { dmgMul: 3, sizeMul: 1.5 },
          { dmgMul: 2, sizeMul: 1.25 },
          { dmgMul: 1, sizeMul: 1.0 }
        ];
        break;
      case 21: // Medium Repulse — ×0.75 extra dmg, 15px push
        result.pushDistance = 60;
        result.pushExtraDmgMul = 0.75;
        result.pushRadius = 50;
        break;
      case 22: // Large Repulse — ×1 extra dmg, 20px push
        result.pushDistance = 80;
        result.pushExtraDmgMul = 1.0;
        result.pushRadius = 60;
        break;
      case 23: // Medium Vacuum — ×0.75 extra dmg, 15px pull radius
        result.pullDistance = 50;
        result.pullExtraDmgMul = 0.75;
        break;
      case 24: // Large Vacuum — ×1 extra dmg, 20px pull radius
        result.pullDistance = 60;
        result.pullExtraDmgMul = 1.0;
        break;
      case 25: // Medium Combo — every 4th: 3 rapid shots ×1.5 dmg
        if (!_comboCounters[cellIndex]) _comboCounters[cellIndex] = 0;
        _comboCounters[cellIndex]++;
        if (_comboCounters[cellIndex] >= 4) {
          _comboCounters[cellIndex] = 0;
          result.comboShots = 3;
          result.comboDmgMul = 4.5;
        }
        break;
      case 26: // Large Combo — every 4th: 4 rapid shots ×2 dmg
        if (!_comboCounters[cellIndex]) _comboCounters[cellIndex] = 0;
        _comboCounters[cellIndex]++;
        if (_comboCounters[cellIndex] >= 4) {
          _comboCounters[cellIndex] = 0;
          result.comboShots = 4;
          result.comboDmgMul = 8.0;
        }
        break;
      case 27: // Medium Nuke — every 30s: ×4 dmg, 300px radius
        var now27 = _now();
        if (!_nukeCooldowns[cellIndex] || now27 >= _nukeCooldowns[cellIndex]) {
          result.isNuke = true;
          result.nukeDmgMul = 4;
          result.nukeRadius = 300;
          _nukeCooldowns[cellIndex] = now27 + 30;
        }
        break;
      case 28: // Large Nuke — every 30s: ×5 dmg, entire map (radius 9999)
        var now28 = _now();
        if (!_nukeCooldowns[cellIndex] || now28 >= _nukeCooldowns[cellIndex]) {
          result.isNuke = true;
          result.nukeDmgMul = 5;
          result.nukeRadius = 9999;
          _nukeCooldowns[cellIndex] = now28 + 30;
        }
        break;
      case 29: // Medium Calming — 0.75s stun
        result.isCalming = true;
        result.calmDuration = 2;
        result.calmRadius = CALM_RADIUS_BY_LEVEL.medium;
        break;
      case 30: // Large Calming — 1s stun
        result.isCalming = true;
        result.calmDuration = 3;
        result.calmRadius = CALM_RADIUS_BY_LEVEL.large;
        break;
    }
  }

  /**
   * Called from fireTankProjectile BEFORE spawning projectiles.
   * Returns an object describing modifications to the shot.
   *
   * Cascade system: mods with order > 0 are deferred to impact time.
   * - order 0: applied at shot time (initial fire)
   * - order 1: spawns cascade projectiles from impact point
   * - order 2 (yellow): triggers on the LAST cascade's impact
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
    var chipMods = getActiveChipMods(cellIndex);
    if (!chipMods.length) return null;

    /* Mod 7 — Arcade Chaos: replace active mods with one random from group A (no cascade) */
    var hasArcadeChaos = false;
    for (var ac = 0; ac < chipMods.length; ac++) {
      if (chipMods[ac].modId === 7) { hasArcadeChaos = true; break; }
    }
    if (hasArcadeChaos) {
      var pick = GROUP_A_MODS[Math.floor(Math.random() * GROUP_A_MODS.length)];
      var result = _buildEmptyResult();
      result.activeModIds = [pick];
      result.cellIndex = cellIndex;
      _applyModToResult(result, pick, cellIndex);
      return result;
    }

    /* Separate mods by cascade order */
    var level0Mods = [];
    var cascadeMods = [];
    var yellowMods = [];

    for (var i = 0; i < chipMods.length; i++) {
      var cm = chipMods[i];
      var order = cm.order !== undefined ? cm.order : 0;
      if (cm.source === 'yellow' || order === 2) {
        yellowMods.push({ modId: cm.modId });
      } else if (order >= 1) {
        cascadeMods.push({ modId: cm.modId });
      } else {
        level0Mods.push({ modId: cm.modId });
      }
    }

    /* Build result from level-0 mods only */
    var result = _buildEmptyResult();
    result.cellIndex = cellIndex;
    for (var j = 0; j < level0Mods.length; j++) {
      result.activeModIds.push(level0Mods[j].modId);
      _applyModToResult(result, level0Mods[j].modId, cellIndex);
    }

    /* If no cascade mods, yellow mods apply at this (first) level */
    if (cascadeMods.length === 0) {
      for (var k = 0; k < yellowMods.length; k++) {
        result.activeModIds.push(yellowMods[k].modId);
        _applyModToResult(result, yellowMods[k].modId, cellIndex);
      }
      result.pendingCascadeMods = [];
      result.pendingYellowMods = [];
    } else {
      /* Cascade mods deferred; yellow deferred to final cascade */
      result.pendingCascadeMods = cascadeMods;
      result.pendingYellowMods = yellowMods;

      /*
       * Combo counter mods (6/25/26) need their counter incremented
       * at shot time even when deferred — otherwise the counter never
       * advances because cascade impacts don't correspond to tank shots.
       * We track the combo fire state so the cascade spawn can read it.
       */
      var COMBO_MODS = [6, 25, 26];
      for (var ci = 0; ci < cascadeMods.length; ci++) {
        if (COMBO_MODS.indexOf(cascadeMods[ci].modId) !== -1) {
          var tmpResult = _buildEmptyResult();
          tmpResult.cellIndex = cellIndex;
          _applyModToResult(tmpResult, cascadeMods[ci].modId, cellIndex);
          if (tmpResult.comboShots > 0) {
            cascadeMods[ci]._comboFired = true;
            cascadeMods[ci]._comboShots = tmpResult.comboShots;
            cascadeMods[ci]._comboDmgMul = tmpResult.comboDmgMul;
          }
        }
      }
      for (var yi = 0; yi < yellowMods.length; yi++) {
        if (COMBO_MODS.indexOf(yellowMods[yi].modId) !== -1) {
          var tmpResult2 = _buildEmptyResult();
          tmpResult2.cellIndex = cellIndex;
          _applyModToResult(tmpResult2, yellowMods[yi].modId, cellIndex);
          if (tmpResult2.comboShots > 0) {
            yellowMods[yi]._comboFired = true;
            yellowMods[yi]._comboShots = tmpResult2.comboShots;
            yellowMods[yi]._comboDmgMul = tmpResult2.comboDmgMul;
          }
        }
      }
    }

    result.cascadeLevel = 0;
    return result;
  }

  /* ================== CASCADE SYSTEM ================== */

  /** Minimum distance (px) from impact for cascade target selection. */
  var CASCADE_MIN_DIST = 100;
  /** Maximum distance (px) from impact for cascade target selection. */
  var CASCADE_MAX_DIST = 250;

  /**
   * Find targets for cascade projectiles: zombies 100–250px from impact.
   * Prefers targets closer to CASCADE_MIN_DIST for maximum spread.
   */
  function _findCascadeTargets(x, y, count, opts) {
    var zombies = opts.zombies;
    var getPos = opts.getZombiePos;
    var candidates = [];

    for (var i = 0; i < zombies.length; i++) {
      var z = zombies[i];
      if (z.state === 'dying') continue;
      var p = getPos(z);
      var d = Math.hypot(p.x - x, p.y - y);
      if (d >= CASCADE_MIN_DIST && d <= CASCADE_MAX_DIST) {
        candidates.push({ z: z, d: d });
      }
    }

    /* Sort by distance ascending — prefer closer for first picks */
    candidates.sort(function(a, b) { return a.d - b.d; });

    var results = [];
    var usedIds = {};
    /* Pick diverse targets (skip duplicates) */
    for (var j = 0; j < candidates.length && results.length < count; j++) {
      var c = candidates[j];
      if (!usedIds[c.z.id]) {
        results.push(c.z);
        usedIds[c.z.id] = true;
      }
    }

    /* Fallback: if not enough in preferred range, accept any alive zombie ≥50px */
    if (results.length < count) {
      for (var k = 0; k < zombies.length && results.length < count; k++) {
        var zf = zombies[k];
        if (zf.state === 'dying') continue;
        if (usedIds[zf.id]) continue;
        var pf = getPos(zf);
        var df = Math.hypot(pf.x - x, pf.y - y);
        if (df >= 50) {
          results.push(zf);
          usedIds[zf.id] = true;
        }
      }
    }

    /* Last resort: any alive zombie */
    if (results.length < count) {
      for (var m = 0; m < zombies.length && results.length < count; m++) {
        var za = zombies[m];
        if (za.state === 'dying') continue;
        if (usedIds[za.id]) continue;
        results.push(za);
        usedIds[za.id] = true;
      }
    }

    return results;
  }

  /**
   * Determine how many cascade projectiles a mod should spawn.
   */
  function _getCascadeProjectileCount(modId, result) {
    switch (modId) {
      case 1:  // Double Shot
      case 15: // Triple Shot
      case 16: // Hex Shot
        return 1 + (result.extraProjectiles || 1);
      case 6:  // Small Combo
      case 25: // Medium Combo
      case 26: // Large Combo
        return result.comboShots > 0 ? result.comboShots : 1;
      default: return 1;
    }
  }

  /**
   * Spawn cascade projectiles from impact point when a higher-order mod
   * needs to fire. Each cascade projectile flies to a target 100–250px
   * away and carries that mod's effects (+yellow if it's the final cascade).
   */
  function _spawnCascadeProjectiles(x, y, b, nextMod, remainingCascade, yellowMods, opts) {
    if (!opts.spawnProjectile) return;
    var cellIndex = (b.chipShotMods && b.chipShotMods.cellIndex >= 0) ? b.chipShotMods.cellIndex : -1;

    /* Build shotMods for the cascade mod */
    var cascadeResult = _buildEmptyResult();
    cascadeResult.cellIndex = cellIndex;
    cascadeResult.activeModIds = [nextMod.modId];

    /* For combo counter mods: use pre-computed state from applyShotModifiers
       to avoid double-incrementing the counter.
       Counter was already advanced during applyShotModifiers, so we must
       NOT call _applyModToResult again for combo mods. */
    var COMBO_MODS_SET = {6: true, 25: true, 26: true};
    if (COMBO_MODS_SET[nextMod.modId]) {
      if (nextMod._comboFired) {
        /* Shot 4: burst of comboShots projectiles at comboDmgMul */
        cascadeResult.comboShots = nextMod._comboShots;
        cascadeResult.comboDmgMul = nextMod._comboDmgMul;
      } else {
        /* Shots 1-3: spawn a single normal-damage cascade projectile */
        cascadeResult.comboShots = 1;
        cascadeResult.comboDmgMul = 1.0;
      }
    } else {
      _applyModToResult(cascadeResult, nextMod.modId, cellIndex);
    }

    /* If this is the LAST cascade level, include yellow mods */
    if (remainingCascade.length === 0 && yellowMods.length > 0) {
      for (var yi = 0; yi < yellowMods.length; yi++) {
        cascadeResult.activeModIds.push(yellowMods[yi].modId);
        if (COMBO_MODS_SET[yellowMods[yi].modId]) {
          if (yellowMods[yi]._comboFired) {
            cascadeResult.comboShots = yellowMods[yi]._comboShots;
            cascadeResult.comboDmgMul = yellowMods[yi]._comboDmgMul;
          }
          /* else: counter not reached — yellow combo simply not applied */
        } else {
          _applyModToResult(cascadeResult, yellowMods[yi].modId, cellIndex);
        }
      }
    }

    cascadeResult.cascadeLevel = ((b.chipShotMods && b.chipShotMods.cascadeLevel) || 0) + 1;
    cascadeResult.pendingCascadeMods = remainingCascade;
    cascadeResult.pendingYellowMods = remainingCascade.length > 0 ? yellowMods : [];

    /* Determine projectile count for this mod */
    var projCount = _getCascadeProjectileCount(nextMod.modId, cascadeResult);

    /* Determine damage multipliers */
    var cascadeDmg = b.dmg;
    if (cascadeResult.comboDmgMul > 1) cascadeDmg *= cascadeResult.comboDmgMul;
    if (cascadeResult.isMatryoshka) cascadeDmg *= cascadeResult.matryoshkaDmgMul;
    if (cascadeResult.isNuke) cascadeDmg *= cascadeResult.nukeDmgMul;
    var splitDmg = cascadeDmg / Math.max(1, projCount);

    /* Determine aoe */
    var cascadeAoe = cascadeResult.isNuke ? cascadeResult.nukeRadius : b.aoe;

    /* Visual size multiplier */
    var sizeMul = cascadeResult.isMatryoshka ? cascadeResult.matryoshkaSizeMul : 0.85;

    /* Find targets */
    var targets = _findCascadeTargets(x, y, projCount, opts);
    if (!targets.length) return;

    /* For combo mods that fired: stagger spawns with 150ms delay (like primary combo) */
    var COMBO_MODS_STAGGER = {6: true, 25: true, 26: true};
    var useCascadeStagger = COMBO_MODS_STAGGER[nextMod.modId] && nextMod._comboFired && projCount > 1;

    if (useCascadeStagger) {
      /* Snapshot primitive values and stable references from b BEFORE the projectile
         is returned to the pool (releaseProjectile resets b.prof/bulletCfg to null). */
      var _level = b.level;
      var _prof = b.prof;
      var _bulletCfg = b.bulletCfg;
      var _effectIntensity = b.effectIntensity || 1;
      var _shotId = b.shotId || 0;
      var _tank = b.tank;
      var _cascadeResult = cascadeResult;
      var _splitDmg = splitDmg;
      var _cascadeAoe = cascadeAoe;
      var _sizeMul = sizeMul;
      var _x = x, _y = y;
      var _targets = targets, _opts = opts;
      for (var i = 0; i < projCount; i++) {
        (function (delay, idx) {
          setTimeout(function () {
            var zt = _targets[idx % _targets.length];
            var ztp = _opts.getZombiePos(zt);
            _opts.spawnProjectile({
              fromX: _x, fromY: _y,
              toZombieId: zt.id, toX: ztp.x, toY: ztp.y,
              level: _level,
              dmg: _splitDmg,
              aoe: _cascadeAoe,
              prof: _prof,
              bulletCfg: _bulletCfg,
              effectIntensity: _effectIntensity * _sizeMul,
              shotId: _shotId + 0.3 * _cascadeResult.cascadeLevel,
              isTankAttackingZombie: false,
              tank: _tank,
              chipShotMods: _cascadeResult,
              isCascadeChild: true
            });
          }, delay);
        })(i * 150, i);
      }
    } else {
      for (var i = 0; i < projCount; i++) {
        var t = targets[i % targets.length];
        var tp = opts.getZombiePos(t);
        opts.spawnProjectile({
          fromX: x, fromY: y,
          toZombieId: t.id, toX: tp.x, toY: tp.y,
          level: b.level,
          dmg: splitDmg,
          aoe: cascadeAoe,
          prof: b.prof,
          bulletCfg: b.bulletCfg,
          effectIntensity: (b.effectIntensity || 1) * sizeMul,
          shotId: (b.shotId || 0) + 0.3 * cascadeResult.cascadeLevel,
          isTankAttackingZombie: false,
          tank: b.tank,
          chipShotMods: cascadeResult,
          isCascadeChild: true
        });
      }
    }

    /* Visual burst at cascade spawn point */
    if (opts.burst) {
      opts.burst(x, y, Math.min(8, projCount * 3), 'rgba(255,220,100,0.35)');
    }
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
      _applyPushPull(x, y, b, sm.pushDistance, sm.pushExtraDmgMul, sm.pushRadius, 'push', opts);
    }

    /* ─── Mod 5: Vacuum ─── */
    if (sm.pullDistance > 0) {
      _applyVacuum(x, y, b, sm.pullDistance, sm.pullExtraDmgMul, opts);
    }

    /* ─── Mod 9: Calming ─── */
    if (sm.isCalming) {
      _applyCalming(x, y, b, sm.calmDuration, sm.calmRadius, opts);
    }

    /* ─── Mod 10: Fire Pool ─── */
    if (sm.firePool && opts.addDecal) {
      var eff = getModEffectConfig(10);
      if (eff && isModEffectEnabled(10)) {
        opts.addDecal({
          kind: 'chipPool', subKind: 'fire', x: x, y: y,
          r: eff.poolRadius,
          life: eff.poolLife,
          dps: b.dmg * eff.poolDpsMul,
          color: resolveModEffectColor(10, 'rgba(255,99,72,0.25)', eff.color),
          effectSprite: getModEffectSprite(10),
          chipModId: 10
        });
      }
    }

    /* ─── Mod 11: Ice Zone ─── */
    if (sm.iceZone && opts.addDecal) {
      var iceEff = getModEffectConfig(11);
      if (iceEff && isModEffectEnabled(11)) {
        opts.addDecal({
          kind: 'chipPool', subKind: 'ice', x: x, y: y,
          r: iceEff.poolRadius,
          life: iceEff.poolLife,
          dps: 0,
          slowFactor: iceEff.slowFactor,
          color: resolveModEffectColor(11, 'rgba(112,161,255,0.2)', iceEff.color),
          effectSprite: getModEffectSprite(11),
          chipModId: 11
        });
      }
    }

    /* ─── Mod 12: Electro Node ─── */
    if (sm.electroNode) {
      var elEff = getModEffectConfig(12);
      if (elEff && isModEffectEnabled(12)) {
        _electroNodes.push({
          x: x, y: y,
          life: elEff.nodeLife,
          maxLife: elEff.nodeLife,
          interval: elEff.nodeInterval,
          range: elEff.nodeRange,
          dmg: b.dmg * elEff.nodeDmgMul,
          timer: 0,
          color: resolveModEffectColor(12, 'rgba(236,204,104,0.3)', elEff.color),
          effectSprite: getModEffectSprite(12),
          chipModId: 12
        });
      }
    }

    /* ─── Mod 13: Laser Mark ─── */
    if (sm.laserMark) {
      var laEff = getModEffectConfig(13);
      if (laEff && isModEffectEnabled(13)) {
        _laserMarks.push({
          x: x, y: y,
          life: laEff.markLife,
          maxLife: laEff.markLife,
          damageMul: laEff.damageMul,
          aoeMul: laEff.aoeMul,
          r: 18,
          color: resolveModEffectColor(13, 'rgba(255,71,87,0.35)', laEff.color),
          effectSprite: getModEffectSprite(13),
          chipModId: 13
        });
      }
    }

    /* ─── Mod 14: Acid Pool ─── */
    if (sm.acidPool && opts.addDecal) {
      var acidEff = getModEffectConfig(14);
      if (acidEff && isModEffectEnabled(14)) {
        opts.addDecal({
          kind: 'chipPool', subKind: 'acid', x: x, y: y,
          r: acidEff.poolRadius,
          life: acidEff.poolLife,
          dps: b.dmg * acidEff.poolDpsMul,
          slowFactor: acidEff.slowFactor,
          color: resolveModEffectColor(14, 'rgba(184,255,59,0.18)', acidEff.color),
          effectSprite: getModEffectSprite(14),
          chipModId: 14
        });
      }
    }

    /* ─── CASCADE SPAWNING ───
     * If there are pending cascade mods, spawn projectiles from impact
     * point carrying the next cascade mod's effects. Yellow mods are
     * included only on the final cascade level. */
    if (sm.pendingCascadeMods && sm.pendingCascadeMods.length > 0) {
      var nextMod = sm.pendingCascadeMods[0];
      var remaining = sm.pendingCascadeMods.slice(1);
      var yellows = sm.pendingYellowMods || [];
      _spawnCascadeProjectiles(x, y, b, nextMod, remaining, yellows, opts);
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
      if (d >= 120 && d <= 300 && d < bestD) { best = z; bestD = d; }
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

  /* ─── matryoshka child (mod 3/19/20) — spawn child(ren) to DIFFERENT targets ─── */
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
      if (d >= 50 && d < bestD) { best = z; bestD = d; }
    }
    if (!best) return;
    var tp = getPos(best);

    var sm = b.chipShotMods;
    var chain = sm && sm.matryoshkaChain;
    var depth = sm && sm.matryoshkaDepth;

    if (chain && chain.length > 0 && depth > 0) {
      /* Advanced matryoshka (triple/quad): spawn next child in chain */
      var nextChild = chain[0];
      var remainingChain = chain.slice(1);
      var baseDmg = b.dmg / (sm.matryoshkaDmgMul || 1); // get base dmg
      var childDmg = baseDmg * nextChild.dmgMul;
      var childShotMods = null;
      if (remainingChain.length > 0) {
        childShotMods = {
          isMatryoshka: true,
          matryoshkaDmgMul: nextChild.dmgMul,
          matryoshkaSizeMul: nextChild.sizeMul,
          matryoshkaDepth: depth - 1,
          matryoshkaChain: remainingChain,
          /* carry through other properties as empty */
          extraProjectiles: 0, chainJumps: 0,
          pushDistance: 0, pushExtraDmgMul: 0,
          pullDistance: 0, pullExtraDmgMul: 0,
          comboShots: 0, comboDmgMul: 1,
          isNuke: false, nukeDmgMul: 1, nukeRadius: 0,
          isCalming: false, calmDuration: 0,
          firePool: false, iceZone: false, electroNode: false,
          laserMark: false, acidPool: false,
          activeModIds: sm.activeModIds || [],
          cascadeLevel: 0, pendingCascadeMods: [],
          pendingYellowMods: [], cellIndex: sm.cellIndex || -1
        };
      }
      opts.spawnProjectile({
        fromX: x, fromY: y,
        toZombieId: best.id, toX: tp.x, toY: tp.y,
        level: b.level,
        dmg: childDmg,
        aoe: b.aoe,
        prof: b.prof,
        bulletCfg: b.bulletCfg,
        effectIntensity: (b.effectIntensity || 1) * nextChild.sizeMul,
        shotId: (b.shotId || 0) + 0.5,
        isTankAttackingZombie: false,
        tank: b.tank,
        chipShotMods: childShotMods,
        isMatryoshkaChild: true
      });
    } else {
      /* Original double matryoshka: big → small (base dmg) */
      opts.spawnProjectile({
        fromX: x, fromY: y,
        toZombieId: best.id, toX: tp.x, toY: tp.y,
        level: b.level,
        dmg: (b.dmg / (sm && sm.matryoshkaDmgMul || 2)),
        aoe: b.aoe,
        prof: b.prof,
        bulletCfg: b.bulletCfg,
        effectIntensity: (b.effectIntensity || 1) * 0.8,
        shotId: (b.shotId || 0) + 0.5,
        isTankAttackingZombie: false,
        tank: b.tank,
        chipShotMods: null,
        isMatryoshkaChild: true
      });
    }
  }

  /* ─── push (mod 4) ─── */
  /* Zombies use polar coordinates (z.r, z.theta) around center.
     Push = increase z.r (away from center = away from fence). */
  function _applyPushPull(x, y, b, distance, extraDmgMul, pushRadius, direction, opts) {
    var zombies = opts.zombies;
    var getPos = opts.getZombiePos;
    var applyDmg = opts.applyDamage;
    var addNum = opts.addDamageNumber;
    var effectRadius = pushRadius > 0 ? pushRadius : (b.aoe || 0);

    for (var i = 0; i < zombies.length; i++) {
      var z = zombies[i];
      if (z.state === 'dying') continue;
      var p = getPos(z);
      var d = Math.hypot(p.x - x, p.y - y);
      if (d > effectRadius) continue;

      /* Distance falloff: closer zombies get more push, farther get less */
      var falloff = effectRadius > 0 ? Math.max(0.3, 1 - d / effectRadius) : 1;
      var actualDistance = Math.round(distance * falloff);

      // extra damage
      if (extraDmgMul > 0) {
        var extraDmg = Math.round(b.dmg * extraDmgMul * falloff);
        if (applyDmg) applyDmg(z, extraDmg, 'tank');
        if (addNum) addNum(p.x, p.y, extraDmg, false);
      }

      // displacement: always push AWAY from fence (increase z.r)
      if (Number.isFinite(z.r)) {
        z.r = Math.max(0, z.r + actualDistance);
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
      // Pull strongly — almost all the way to the center of the explosion
      var pullStrength = d * 0.85;
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
  function _applyCalming(x, y, b, duration, calmRadius, opts) {
    var zombies = opts.zombies;
    var getPos = opts.getZombiePos;
    var now = _now();
    var effectRadius = (calmRadius > 0) ? calmRadius : (b.aoe || 40);

    for (var i = 0; i < zombies.length; i++) {
      var z = zombies[i];
      if (z.state === 'dying') continue;
      var p = getPos(z);
      var d = Math.hypot(p.x - x, p.y - y);
      if (d > effectRadius) continue;
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
    getModEffectConfig: getModEffectConfig,
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
    getModBulletSprite: getModBulletSprite,
    getModImpactSprite: getModImpactSprite,
    getModImpactSpriteNormal: getModImpactSpriteNormal,
    getModEffectSprite: getModEffectSprite,
    getModSfxConfig: getModSfxConfig,
    resolveChipSfxKey: resolveChipSfxKey,
    resolveChipShotSfx: resolveChipShotSfx,
    resolveChipImpactSfx: resolveChipImpactSfx,
    buildChipBulletCfgOverride: buildChipBulletCfgOverride,
    getChipAtlasImage: getChipAtlasImage,
    GROUP_A_MODS: GROUP_A_MODS,
    /** Configurable min distance for Double Shot second-target selection */
    get DOUBLE_SHOT_MIN_TARGET_DISTANCE() { return DOUBLE_SHOT_MIN_TARGET_DISTANCE; },
    set DOUBLE_SHOT_MIN_TARGET_DISTANCE(v) { DOUBLE_SHOT_MIN_TARGET_DISTANCE = v; },
    /** Configurable AoE radius (px) for calming effect per level */
    CALM_RADIUS_BY_LEVEL: CALM_RADIUS_BY_LEVEL
  };

})(typeof window !== 'undefined' ? window : this);
