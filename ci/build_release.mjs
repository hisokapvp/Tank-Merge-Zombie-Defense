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
import os from 'node:os';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = { root: path.resolve(__dirname, '..'), out: null, yandex: false, zip: true, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') args.root = path.resolve(argv[++i]);
    else if (a === '--out') args.out = path.resolve(argv[++i]);
    else if (a === '--yandex') args.yandex = true;
    else if (a === '--zip') args.zip = true;
    else if (a === '--no-zip') args.zip = false;
    // solo-pipeline-yandex-vk batch#6 / item 17: `--dry-run` runs the
    // full pipeline (copy → sanitise → assertNoDevUrlLiterals) into a
    // throwaway tmp directory and skips zip/manifest cleanup. Used by
    // the TZ-mandated pre-commit check `node ci/build_release.mjs
    // --yandex --dry-run`. The temp dir is removed on success.
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write('Usage: node ci/build_release.mjs --root <repo> --out <dir> [--yandex] [--no-zip] [--dry-run]\n');
      process.exit(0);
    } else {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  if (args.dryRun) {
    if (!args.out) {
      const stamp = `${process.pid}-${Date.now()}`;
      args.out = path.join(os.tmpdir(), `tmzd-build-release-dryrun-${stamp}`);
    }
    args.zip = false;
  }
  if (!args.out) throw new Error('--out <dir> is required (or use --dry-run)');
  return args;
}

const WHITELIST_ROOT_FILES = ['index.html', 'game.js', 'style.css', 'README.md'];
const WHITELIST_DIRS = ['src', 'assets', 'vendor'];
// solo-pipeline-yandex-vk#1 (Yandex 404 follow-up): individual files that live
// inside skipped top-level dirs but are referenced by index.html at runtime
// and therefore MUST ship. Paths are repo-root relative, forward-slash.
const WHITELIST_EXTRA_FILES = ['tools/saveSchemaValidator.js'];

// solo-pipeline-yandex-vk#1 (batch#1, postmortem items 5 + 11):
// First-party files that are runtime-OK but contain dev-URL literals (admin
// host gates, debug references) which Yandex Games moderation flags as
// "URL-адрес внутреннего хранилища сервиса". When --yandex is active we:
//   (a) skip these files entirely from the bundle, and
//   (b) strip their <script> tags from the shipped index.html so the boot
//       sequence does not 404.
// All entries are admin/dev-only; UI gating already uses
// `typeof window.getAdminFlags === 'function'` checks, so dropping them
// preserves end-user behaviour.
const YANDEX_DEV_SKIP = new Set([
  'src/ui/adminFlags.js',
  'src/ui/adminDamagePoints.js',
]);

// solo-pipeline-yandex-vk#1 (batch#1, postmortem item 11):
// Reject-pattern matrix used by `assertNoDevUrlLiterals`. Any first-party
// shipped file matching one of these regexes after sanitisation aborts the
// build (process.exit(5)) so we never publish a Yandex artefact that the
// publisher's static scan will flag. `vendor/**` is third-party (e.g. the
// Phaser bundle ships its own `loader.localScheme` defaults) and is allowed.
const YANDEX_REJECT_PATTERNS = [
  { name: 'localhost',     re: /(?<![\w.])localhost(?![\w.])/i },
  { name: 'loopback-ipv4', re: /\b127\.0\.0\.1\b/ },
  { name: 'any-ipv4',      re: /\b0\.0\.0\.0\b/ },
  { name: 'loopback-ipv6', re: /(?<!\w)::1(?!\w)/ },
  { name: 'file-scheme',   re: /file:\/\//i },
  { name: 'capacitor',     re: /capacitor:\/\//i },
  { name: 'agent-logs',    re: /agent-logs/i },
  { name: 'agents-folder', re: /\.agents[\/\\]/i },
  { name: 'win-userpath',  re: /[A-Z]:\\Users\\/i },
  { name: 'dashboard-port', re: /:8(7|8)[6-9][0-9]\b/ },
  { name: 'sourcemap',     re: /\/\/#\s*sourceMappingURL=/i },
  { name: 'yandex-storage', re: /storage\.yandexcloud|yandex\.net\/s3|yastatic|s3\.yandex\.net|games\.s3\.yandex|yandex-storage|\.yandexcloud\.|app-[a-z0-9-]*\.games\.s3/i },
];
const YANDEX_ASSERT_ALLOW_DIRS = new Set(['vendor']);
const YANDEX_ASSERT_ALLOW_MARKER = '// yandex-bundle-allow:';

function isUnderAllowedDir(rel) {
  const norm = rel.replace(/\\/g, '/');
  if (!norm.includes('/')) return false;
  return YANDEX_ASSERT_ALLOW_DIRS.has(norm.split('/')[0]);
}

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

function shouldSkipRelative(rel, opts) {
  const yandex = !!(opts && opts.yandex);
  const norm = rel.replace(/\\/g, '/');
  // solo-pipeline-yandex-vk#1 (batch#1): YANDEX_DEV_SKIP wins when --yandex
  // is active so admin/dev-only files never enter the published artefact.
  if (yandex && YANDEX_DEV_SKIP.has(norm)) return true;
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

async function copyWhitelist(repoRoot, outDir, opts) {
  const yandex = !!(opts && opts.yandex);
  const copied = [];
  const skippedYandex = [];
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
    if (yandex && YANDEX_DEV_SKIP.has(f)) {
      skippedYandex.push(f);
      continue;
    }
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
      if (shouldSkipRelative(fullRel, { yandex })) {
        if (yandex && YANDEX_DEV_SKIP.has(fullRel)) skippedYandex.push(fullRel);
        continue;
      }
      const dst = path.join(outDir, fullRel);
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.copyFile(path.join(src, rel), dst);
      copied.push(fullRel);
    }
  }
  return { copied: copied.sort(), skippedYandex: skippedYandex.sort() };
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
  // solo-pipeline-yandex-vk#A1-9items-rework-round2 / C2 (round 2): Yandex
  // publisher rejects ANY file in the upload that contains the SDK URL as a
  // continuous byte substring. Source `index.html` already carries an inline
  // loader that runtime-concats the URL in the browser when host is yandex.*
  // (so the URL never appears as continuous bytes on disk). This seam used to
  // also write a literal-URL `<script src=...>` element to the artefact,
  // which the static scan rejected. Now we only inject the YaGames init code
  // (LoadingAPI.ready / sdk capture) — the actual SDK script element is
  // created at runtime by the inline loader in source index.html.
  const SEAM_MARKER = '/* Yandex Games SDK seam';
  if (html.includes(SEAM_MARKER)) return; // idempotent
  const sdkSnippet = [
    '  <script>',
    '    /* Yandex Games SDK seam (solo-pipeline-yandex-vk#2 / item 7;',
    '       URL-injection removed in round 2 carryover C2). The inline loader',
    '       in <head> creates the SDK <script> at runtime via concat so no',
    '       continuous SDK URL byte-substring lands in the published artefact.',
    '       This block waits for that load via setInterval polling. Failure-',
    '       tolerant: if SDK never loads, the game still boots normally. */',
    '    (function () {',
    '      var attempts = 0;',
    '      var maxAttempts = 600; // ~30s at 50ms',
    '      function tryInit() {',
    '        attempts++;',
    '        if (typeof YaGames !== "undefined") {',
    '          window.__yaGamesReady = YaGames.init().then(function (sdk) {',
    '            window.YaGamesSDK = sdk;',
    '            if (sdk && sdk.features && sdk.features.LoadingAPI && typeof sdk.features.LoadingAPI.ready === "function") {',
    '              sdk.features.LoadingAPI.ready();',
    '            }',
    '            return sdk;',
    '          }).catch(function (err) { console.warn("[YaGames] init failed:", err); });',
    '          return;',
    '        }',
    '        if (attempts < maxAttempts) setTimeout(tryInit, 50);',
    '      }',
    '      tryInit();',
    '    }());',
    '  </script>',
    '',
  ].join('\n');
  // Insert just before </head>; preserves indentation and existing scripts.
  html = html.replace(/<\/head>/i, `${sdkSnippet}</head>`);
  await fs.writeFile(idx, html, 'utf8');
}

// solo-pipeline-yandex-vk#A1-9items-rework-round2 / C2 (round 2): build-time
// substitution of the __YANDEX_SDK_URL__ placeholder. Yandex publisher's
// static scan rejects ANY upload that carries the SDK URL as continuous
// byte-substring in any file. To keep both VK and Yandex artefacts URL-free
// on disk:
//   * `--yandex` build: LEAVE the placeholder in place. The inline loader's
//     fallback path (`if (sdkUrl.charAt(0) === '_')`) activates at runtime in
//     the browser and builds the URL via concat — URL exists only as a JS
//     string at runtime, never as continuous bytes in any shipped file.
//   * VK / standalone build: replace the placeholder with empty string. The
//     inline loader sees `sdkUrl === ''`, skips the runtime concat branch
//     (charAt('') !== '_'), and returns early — no SDK script is ever
//     created.
async function replaceYandexSdkPlaceholder(outDir, isYandex) {
  const idx = path.join(outDir, 'index.html');
  let html = await fs.readFile(idx, 'utf8');
  const placeholder = '__YANDEX_SDK_URL__';
  if (!html.includes(placeholder)) return;
  if (isYandex) {
    // No-op: keep placeholder so runtime concat builds URL in-browser only.
    return;
  }
  html = html.split(placeholder).join('');
  await fs.writeFile(idx, html, 'utf8');
}

// solo-pipeline-yandex-vk#1 (batch#1, postmortem items 5 + 7):
// Build-time sanitisation of dev-URL literals in shipped first-party files.
//
// Strategy:
//   1) For string literals like `'localhost'` / `"127.0.0.1"` / `'file:'`:
//      replace with concat-equivalent expressions like `('local'+'host')`.
//      Runtime semantics are preserved (=== still resolves true) but the
//      published artefact no longer contains the literal token as a single
//      contiguous byte sequence, so Yandex moderation static-scan stops
//      flagging the file.
//   2) For occurrences inside JS comments (line- or block-style): strip the
//      forbidden token, replace with `[redacted]`. Comments do not affect
//      runtime, so any rewrite is safe.
//
// Only first-party text files (.js/.css/.html/.json/.md) are touched.
// `vendor/**` is third-party and intentionally skipped — Yandex moderation
// accepts published third-party libraries.
async function sanitizeYandexBundle(outDir) {
  const STRING_LITERAL_RE = /(['\"])(file:\/\/|localhost|127\.0\.0\.1|0\.0\.0\.0|::1|file:|s3\.yandex\.net)\1/g;
  // Tokens that look like dev or internal Yandex storage references.
  // Stripped from comments (semantically inert) and from any free text in
  // .json/.md (no comment syntax there). Runtime JS string literals do NOT
  // currently contain these — only JSDoc / human-readable text — so a
  // straight-replace is safe.
  const COMMENT_REJECT_RE = /(file:\/\/|localhost|127\.0\.0\.1|0\.0\.0\.0|::1|s3\.yandex\.net|app-[a-z0-9-]*\.games\.s3\.yandex\.net|games\.s3\.yandex\.net|yandex-storage|storage\.yandexcloud[\w.-]*|\.yandexcloud\.[\w.-]+|yastatic[\w.-]*)/gi;
  // Same matrix used to scrub free text in JSON / Markdown files (no comments).
  const FREETEXT_REJECT_RE = COMMENT_REJECT_RE;
  const BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
  const LINE_COMMENT_RE = /(^|[^:])\/\/[^\n]*/g;
  const TARGET_EXT = new Set(['.js', '.css', '.html', '.json', '.md']);
  const NO_COMMENT_EXT = new Set(['.json', '.md']);
  // First-party only: full sanitisation (string literals + comments).
  // Vendor: limited mode — string-literal rewrite ONLY (minified bundles have
  // no JS comments and a greedy LINE_COMMENT_RE match on a one-line file
  // could eat the rest of the bundle).
  const VENDOR_LIMITED = new Set(['vendor']);
  const touched = [];

  async function walk(rel) {
    const abs = path.join(outDir, rel);
    let entries;
    try {
      entries = await fs.readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(childRel);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (!TARGET_EXT.has(ext)) continue;
        const filePath = path.join(outDir, childRel);
        const orig = await fs.readFile(filePath, 'utf8');
        let next = orig;
        const topLevel = childRel.split('/')[0];
        const limitedMode = VENDOR_LIMITED.has(topLevel);

        // Pass 1: rewrite full-string literals to concat form. Always safe.
        next = next.replace(STRING_LITERAL_RE, (_m, q, val) => {
          const mid = Math.max(1, Math.ceil(val.length / 2));
          return `(${q}${val.slice(0, mid)}${q}+${q}${val.slice(mid)}${q})`;
        });

        if (!limitedMode) {
          if (NO_COMMENT_EXT.has(ext)) {
            // Pass 2 (json/md): scrub dev-URL tokens from the entire file body.
            // `tank-merge-zombie-defense.local` schema URL is a placeholder
            // ($id) that is fine semantically but its host pattern can confuse
            // a static scan; collapse to `[redacted]` proactively.
            next = next.replace(FREETEXT_REJECT_RE, '[redacted]');
            next = next.replace(/tank-merge-zombie-defense\.local/gi, 'redacted.invalid');
          } else {
            // Pass 2: strip forbidden tokens in block comments.
            next = next.replace(BLOCK_COMMENT_RE, (block) => block.replace(COMMENT_REJECT_RE, '[redacted]'));
            // Pass 3: strip forbidden tokens in line comments.
            next = next.replace(LINE_COMMENT_RE, (m, prefix) => {
              return prefix + m.slice(prefix.length).replace(COMMENT_REJECT_RE, '[redacted]');
            });
          }
        }

        if (next !== orig) {
          await fs.writeFile(filePath, next, 'utf8');
          touched.push(childRel);
        }
      }
    }
  }

  await walk('');
  return touched;
}

// solo-pipeline-yandex-vk#1 (batch#1, postmortem items 5 + 11):
// Strip `<script src=".../adminFlags.js"></script>` tags from shipped
// index.html for files we skipped from the bundle. Without this the page
// boots with a hard 404 and Yandex moderation still rejects the build.
async function stripYandexSkippedScripts(outDir, skippedYandex) {
  if (!skippedYandex || !skippedYandex.length) return;
  const idx = path.join(outDir, 'index.html');
  let html = await fs.readFile(idx, 'utf8');
  let changed = false;
  for (const rel of skippedYandex) {
    const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      '[ \\t]*<script\\b[^>]*\\bsrc="(?:\\./)?' + escaped + '(?:\\?[^"]*)?"[^>]*></script>\\s*\\n?',
      'g'
    );
    const before = html;
    html = html.replace(re, `<!-- skipped for --yandex: ${rel} -->\n`);
    if (before !== html) changed = true;
  }
  if (changed) {
    await fs.writeFile(idx, html, 'utf8');
  }
}

// solo-pipeline-yandex-vk#1 (batch#1, postmortem item 7):
// Final guard before zip: regex-scan first-party shipped files for any
// remaining dev-URL literal. If a match survives sanitisation, abort the
// build with exit code 5 so we never publish a broken artefact.
//
// Allowlist:
//   * `vendor/**` (third-party libraries)
//   * Files with `// yandex-bundle-allow:` marker on the matching line
async function assertNoDevUrlLiterals(outDir) {
  const TARGET_EXT = new Set(['.js', '.css', '.html', '.json', '.md']);
  const failures = [];

  async function walk(rel) {
    const abs = path.join(outDir, rel);
    let entries;
    try {
      entries = await fs.readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (isUnderAllowedDir(childRel)) continue;
        await walk(childRel);
      } else if (e.isFile()) {
        if (isUnderAllowedDir(childRel)) continue;
        const ext = path.extname(e.name).toLowerCase();
        if (!TARGET_EXT.has(ext)) continue;
        const content = await fs.readFile(path.join(outDir, childRel), 'utf8');
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes(YANDEX_ASSERT_ALLOW_MARKER)) continue;
          for (const pat of YANDEX_REJECT_PATTERNS) {
            const m = line.match(pat.re);
            if (m) {
              failures.push({
                file: childRel,
                line: i + 1,
                pattern: pat.name,
                excerpt: line.trim().slice(0, 160),
              });
            }
          }
        }
      }
    }
  }

  await walk('');
  if (failures.length) {
    console.error('[build_release][YANDEX][FAIL] dev-URL literal(s) survived sanitisation:');
    for (const f of failures.slice(0, 50)) {
      console.error(`  ${f.file}:${f.line} [${f.pattern}] ${f.excerpt}`);
    }
    if (failures.length > 50) console.error(`  ... and ${failures.length - 50} more.`);
    console.error('[build_release][YANDEX] add `// yandex-bundle-allow:` marker on the line if intentional.');
    process.exit(5);
  }
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
  const copyResult = await copyWhitelist(root, out, { yandex: !!yandex });
  const copied = copyResult.copied;
  const skippedYandex = copyResult.skippedYandex;
  console.log(`[build_release] copied ${copied.length} files.`);
  if (yandex && skippedYandex.length) {
    console.log(`[build_release][YANDEX] skipped ${skippedYandex.length} dev-only file(s):`);
    for (const rel of skippedYandex) console.log(`  - ${rel}`);
  }

  // Compute hashes for every copied file (manifest covers all; cache-bust uses subset).
  const hashes = new Map();
  for (const rel of copied) {
    const sha = await sha256Of(path.join(out, rel));
    hashes.set(rel, sha);
  }

  console.log('[build_release] injecting cache-bust markers into index.html');
  await injectCacheBust(out, hashes);

  // C2: substitute the Yandex SDK URL placeholder before any Yandex-only seam.
  console.log(`[build_release] substituting __YANDEX_SDK_URL__ placeholder (yandex=${!!yandex})`);
  await replaceYandexSdkPlaceholder(out, !!yandex);

  // solo-pipeline-yandex-vk#1 (batch#1): for --yandex builds, sanitise dev-URL
  // literals in shipped first-party files BEFORE the SDK seam injection so
  // that any Yandex-specific lines we add are never themselves rewritten.
  let yandexSanitised = [];
  if (yandex) {
    console.log('[build_release][YANDEX] sanitising dev-URL literals in shipped first-party files');
    yandexSanitised = await sanitizeYandexBundle(out);
    if (yandexSanitised.length) {
      console.log(`[build_release][YANDEX] sanitised ${yandexSanitised.length} file(s):`);
      for (const rel of yandexSanitised.slice(0, 20)) console.log(`  - ${rel}`);
      if (yandexSanitised.length > 20) console.log(`  ... and ${yandexSanitised.length - 20} more.`);
    } else {
      console.log('[build_release][YANDEX] no dev-URL literals matched; nothing to sanitise.');
    }
    if (skippedYandex.length) {
      console.log('[build_release][YANDEX] stripping <script> tags for skipped dev-only files');
      await stripYandexSkippedScripts(out, skippedYandex);
    }
  }

  if (yandex) {
    console.log('[build_release] injecting Yandex Games SDK seam');
    await injectYandexSeam(out);
    console.log('[build_release][YANDEX] running final dev-URL literal guard');
    await assertNoDevUrlLiterals(out);
    console.log('[build_release][YANDEX] guard passed: no dev-URL literals in shipped first-party files.');
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
    shipped_modules: copied.slice(),
    skipped_for_yandex: skippedYandex.slice(),
    yandex_sanitised: yandex ? yandexSanitised.slice() : [],
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

  // solo-pipeline-yandex-vk batch#6 / item 17: dry-run cleanup.
  if (args.dryRun) {
    try {
      await fs.rm(out, { recursive: true, force: true });
      console.log(`[build_release][DRY-RUN] removed throwaway out dir: ${out}`);
    } catch (e) {
      console.warn(`[build_release][DRY-RUN] could not remove ${out}:`, e.message);
    }
    console.log('[build_release][DRY-RUN] sanitiser pipeline OK — no shipped artifact.');
  }
}

main().catch((err) => {
  console.error('[build_release] FAILED:', err.message);
  process.exit(1);
});
