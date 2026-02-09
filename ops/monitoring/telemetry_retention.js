#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {
    input: null,
    output: null,
    maxEntries: 2000,
    maxAgeDays: 7,
    selfTest: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input') out.input = argv[++i];
    else if (arg === '--output') out.output = argv[++i];
    else if (arg === '--max-entries') out.maxEntries = Number(argv[++i]) || out.maxEntries;
    else if (arg === '--max-age-days') out.maxAgeDays = Number(argv[++i]) || out.maxAgeDays;
    else if (arg === '--self-test') out.selfTest = true;
  }
  return out;
}

function parseTs(ts) {
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : null;
}

function trimTelemetry(entries, opts) {
  const maxEntries = Number.isFinite(opts.maxEntries) ? opts.maxEntries : 2000;
  const maxAgeMs = (Number.isFinite(opts.maxAgeDays) ? opts.maxAgeDays : 7) * 24 * 60 * 60 * 1000;
  const nowMs = opts.nowMs || Date.now();

  let trimmed = [];
  for (const item of entries) {
    if (!item || !item.ts) continue;
    if (maxAgeMs > 0) {
      const tsMs = parseTs(item.ts);
      if (tsMs == null) continue;
      if (nowMs - tsMs > maxAgeMs) continue;
    }
    trimmed.push(item);
  }
  if (maxEntries > 0 && trimmed.length > maxEntries) {
    trimmed = trimmed.slice(trimmed.length - maxEntries);
  }
  return trimmed;
}

function runSelfTest() {
  const now = Date.now();
  const oldTs = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
  const newTs = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
  const entries = [
    { ts: oldTs, event: 'old' },
    { ts: newTs, event: 'new' }
  ];
  const trimmed = trimTelemetry(entries, { maxEntries: 2000, maxAgeDays: 7, nowMs: now });
  if (trimmed.length !== 1 || trimmed[0].event !== 'new') {
    throw new Error('Self-test failed: retention trimming did not remove old entry.');
  }
}

const args = parseArgs(process.argv);

if (args.selfTest) {
  runSelfTest();
  console.log('Telemetry retention self-test passed.');
  process.exit(0);
}

if (!args.input) {
  console.error('Usage: telemetry_retention.js --input <file> [--output <file>]');
  process.exit(1);
}

const inputPath = path.resolve(args.input);
const raw = fs.readFileSync(inputPath, 'utf8');
const data = JSON.parse(raw);
if (!Array.isArray(data)) {
  console.error('Input must be a JSON array of entries.');
  process.exit(1);
}

const trimmed = trimTelemetry(data, args);
const outContent = JSON.stringify(trimmed, null, 2);

if (args.output) {
  fs.writeFileSync(path.resolve(args.output), outContent, 'utf8');
} else {
  process.stdout.write(outContent);
}
