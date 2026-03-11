(function (global) {
  'use strict';

  function asNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function asPositiveNumber(value, fallback) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function hashString(value) {
    var text = typeof value === 'string' ? value : '';
    var hash = 0;
    for (var index = 0; index < text.length; index++) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
  }

  function getDefaultCycle() {
    return ['hoverScan', 'idleBob', 'alertPulse'];
  }

  function getHangarAnimationsConfig(config) {
    return config && config.hangarAnimations && typeof config.hangarAnimations === 'object'
      ? config.hangarAnimations
      : null;
  }

  function getCycle(config) {
    var hangarConfig = getHangarAnimationsConfig(config);
    var rawCycle = hangarConfig && Array.isArray(hangarConfig.defaultCycle) ? hangarConfig.defaultCycle : null;
    var cycle = [];
    if (rawCycle) {
      for (var index = 0; index < rawCycle.length; index++) {
        if (typeof rawCycle[index] === 'string' && rawCycle[index]) cycle.push(rawCycle[index]);
      }
    }
    return cycle.length ? cycle : getDefaultCycle();
  }

  function getPresetConfig(config, presetName) {
    var hangarConfig = getHangarAnimationsConfig(config);
    var rawPreset = hangarConfig && presetName && hangarConfig[presetName] && typeof hangarConfig[presetName] === 'object'
      ? hangarConfig[presetName]
      : null;
    var rawEffects = rawPreset && Array.isArray(rawPreset.effects) ? rawPreset.effects : [];
    var effects = [];
    for (var index = 0; index < rawEffects.length; index++) {
      var effect = rawEffects[index];
      if (!effect || typeof effect !== 'object') continue;
      effects.push({
        preset: typeof effect.preset === 'string' ? effect.preset : '',
        amplitudeX: asNumber(effect.amplitudeX, 0),
        amplitudeY: asNumber(effect.amplitudeY, 0),
        angleDeg: asNumber(effect.angleDeg, 0),
        scaleMul: asNumber(effect.scaleMul, 0),
        frequencyHz: asPositiveNumber(effect.frequencyHz, 1),
        phase: asNumber(effect.phase, 0),
      });
    }
    return { effects: effects };
  }

  function pickPresetName(cell, tank, config) {
    var cycle = getCycle(config);
    var slotIndex = Number.isFinite(cell && cell.i) ? Math.abs(Math.floor(cell.i)) : null;
    var seed = slotIndex != null ? slotIndex : hashString(tank && tank.id);
    return cycle[seed % cycle.length] || cycle[0];
  }

  function computeSignal(timeSec, frequencyHz, phase, seed) {
    var timeValue = asNumber(timeSec, 0);
    var freq = asPositiveNumber(frequencyHz, 1);
    return Math.sin((timeValue * freq + phase + seed) * Math.PI * 2);
  }

  function computeRenderState(cell, tank, config, timeSec) {
    if (!tank || tank.onTrack) {
      return { offsetX: 0, offsetY: 0, rotation: 0, scale: 1, presetName: '' };
    }

    var presetName = pickPresetName(cell, tank, config);
    var preset = getPresetConfig(config, presetName);
    var seed = (hashString(tank && tank.id) % 1000) / 1000;
    var offsetX = 0;
    var offsetY = 0;
    var rotation = 0;
    var scale = 1;

    for (var index = 0; index < preset.effects.length; index++) {
      var effect = preset.effects[index];
      var signal = computeSignal(timeSec, effect.frequencyHz, effect.phase, seed);
      var effectName = effect.preset;

      if (effectName === 'float' || effectName === 'bob' || effectName === 'hover') {
        offsetY += signal * (effect.amplitudeY || 0);
        offsetX += Math.cos((asNumber(timeSec, 0) * effect.frequencyHz + effect.phase + seed) * Math.PI * 2) * (effect.amplitudeX || 0);
        continue;
      }

      if (effectName === 'sway' || effectName === 'wobble') {
        rotation += signal * (effect.angleDeg || 0) * Math.PI / 180;
        offsetX += signal * (effect.amplitudeX || 0);
        continue;
      }

      if (effectName === 'vibration' || effectName === 'vibrationStrong') {
        offsetX += signal * (effect.amplitudeX || 0);
        offsetY += Math.cos((asNumber(timeSec, 0) * effect.frequencyHz + effect.phase + seed) * Math.PI * 2) * (effect.amplitudeY || 0);
        continue;
      }

      if (effectName === 'pulse') {
        scale *= 1 + signal * (effect.scaleMul || 0);
      }
    }

    return {
      offsetX: offsetX,
      offsetY: offsetY,
      rotation: rotation,
      scale: Math.max(0.85, scale),
      presetName: presetName,
    };
  }

  global.Game = global.Game || {};
  global.Game.TankHangarAnimation = {
    computeRenderState: computeRenderState,
  };
})(typeof window !== 'undefined' ? window : this);