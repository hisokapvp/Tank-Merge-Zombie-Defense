#!/usr/bin/env node
'use strict';
/**
 * _diag_real_exe.mjs — TEMP diagnostic harness (solo-pipeline-yandex-vk#6).
 * Launches the REAL packaged portable .exe with remote debugging + verbose
 * logging, connects over CDP, and reports renderer/console/load state.
 * This is NOT a surrogate: it spawns the exact .exe the user double-clicks.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EXE = process.argv[2] ||
  'D:\\Tank-Merge-Zombie-Defense\\dist\\native\\desktop\\win-portable\\Tank Merge Zombie Defense.exe';
const PORT = 9222;
const LOG = path.join(process.env.TEMP || '.', 'tmzd_real_exe.log');
const out = fs.createWriteStream(LOG, { flags: 'w' });

const result = {
  exe: EXE,
  exe_exists: fs.existsSync(EXE),
  launched: false,
  cdp_connected: false,
  page_url: null,
  ready_state: null,
  body_html_len: null,
  canvas_count: null,
  canvas_painted: null,
  has_window_game: null,
  game_keys: null,
  console_errors: [],
  log_entries: [],
  failed_requests: [],
  render_process_gone: false,
  evaluate_error: null,
  notes: [],
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

if (!result.exe_exists) {
  console.log(JSON.stringify({ ...result, fatal: 'exe-not-found' }, null, 2));
  process.exit(2);
}

const child = spawn(EXE, [
  `--remote-debugging-port=${PORT}`,
  '--enable-logging',
  '--v=1',
  '--no-sandbox',
], { stdio: ['ignore', 'pipe', 'pipe'] });
result.launched = true;

child.stdout.on('data', (d) => out.write('[stdout] ' + d));
child.stderr.on('data', (d) => out.write('[stderr] ' + d));
child.on('exit', (code, sig) => out.write(`\n[exit] code=${code} sig=${sig}\n`));

async function fetchTargets() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const j = await r.json();
      const page = j.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page;
    } catch (_) { /* not ready */ }
    await sleep(500);
  }
  return null;
}

let nextId = 1;
function cdp(ws, method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const onMsg = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (_) { return; }
      if (m.id === id) {
        ws.removeEventListener('message', onMsg);
        if (m.error) reject(new Error(m.error.message));
        else resolve(m.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}

async function main() {
  const page = await fetchTargets();
  if (!page) {
    result.notes.push('CDP /json/list never exposed a page target');
    finish(3);
    return;
  }
  result.page_url = page.url;
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  result.cdp_connected = true;

  ws.addEventListener('message', (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      const txt = (m.params.args || []).map((a) => a.value || a.description || a.type).join(' ');
      result.console_errors.push(`${m.params.type}: ${txt}`);
    }
    if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      if (e.level === 'error' || e.level === 'warning') {
        result.log_entries.push(`${e.level} [${e.source}] ${e.text} ${e.url || ''}`);
      }
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      result.console_errors.push('exception: ' + (d.exception && d.exception.description || d.text));
    }
    if (m.method === 'Network.loadingFailed') {
      result.failed_requests.push(`${m.params.type} ${m.params.errorText} ${m.params.requestId}`);
    }
    if (m.method === 'Inspector.targetCrashed') {
      result.render_process_gone = true;
    }
  });

  await cdp(ws, 'Runtime.enable');
  await cdp(ws, 'Log.enable');
  await cdp(ws, 'Network.enable');
  await cdp(ws, 'Page.enable');

  // Let the game boot.
  await sleep(7000);

  try {
    const expr = `(function(){
      var c = document.querySelectorAll('canvas');
      var painted = false;
      if (c.length) {
        try {
          var cv = c[0];
          painted = (cv.width > 0 && cv.height > 0);
        } catch(e) {}
      }
      return JSON.stringify({
        readyState: document.readyState,
        bodyLen: document.body ? document.body.innerHTML.length : -1,
        canvasCount: c.length,
        canvasPainted: painted,
        hasGame: !!window.Game,
        gameKeys: window.Game ? Object.keys(window.Game).slice(0,40) : [],
        title: document.title,
        scripts: document.scripts.length,
        location: location.href
      });
    })()`;
    const ev = await cdp(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true });
    if (ev.exceptionDetails) {
      result.evaluate_error = ev.exceptionDetails.text || JSON.stringify(ev.exceptionDetails);
    } else {
      const parsed = JSON.parse(ev.result.value);
      result.ready_state = parsed.readyState;
      result.body_html_len = parsed.bodyLen;
      result.canvas_count = parsed.canvasCount;
      result.canvas_painted = parsed.canvasPainted;
      result.has_window_game = parsed.hasGame;
      result.game_keys = parsed.gameKeys;
      result.page_url = parsed.location;
      result.notes.push('title=' + parsed.title + ' scripts=' + parsed.scripts);
    }
  } catch (e) {
    result.evaluate_error = String(e && e.message || e);
  }

  finish(0);
}

function finish(code) {
  out.end();
  try { child.kill(); } catch (_) {}
  setTimeout(() => {
    console.log('=== REAL EXE DIAGNOSTIC RESULT ===');
    console.log(JSON.stringify(result, null, 2));
    console.log('=== main/renderer log file: ' + LOG + ' ===');
    process.exit(code);
  }, 500);
}

main().catch((e) => { result.notes.push('harness-error: ' + String(e && e.message || e)); finish(1); });
