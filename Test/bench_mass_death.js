/**
 * Mass-death microbenchmark (Batch 4).
 * Run: node Test/bench_mass_death.js
 * Optional strict gate: node Test/bench_mass_death.js --strict
 */

'use strict';

const perfHooks = require('perf_hooks');
const perf = perfHooks.performance;

const KILLS_PER_FRAME = 80;
const DURATION_MS = 500;
const TARGET_REDUCTION_PCT = 40;
const DEATH_BURST_FRAME_BUDGET = 240;

function createRng(seed) {
	let s = seed >>> 0;
	return function rand() {
		s ^= s << 13;
		s ^= s >>> 17;
		s ^= s << 5;
		return ((s >>> 0) & 0xffffffff) / 0x100000000;
	};
}

function createScene(seed) {
	const rand = createRng(seed);
	const zombies = [];
	for (let i = 0; i < 420; i++) {
		zombies.push({
			id: i,
			level: 1 + (i % 12),
			hp: 50 + (i % 70),
			state: 'alive',
			x: rand() * 1920,
			y: rand() * 1080,
		});
	}
	const decor = [];
	for (let i = 0; i < 520; i++) {
		decor.push({
			x: rand() * 1920,
			y: rand() * 1080,
			renderOrder: i,
			sprite: (i % 4),
		});
	}
	return {
		rand,
		zombies,
		particles: [],
		particlePool: [],
		damageNumbers: [],
		damageWriteIndex: 0,
		telemetryPayloads: [],
		decor,
		decorItems: [],
		deathBatch: [],
		deathBatchCount: 0,
	};
}

function particleAllocBaseline(state, x, y, count) {
	for (let i = 0; i < count; i++) {
		state.particles.push({ x, y, life: 0.6, vx: (i % 3) - 1, vy: (i % 5) - 2 });
	}
}

function particleAllocPooled(state, x, y, count) {
	for (let i = 0; i < count; i++) {
		const p = state.particlePool.length ? state.particlePool.pop() : { x: 0, y: 0, life: 0, vx: 0, vy: 0 };
		p.x = x;
		p.y = y;
		p.life = 0.6;
		p.vx = (i % 3) - 1;
		p.vy = (i % 5) - 2;
		state.particles.push(p);
	}
}

function stepParticlesWithPool(state, dt) {
	let w = 0;
	const arr = state.particles;
	for (let i = 0; i < arr.length; i++) {
		const p = arr[i];
		p.life -= dt;
		if (p.life > 0) {
			arr[w++] = p;
		} else {
			state.particlePool.push(p);
		}
	}
	arr.length = w;
}

function stepParticlesBaseline(state, dt) {
	const next = [];
	const arr = state.particles;
	for (let i = 0; i < arr.length; i++) {
		const p = arr[i];
		p.life -= dt;
		if (p.life > 0) next.push(p);
	}
	state.particles = next;
}

function addDamageNumberBaseline(state, value) {
	state.damageNumbers.push({ v: value, life: 0.8, max: 0.8 });
	if (state.damageNumbers.length > 24) {
		state.damageNumbers.shift();
	}
}

function addDamageNumberRing(state, value) {
	const max = 24;
	const idx = state.damageWriteIndex % max;
	state.damageWriteIndex++;
	if (state.damageNumbers.length < max) {
		state.damageNumbers.push({ v: value, life: 0.8, max: 0.8 });
		return;
	}
	const slot = state.damageNumbers[idx];
	slot.v = value;
	slot.life = 0.8;
	slot.max = 0.8;
}

function stepDamageNumbersBaseline(state, dt) {
	const next = [];
	const arr = state.damageNumbers;
	for (let i = 0; i < arr.length; i++) {
		const d = arr[i];
		d.life -= dt;
		if (d.life > 0) next.push(d);
	}
	state.damageNumbers = next;
}

function stepDamageNumbersCompacted(state, dt) {
	let w = 0;
	const arr = state.damageNumbers;
	for (let i = 0; i < arr.length; i++) {
		const d = arr[i];
		d.life -= dt;
		if (d.life > 0) arr[w++] = d;
	}
	arr.length = w;
}

function drawDecorBaseline(state) {
	const viewportX = 960;
	const viewportY = 540;
	const items = [];
	for (let i = 0; i < state.decor.length; i++) {
		const d = state.decor[i];
		const dx = d.x - viewportX;
		const dy = d.y - viewportY;
		if ((dx * dx + dy * dy) > (960 * 960)) continue;
		items.push({ x: d.x, y: d.y, order: d.renderOrder, sprite: d.sprite });
	}
	let sum = 0;
	for (let i = 0; i < items.length; i++) sum += items[i].order;
	return sum;
}

function drawDecorPooled(state) {
	const viewportX = 960;
	const viewportY = 540;
	const items = state.decorItems;
	items.length = 0;
	for (let i = 0; i < state.decor.length; i++) {
		const d = state.decor[i];
		const dx = d.x - viewportX;
		const dy = d.y - viewportY;
		if ((dx * dx + dy * dy) > (960 * 960)) continue;
		items.push(d);
	}
	let sum = 0;
	for (let i = 0; i < items.length; i++) sum += items[i].renderOrder;
	return sum;
}

function cleanupKillsBaseline(state, k) {
	const alive = [];
	let killed = 0;
	let levelSum = 0;
	for (let i = 0; i < state.zombies.length; i++) {
		const z = state.zombies[i];
		if (killed < k && z.state === 'alive') {
			z.state = 'dying';
			particleAllocBaseline(state, z.x, z.y, 18);
			state.telemetryPayloads.push({ level: z.level });
			addDamageNumberBaseline(state, 100 + z.level);
			levelSum += z.level;
			killed++;
		} else {
			alive.push(z);
		}
	}
	// Baseline: preserve old expensive rebuild + sort pattern.
	alive.sort(function byLevelAsc(a, b) { return a.level - b.level; });
	state.zombies = alive;

	// Keep pressure constant: respawn K new alive zombies each frame.
	for (let i = 0; i < killed; i++) {
		state.zombies.push({
			id: (state.rand() * 1e9) | 0,
			level: 1 + ((levelSum + i) % 12),
			hp: 80,
			state: 'alive',
			x: state.rand() * 1920,
			y: state.rand() * 1080,
		});
	}
}

function cleanupKillsOptimized(state, k) {
	let w = 0;
	let killed = 0;
	let levelSum = 0;
	state.deathBatchCount = 0;
	for (let i = 0; i < state.zombies.length; i++) {
		const z = state.zombies[i];
		if (killed < k && z.state === 'alive') {
			z.state = 'dying';
			state.deathBatch[state.deathBatchCount++] = z;
			addDamageNumberRing(state, 100 + z.level);
			levelSum += z.level;
			killed++;
			continue;
		}
		state.zombies[w++] = z;
	}
	state.zombies.length = w;

	if (state.deathBatchCount > 0) {
		const perKill = Math.max(2, Math.floor(DEATH_BURST_FRAME_BUDGET / state.deathBatchCount));
		for (let i = 0; i < state.deathBatchCount; i++) {
			const z = state.deathBatch[i];
			particleAllocPooled(state, z.x, z.y, perKill);
		}
		state.telemetryPayloads.push(state.deathBatchCount);
	}

	// Keep pressure constant using reused records instead of fresh objects.
	for (let i = 0; i < state.deathBatchCount; i++) {
		const z = state.deathBatch[i];
		z.level = 1 + ((levelSum + i) % 12);
		z.hp = 80;
		z.state = 'alive';
		z.x = state.rand() * 1920;
		z.y = state.rand() * 1080;
		state.zombies[w++] = z;
	}
	state.zombies.length = w;
}

function runScenario(name, frameFn) {
	const state = createScene(0xBADC0DE);
	const frameTimes = [];
	const heapSeries = [];
	const start = perf.now();
	let checksum = 0;

	while ((perf.now() - start) < DURATION_MS) {
		const frameStart = perf.now();
		frameFn(state);
		const frameMs = perf.now() - frameStart;
		frameTimes.push(frameMs);
		if (perf.memory && Number.isFinite(perf.memory.usedJSHeapSize)) {
			heapSeries.push(perf.memory.usedJSHeapSize);
		}
		checksum += frameMs;
	}

	let maxFrameMs = 0;
	let sum = 0;
	for (let i = 0; i < frameTimes.length; i++) {
		const ms = frameTimes[i];
		sum += ms;
		if (ms > maxFrameMs) maxFrameMs = ms;
	}
	const avgFrameMs = frameTimes.length ? (sum / frameTimes.length) : 0;
	const minFps = maxFrameMs > 0 ? (1000 / maxFrameMs) : 0;

	let majorGcCount = null;
	if (heapSeries.length > 3) {
		majorGcCount = 0;
		for (let i = 1; i < heapSeries.length; i++) {
			const drop = heapSeries[i - 1] - heapSeries[i];
			if (drop > (2 * 1024 * 1024)) majorGcCount++;
		}
	}

	return {
		name,
		frames: frameTimes.length,
		avgFrameMs,
		maxFrameMs,
		minFps,
		checksum,
		majorGcCount,
		heapMetricAvailable: heapSeries.length > 0,
	};
}

function baselineFrame(state) {
	cleanupKillsBaseline(state, KILLS_PER_FRAME);
	stepDamageNumbersBaseline(state, 1 / 60);
	stepParticlesBaseline(state, 1 / 60);
	return drawDecorBaseline(state);
}

function optimizedFrame(state) {
	cleanupKillsOptimized(state, KILLS_PER_FRAME);
	stepDamageNumbersCompacted(state, 1 / 60);
	stepParticlesWithPool(state, 1 / 60);
	return drawDecorPooled(state);
}

function printResult(base, opt, reductionPct) {
	console.log('Mass-death microbenchmark (K=80, 500ms loop)');
	console.log('Baseline : avg=' + base.avgFrameMs.toFixed(3) + 'ms, minFPS=' + base.minFps.toFixed(2)
		+ ', frames=' + base.frames + ', gcMajor=' + (base.majorGcCount == null ? 'n/a' : String(base.majorGcCount)));
	console.log('Optimized: avg=' + opt.avgFrameMs.toFixed(3) + 'ms, minFPS=' + opt.minFps.toFixed(2)
		+ ', frames=' + opt.frames + ', gcMajor=' + (opt.majorGcCount == null ? 'n/a' : String(opt.majorGcCount)));
	console.log('Reduction: ' + reductionPct.toFixed(2) + '% (target >= ' + TARGET_REDUCTION_PCT + '%)');
	if (!base.heapMetricAvailable || !opt.heapMetricAvailable) {
		console.log('Heap metric: performance.memory.usedJSHeapSize недоступен в текущем runtime');
	}
}

function main() {
	const baseline = runScenario('baseline', baselineFrame);
	const optimized = runScenario('optimized', optimizedFrame);
	const reductionPct = baseline.avgFrameMs > 0
		? ((baseline.avgFrameMs - optimized.avgFrameMs) / baseline.avgFrameMs) * 100
		: 0;
	printResult(baseline, optimized, reductionPct);

	const strict = process.argv.indexOf('--strict') !== -1;
	if (strict && reductionPct < TARGET_REDUCTION_PCT) {
		console.error('Strict mode failed: reduction is below target.');
		process.exit(1);
	}
}

main();
