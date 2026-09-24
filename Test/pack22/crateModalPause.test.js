'use strict';

/**
 * Pack 22: подарочный бокс («Военная помощь») ставит игру на паузу.
 *
 * Контракт (задача пользователя 2026-09-24):
 *   При открытии модалки подарочного бокса симуляция обязана вставать на паузу
 *   точно так же, как при открытии меню, суперкомпьютера, достижений или
 *   производственного склада. Раньше crate-модалка была единственной
 *   «тяжёлой» модалкой без pause-lock: таймер бокса, зомби и снаряды
 *   продолжали тикать за спиной открытого окна.
 *
 * Инварианты, которые проверяет пак:
 *   CMP-1  menuPauseLocks содержит ключ `crate` (иначе setMenuPauseSource молча
 *          игнорирует источник и пауза не включается).
 *   CMP-2  агрегатный isAnyMenuPauseOpen() учитывает crate-источник.
 *   CMP-3  hasHigherPriorityEscapeLock() учитывает crate (Escape не должен
 *          открывать меню поверх crate-модалки).
 *   CMP-4  tab-inactive fallback (reasons.tabInactive) aware of crate.
 *   CMP-5  openCrateModal() acquire'ит lock ДО любой ветки показа модалки
 *          (DOM + Phaser parity) — то есть lock не зависит от того, каким
 *          бэкендом рендерится окно.
 *   CMP-6  closeCrateModal() безусловно release'ит lock на всех путях
 *          (claim / decline / backdrop / Escape / reset-to-big-menu).
 *   CMP-7  RUNTIME: реальный исходник game.js (lock-literal + агрегатор +
 *          setMenuPauseSource) в sandbox — `setMenuPauseSource('crate', true)`
 *          включает паузу, `false` возвращает в рабочее состояние, а пауза
 *          не «залипает» при повторных вызовах.
 *   CMP-8  RUNTIME: crate-lock взаимодействует с соседними источниками
 *          (settings) через агрегат — закрытие crate не снимает чужую паузу.
 *   CMP-9  docs/ai/SYSTEMS/ui.md фиксирует pause-контракт crate-модалки.
 *   CMP-10 entry token parity для изменённых entry assets.
 *
 * Run: node Test/pack22/crateModalPause.test.js
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
    console.log('  [FAIL] ' + name + ' — ' + err.message);
  }
}

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const uiDoc = fs.readFileSync(path.join(ROOT, 'docs', 'ai', 'SYSTEMS', 'ui.md'), 'utf8');
const changelog = fs.readFileSync(path.join(ROOT, 'docs', 'ai', 'CHANGELOG.md'), 'utf8');

console.log('\n── Pack 22: crate modal pause lock ──');

function sliceFn(src, header) {
  const start = src.indexOf(header);
  if (start < 0) return '';
  // Найдём закрывающую `}` на нулевой колонке после старта (canonical
  // game.js style: top-level функции закрываются `\n}` без отступа).
  const end = src.indexOf('\n}', start);
  return end < 0 ? '' : src.slice(start, end + 2);
}

const locksLiteralMatch = gameSrc.match(/let menuPauseLocks = \{[\s\S]*?\n\};/);
const locksLiteral = locksLiteralMatch ? locksLiteralMatch[0] : '';
const isAnyMenuPauseOpenSrc = sliceFn(gameSrc, 'function isAnyMenuPauseOpen(){');
const recomputeSrc = sliceFn(gameSrc, 'function recomputeMenuPauseLock(){');
const setSourceSrc = sliceFn(gameSrc, 'function setMenuPauseSource(source, open){');

const openCrateSrc = sliceFn(gameSrc, 'function openCrateModal(){');
const closeCrateSrc = sliceFn(gameSrc, 'function closeCrateModal(){');
const escapePrioritySrc = sliceFn(gameSrc, 'function hasHigherPriorityEscapeLock(){');
const tabInactiveGuardSrc = gameSrc.slice(gameSrc.indexOf('if (reasons && reasons.tabInactive'));

// ════════════════════════════════════════════════════════════════
//  Section 1 — статические guard'ы контракта
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 1: static contract ---');

test('CMP-1: menuPauseLocks содержит crate-источник', function () {
  assert(locksLiteral.length > 0, 'menuPauseLocks literal найден в game.js');
  assert(/crate:\s*false/.test(locksLiteral), 'menuPauseLocks.crate seeding присутствует');
});

test('CMP-2: isAnyMenuPauseOpen() учитывает crate', function () {
  assert(isAnyMenuPauseOpenSrc.length > 0, 'isAnyMenuPauseOpen найден');
  assert(isAnyMenuPauseOpenSrc.indexOf('menuPauseLocks.crate') !== -1, 'агрегат включает crate');
});

test('CMP-3: hasHigherPriorityEscapeLock() учитывает crate', function () {
  assert(escapePrioritySrc.length > 0, 'hasHigherPriorityEscapeLock найден');
  assert(escapePrioritySrc.indexOf('menuPauseLocks.crate') !== -1, 'Escape-priority включает crate');
});

test('CMP-4: tab-inactive fallback aware of crate', function () {
  assert(tabInactiveGuardSrc.length > 0, 'tab-inactive guard найден');
  assert(tabInactiveGuardSrc.indexOf('!menuPauseLocks.crate') !== -1, 'guard исключает crate-lock');
});

test('CMP-5: openCrateModal() acquire lock до ветвления DOM/Phaser', function () {
  assert(openCrateSrc.length > 0, 'openCrateModal найден');
  assert(openCrateSrc.indexOf("setMenuPauseSource('crate', true)") !== -1, 'lock acquire присутствует');
  const lockPos = openCrateSrc.indexOf("setMenuPauseSource('crate', true)");
  const domBranchPos = openCrateSrc.indexOf('UIModals');
  assert(domBranchPos > 0 && lockPos < domBranchPos,
    'lock acquire стоит перед веткой UIModals (Phaser/DOM parity)');
  assert(/if \(!state\.crate \|\| !ui\.crateModal\) return;/.test(openCrateSrc),
    'guard по отсутствию бокса остаётся перед acquire');
});

test('CMP-6: closeCrateModal() безусловно release lock', function () {
  assert(closeCrateSrc.length > 0, 'closeCrateModal найден');
  assert(closeCrateSrc.indexOf("setMenuPauseSource('crate', false)") !== -1, 'lock release присутствует');
  const releasePos = closeCrateSrc.indexOf("setMenuPauseSource('crate', false)");
  const uiModalsPos = closeCrateSrc.indexOf('UIModals');
  assert(releasePos < uiModalsPos, 'release стоит ДО ветки UIModals — безусловно на всех путях');
});

// ════════════════════════════════════════════════════════════════
//  Section 2 — RUNTIME поведение реального исходника
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 2: runtime aggregation ---');

function loadPauseAggregate() {
  assert(locksLiteral.length > 0, 'locks literal доступен');
  assert(isAnyMenuPauseOpenSrc.length > 0, 'aggregate доступен');
  assert(recomputeSrc.length > 0, 'recompute доступен');
  assert(setSourceSrc.length > 0, 'setMenuPauseSource доступен');

  const code = [
    'var pauseManager = null;',
    'var state = { ui: { menuOpen: false } };',
    'var ui = {};',
    locksLiteral,
    isAnyMenuPauseOpenSrc,
    recomputeSrc,
    setSourceSrc,
    'return {',
    '  isAnyMenuPauseOpen: isAnyMenuPauseOpen,',
    '  setMenuPauseSource: setMenuPauseSource,',
    '  locks: menuPauseLocks,',
    '};',
  ].join('\n');

  const sandboxWindow = { Game: {} };
  const fn = new Function('window', 'state', 'ui', code);
  return fn(sandboxWindow, { ui: { menuOpen: false } }, {});
}

test('CMP-7: setMenuPauseSource("crate", …) реально включает и снимает паузу', function () {
  const api = loadPauseAggregate();
  assertEqual(api.isAnyMenuPauseOpen(), false, 'стартовое состояние — не на паузе');

  api.setMenuPauseSource('crate', true);
  assertEqual(api.isAnyMenuPauseOpen(), true, 'crate-модалка включает общую паузу');

  api.setMenuPauseSource('crate', true);
  assertEqual(api.isAnyMenuPauseOpen(), true, 'повторный acquire не ломает состояние');

  api.setMenuPauseSource('crate', false);
  assertEqual(api.isAnyMenuPauseOpen(), false, 'release возвращает симуляцию в работу');
});

test('CMP-8: crate-lock не снимает чужую паузу и не залипает сам', function () {
  const api = loadPauseAggregate();

  api.setMenuPauseSource('settings', true);
  assertEqual(api.isAnyMenuPauseOpen(), true, 'settings держит паузу');

  api.setMenuPauseSource('crate', true);
  api.setMenuPauseSource('crate', false);
  assertEqual(api.isAnyMenuPauseOpen(), true, 'закрытие crate не снимает чужую паузу');

  api.setMenuPauseSource('settings', false);
  assertEqual(api.isAnyMenuPauseOpen(), false, 'после снятия всех источников пауза уходит');

  // Whitelist-guard: произвольный источник не должен создавать фантомный lock.
  api.setMenuPauseSource('notARealSource', true);
  assertEqual(api.isAnyMenuPauseOpen(), false, 'неизвестный источник игнорируется');
  assertEqual(api.locks.notARealSource, undefined, 'мусорный ключ не создаётся');
});

// ════════════════════════════════════════════════════════════════
//  Section 3 — docs + entry token parity
// ════════════════════════════════════════════════════════════════
console.log('\n  --- Section 3: docs + entry token ---');

test('CMP-9: ui.md фиксирует pause-контракт crate-модалки', function () {
  const crateSectionPos = uiDoc.indexOf('## Military aid / crate modal');
  assert(crateSectionPos !== -1, 'секция crate-модалки присутствует');
  const section = uiDoc.slice(crateSectionPos, crateSectionPos + 4000);
  assert(section.indexOf("setMenuPauseSource('crate'") !== -1, 'ui.md упоминает crate pause-источник');
  assert(section.indexOf('menuPauseLocks') !== -1, 'ui.md ссылается на menuPauseLocks');
  assert(changelog.indexOf('setMenuPauseSource') !== -1 || changelog.indexOf('menuPauseLocks') !== -1,
    'CHANGELOG описывает pause-контракт');
});

test('CMP-10: entry token parity для изменённого entry asset', function () {
  const m = indexSrc.match(/var token = '([^']+)'/);
  assert(m, 'entry token присутствует');
  assert(m[1].length > 0, 'entry token непустой');
  assert(indexSrc.indexOf("resolve('game.js')") !== -1, 'game.js резолвится через token');
  const all = indexSrc.match(/\?v=([A-Za-z0-9._-]+)/g) || [];
  assert(all.length > 0, 'найдены ?v= маркеры');
  const wrong = all.filter(function (x) { return x !== '?v=' + m[1]; });
  assertEqual(wrong.length, 0, 'все ?v= маркеры несут общий token; расхождения: ' + wrong.slice(0, 5).join(', '));
});

console.log('\n═══════════════════════════');
console.log('Pack 22 (crate modal pause): ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (f) { console.log('  - ' + f.name + ': ' + f.error); });
}
console.log('═══════════════════════════\n');
process.exit(failCount > 0 ? 1 : 0);
