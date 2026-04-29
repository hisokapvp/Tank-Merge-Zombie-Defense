/**
 * Game.Sprites — sprite atlas frame ref cache + invalidation hook.
 *
 * Solo-pipeline-yandex-vk#1 step-3 (postmortem items 10, 13, 17):
 *
 *  - Hot-path drawers (drawZombieEntity / drawTank / drawChipEffectSprite /
 *    projectile drawers) repeatedly resolve `spritesheet[type][frame]` to
 *    obtain an `ImageBitmap` / `HTMLImageElement`. With N sprites × 60 Hz
 *    that is N×60 property accesses per second.
 *
 *  - This module exposes:
 *      Game.Sprites.getAtlasVersion()      → monotonically increasing int
 *      Game.Sprites.bumpAtlasVersion(why?) → invalidates cached refs
 *      Game.Sprites.getCachedFrameRef(slot, resolveFn)
 *          slot        — any object owned by the caller (e.g. a sprite
 *                        descriptor on a zombie/tank/effect). The cache is
 *                        stored on the slot object itself under
 *                        `_atlasFrameRef` / `_atlasFrameVer` so it is
 *                        per-instance and GC-tracks the owner.
 *          resolveFn() — a closure that performs the property-chain
 *                        lookup once and returns the ref. The cache stores
 *                        the **ref** (not a primitive index), so the
 *                        consumer gets ImageBitmap / HTMLImageElement back.
 *
 *  - `bumpAtlasVersion()` is the canonical invalidation hook called from:
 *      * worldReset partial reset path (sprite namespace can be rebuilt)
 *      * sprite atlas hot-swap (asset reload, language pack swap,
 *        supercomputer skin tier change)
 *
 *  - `invalidateFrameRefs()` is an alias of `bumpAtlasVersion('explicit')`
 *    kept for documentation symmetry with the postmortem additions.
 *
 * Invariants:
 *  - Cache stores ref (NOT primitive index) — postmortem item 13.
 *  - Stale cache after worldReset is impossible — postmortem item 17.
 *  - Hot-swap atlas without bumpAtlasVersion is a CALLER bug; this module
 *    cannot detect it but provides the canonical invalidation API.
 */
(function (global) {
  'use strict';

  var atlasVersion = 1;

  function getAtlasVersion() { return atlasVersion; }

  function bumpAtlasVersion(reason) {
    atlasVersion = (atlasVersion + 1) | 0;
    if (atlasVersion <= 0) atlasVersion = 1; // wraparound guard (very unlikely)
    var bus = global.Game && global.Game.Events;
    if (bus && typeof bus.emit === 'function') {
      bus.emit('sprite.atlas.invalidated', { version: atlasVersion, reason: reason || null });
    }
    return atlasVersion;
  }

  function invalidateFrameRefs(reason) {
    return bumpAtlasVersion(reason || 'explicit');
  }

  /**
   * Lazy-cache the resolved frame ref on `slot`, keyed by atlas version.
   * Returns the ref. `resolveFn` MUST return an `ImageBitmap` /
   * `HTMLImageElement` / `HTMLCanvasElement`, never a primitive index.
   */
  function getCachedFrameRef(slot, resolveFn) {
    if (!slot || typeof resolveFn !== 'function') {
      return typeof resolveFn === 'function' ? resolveFn() : null;
    }
    if (slot._atlasFrameVer === atlasVersion && slot._atlasFrameRef) {
      return slot._atlasFrameRef;
    }
    var ref = resolveFn();
    // Guard against accidental primitive caching (postmortem item 13).
    if (ref && typeof ref === 'object') {
      slot._atlasFrameRef = ref;
      slot._atlasFrameVer = atlasVersion;
    } else {
      // Do not cache primitives — return the resolved value and leave cache cold.
      slot._atlasFrameRef = null;
      slot._atlasFrameVer = 0;
    }
    return ref;
  }

  global.Game = global.Game || {};
  if (!global.Game.Sprites) {
    global.Game.Sprites = {
      getAtlasVersion: getAtlasVersion,
      bumpAtlasVersion: bumpAtlasVersion,
      invalidateFrameRefs: invalidateFrameRefs,
      getCachedFrameRef: getCachedFrameRef,
    };
  } else {
    // Augment in case another module pre-registered a Sprites namespace.
    var ns = global.Game.Sprites;
    if (!ns.getAtlasVersion) ns.getAtlasVersion = getAtlasVersion;
    if (!ns.bumpAtlasVersion) ns.bumpAtlasVersion = bumpAtlasVersion;
    if (!ns.invalidateFrameRefs) ns.invalidateFrameRefs = invalidateFrameRefs;
    if (!ns.getCachedFrameRef) ns.getCachedFrameRef = getCachedFrameRef;
  }
})(typeof window !== 'undefined' ? window : this);
