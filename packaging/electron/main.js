'use strict';
/**
 * packaging/electron/main.js
 * solo-pipeline-yandex-vk#1 / Phase 2 — Electron/Steam desktop shell.
 *
 * Responsibilities:
 *   • Boot a single fullscreen BrowserWindow.
 *   • Serve the pre-built web bundle (dist/native/web) over a custom
 *     `app://` protocol so that relative fetch('assets/...') resolves like a
 *     real web origin (file:// breaks fetch + relative paths).
 *   • Apply desktop GPU hints for the Canvas/Phaser renderer.
 *   • Enforce a single-instance lock (Steam launches one process).
 *   • Initialise Steamworks (achievements / cloud / IAP) and expose a
 *     minimal status object to the preload bridge.
 *
 * Native bridge contract (see preload.js): the page receives
 *   window.__TMZD_NATIVE_BRIDGE__ = { platform:'electron', capabilities,
 *   payments, cloudSave, lifecycle } which Game.Platform consumes.
 */
const { app, BrowserWindow, protocol, net, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

// Web bundle produced by scripts/build-web-bundle.mjs.
//
// solo-pipeline-yandex-vk#6 (D3 real root cause): the bundle lives at a
// DIFFERENT relative depth from main.js in dev vs packaged layouts, so a fixed
// `../../dist/native/web` is wrong in one of them:
//   • dev      __dirname = packaging/electron        -> ../../dist/native/web = <repo>/dist/native/web   (2 up)
//   • packaged __dirname = resources/app/electron    -> ../dist/native/web    = resources/app/dist/...   (1 up)
// The old fixed `../..` overshot in the packaged portable build and resolved to
// resources/dist/native/web (the `app/` segment dropped). app:// then 404'd on
// index.html, loadURL failed with ERR_UNEXPECTED, and the window stayed black.
// Probe the packaged location first, then dev, and verify index.html exists.
function resolveWebRoot() {
  const candidates = [
    path.resolve(__dirname, '..', 'dist', 'native', 'web'),       // packaged: resources/app/electron -> resources/app/dist/native/web
    path.resolve(__dirname, '..', '..', 'dist', 'native', 'web'), // dev: packaging/electron -> <repo>/dist/native/web
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(path.join(candidate, 'index.html'))) return candidate;
    } catch (_) { /* keep probing */ }
  }
  // Fallback to the dev path so the error surface still points at a real layout.
  return candidates[candidates.length - 1];
}

const WEB_ROOT = resolveWebRoot();
const APP_SCHEME = 'app';
const APP_ORIGIN = `${APP_SCHEME}://tmzd`;

// solo-pipeline-yandex-vk#4 (item 3 fix): explicit MIME map for the app://
// handler. net.fetch() of a file:// URL does NOT set a reliable Content-Type,
// so .js assets arrive as application/octet-stream. Under the standard+secure
// app:// scheme the renderer applies strict MIME checking and refuses to
// execute those scripts — the game never boots and the window stays black.
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

// --- Desktop GPU hints (applied before app ready) -------------------------
// High-performance path for the 2D Canvas / Phaser WebGL fallback. Guarded so
// a hostile environment variable can disable them for debugging.
if (!process.env.TMZD_NO_GPU_FLAGS) {
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
}

// --- Single-instance lock (Steam spawns one game process) -----------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// --- Steamworks (optional; absent in dev without the SDK) -----------------
let steamClient = null;
let steamStatus = { available: false, appId: null, reason: 'not-initialised' };

function initSteam() {
  // STEAM_APPID via steam_appid.txt next to the binary, or env override.
  const appId = Number(process.env.TMZD_STEAM_APPID || 0) || undefined;
  try {
    // Lazy require: keep the shell runnable without the native module present.
    const steamworks = require('steamworks.js');
    steamClient = appId ? steamworks.init(appId) : steamworks.init();
    steamStatus = {
      available: true,
      appId: appId || (steamClient && steamClient.utils && steamClient.utils.getAppId
        ? steamClient.utils.getAppId() : null),
      reason: 'ok',
    };
  } catch (err) {
    steamClient = null;
    steamStatus = { available: false, appId: appId || null, reason: String(err && err.message || err) };
    console.warn('[tmzd] Steamworks unavailable:', steamStatus.reason);
  }
}

// --- Custom protocol registration (must precede app ready) ----------------
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: false,
    },
  },
]);

function registerAppProtocol() {
  // Map app://tmzd/<path> -> WEB_ROOT/<path>, defaulting to index.html.
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') pathname = '/index.html';

    // Resolve safely inside WEB_ROOT (block path traversal).
    const resolved = path.normalize(path.join(WEB_ROOT, pathname));
    if (!resolved.startsWith(WEB_ROOT)) {
      return new Response('Forbidden', { status: 403 });
    }

    const response = await net.fetch(pathToFileURL(resolved).toString());
    // Override Content-Type from the file extension so scripts/styles are
    // served with an executable MIME type (see MIME_TYPES note above).
    const ext = path.extname(resolved).toLowerCase();
    const mime = MIME_TYPES[ext];
    if (mime) {
      const headers = new Headers(response.headers);
      headers.set('Content-Type', mime);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    return response;
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs require('steamworks.js') relay via ipc
      backgroundThrottling: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Make load failures loud instead of a silent black screen. With
  // --enable-logging these reach stderr and surface the real cause (e.g. a
  // 404 on index.html from a mis-resolved WEB_ROOT) during diagnostics.
  win.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    console.error(`[tmzd] did-fail-load ${errorCode} ${errorDescription} url=${validatedURL} WEB_ROOT=${WEB_ROOT}`);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[tmzd] render-process-gone:', JSON.stringify(details));
  });

  win.loadURL(`${APP_ORIGIN}/index.html`);
  return win;
}

// --- Steam IPC relay used by preload bridge -------------------------------
function wireSteamIpc() {
  ipcMain.handle('tmzd:steam:status', () => steamStatus);

  // Achievements: map game achievement ids to Steam stat ids 1:1.
  ipcMain.handle('tmzd:steam:unlockAchievement', (_evt, achievementId) => {
    if (!steamClient || !achievementId) return { ok: false, reason: 'no-steam' };
    try {
      steamClient.achievement.activate(String(achievementId));
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: String(err && err.message || err) };
    }
  });

  // Steam Cloud save/load — backs Game.Platform.CloudSave on desktop.
  ipcMain.handle('tmzd:steam:cloudWrite', (_evt, key, value) => {
    if (!steamClient) return { ok: false, reason: 'no-steam' };
    try {
      steamClient.cloud.writeFile(String(key), String(value));
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: String(err && err.message || err) };
    }
  });
  ipcMain.handle('tmzd:steam:cloudRead', (_evt, key) => {
    if (!steamClient) return { ok: false, reason: 'no-steam', value: null };
    try {
      const exists = steamClient.cloud.fileExists(String(key));
      const value = exists ? steamClient.cloud.readFile(String(key)) : null;
      return { ok: true, value };
    } catch (err) {
      return { ok: false, reason: String(err && err.message || err), value: null };
    }
  });

  // Payments — Phase 2 scope is premium/DLC ownership ONLY. Consumable
  // micro-transaction bundles need ISteamMicroTxn + a trusted backend, so we
  // intentionally expose only DLC ownership here.
  ipcMain.handle('tmzd:steam:ownsDlc', (_evt, dlcAppId) => {
    if (!steamClient) return { ok: false, reason: 'no-steam', owned: false };
    try {
      const owned = steamClient.apps.isDlcInstalled(Number(dlcAppId));
      return { ok: true, owned: !!owned };
    } catch (err) {
      return { ok: false, reason: String(err && err.message || err), owned: false };
    }
  });
}

if (gotLock) {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    initSteam();
    registerAppProtocol();
    wireSteamIpc();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    try { if (steamClient && steamClient.flushStats) steamClient.flushStats(); } catch (_) {}
  });
}
