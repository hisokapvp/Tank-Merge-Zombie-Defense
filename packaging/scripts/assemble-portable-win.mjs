#!/usr/bin/env node
'use strict';
/**
 * packaging/scripts/assemble-portable-win.mjs
 * solo-pipeline-yandex-vk#3 — fallback portable Windows desktop build.
 *
 * Why this exists:
 *   electron-builder (nsis/portable) cannot run on a Windows account without
 *   SeCreateSymbolicLinkPrivilege (Developer Mode off / non-elevated): its
 *   winCodeSign extraction fails creating darwin .dylib symlinks. That blocks
 *   the *signed installer* path, NOT the ability to ship a runnable desktop
 *   build. This script assembles a fully runnable, UNSIGNED portable Electron
 *   app from the prebuilt electron runtime — no signing, no symlinks, no admin.
 *
 * Output: dist/native/desktop/win-portable/<productName>.exe (+ runtime).
 *
 * This is a real artifact (double-click to run). The signed NSIS installer +
 * code-signing cert remain the externally-gated step (see docs/BUILD_REPORT.md).
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');          // packaging/
const REPO_ROOT = path.resolve(PKG_ROOT, '..');          // repo root
const ELECTRON_DIST = path.join(PKG_ROOT, 'node_modules', 'electron', 'dist');
const WEB_BUNDLE = path.join(REPO_ROOT, 'dist', 'native', 'web');
const OUT_DIR = path.join(REPO_ROOT, 'dist', 'native', 'desktop', 'win-portable');
const PRODUCT_NAME = 'Tank Merge Zombie Defense';

function die(msg) {
  console.error(`[assemble-portable-win] ERROR: ${msg}`);
  process.exit(1);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countFiles(path.join(dir, entry.name));
    else if (entry.isFile()) n += 1;
  }
  return n;
}

// --- Preconditions --------------------------------------------------------
if (!fs.existsSync(path.join(ELECTRON_DIST, 'electron.exe'))) {
  die(`prebuilt electron runtime not found at ${ELECTRON_DIST} (run npm install in packaging/)`);
}
if (!fs.existsSync(path.join(WEB_BUNDLE, 'index.html'))) {
  die(`web bundle not found at ${WEB_BUNDLE} (run npm run build:web first)`);
}

// --- Clean output ---------------------------------------------------------
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// --- 1. Copy prebuilt electron runtime ------------------------------------
console.log('[assemble-portable-win] copying electron runtime...');
copyDir(ELECTRON_DIST, OUT_DIR);

// --- 2. Replace default_app.asar with our app -----------------------------
const defaultAsar = path.join(OUT_DIR, 'resources', 'default_app.asar');
if (fs.existsSync(defaultAsar)) fs.rmSync(defaultAsar, { force: true });

const appRoot = path.join(OUT_DIR, 'resources', 'app');
fs.mkdirSync(path.join(appRoot, 'electron'), { recursive: true });

// app/package.json — minimal launcher manifest (main -> electron/main.js).
const launcherPkg = {
  name: 'tmzd-desktop',
  productName: PRODUCT_NAME,
  version: '1.0.0',
  main: 'electron/main.js',
  private: true,
};
fs.writeFileSync(
  path.join(appRoot, 'package.json'),
  JSON.stringify(launcherPkg, null, 2),
  'utf8',
);

// app/electron/{main.js,preload.js}
for (const f of ['main.js', 'preload.js']) {
  const src = path.join(PKG_ROOT, 'electron', f);
  if (!fs.existsSync(src)) die(`missing packaging/electron/${f}`);
  fs.copyFileSync(src, path.join(appRoot, 'electron', f));
}

// app/dist/native/web/** — in the packaged layout main.js lives at
// resources/app/electron, so its WEB_ROOT resolver probes <app>/dist/native/web
// (one level up from electron/). Place the bundle at app/dist/native/web to match.
const appWeb = path.join(appRoot, 'dist', 'native', 'web');
console.log('[assemble-portable-win] copying web bundle into app...');
copyDir(WEB_BUNDLE, appWeb);

// --- 3. Rename electron.exe to the product name ---------------------------
const exeSrc = path.join(OUT_DIR, 'electron.exe');
const exeDest = path.join(OUT_DIR, `${PRODUCT_NAME}.exe`);
if (fs.existsSync(exeSrc)) fs.renameSync(exeSrc, exeDest);

// --- Summary --------------------------------------------------------------
const webFiles = countFiles(appWeb);
const totalFiles = countFiles(OUT_DIR);
console.log('[assemble-portable-win] DONE');
console.log(`  out_dir      = ${OUT_DIR}`);
console.log(`  exe          = ${path.basename(exeDest)}`);
console.log(`  web_files    = ${webFiles}`);
console.log(`  total_files  = ${totalFiles}`);
console.log(`  signed       = no (portable, unsigned)`);
