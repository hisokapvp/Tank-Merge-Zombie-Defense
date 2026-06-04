#!/usr/bin/env node
/**
 * ops/package/release.mjs
 * solo-pipeline-yandex-vk#2 / Phase 5 — one-command release CLI for every target.
 *
 * Single entry point that bumps the version, runs regression tests, builds the
 * clean web bundle, and produces the per-platform artifact. Pure node stdlib in
 * this orchestrator; the heavy platform tooling (electron-builder, gradle,
 * xcodebuild) is reached through packaging/ where npm is allowed.
 *
 * Subcommands:
 *   node ops/package/release.mjs web      [--bump <token>] [--yandex] [--skip-tests]
 *   node ops/package/release.mjs steam    [--bump <token>] [--upload] [--skip-tests]
 *   node ops/package/release.mjs android  [--bump <token>] [--debug] [--no-build] [--skip-tests]
 *   node ops/package/release.mjs ios      [--bump <token>] [--prepare-only] [--skip-tests]
 *   node ops/package/release.mjs all      [--bump <token>] [--skip-tests]
 *
 * --bump <token> rewrites the index.html cache-bust token (?v=...) to <token>;
 *   if omitted, a date-stamped token (YYYYMMDD-release-HHMMSS) is generated.
 * --skip-tests skips bash ci/run_tests.sh (NOT recommended for a real release).
 *
 * "web" and "steam" build directly; "android"/"ios" delegate to the Capacitor
 * build scripts; "all" runs web + steam + android + ios in sequence and reports
 * which targets succeeded vs were skipped (e.g. ios cloud build).
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const INDEX_HTML = path.join(REPO_ROOT, 'index.html');
const PKG_DIR = path.join(REPO_ROOT, 'packaging');
const isWin = process.platform === 'win32';
// Canonical desktop product name — must match assemble-portable-win.mjs PRODUCT_NAME.
const STEAM_PRODUCT_NAME = 'Tank Merge Zombie Defense';
const WIN_PORTABLE_DIR = path.join(REPO_ROOT, 'dist', 'native', 'desktop', 'win-portable');
const WIN_PORTABLE_EXE = path.join(WIN_PORTABLE_DIR, `${STEAM_PRODUCT_NAME}.exe`);
// web subcommand output (folder + zip). Generic vs Yandex variant kept separate.
const WEB_OUT_GENERIC = path.join(REPO_ROOT, 'dist', 'release', 'web');
const WEB_OUT_YANDEX = path.join(REPO_ROOT, 'dist', 'release', 'web-yandex');
const DIST_ANDROID = path.join(REPO_ROOT, 'dist', 'native', 'android');

function usage(code = 0) {
  process.stdout.write([
    'TMZD release CLI',
    'Usage: node ops/package/release.mjs <web|steam|android|ios|all> [flags]',
    '  --bump <token>   set index.html cache-bust token (default: date-stamped)',
    '  --skip-tests     skip bash ci/run_tests.sh',
    '  --yandex         (web) build the Yandex variant',
    '  --upload         (steam) run steamcmd depot upload',
    '  --debug          (android) unsigned debug AAB',
    '  --no-build       (android) prepare project, skip gradle',
    '  --prepare-only   (ios) prepare project, skip cloud trigger',
    '',
  ].join('\n'));
  process.exit(code);
}

function parse(argv) {
  if (!argv.length) usage(1);
  const target = argv[0];
  const valid = ['web', 'steam', 'android', 'ios', 'all'];
  if (target === '-h' || target === '--help') usage(0);
  if (!valid.includes(target)) { console.error(`Unknown target: ${target}`); usage(1); }
  const o = { target, bump: null, skipTests: false, yandex: false, upload: false, debug: false, noBuild: false, prepareOnly: false };
  for (let i = 1; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--bump') o.bump = argv[++i];
    else if (x === '--skip-tests') o.skipTests = true;
    else if (x === '--yandex') o.yandex = true;
    else if (x === '--upload') o.upload = true;
    else if (x === '--debug') o.debug = true;
    else if (x === '--no-build') o.noBuild = true;
    else if (x === '--prepare-only') o.prepareOnly = true;
    else { console.error(`Unknown flag: ${x}`); usage(1); }
  }
  return o;
}

function run(cmd, args, cwd) {
  console.log(`[release] $ ${cmd} ${args.join(' ')}  (cwd=${cwd || REPO_ROOT})`);
  // On Windows we spawn through cmd.exe (shell: true). cmd.exe does NOT auto-quote
  // the executable path, so a node binary at "C:\Program Files\nodejs\node.exe"
  // (process.execPath) is parsed as just "C:\Program" and the whole call dies with
  // '"C:\Program" is not recognized'. Quote every whitespace-bearing token so the
  // shell treats it as a single argument. Skip tokens that are already quoted.
  const quoteForShell = (s) => (isWin && /\s/.test(s) && !/^".*"$/.test(s)) ? `"${s}"` : s;
  const finalCmd = quoteForShell(cmd);
  const finalArgs = args.map(quoteForShell);
  const res = spawnSync(finalCmd, finalArgs, { cwd: cwd || REPO_ROOT, stdio: 'inherit', shell: isWin });
  return res.status === 0;
}
function mustRun(cmd, args, cwd) {
  if (!run(cmd, args, cwd)) { console.error(`[release] FAILED: ${cmd} ${args.join(' ')}`); process.exit(1); }
}
function node(scriptArgs) { mustRun(process.execPath, scriptArgs, REPO_ROOT); }
function exists(p) { try { return fs.existsSync(p); } catch { return false; } }
function firstFileWithExt(dir, ext) {
  if (!exists(dir)) return null;
  for (const f of fs.readdirSync(dir)) { if (f.toLowerCase().endsWith(ext)) return path.join(dir, f); }
  return null;
}

function defaultToken() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-release-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Rewrite every "?v=<oldtoken>" cache-bust query in index.html to the new token.
 * This is the canonical web/Yandex version marker the runtime appends to asset URLs.
 */
function bumpVersion(token) {
  if (!fs.existsSync(INDEX_HTML)) { console.error('[release] index.html not found'); process.exit(1); }
  let html = fs.readFileSync(INDEX_HTML, 'utf8');
  const before = html;
  html = html.replace(/\?v=[A-Za-z0-9._-]+/g, `?v=${token}`);
  if (html !== before) {
    fs.writeFileSync(INDEX_HTML, html, 'utf8');
    const count = (before.match(/\?v=[A-Za-z0-9._-]+/g) || []).length;
    console.log(`[release] version bumped -> ?v=${token} (${count} refs)`);
  } else {
    console.log('[release] no cache-bust tokens changed (already current or none present)');
  }
}

function tests() {
  console.log('[release] regression tests (bash ci/run_tests.sh)');
  mustRun('bash', ['ci/run_tests.sh'], REPO_ROOT);
}

function buildWeb(o) {
  // ci/build_release.mjs REQUIRES --out; without it the builder throws and the
  // web subcommand silently aborts. Pin a deterministic release folder + zip.
  const outDir = o.yandex ? WEB_OUT_YANDEX : WEB_OUT_GENERIC;
  console.log(`[release] building web bundle (${o.yandex ? 'yandex' : 'generic'}) -> ${outDir}`);
  const args = [path.join('ci', 'build_release.mjs'), '--root', REPO_ROOT, '--out', outDir];
  if (o.yandex) args.push('--yandex');
  node(args);
  if (exists(path.join(outDir, 'index.html'))) {
    console.log(`[release] web ARTIFACT (folder): ${outDir}`);
    const zip = firstFileWithExt(path.dirname(outDir), '.zip');
    if (zip) console.log(`[release] web ARTIFACT (zip)   : ${zip}`);
  } else {
    console.error(`[release] web: expected index.html missing under ${outDir}`);
    process.exit(1);
  }
}

function buildSteam(o) {
  // Steam ships a desktop Electron build. On Windows the SIGNED electron-builder
  // installer needs SeCreateSymbolicLinkPrivilege (Developer Mode / elevated) to
  // unpack winCodeSign; without it electron-builder aborts. Previously the steam
  // subcommand called ONLY `npm run build:desktop`, so on a normal Windows account
  // it bumped the version, built the web bundle, then died with process.exit(1)
  // producing NO desktop artifact and no clear path — the "build never appeared"
  // the user hit. The CANONICAL runnable artifact is the UNSIGNED portable build
  // assembled by assemble-portable-win.mjs (no admin, no symlinks). We build that
  // first, then ATTEMPT the signed installer best-effort (non-fatal).
  const npmCmd = isWin ? 'npm.cmd' : 'npm';

  // 1) Clean web bundle (shared by every desktop variant).
  console.log('[release] steam: building clean web bundle (npm run build:web)');
  mustRun(npmCmd, ['run', 'build:web'], PKG_DIR);

  if (isWin) {
    // 2) Assemble the portable, runnable, unsigned desktop build.
    console.log('[release] steam: assembling portable Windows desktop build');
    node([path.join('packaging', 'scripts', 'assemble-portable-win.mjs')]);

    // 3) Best-effort SIGNED installer via electron-builder — NON-fatal.
    console.log('[release] steam: attempting signed electron-builder installer (best-effort)');
    const signedOk = run(npmCmd, ['run', 'build:win'], PKG_DIR);
    if (!signedOk) {
      console.warn('[release] steam: signed electron-builder installer BLOCKED (non-fatal).');
      console.warn('[release]   reason : winCodeSign unpack needs SeCreateSymbolicLinkPrivilege');
      console.warn('[release]   unblock: enable Windows Developer Mode (Settings > Privacy & security >');
      console.warn('[release]            For developers > Developer Mode) OR run from an elevated');
      console.warn('[release]            "Run as administrator" terminal, then re-run: node ops/package/release.mjs steam');
      console.warn('[release]   note   : does NOT block shipping — the portable .exe below is fully runnable.');
    }
  } else {
    // macOS / Linux: electron-builder runs without the Windows symlink-privilege issue.
    console.log('[release] steam: building desktop installer (electron-builder)');
    mustRun(npmCmd, ['run', 'build:desktop'], PKG_DIR);
  }

  // 4) Optional steamcmd depot upload.
  if (o.upload) {
    const appVdf = path.join(PKG_DIR, 'steam', 'app_build.vdf');
    if (!fs.existsSync(appVdf)) {
      console.warn(`[release] steamcmd skip: ${appVdf} not found. Create the depot script to enable --upload.`);
    } else {
      const user = process.env.TMZD_STEAM_USER;
      if (!user) { console.warn('[release] steamcmd skip: TMZD_STEAM_USER not set.'); }
      // Password/2FA handled interactively or via cached steamcmd session (never logged).
      else run('steamcmd', ['+login', user, '+run_app_build', appVdf, '+quit'], PKG_DIR);
    }
  }

  // 5) ALWAYS report the exact artifact path + status (no silent no-op).
  if (isWin) {
    if (exists(WIN_PORTABLE_EXE)) {
      console.log(`[release] steam ARTIFACT (portable, unsigned, runnable): ${WIN_PORTABLE_EXE}`);
      console.log('[release] steam: double-click that .exe to run; upload to Steam via steamcmd/Partner (see docs/PACKAGING.md §3).');
    } else {
      console.error(`[release] steam: expected portable artifact missing: ${WIN_PORTABLE_EXE}`);
      process.exit(1);
    }
  }
}

function buildAndroid(o) {
  const args = [path.join('packaging', 'scripts', 'build-android.mjs'), '--skip-tests'];
  if (o.debug) args.push('--debug');
  if (o.noBuild) args.push('--no-build');
  node(args); // tests already ran at top level
  if (o.noBuild) {
    console.log('[release] android: project prepared (--no-build). Open packaging/capacitor/android in Android Studio or re-run without --no-build to produce the .aab.');
    return;
  }
  const aab = firstFileWithExt(DIST_ANDROID, '.aab');
  if (aab) console.log(`[release] android ARTIFACT (.aab): ${aab}`);
  else console.warn(`[release] android: no .aab found under ${DIST_ANDROID} — see build-android log above (likely missing SDK/keystore; see docs/PACKAGING.md §4).`);
}

function buildIos(o) {
  const args = [path.join('packaging', 'scripts', 'build-ios.mjs'), '--skip-tests'];
  if (o.prepareOnly) args.push('--prepare-only');
  node(args);
  // iOS archive/sign/upload runs on a cloud macOS runner (no local Mac). The
  // .ipa is produced there, not under dist/. Be explicit so this is not a silent no-op.
  console.log('[release] ios: local prep done. The signed .ipa is produced by the cloud macOS build');
  console.log('[release] ios: (Codemagic / macOS runner), NOT under dist/. See docs/PACKAGING.md §5 for the full flow.');
}

function main() {
  const o = parse(process.argv.slice(2));
  const token = o.bump || defaultToken();
  bumpVersion(token);
  if (!o.skipTests) tests();

  switch (o.target) {
    case 'web': buildWeb(o); break;
    case 'steam': buildSteam(o); break;
    case 'android': buildAndroid(o); break;
    case 'ios': buildIos(o); break;
    case 'all':
      buildWeb(o);
      buildSteam(o);
      buildAndroid(o);
      buildIos(o);
      break;
  }
  console.log(`[release] target "${o.target}" complete (version ${token}).`);
}

main();
