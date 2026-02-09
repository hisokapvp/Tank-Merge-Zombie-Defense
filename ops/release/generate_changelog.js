#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function parseArgs(argv) {
  const out = { out: null, limit: 50 };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') out.out = argv[++i];
    else if (arg === '--limit') out.limit = Number(argv[++i]) || 50;
  }
  return out;
}

function tryGitLog(limit) {
  try {
    const cmd = `git log -n ${limit} --pretty=format:%h|%ad|%s --date=short`;
    const raw = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
    if (!raw) return [];
    return raw.split('\n').map((line) => {
      const parts = line.split('|');
      return { hash: parts[0], date: parts[1], subject: parts.slice(2).join('|') };
    });
  } catch (_) {
    return [];
  }
}

function buildChangelog(commits) {
  const lines = [];
  lines.push('# Changelog');
  lines.push('');
  if (!commits.length) {
    lines.push('- No git history available.');
    return lines.join('\n');
  }
  commits.forEach((c) => {
    lines.push(`- ${c.date} ${c.hash} ${c.subject}`);
  });
  return lines.join('\n');
}

const args = parseArgs(process.argv);
const commits = tryGitLog(args.limit);
const content = buildChangelog(commits);

if (args.out) {
  const outPath = path.resolve(args.out);
  fs.writeFileSync(outPath, content, 'utf8');
} else {
  process.stdout.write(content);
}
