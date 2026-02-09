#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = { root: process.cwd(), zip: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') out.root = argv[++i];
    else if (arg === '--zip') out.zip = argv[++i];
  }
  return out;
}

function exists(p) {
  return fs.existsSync(p);
}

function readJson(p) {
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function checkRoot(rootDir) {
  const required = [
    'index.html',
    'game.js',
    'style.css',
    'assets/zombies.json',
    'assets/tanks.json',
    'assets/decor.json',
    'assets/fence.json',
    'src/telemetry/telemetry.js',
    'src/flags/flags.js'
  ];

  const failures = [];
  required.forEach((rel) => {
    const p = path.join(rootDir, rel);
    if (!exists(p)) failures.push('Missing: ' + rel);
  });

  ['assets/zombies.json', 'assets/tanks.json', 'assets/decor.json', 'assets/fence.json'].forEach((rel) => {
    const p = path.join(rootDir, rel);
    if (exists(p)) {
      try { readJson(p); }
      catch (e) { failures.push('Invalid JSON: ' + rel + ' (' + e.message + ')'); }
    }
  });

  const indexPath = path.join(rootDir, 'index.html');
  if (exists(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8');
    if (html.indexOf('src/flags/flags.js') === -1) failures.push('index.html missing flags.js');
    if (html.indexOf('src/ui/adminFlags.js') === -1) failures.push('index.html missing adminFlags.js');
  }

  return failures;
}

function checkZip(zipPath) {
  if (!exists(zipPath)) return ['Missing zip: ' + zipPath];
  const stat = fs.statSync(zipPath);
  if (!stat.isFile() || stat.size <= 0) return ['Zip is empty: ' + zipPath];
  return [];
}

const args = parseArgs(process.argv);
let failures = [];

if (args.zip) failures = failures.concat(checkZip(path.resolve(args.zip)));
else failures = failures.concat(checkRoot(path.resolve(args.root)));

if (failures.length) {
  console.error('Health check failed:');
  failures.forEach((f) => console.error(' - ' + f));
  process.exit(1);
}

console.log('Health check passed.');
