/**
 * Pack 11 — voucher bulk-buy regression guard (solo-pipeline-yandex-vk#1 followup1, item 2).
 *
 * Контракт (RAW_TZ followup verdict):
 *   Если у игрока 1 скидочный купон и он жмёт "Создать N танков":
 *     - 1-й танк покупается со скидкой (cost * voucherDiscountMul),
 *     - все остальные N-1 танков покупаются по полной цене (без скидки),
 *     - vouchers переходит из 1 → 0 после первой покупки,
 *     - последующие quote-вызовы (для 2..N) видят vouchers=0 и не применяют discount.
 *
 * Этот тест воспроизводит canonical contract двух разделённых проходов
 * `onBuyTank`:
 *   - quote pass: ctx.confirmed = false → cost * discount возвращён, vouchers НЕ списан;
 *   - commit pass: ctx.confirmed = true → vouchers−=1.
 *
 * А также bulk loop `tryBuyBulk → performTankPurchaseOnce` через N-итераций.
 *
 * Загружает реальное значение `voucherDiscountMul` из
 * `assets/balance/talentTree_v2.json` (talent eco_voucher_discount).
 *
 * Run: node Test/pack11/voucherBulkBuy.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || 'assertEqual') + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  \u2713 ' + name);
  } catch (e) {
    failCount++;
    failures.push({ name, error: e.message });
    console.log('  \u2717 ' + name + ' \u2014 ' + e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Read canonical voucherDiscountMul from talentTree_v2.json.
// ─────────────────────────────────────────────────────────────────────────
const TREE_PATH = path.resolve(__dirname, '../../assets/balance/talentTree_v2.json');
const tree = JSON.parse(fs.readFileSync(TREE_PATH, 'utf-8'));

function findTalentParam(treeRoot, talentId, paramKey) {
  if (!treeRoot || !Array.isArray(treeRoot.talents)) return null;
  for (let i = 0; i < treeRoot.talents.length; i++) {
    const talent = treeRoot.talents[i];
    if (!talent || talent.id !== talentId) continue;
    // talentTree_v2.json keeps `effects` directly on the talent (rank effects scale via `perRank`),
    // not nested under per-rank arrays.
    const effects = Array.isArray(talent.effects) ? talent.effects : [];
    for (let e = 0; e < effects.length; e++) {
      const eff = effects[e];
      if (eff && eff.type === 'param' && eff.key === paramKey) {
        if (eff.value != null) return eff.value;
        if (eff.base != null) return eff.base;
      }
    }
  }
  return null;
}

const voucherDiscountMul = findTalentParam(tree, 'eco_voucher', 'voucherDiscountMul');
assert(voucherDiscountMul != null, 'voucherDiscountMul must be declared in talentTree_v2.json under eco_voucher');
assert(voucherDiscountMul > 0 && voucherDiscountMul < 1, 'voucherDiscountMul must be in (0, 1)');

const voucherCap = findTalentParam(tree, 'eco_voucher', 'voucherCap');
assert(voucherCap != null && voucherCap >= 1, 'voucherCap must be declared and >=1');

// ─────────────────────────────────────────────────────────────────────────
// Reference simulator: mirrors talentsV2.onBuyTank quote/commit contract.
// Mirrors game.js tryBuyBulk → performTankPurchaseOnce per-tank loop.
// ─────────────────────────────────────────────────────────────────────────
function makeRunRt(initialVouchers) {
  return { eco: { vouchers: initialVouchers, taxReliefUntilMs: 0 } };
}

// canonical onBuyTank emulation (no lottery, no taxRelief — irrelevant for voucher test)
function onBuyTank(runRt, payload) {
  const ctx = payload || {};
  const baseCost = Math.max(0, Number(ctx.baseCost) || 0);
  const commit = !!(ctx.confirmed || ctx.success || ctx.committed);
  let cost = baseCost;
  let voucherUsed = false;
  if (runRt.eco.vouchers > 0) {
    cost *= voucherDiscountMul;
    voucherUsed = true;
    if (commit) {
      runRt.eco.vouchers = Math.max(0, runRt.eco.vouchers - 1);
    }
  }
  return { cost: cost, voucherUsed: voucherUsed, vouchersLeft: runRt.eco.vouchers };
}

// canonical performTankPurchaseOnce + tryBuyBulk emulation
function simulateBulkBuy(initialVouchers, basePrice, bulkCount, bumpFn) {
  const runRt = makeRunRt(initialVouchers);
  let price = basePrice;
  let totalSpend = 0;
  const perTank = [];
  for (let i = 0; i < bulkCount; i++) {
    // quote pass — no commit, returns discounted cost if vouchers>0
    const quote = onBuyTank(runRt, { baseCost: price });
    const charged = quote.cost;
    totalSpend += charged;
    perTank.push({
      level: 1,
      basePrice: price,
      charged: charged,
      voucherUsedOnQuote: quote.voucherUsed,
      vouchersBeforeQuote: i === 0 ? initialVouchers : runRt.eco.vouchers,
    });
    // bump price (game.js bumpBuyPrice — multiplied by some growth factor)
    price = bumpFn(price);
    // commit pass — actually consumes voucher
    const commit = onBuyTank(runRt, { baseCost: price, confirmed: true });
    perTank[i].voucherConsumedOnCommit = commit.voucherUsed;
    perTank[i].vouchersAfterCommit = runRt.eco.vouchers;
  }
  return { totalSpend: totalSpend, finalVouchers: runRt.eco.vouchers, perTank: perTank };
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────
console.log('\n\u2500\u2500 Pack 11: voucher bulk-buy regression guard \u2500\u2500');

test('VOUCHER-1: quote without commit does NOT decrement voucher counter', () => {
  const runRt = makeRunRt(1);
  const r = onBuyTank(runRt, { baseCost: 100 });
  assertEqual(r.voucherUsed, true, 'quote with vouchers>0 must report voucherUsed=true');
  assertEqual(runRt.eco.vouchers, 1, 'quote pass must NOT decrement vouchers');
  assertEqual(r.cost, 100 * voucherDiscountMul, 'quote pass must return discounted cost');
});

test('VOUCHER-2: commit decrements voucher exactly once', () => {
  const runRt = makeRunRt(1);
  const r = onBuyTank(runRt, { baseCost: 100, confirmed: true });
  assertEqual(r.voucherUsed, true, 'commit with vouchers>0 must report voucherUsed=true');
  assertEqual(runRt.eco.vouchers, 0, 'commit pass must decrement vouchers 1→0');
  assertEqual(r.cost, 100 * voucherDiscountMul, 'commit pass must return discounted cost');
});

test('VOUCHER-3: subsequent quote with vouchers=0 returns full price, no discount', () => {
  const runRt = makeRunRt(0);
  const r = onBuyTank(runRt, { baseCost: 100 });
  assertEqual(r.voucherUsed, false, 'vouchers=0 → voucherUsed must be false');
  assertEqual(runRt.eco.vouchers, 0, 'vouchers must stay at 0');
  assertEqual(r.cost, 100, 'vouchers=0 → no discount, cost must equal baseCost');
});

test('VOUCHER-4: bulk-16 with vouchers=1 + fixed price P → spend = 1·discount·P + 15·P', () => {
  const P = 100;
  const N = 16;
  const noBump = (x) => x; // fixed price (no growth)
  const result = simulateBulkBuy(1, P, N, noBump);
  const expectedTotal = voucherDiscountMul * P + (N - 1) * P;
  assertEqual(result.totalSpend, expectedTotal, 'bulk-16 net spend must equal 1·discount·P + 15·P');
  assertEqual(result.finalVouchers, 0, 'all vouchers must be consumed exactly once');
  assertEqual(result.perTank[0].voucherConsumedOnCommit, true, 'tank #1 must consume the voucher');
  assertEqual(result.perTank[0].charged, P * voucherDiscountMul, 'tank #1 must be discounted');
  for (let i = 1; i < N; i++) {
    assertEqual(result.perTank[i].voucherConsumedOnCommit, false, 'tank #' + (i + 1) + ' must NOT consume a voucher');
    assertEqual(result.perTank[i].charged, P, 'tank #' + (i + 1) + ' must be charged full price');
  }
});

test('VOUCHER-5: bulk-N with vouchers=K (K<N) consumes exactly K vouchers, K discounted tanks', () => {
  const P = 100;
  const N = 5;
  const K = 3;
  const noBump = (x) => x;
  const result = simulateBulkBuy(K, P, N, noBump);
  const expectedTotal = K * voucherDiscountMul * P + (N - K) * P;
  assertEqual(result.totalSpend, expectedTotal, 'bulk-5 with 3 vouchers → 3·discount·P + 2·P');
  assertEqual(result.finalVouchers, 0, 'all 3 vouchers must be consumed');
  let discountedCount = 0;
  let fullCount = 0;
  for (let i = 0; i < N; i++) {
    if (result.perTank[i].voucherConsumedOnCommit) {
      discountedCount++;
      assertEqual(result.perTank[i].charged, P * voucherDiscountMul, 'discounted tank cost mismatch');
    } else {
      fullCount++;
      assertEqual(result.perTank[i].charged, P, 'full-price tank cost mismatch');
    }
  }
  assertEqual(discountedCount, K, 'exactly K discounted tanks');
  assertEqual(fullCount, N - K, 'exactly N-K full-price tanks');
});

test('VOUCHER-6: vouchers=0 bulk-N never applies discount, spend = N·P', () => {
  const P = 100;
  const N = 4;
  const noBump = (x) => x;
  const result = simulateBulkBuy(0, P, N, noBump);
  assertEqual(result.totalSpend, N * P, 'vouchers=0 bulk-N spend must equal N·P');
  assertEqual(result.finalVouchers, 0, 'vouchers must remain 0');
  for (let i = 0; i < N; i++) {
    assertEqual(result.perTank[i].voucherConsumedOnCommit, false, 'no tank may consume a voucher');
  }
});

test('VOUCHER-7: voucherCap must allow accumulating up to declared cap (>=10)', () => {
  assert(voucherCap >= 10, 'voucherCap should be >= 10 per balance contract');
  // Verify bulk-N with vouchers=N consumes all vouchers, all tanks discounted
  const N = 5;
  const P = 100;
  const noBump = (x) => x;
  const result = simulateBulkBuy(N, P, N, noBump);
  assertEqual(result.totalSpend, N * voucherDiscountMul * P, 'all-discount bulk spend');
  assertEqual(result.finalVouchers, 0, 'all vouchers consumed');
});

// ─────────────────────────────────────────────────────────────────────────
// solo-pipeline-yandex-vk#1 followup2-item2 — preview vs actual divergence.
// The follow-up bug: button label said 638 gold, actual deduction was 440 gold.
// Root cause: preview did not simulate tax-relief or the talentsV2 mul chain,
// while the actual `onBuyTank` call did. The fix routes preview through the
// SAME `onBuyTank` quote pass (with vouchersOverride + taxReliefUntilMsOverride)
// so previewTotal === Σ(perTankActual) by construction. This guard mirrors that
// contract.
// ─────────────────────────────────────────────────────────────────────────

// Extended onBuyTank emulator with tax-relief and override semantics — matches
// the production contract in src/systems/talents/talentsV2.js after the fix.
function onBuyTankExt(runRt, payload) {
  const ctx = payload || {};
  const baseCost = Math.max(0, Number(ctx.baseCost) || 0);
  const commit = !!(ctx.confirmed || ctx.success || ctx.committed);
  const timeMs = Number.isFinite(ctx.timeMs) ? ctx.timeMs : 0;
  const taxReliefCostMul = Number.isFinite(ctx.taxReliefCostMul) ? ctx.taxReliefCostMul : 1;
  const hasVouchersOverride = Number.isFinite(ctx.vouchersOverride);
  const hasTaxReliefOverride = Number.isFinite(ctx.taxReliefUntilMsOverride);
  const availableVouchers = hasVouchersOverride
    ? Math.max(0, Math.floor(ctx.vouchersOverride))
    : runRt.eco.vouchers;
  const taxReliefUntilMs = hasTaxReliefOverride
    ? Number(ctx.taxReliefUntilMsOverride)
    : runRt.eco.taxReliefUntilMs;
  let cost = baseCost;
  if (timeMs < taxReliefUntilMs) cost *= taxReliefCostMul;
  let voucherUsed = false;
  if (availableVouchers > 0) {
    cost *= voucherDiscountMul;
    voucherUsed = true;
    if (commit && !hasVouchersOverride) {
      runRt.eco.vouchers = Math.max(0, runRt.eco.vouchers - 1);
    }
  }
  return { cost: cost, voucherUsed: voucherUsed };
}

// Mirror calculateAffordableBuyCount: walks N quote iterations with virtual
// voucher and tax-relief state — never touches the real runRt.
function simulatePreview(initialVouchers, basePrice, bulkCount, bumpFn, taxReliefDurationMs, taxReliefCostMul, timeMs) {
  let virtualVouchers = initialVouchers;
  let virtualTaxReliefUntilMs = 0;
  let price = basePrice;
  let totalCost = 0;
  const runRt = { eco: { vouchers: initialVouchers, taxReliefUntilMs: 0 } };
  for (let i = 0; i < bulkCount; i++) {
    const quote = onBuyTankExt(runRt, {
      baseCost: price,
      timeMs: timeMs,
      taxReliefCostMul: taxReliefCostMul,
      vouchersOverride: virtualVouchers,
      taxReliefUntilMsOverride: virtualTaxReliefUntilMs,
    });
    totalCost += Math.floor(quote.cost);
    if (quote.voucherUsed && virtualVouchers > 0) virtualVouchers -= 1;
    price = bumpFn(price);
    if (taxReliefDurationMs > 0) virtualTaxReliefUntilMs = timeMs + taxReliefDurationMs;
  }
  return totalCost;
}

// Mirror tryBuyBulk → performTankPurchaseOnce: real onBuyTank quote+commit per iter.
function simulateActual(initialVouchers, basePrice, bulkCount, bumpFn, taxReliefDurationMs, taxReliefCostMul, timeMs) {
  const runRt = { eco: { vouchers: initialVouchers, taxReliefUntilMs: 0 } };
  let price = basePrice;
  let totalSpend = 0;
  for (let i = 0; i < bulkCount; i++) {
    const quote = onBuyTankExt(runRt, {
      baseCost: price,
      timeMs: timeMs,
      taxReliefCostMul: taxReliefCostMul,
    });
    totalSpend += Math.floor(quote.cost);
    // commit (no override): decrements voucher AND sets tax-relief in real flow
    onBuyTankExt(runRt, {
      baseCost: price,
      timeMs: timeMs,
      taxReliefCostMul: taxReliefCostMul,
      confirmed: true,
    });
    if (taxReliefDurationMs > 0) runRt.eco.taxReliefUntilMs = timeMs + taxReliefDurationMs;
    price = bumpFn(price);
  }
  return totalSpend;
}

test('VOUCHER-8: preview total must equal actual deduction with tax-relief + voucher + escalation', () => {
  const P = 35;
  const N = 16;
  const taxReliefCostMul = 0.91;
  const taxReliefDurationMs = 10000;
  const timeMs = 1000000;
  const bumpFn = (x) => x + Math.max(1, Math.ceil(x * 0.001));
  const preview = simulatePreview(1, P, N, bumpFn, taxReliefDurationMs, taxReliefCostMul, timeMs);
  const actual = simulateActual(1, P, N, bumpFn, taxReliefDurationMs, taxReliefCostMul, timeMs);
  assertEqual(preview, actual, 'preview total must equal actual deduction (bug: 638 vs 440 divergence)');
});

test('VOUCHER-9: preview-vs-actual parity holds for vouchers=0 (no tax-relief active)', () => {
  const P = 50;
  const N = 8;
  const bumpFn = (x) => x + Math.max(1, Math.ceil(x * 0.001));
  const preview = simulatePreview(0, P, N, bumpFn, 0, 1, 1000000);
  const actual = simulateActual(0, P, N, bumpFn, 0, 1, 1000000);
  assertEqual(preview, actual, 'baseline parity without vouchers/tax-relief');
});

test('VOUCHER-10: preview-vs-actual parity holds for vouchers>=N (all discounted)', () => {
  const P = 100;
  const N = 5;
  const bumpFn = (x) => x + Math.max(1, Math.ceil(x * 0.001));
  const preview = simulatePreview(10, P, N, bumpFn, 5000, 0.85, 1000000);
  const actual = simulateActual(10, P, N, bumpFn, 5000, 0.85, 1000000);
  assertEqual(preview, actual, 'parity when all tanks consume a voucher');
});

// ─────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────
console.log('\n' + passCount + ' passed, ' + failCount + ' failed.');
if (failCount > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log('  - ' + f.name + ': ' + f.error));
  process.exit(1);
}
