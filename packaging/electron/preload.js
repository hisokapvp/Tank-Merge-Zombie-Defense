'use strict';
/**
 * packaging/electron/preload.js
 * solo-pipeline-yandex-vk#1 / Phase 2 — native bridge injection.
 *
 * Exposes the canonical native bridge object that Game.Platform consumes:
 *   window.__TMZD_NATIVE_BRIDGE__ = {
 *     platform: 'electron',
 *     capabilities: {...},
 *     payments:  { ownsDlc },
 *     cloudSave: { read, write },
 *     lifecycle: { ready, requestExit, ... },
 *     achievements: { unlock },
 *   }
 *
 * All privileged work is relayed to the main process over ipcRenderer; the
 * page never gets Node access (contextIsolation: true).
 */
const { contextBridge, ipcRenderer } = require('electron');

const bridge = {
  platform: 'electron',

  capabilities: {
    payments: true,      // DLC ownership only (Phase 2 scope)
    cloudSave: true,     // Steam Cloud
    fullscreen: true,
    exit: true,
    achievements: true,
    mobile: false,
  },

  // Payments facade — Game.Platform.Payments delegates here on desktop.
  // Phase 2 deliberately ships DLC ownership only (no consumable bundles).
  payments: {
    backend: 'steam',
    ownsDlc(dlcAppId) {
      return ipcRenderer.invoke('tmzd:steam:ownsDlc', dlcAppId);
    },
  },

  // CloudSave facade — Game.Platform.CloudSave router targets this on desktop.
  cloudSave: {
    read(key) {
      return ipcRenderer.invoke('tmzd:steam:cloudRead', key);
    },
    write(key, value) {
      return ipcRenderer.invoke('tmzd:steam:cloudWrite', key, value);
    },
  },

  // Achievements — mapped 1:1 to existing game achievement ids.
  achievements: {
    unlock(achievementId) {
      return ipcRenderer.invoke('tmzd:steam:unlockAchievement', achievementId);
    },
  },

  // Lifecycle — Game.Platform.Lifecycle delegates fullscreen/exit on desktop.
  lifecycle: {
    ready() { /* shell is already shown on ready-to-show */ },
    requestFullscreen() { /* window boots fullscreen; no-op hook */ },
    exitFullscreen() { /* managed by OS / window chrome */ },
    requestExit() { window.close(); },
    onVisibilityChange(cb) {
      if (typeof cb !== 'function') return;
      document.addEventListener('visibilitychange', () => {
        cb(document.visibilityState === 'visible');
      });
    },
  },

  // Diagnostics: lets the page know if Steam actually initialised.
  steamStatus() {
    return ipcRenderer.invoke('tmzd:steam:status');
  },
};

contextBridge.exposeInMainWorld('__TMZD_NATIVE_BRIDGE__', bridge);
