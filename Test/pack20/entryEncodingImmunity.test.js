'use strict';

/**
 * Pack 20: entry-file encoding immunity.
 *
 * Regression guard for a bug that hit TWICE: `index.html` was rewritten by a
 * legacy-ANSI round trip (PowerShell `Get-Content` defaults to cp1251, then
 * `Set-Content -Encoding UTF8` writes UTF-8), which double-encoded every
 * non-ASCII character and added a BOM. Symptoms the player saw:
 *   * loading splash showed `Р—РђР“Р РЈР—РљРђвЂ¦` instead of `ЗАГРУЗКА…`
 *   * the supercomputer HUD icon turned into a broken glyph instead of 🖥
 *
 * Root cause of the fragility: `index.html` shipped 1983 literal non-ASCII
 * characters inline (Cyrillic fallback text + emoji). Only strings that are NOT
 * overwritten by `data-i18n` at runtime are visibly broken, so the damage looked
 * partial — most labels are repainted from `src/i18n/*.json`, which is a separate
 * file and therefore never corrupted.
 *
 * Permanent fix: `index.html` is now 100% ASCII.
 *   * markup text / attribute values / <title> -> numeric character references
 *     (`&#x417;`). The HTML parser decodes them, so `textContent` and
 *     `getAttribute()` return exactly the same characters as before.
 *   * raw-text zones (<script>, <style>) -> ASCII transliteration, because HTML
 *     entities are NOT decoded there.
 *   * HTML comments -> ASCII transliteration (never rendered).
 *
 * Why that is immune: ASCII bytes (0x00-0x7F) are IDENTICAL in UTF-8 and cp1251,
 * so any re-encoding round trip is byte-for-byte a no-op. The file can no longer
 * be damaged by the accident that caused this bug.
 *
 * Cases:
 *   ENC-1   index.html decodes as UTF-8 and carries no BOM.
 *   ENC-2   index.html is pure ASCII (the immunity guarantee).
 *   ENC-3   the UTF-8 <-> cp1251 round trip that caused the bug is a byte no-op.
 *   ENC-4   no raw-text (<script>/<style>) zone contains non-ASCII.
 *   ENC-5   loading-splash status decodes to `ЗАГРУЗКА…`.
 *   ENC-6   supercomputer HUD icon decodes to U+1F5A5.
 *   ENC-7   supercomputer button label decodes to `Суперкомпьютер`.
 *   ENC-8   save-table `name` column headers decode to `Имя`.
 *   ENC-9   user-visible Cyrillic survives as entities (spot-check other labels).
 *   ENC-10   every inline <script> body is still valid JavaScript.
 *   ENC-11  style.css keeps its 5 `content:` glyphs as ASCII CSS escapes.
 *   ENC-12  entry token parity across every `?v=` marker.
 *   ENC-13  i18n ru/en stay valid JSON with equal key counts (parity sanity).
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  [OK] ' + name);
  } catch (err) {
    failCount++;
    failures.push({ name: name, error: err.message });
    console.log('  [FAIL] ' + name + ' - ' + err.message);
  }
}

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const STYLE_PATH = path.join(ROOT, 'style.css');

const indexBytes = fs.readFileSync(INDEX_PATH);
const indexText = indexBytes.toString('utf8');
// Compare on a BOM-less copy so line-ending / BOM policy is asserted separately.
const indexBody = indexText.replace(/^\uFEFF/, '');

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Decode the named/numeric character references a browser would decode. */
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, function (_, hex) {
      return String.fromCodePoint(parseInt(hex, 16));
    })
    .replace(/&#(\d+);/g, function (_, dec) {
      return String.fromCodePoint(parseInt(dec, 10));
    });
}

/** Return every <script>/<style> body (raw-text zones: entities NOT decoded). */
function rawTextBodies(html) {
  const out = [];
  const re = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push({ tag: m[1].toLowerCase(), body: m[2] });
  return out;
}

/** Value of an element's text as a browser would read it. */
function textOfId(html, id) {
  const re = new RegExp('<[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)</');
  const m = html.match(re);
  return m ? decodeEntities(m[1]) : null;
}

/* ------------------------------------------------------------------ *
 * ENC-1..3 — the immunity properties
 * ------------------------------------------------------------------ */

test('ENC-1: index.html decodes as UTF-8 and has no BOM', function () {
  assert(indexText.length > 0, 'file is readable');
  assertEqual(indexText.charCodeAt(0) !== 0xfeff, true, 'no BOM (U+FEFF) at start');
  assertEqual(indexBytes.slice(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false, 'no UTF-8 BOM bytes');
});

test('ENC-2: index.html is pure ASCII (immunity guarantee)', function () {
  const offenders = [];
  for (let i = 0; i < indexBytes.length; i++) {
    if (indexBytes[i] > 0x7f) {
      offenders.push({ offset: i, byte: indexBytes[i] });
      if (offenders.length >= 5) break;
    }
  }
  assert(
    offenders.length === 0,
    'index.html must contain only bytes 0x00-0x7F; found ' +
      offenders.map(function (o) { return '0x' + o.byte.toString(16) + '@' + o.offset; }).join(', ')
  );
});

test('ENC-3: UTF-8 <-> cp1251 round trip is a byte no-op (simulates the accident)', function () {
  // The accident: bytes were decoded as cp1251 then re-encoded as UTF-8.
  const viaCp1251 = Buffer.from(indexBytes.toString('latin1'), 'utf8');
  assertEqual(viaCp1251.equals(indexBytes), true, 'decode(cp1251)+encode(utf8) must not change bytes');
  // The mirror direction: decoded as UTF-8 then written back as cp1251.
  const viaUtf8 = Buffer.from(indexText, 'latin1');
  assertEqual(viaUtf8.equals(indexBytes), true, 'decode(utf8)+encode(cp1251) must not change bytes');
});

/* ------------------------------------------------------------------ *
 * ENC-4 — raw-text zones must not rely on entity decoding
 * ------------------------------------------------------------------ */

test('ENC-4: no raw-text (<script>/<style>) zone contains non-ASCII', function () {
  const bad = [];
  rawTextBodies(indexBody).forEach(function (zone) {
    for (let i = 0; i < zone.body.length; i++) {
      if (zone.body.charCodeAt(i) > 0x7f) {
        bad.push(zone.tag + ':U+' + zone.body.charCodeAt(i).toString(16).toUpperCase());
        break;
      }
    }
  });
  assert(bad.length === 0, 'raw-text zones must stay ASCII (entities are not decoded there); found ' + bad.join(', '));
});

/* ------------------------------------------------------------------ *
 * ENC-5..9 — the exact strings that broke, decoded as a browser would
 * ------------------------------------------------------------------ */

test('ENC-5: loading-splash status decodes to ЗАГРУЗКА…', function () {
  const v = textOfId(indexBody, 'yandexLoadingSplashStatus');
  assert(v !== null, 'splash status element present');
  assertEqual(v.trim(), '\u0417\u0410\u0413\u0420\u0423\u0417\u041A\u0410\u2026', 'ЗАГРУЗКА… (with U+2026 ellipsis)');
});

test('ENC-6: supercomputer HUD icon decodes to U+1F5A5', function () {
  const m = indexBody.match(/id="supercomputerBtn"[\s\S]*?<span class="supercomputerHudBtn__icon"[^>]*>([\s\S]*?)<\/span>/);
  assert(m, 'supercomputer icon span present');
  const icon = decodeEntities(m[1]).trim();
  assertEqual(icon.codePointAt(0), 0x1f5a5, 'desktop-computer emoji');
  assertEqual([...icon].length, 1, 'exactly one emoji glyph');
});

test('ENC-7: supercomputer button label decodes to Суперкомпьютер', function () {
  const tag = indexBody.match(/<button[^>]*id="supercomputerBtn"[^>]*>/);
  assert(tag, 'supercomputer button present');
  const label = tag[0].match(/aria-label="([^"]*)"/);
  assert(label, 'aria-label present');
  assertEqual(decodeEntities(label[1]), '\u0421\u0443\u043F\u0435\u0440\u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440', 'Суперкомпьютер');
});

test('ENC-8: save-table name column headers decode to Имя', function () {
  const re = /data-i18n="menu\.(?:save|load)\.col\.name"[^>]*>([\s\S]*?)</g;
  let m;
  let seen = 0;
  while ((m = re.exec(indexBody)) !== null) {
    seen++;
    assertEqual(decodeEntities(m[1]).trim(), '\u0418\u043C\u044F', 'column header decodes to Имя');
  }
  assert(seen >= 3, 'expected at least 3 name column headers, saw ' + seen);
});

test('ENC-9: other user-visible labels survive as decoded entities', function () {
  const checks = [
    ['settingsBtn', 'aria-label', '\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438'],
    ['achievementsBtn', 'text', '\u0414\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u044F'],
    ['currentWaveText', 'text', '\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0432\u043E\u043B\u043D\u0430']
  ];
  const settings = indexBody.match(/<button[^>]*id="settingsBtn"[^>]*>/);
  assert(settings, 'settings button present');
  const lbl = settings[0].match(/aria-label="([^"]*)"/);
  assert(lbl, 'settings aria-label present');
  assertEqual(decodeEntities(lbl[1]), checks[0][2], 'Настройки');

  const ach = indexBody.match(/<button[^>]*id="achievementsBtn"[^>]*>([\s\S]*?)<\/button>/);
  assert(ach, 'achievements button present');
  assertEqual(decodeEntities(ach[1]).trim(), checks[1][2], 'Достижения');

  const wave = textOfId(indexBody, 'currentWaveText');
  assert(wave !== null, 'current wave label present');
  assert(wave.indexOf('\u0422\u0435\u043A\u0443\u0449\u0430\u044F') === 0, 'Текущая волна prefix intact');
});

/* ------------------------------------------------------------------ *
 * ENC-10 — inline JS must still parse
 * ------------------------------------------------------------------ */

test('ENC-10: every inline <script> body is valid JavaScript', function () {
  const commentSpans = [];
  let c;
  const cre = /<!--[\s\S]*?-->/g;
  while ((c = cre.exec(indexBody)) !== null) commentSpans.push([c.index, cre.lastIndex]);

  const scripts = [];
  const sre = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let s;
  while ((s = sre.exec(indexBody)) !== null) {
    // A commented-out <script> block holds prose, not JavaScript.
    const inComment = commentSpans.some(function (sp) { return s.index >= sp[0] && s.index < sp[1]; });
    if (!inComment && s[1].trim()) scripts.push(s[1]);
  }
  assert(scripts.length > 0, 'found inline script blocks');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'enc-guard-'));
  scripts.forEach(function (body, i) {
    const f = path.join(tmp, 'inline-' + i + '.js');
    fs.writeFileSync(f, body, 'utf8');
    try {
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    } catch (err) {
      throw new Error('inline script #' + i + ' failed node --check: ' + String(err.stderr || err.message).slice(0, 300));
    }
  });
  fs.rmSync(tmp, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ *
 * ENC-11 — CSS glyph escape hardening
 * ------------------------------------------------------------------ */

test('ENC-11: style.css keeps content glyphs as ASCII CSS escapes', function () {
  const css = fs.readFileSync(STYLE_PATH, 'utf8');
  const bad = [];
  css.split('\n').forEach(function (line, i) {
    if (/content\s*:/.test(line) && /[^\x00-\x7F]/.test(line)) bad.push((i + 1) + ': ' + line.trim().slice(0, 80));
  });
  assert(bad.length === 0, 'content: declarations must not carry raw non-ASCII; found ' + bad.join(' | '));
  // Each glyph that used to be a literal must now be a codepoint escape.
  const expected = [
    ['\\2022 ', 'bullet'],
    ['\\1F512 ', 'lock'],
    ['\\25BE ', 'small down triangle']
  ];
  const missing = expected.filter(function (e) { return css.indexOf(e[0]) === -1; });
  assert(missing.length === 0, 'missing ASCII escapes: ' + missing.map(function (e) { return e[1] + ' (' + e[0] + ')'; }).join(', '));
});

/* ------------------------------------------------------------------ *
 * ENC-12 — entry token parity
 * ------------------------------------------------------------------ */

test('ENC-12: every ?v= marker carries the shared entry token', function () {
  const m = indexBody.match(/var token = '([^']+)'/);
  assert(m, 'entry token present');
  const token = m[1];
  const all = indexBody.match(/\?v=([A-Za-z0-9._-]+)/g) || [];
  assert(all.length > 0, 'found ?v= markers');
  const wrong = all.filter(function (x) { return x !== '?v=' + token; });
  assert(wrong.length === 0, 'all ?v= must equal the token; mismatches: ' + wrong.slice(0, 5).join(', '));
});

/* ------------------------------------------------------------------ *
 * ENC-13 — i18n parity sanity
 * ------------------------------------------------------------------ */

test('ENC-13: i18n ru/en remain valid JSON with equal key counts', function () {
  const ru = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/ru.json'), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/en.json'), 'utf8'));
  const a = Object.keys(ru).length;
  const b = Object.keys(en).length;
  assertEqual(a, b, 'ru/en key counts must match');
});

/* ------------------------------------------------------------------ */

console.log('');
console.log('-- Summary --');
console.log('Passed: ' + passCount);
console.log('Failed: ' + failCount);
if (failCount > 0) {
  for (const f of failures) console.log('  * ' + f.name + ': ' + f.error);
  process.exitCode = 1;
} else {
  console.log('All entry-file encoding immunity checks passed.');
}
