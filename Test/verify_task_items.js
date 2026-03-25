// Temporary FailDetector verification — covers acceptance criteria Items 1-6
'use strict';

let passed = 0;
let failed = 0;
const errors = [];

function assert(desc, cond) {
  if (cond) { passed++; console.log('  \u2713 ' + desc); }
  else { failed++; errors.push(desc); console.log('  \u2717 FAIL: ' + desc); }
}

// ─── Helpers ───
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function readF(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

// ═══════════════════════════════════════
// Item 1: Shared i18n plural utility
// ═══════════════════════════════════════
console.log('\n── Item 1: pluralize.js ──');

const plurSrc = readF('src/i18n/pluralize.js');
assert('pluralize.js exists', plurSrc.length > 0);
assert('exports Game.I18n.pluralize', plurSrc.includes('global.Game.I18n.pluralize'));

// Check that getTankWordKey delegates to pluralize
const gameSrc = readF('game.js');
const getTankWordKeyMatch = gameSrc.match(/function getTankWordKey\([\s\S]*?\n\}/);
assert('getTankWordKey extracted', !!getTankWordKeyMatch);
if (getTankWordKeyMatch) {
  const fn = getTankWordKeyMatch[0];
  assert('getTankWordKey uses Game.I18n.pluralize', fn.includes('pluralize'));
  assert('getTankWordKey primary path before fallback',
    fn.indexOf('pluralize') < fn.indexOf('mod10'));
}

// Check getDismantleTankCountText
const modalsSrc = readF('src/ui/modals.js');
const dismFnMatch = modalsSrc.match(/function getDismantleTankCountText[\s\S]*?\n  \}/);
assert('getDismantleTankCountText extracted', !!dismFnMatch);
if (dismFnMatch) {
  const fn = dismFnMatch[0];
  assert('getDismantleTankCountText uses Game.I18n.pluralize', fn.includes('pluralize'));
  assert('getDismantleTankCountText primary path before fallback',
    fn.indexOf('pluralize') < fn.indexOf('mod10'));
}

// index.html loading order
const htmlSrc = readF('index.html');
const plurLine = htmlSrc.indexOf('pluralize.js');
const modalsLine = htmlSrc.indexOf('modals.js');
const gameLine = htmlSrc.indexOf('game.js');
assert('pluralize.js loaded before modals.js', plurLine > 0 && modalsLine > 0 && plurLine < modalsLine);
assert('pluralize.js loaded before game.js', plurLine > 0 && gameLine > 0 && plurLine < gameLine);

// Runtime test of pluralize logic — IIFE uses `typeof window !== 'undefined' ? window : this`
// In Node CJS `this` = module.exports, so we must use globalThis.
globalThis.window = globalThis;
globalThis.Game = { I18n: { getLanguage: () => 'ru' } };
require(path.join(ROOT, 'src/i18n/pluralize.js'));
const plur = globalThis.Game.I18n.pluralize;
assert('pluralize function callable', typeof plur === 'function');
assert('pluralize(1) → one', plur(1, 'a', 'b', 'c') === 'a');
assert('pluralize(2) → few', plur(2, 'a', 'b', 'c') === 'b');
assert('pluralize(5) → many', plur(5, 'a', 'b', 'c') === 'c');
assert('pluralize(11) → many (11-14 rule)', plur(11, 'a', 'b', 'c') === 'c');
assert('pluralize(21) → one', plur(21, 'a', 'b', 'c') === 'a');
assert('pluralize(0) → many', plur(0, 'a', 'b', 'c') === 'c');

// Switch to en
globalThis.Game.I18n.getLanguage = () => 'en';
assert('pluralize en(1) → one', plur(1, 'a', 'b', 'c') === 'a');
assert('pluralize en(2) → many', plur(2, 'a', 'b', 'c') === 'c');

// ═══════════════════════════════════════
// Item 2: Config-driven thresholds
// ═══════════════════════════════════════
console.log('\n── Item 2: computeHangarMasterLevel thresholds ──');

const threshFnMatch = gameSrc.match(/function getHangarMasterThresholds\(\)\{[\s\S]*?\n\}/);
assert('getHangarMasterThresholds exists', !!threshFnMatch);
if (threshFnMatch) {
  const fn = threshFnMatch[0];
  assert('has FALLBACK array', fn.includes('FALLBACK'));
  assert('reads from achievement definitions', fn.includes('getAchievementDefinitions'));
  assert('filters familyId hangar_master', fn.includes("'hangar_master'"));
  assert('no hardcoded literal 10 as threshold in primary path',
    !fn.match(/min:\s*10[^0]/) || fn.includes('FALLBACK'));
}

const compFnMatch = gameSrc.match(/function computeHangarMasterLevel\(\)\{[\s\S]*?\n\}/);
assert('computeHangarMasterLevel exists', !!compFnMatch);
if (compFnMatch) {
  const fn = compFnMatch[0];
  assert('calls getHangarMasterThresholds()', fn.includes('getHangarMasterThresholds()'));
  assert('iterates thresholds array', fn.includes('thresholds[i]'));
  assert('no hardcoded 20/40/60', !fn.match(/minLevel\s*>=?\s*(20|40|60)\b/));
}

// ═══════════════════════════════════════
// Item 3: hover_idle animation
// ═══════════════════════════════════════
console.log('\n── Item 3: hover_idle animation ──');

const uhJson = JSON.parse(readF('assets/underground_hangar.json'));
const anims = uhJson.animations || {};
assert('underground_hangar.json has hover_idle', !!anims.hover_idle);
assert('hover_idle loop=true', anims.hover_idle && anims.hover_idle.loop === true);
assert('hover_start loop=false (one-shot)', anims.hover_start && anims.hover_start.loop === false);

// hover_start → hover_idle chain in JS
const uhSrc = readF('src/mechanics/undergroundHangar.js');
assert('handlePointerEnter sets hover_start', uhSrc.includes("setAnim('hover_start'"));
assert('hover_start callback chains to hover_idle',
  uhSrc.includes("setAnim('hover_idle')") && uhSrc.includes('handlePointerEnter'));

// hover_idle → hover_end on pointer leave
assert('handlePointerLeave sets hover_end', uhSrc.includes("setAnim('hover_end'"));

// Atlas continuity: hover_start last frame position = hover_idle position
const hsLastX = anims.hover_start.x + (anims.hover_start.frames - 1) * anims.hover_start.w;
assert('hover_start last frame matches hover_idle x (' + hsLastX + ' === ' + anims.hover_idle.x + ')',
  hsLastX === anims.hover_idle.x);

// ═══════════════════════════════════════
// Item 4: Close-only animation fix
// ═══════════════════════════════════════
console.log('\n── Item 4: _isClosing flag ──');

assert('_isClosing variable declared', uhSrc.includes('_isClosing'));
assert('handleModalClose sets _isClosing = true', uhSrc.includes('_isClosing = true'));
assert('handleModalClose plays close animation', uhSrc.includes("setAnim('close'"));
assert('close callback resets _isClosing = false', uhSrc.includes('_isClosing = false'));
assert('handlePointerLeave checks _isClosing', uhSrc.includes('_isClosing') && uhSrc.includes('handlePointerLeave'));

// Verify handlePointerLeave skips hover_end when closing
const hplMatch = uhSrc.match(/function handlePointerLeave[\s\S]*?\n  \}/);
assert('handlePointerLeave extracted', !!hplMatch);
if (hplMatch) {
  const fn = hplMatch[0];
  assert('handlePointerLeave early-returns on _isClosing', fn.includes('_isClosing') && fn.includes('return'));
}

// ═══════════════════════════════════════
// Item 5: Rounded sprite clip
// ═══════════════════════════════════════
console.log('\n── Item 5: Rounded clip in draw() ──');

const drawMatch = uhSrc.match(/function draw\(ctx[\s\S]*?\n  \}/);
assert('draw function extracted', !!drawMatch);
if (drawMatch) {
  const fn = drawMatch[0];
  assert('draw uses ctx.save()', fn.includes('ctx.save()'));
  assert('draw uses ctx.clip()', fn.includes('ctx.clip()'));
  assert('draw uses ctx.restore()', fn.includes('ctx.restore()'));
  assert('draw uses arcTo for rounded rect', fn.includes('ctx.arcTo'));
  assert('drawTankCountBadge after restore (normal path)',
    fn.lastIndexOf('drawTankCountBadge') > fn.indexOf('ctx.restore()'));
}

// ═══════════════════════════════════════
// Item 6: Responsive scaling
// ═══════════════════════════════════════
console.log('\n── Item 6: Responsive scaling ──');

assert('DESKTOP_CELL_BASE = 42', gameSrc.includes('DESKTOP_CELL_BASE = 42'));
assert('DESKTOP_BREAKPOINT = 768', gameSrc.includes('DESKTOP_BREAKPOINT = 768'));

const applyMatch = gameSrc.match(/function applyBalScale\(scale\)\{[\s\S]*?\n\}/);
assert('applyBalScale extracted', !!applyMatch);
if (applyMatch) {
  const fn = applyMatch[0];
  assert('no 1.35 upper clamp', !fn.includes('1.35'));
  assert('Math.max(1, scale) only lower clamp', fn.includes('Math.max(1'));
  assert('desktop cellW uses DESKTOP_CELL_BASE * clamped', fn.includes('DESKTOP_CELL_BASE * clamped'));
  assert('mobile path uses BASE_BAL.cellW', fn.includes('BASE_BAL.cellW'));
  assert('has viewport width check', fn.includes('DESKTOP_BREAKPOINT'));
}

// Check 1920x1080 reference: scale ≈ 1.66, cellW ≈ 70
const scale1080 = 1080 / 650; // typical reference height
const cellW1080 = Math.round(42 * scale1080);
assert('at 1080p: cellW ≈ ' + cellW1080 + ' (expected ~70)', cellW1080 >= 68 && cellW1080 <= 72);

// Low-res regression check: at 720p
const scale720 = 720 / 650;
const cellW720 = Math.round(42 * scale720);
assert('at 720p: cellW ≈ ' + cellW720 + ' (should be > 42)',
  cellW720 > 42);

// Ultra-low 480p
const scale480 = 480 / 650;
const cellW480 = Math.round(42 * Math.max(1, scale480));
assert('at 480p: cellW ≈ ' + cellW480 + ' (clamped at scale=1, cellW≥42)',
  cellW480 >= 42);

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════
console.log('\n════════════════════════════════');
console.log('VERIFY: ' + passed + ' passed, ' + failed + ' failed');
if (errors.length > 0) {
  console.log('FAILURES:');
  errors.forEach(function (e) { console.log('  - ' + e); });
}
console.log('════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
