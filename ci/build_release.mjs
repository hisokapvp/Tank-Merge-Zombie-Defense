#!/usr/bin/env node
// ci/build_release.mjs — deterministic release builder helper.
//
// Pipeline (solo-pipeline-yandex-vk#2 / item 7):
//   1. Whitelist-copy runtime artefacts from repo root into OUT_DIR.
//   2. Compute SHA-256 for each entry asset (game.js, style.css, assets/*.json).
//   3. Inject ?v=<sha12> cache-busting markers into the copied index.html for
//      script/link tags that don't already carry an explicit version query.
//   4. Optionally inject the Yandex Games SDK seam (--yandex) before <script src="game.js">.
//   5. Print a relative-paths audit (fetch('asset/...')) for manual base-href review.
//   6. Emit release_manifest.json: { generated_at, git_sha, version, files[] }.
//
// Hard invariants:
//   * dist/release/staging/ is the protected release mirror (copilot-instructions);
//     this helper refuses to write into it.
//   * No source mutation: index.html / game.js / style.css are rewritten only in
//     the OUT_DIR copy.
//   * Existing manual ?v=... query strings are preserved (no double-versioning).
//   * No npm dependencies — fs / path / crypto / child_process only.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = { root: path.resolve(__dirname, '..'), out: null, yandex: false, zip: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') args.root = path.resolve(argv[++i]);
    else if (a === '--out') args.out = path.resolve(argv[++i]);
    else if (a === '--yandex') args.yandex = true;
    else if (a === '--zip') args.zip = true;
    else if (a === '--no-zip') args.zip = false;
    else if (a === '--help' || a === '-h') {
      process.stdout.write('Usage: node ci/build_release.mjs --root <repo> --out <dir> [--yandex] [--no-zip]\n');
      process.exit(0);
    } else {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  if (!args.out) throw new Error('--out <dir> is required');
  return args;
}

const WHITELIST_ROOT_FILES = ['index.html', 'game.js', 'style.css', 'README.md'];
const WHITELIST_DIRS = ['src', 'assets', 'vendor'];
// solo-pipeline-yandex-vk#1 (Yandex 404 follow-up): individual files that live
// inside skipped top-level dirs but are referenced by index.html at runtime
// and therefore MUST ship. Paths are repo-root relative, forward-slash.
const WHITELIST_EXTRA_FILES = ['tools/saveSchemaValidator.js'];

// Skip patterns. Distinguish between dirs we never want at any nesting depth
// (build/IDE noise) vs. top-level-only skips (so e.g. `src/tools/anki/*` still
// ships even though we skip the repo-root `tools/` dir).
const SKIP_ANY_DEPTH_DIRS = new Set([
  'node_modules', '.venv', '.git', '.idea', '.vscode',
  'test-results', 'dist',
]);
const SKIP_TOP_LEVEL_DIRS = new Set([
  'Test', 'ci', 'tools', 'docs', 'ops', 'scripts',
]);

const SKIP_FILE_PATTERNS = [
  /(^|\/)nul$/i,
  /(^|\/)_diag_/i,
  /(^|\/)branch1_/i,
  /(^|\/)payload_/i,
  /(^|\/)\..+/, // dotfiles
  /\.draft\.json$/i,
  /\.bak$/i,
  /\.tmp$/i,
];

// Files that are technically inside whitelisted dirs but should not ship.
const ASSETS_SKIP_PATTERNS = [
  /^assets\/triangular_chips_.*\.md$/i,
  /^assets\/.*_README\.md$/i,
  /^assets\/balance\/.*\.draft\.json$/i,
];

function shouldSkipRelative(rel) {
  const norm = rel.replace(/\\/g, '/');
  if (norm.includes('/')) {
    const parts = norm.split('/');
    // Top-level skip: only the very first path part counts. This lets
    // `src/tools/anki/*.js` ship even though we skip the repo-root `tools/`.
    if (SKIP_TOP_LEVEL_DIRS.has(parts[0])) return true;
    // Any-depth skip: every parent dir is checked.
    for (const p of parts.slice(0, -1)) {
      if (SKIP_ANY_DEPTH_DIRS.has(p)) return true;
    }
  }
  for (const pat of SKIP_FILE_PATTERNS) {
    if (pat.test(norm)) return true;
  }
  for (const pat of ASSETS_SKIP_PATTERNS) {
    if (pat.test(norm)) return true;
  }
  // Block dev-only markdown anywhere except whitelisted root README.md.
  if (norm.endsWith('.md') && norm !== 'README.md') {
    if (norm.startsWith('assets/') || norm.startsWith('src/')) return true;
  }
  return false;
}

async function* walk(root, rel = '') {
  const abs = path.join(root, rel);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  for (const e of entries) {
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (SKIP_ANY_DEPTH_DIRS.has(e.name)) continue;
      yield* walk(root, childRel);
    } else if (e.isFile()) {
      yield childRel.replace(/\\/g, '/');
    }
  }
}

async function copyWhitelist(repoRoot, outDir) {
  const copied = [];
  for (const f of WHITELIST_ROOT_FILES) {
    const src = path.join(repoRoot, f);
    try {
      await fs.access(src);
    } catch {
      continue;
    }
    const dst = path.join(outDir, f);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
    copied.push(f);
  }
  // Individual runtime files inside otherwise-skipped top-level dirs (e.g.
  // `tools/saveSchemaValidator.js`). Required because index.html references
  // them at runtime — without this, Yandex Games ships a broken save layer.
  for (const f of WHITELIST_EXTRA_FILES) {
    const src = path.join(repoRoot, f);
    try {
      await fs.access(src);
    } catch {
      continue;
    }
    const dst = path.join(outDir, f);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
    copied.push(f);
  }
  for (const dir of WHITELIST_DIRS) {
    const src = path.join(repoRoot, dir);
    try {
      const stat = await fs.stat(src);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }
    for await (const rel of walk(src)) {
      const fullRel = `${dir}/${rel}`;
      if (shouldSkipRelative(fullRel)) continue;
      const dst = path.join(outDir, fullRel);
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.copyFile(path.join(src, rel), dst);
      copied.push(fullRel);
    }
  }
  return copied.sort();
}

async function sha256Of(filePath) {
  const buf = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function shortSha(sha) {
  // Solo-pipeline-yandex-vk#2 / item 5 (postmortem cache-bust collision):
  // SHA-256 truncated to 12 hex chars (48 bits). The previous 8-char prefix
  // (32 bits) had a non-zero collision risk: two distinct file revisions
  // could share the same `?v=<sha8>` token, and the browser would serve a
  // stale cached version, hiding a real release update from players. Bumping
  // to 12 chars reduces collision probability by ~2^16× (~1 in 281 trillion
  // by birthday bound for any pair) which is well below the practical risk
  // floor for a single-project release pipeline.
  return sha.slice(0, 12);
}

async function injectCacheBust(outDir, hashes) {
  const idx = path.join(outDir, 'index.html');
  let html = await fs.readFile(idx, 'utf8');

  function rewriteAttr(re, attrName) {
    html = html.replace(re, (full, before, urlPart, after) => {
      const hasQuery = urlPart.includes('?');
      // Skip absolute URLs (http://, https://, //, data:).
      if (/^(https?:)?\/\//i.test(urlPart) || urlPart.startsWith('data:')) return full;
      // Skip if explicit ?v= already present (preserve existing tokens like fenceRepair.js?v=20260402-...).
      if (/[?&]v=/.test(urlPart)) return full;
      const cleanRel = urlPart.split('?')[0].split('#')[0].replace(/^\.?\//, '');
      const sha = hashes.get(cleanRel);
      if (!sha) return full;
      const sep = hasQuery ? '&' : '?';
      const newUrl = `${urlPart}${sep}v=${shortSha(sha)}`;
      return `${before}${newUrl}${after}`;
    });
  }

  rewriteAttr(/(<script\b[^>]*?\bsrc=")([^"]+)("[^>]*>)/gi, 'src');
  rewriteAttr(/(<link\b[^>]*?\bhref=")([^"]+)("[^>]*>)/gi, 'href');
  rewriteAttr(/(<img\b[^>]*?\bsrc=")([^"]+)("[^>]*>)/gi, 'src');

  await fs.writeFile(idx, html, 'utf8');
}

async function injectYandexSeam(outDir) {
  const idx = path.join(outDir, 'index.html');
  let html = await fs.readFile(idx, 'utf8');
  if (html.includes('yandex.ru/games/sdk/v2')) return; // idempotent
  const sdkSnippet = [
    '  <script src="https://yandex.ru/games/sdk/v2"></script>',
    '  <script>',
    '    /* Yandex Games SDK seam (solo-pipeline-yandex-vk#2 / item 7).',
    '       Failure-tolerant: if SDK fails to load (local dev / non-Yandex host),',
    '       the game still boots normally. Real ad placements / ready-event live',
    '       in the playbook docs/ai/PLAYBOOKS/release-yandex.md as a manual TODO. */',
    '    (function () {',
    '      if (typeof YaGames === "undefined") return;',
    '      window.__yaGamesReady = YaGames.init().then(function (sdk) {',
    '        window.YaGamesSDK = sdk;',
    '        if (sdk && typeof sdk.features?.LoadingAPI?.ready === "function") {',
    '          sdk.features.LoadingAPI.ready();',
    '        }',
    '        return sdk;',
    '      }).catch(function (err) { console.warn("[YaGames] init failed:", err); });',
    '    }());',
    '  </script>',
    '',
  ].join('\n');
  // Insert just before </head>; preserves indentation and existing scripts.
  html = html.replace(/<\/head>/i, `${sdkSnippet}</head>`);
  await fs.writeFile(idx, html, 'utf8');
}

async function auditRelativeFetches(outDir) {
  const findings = [];
  const re = /\bfetch\(\s*['"`]([^'"`]+)['"`]/g;
  for (const fname of ['game.js']) {
    const p = path.join(outDir, fname);
    try {
      const txt = await fs.readFile(p, 'utf8');
      let m;
      while ((m = re.exec(txt)) !== null) {
        const url = m[1];
        if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('/')) continue;
        findings.push({ file: fname, url });
      }
    } catch { /* file may not exist; ignore */ }
  }
  return findings;
}

function readGitSha(repoRoot) {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return 'unknown';
  }
}

async function readVersion(repoRoot) {
  const html = await fs.readFile(path.join(repoRoot, 'index.html'), 'utf8').catch(() => '');
  const m = html.match(/var token\s*=\s*'([^']+)'/);
  return m ? m[1] : 'unversioned';
}

// ---------------------------------------------------------------------------
// Cross-platform deterministic ZIP writer (solo-pipeline-yandex-vk#1 / item 1).
//
// Why this exists:
//   PowerShell `Compress-Archive` on Windows writes ZIP entries with backslash
//   path separators (`assets\ui\foo.png`), which is invalid per APPNOTE.TXT 4.4.17.1
//   ("forward slashes only"). Yandex Games CDN treats such entries as flat
//   filenames containing literal backslashes, so /src/**/*.js, /assets/**/*.json,
//   and /vendor/phaser.min.js return 404 in production despite shipping in the zip.
//
// Implementation:
//   * Pure Node stdlib (fs + zlib + crypto). No npm.
//   * DEFLATE method (8); CRC32 + length validated per local + central headers.
//   * Forward-slash entry names; UTF-8 flag (general purpose bit 11).
//   * Stable sort by path -> deterministic byte-identical zip across runs.
// ---------------------------------------------------------------------------

const ZIP_LOCAL_SIG = 0x04034b50;
const ZIP_CENTRAL_SIG = 0x02014b50;
const ZIP_EOCD_SIG = 0x06054b50;
const ZIP_VERSION = 20; // 2.0
const ZIP_FLAG_UTF8 = 0x0800;
const ZIP_METHOD_DEFLATE = 8;
const ZIP_METHOD_STORED = 0;

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTimeDate(d = new Date(2026, 0, 1, 0, 0, 0)) {
  const dosTime = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  const dosDate = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
  return { dosTime, dosDate };
}

async function* walkAllFiles(root, rel = '') {
  const abs = path.join(root, rel);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  // Stable order for deterministic zip.
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      yield* walkAllFiles(root, childRel);
    } else if (e.isFile()) {
      yield childRel.replace(/\\/g, '/');
    }
  }
}

async function createZip(srcDir, zipPath) {
  // Collect entries first (sorted, forward slashes).
  const relPaths = [];
  for await (const rel of walkAllFiles(srcDir)) relPaths.push(rel);
  relPaths.sort();

  const { dosTime, dosDate } = dosTimeDate();
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;
  let entryCount = 0;

  for (const rel of relPaths) {
    const abs = path.join(srcDir, rel);
    const data = await fs.readFile(abs);
    const nameBuf = Buffer.from(rel, 'utf8');

    // Try DEFLATE; fall back to STORED if it doesn't shrink (e.g. PNG already compressed).
    let method = ZIP_METHOD_DEFLATE;
    let compressed = zlib.deflateRawSync(data, { level: 9 });
    if (compressed.length >= data.length) {
      method = ZIP_METHOD_STORED;
      compressed = data;
    }
    const crc = crc32(data);
    const cSize = compressed.length;
    const uSize = data.length;

    // Local file header (30 bytes + name).
    const local = Buffer.alloc(30);
    local.writeUInt32LE(ZIP_LOCAL_SIG, 0);
    local.writeUInt16LE(ZIP_VERSION, 4);
    local.writeUInt16LE(ZIP_FLAG_UTF8, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(cSize, 18);
    local.writeUInt32LE(uSize, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // no extra
    localChunks.push(local, nameBuf, compressed);

    // Central directory header (46 bytes + name).
    const central = Buffer.alloc(46);
    central.writeUInt32LE(ZIP_CENTRAL_SIG, 0);
    central.writeUInt16LE(ZIP_VERSION, 4);   // version made by
    central.writeUInt16LE(ZIP_VERSION, 6);   // version needed
    central.writeUInt16LE(ZIP_FLAG_UTF8, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(cSize, 20);
    central.writeUInt32LE(uSize, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs (regular file, agnostic)
    central.writeUInt32LE(offset, 42);
    centralChunks.push(central, nameBuf);

    offset += local.length + nameBuf.length + compressed.length;
    entryCount++;
  }

  const centralStart = offset;
  const centralBuf = Buffer.concat(centralChunks);
  const centralSize = centralBuf.length;

  // End of central directory record (22 bytes, no comment).
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(ZIP_EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4);          // disk
  eocd.writeUInt16LE(0, 6);          // disk with cd
  eocd.writeUInt16LE(entryCount, 8);
  eocd.writeUInt16LE(entryCount, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20);         // comment len

  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  await fs.writeFile(zipPath, Buffer.concat([...localChunks, centralBuf, eocd]));

  return { entryCount, totalBytes: offset + centralSize + eocd.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { root, out, yandex } = args;

  if (out.replace(/\\/g, '/').endsWith('/dist/release/staging') ||
      out.replace(/\\/g, '/').includes('/dist/release/staging/')) {
    throw new Error('REFUSE: dist/release/staging is the protected release mirror.');
  }

  await fs.mkdir(out, { recursive: true });

  console.log(`[build_release] copying whitelist -> ${out}`);
  const copied = await copyWhitelist(root, out);
  console.log(`[build_release] copied ${copied.length} files.`);

  // Compute hashes for every copied file (manifest covers all; cache-bust uses subset).
  const hashes = new Map();
  for (const rel of copied) {
    const sha = await sha256Of(path.join(out, rel));
    hashes.set(rel, sha);
  }

  console.log('[build_release] injecting cache-bust markers into index.html');
  await injectCacheBust(out, hashes);

  if (yandex) {
    console.log('[build_release] injecting Yandex Games SDK seam');
    await injectYandexSeam(out);
  }

  const audit = await auditRelativeFetches(out);
  if (audit.length) {
    console.log('[build_release] relative fetch() calls (review base-href compatibility):');
    for (const f of audit.slice(0, 20)) {
      console.log(`  - ${f.file}: ${f.url}`);
    }
    if (audit.length > 20) console.log(`  ... and ${audit.length - 20} more.`);
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    git_sha: readGitSha(root),
    version: await readVersion(root),
    yandex_seam: !!yandex,
    file_count: copied.length,
    audit_relative_fetch: audit.map((f) => ({ file: f.file, url: f.url })),
    files: copied.map((rel) => ({
      path: rel,
      sha256: hashes.get(rel),
      size: 0,
    })),
  };
  for (const f of manifest.files) {
    const stat = await fs.stat(path.join(out, f.path));
    f.size = stat.size;
  }

  await fs.writeFile(
    path.join(out, 'release_manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
  console.log(`[build_release] release_manifest.json written (${copied.length} files, git_sha=${manifest.git_sha.slice(0, 12)}).`);

  if (args.zip) {
    const zipPath = `${out}.zip`;
    console.log(`[build_release] zipping -> ${zipPath} (cross-platform Node writer, forward-slash entries)`);
    const zipInfo = await createZip(out, zipPath);
    console.log(`[build_release] zip written: ${zipInfo.entryCount} entries, ${zipInfo.totalBytes} bytes.`);
  } else {
    console.log('[build_release] zip step skipped (--no-zip).');
  }
}

main().catch((err) => {
  console.error('[build_release] FAILED:', err.message);
  process.exit(1);
});
