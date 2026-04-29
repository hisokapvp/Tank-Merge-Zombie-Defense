#!/usr/bin/env node
// ci/build_release.mjs — deterministic release builder helper.
//
// Pipeline (solo-pipeline-yandex-vk#2 / item 7):
//   1. Whitelist-copy runtime artefacts from repo root into OUT_DIR.
//   2. Compute SHA-256 for each entry asset (game.js, style.css, assets/*.json).
//   3. Inject ?v=<sha8> cache-busting markers into the copied index.html for
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
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = { root: path.resolve(__dirname, '..'), out: null, yandex: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') args.root = path.resolve(argv[++i]);
    else if (a === '--out') args.out = path.resolve(argv[++i]);
    else if (a === '--yandex') args.yandex = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write('Usage: node ci/build_release.mjs --root <repo> --out <dir> [--yandex]\n');
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

// Skip patterns applied to every relative path ("src/foo/bar.js", "assets/x.json").
const SKIP_DIR_NAMES = new Set([
  'node_modules', '.venv', '.git', '.idea', '.vscode',
  'Test', 'ci', 'tools', 'docs', 'ops', 'scripts',
  'test-results', 'dist',
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
    for (const p of parts.slice(0, -1)) {
      if (SKIP_DIR_NAMES.has(p)) return true;
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
      if (SKIP_DIR_NAMES.has(e.name)) continue;
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
  return sha.slice(0, 8);
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
  console.log(`[build_release] release_manifest.json written (${copied.length} files, git_sha=${manifest.git_sha.slice(0, 8)}).`);
}

main().catch((err) => {
  console.error('[build_release] FAILED:', err.message);
  process.exit(1);
});
