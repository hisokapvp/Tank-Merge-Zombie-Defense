// game.js.txt
// Tank Merger: Zombie Orbit (v3)
// Fixes requested:
// 1) If zombies look like simple blobs -> sprites not loaded; show status in HUD.
// 2) Make projectiles visible.
// 3) Tanks differ visually by level.
// 4) Projectiles & hit effects differ by level.
// 5) Reduce cell size.
// 6) Reduce tank size.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const ui = {
  coins: document.getElementById('coins'),
  zcount: document.getElementById('zcount'),
  spr: document.getElementById('spr'),
  buy: document.getElementById('buy'),
  buyCost: document.getElementById('buyCost'),
  boost: document.getElementById('boost'),
  boostState: document.getElementById('boostState'),
  tankInfo: document.getElementById('tankInfo'),
};

const BAL = {
  // Board 4x4 (smaller cells)
  rows: 4,
  cols: 4,
  cellW: 39,
  cellH: 30,
  cellGap: 4,
  boardPad: 6,

  buyCostLv1: 50,

  // Tanks
  dmgBase: 7,
  dmgMultPerLevel: 1.48,
  fireRateBase: 0.85,
  fireRateAddPerLevel: 0.075,
  rangeBase: 315,
  rangePerLevel: 10,

  // Zombie ring
  zombieTrackRadius: 295,
  zombieTrackWidth: 18,
  fenceRadius: 0,
  fenceWidth: 40,
  fenceKeepout: 6,
  zombieFencePush: 18,
  tankOrbitRadius: 210,
  tankOrbitSpeed: 0.55,
  tankTrackWidth: 12,
  zombieCountTarget: 50,
  zombieHpBase: 44,
  zombieHpVar: 0.22,
  omegaBase: 0.72,
  omegaVar: 0.18,
  zombieSwayAmp: 0.14,

  // Zombie visuals (walk + size)
  zombieScaleMul: 0.72,
  zombieBobAmp: 2.2,
  zombieBobSpeedMul: 7.0,
  zombieShadowW: 11,
  zombieShadowH: 5,
  zombieShadowY: 12,

  // Spawn from edge
  edgeSpawnRadius: 520,
  edgeJoinSpeed: 2.6,

  // Economy
  coinsPerKillBase: 2,

  // Boost
  boostDurationSec: 60,
  boostMult: 2,

  // FX
  maxParticles: 1600,
  maxDecals: 120,
};

const compact = true;
const muted = false;

const backgroundLayer = {
  canvas: null,
  ctx: null,
  ready: false,
};

let state = {
  coins: 120,
  cells: [],
  boardRect: {x:0,y:0,w:0,h:0},
  zombies: [],
  projectiles: [],
  impacts: [],     // rings + bolts
  decals: [],      // e.g., toxic pools
  particles: [],
  dragging: null,
  boostUntil: 0,
};

const center = { x: canvas.width/2, y: canvas.height/2 };
const nowSec = ()=>performance.now()/1000;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

// ---------- Sprite atlas loader (PNG + JSON) ----------
const ZombieSprites = {
  ready: false,
  error: '',
  atlasImg: null,
  types: [],
  async load(){
    try{
      const res = await fetch('assets/zombies.json', {cache:'no-store'});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const atlasPath = 'assets/' + (data.atlas || 'zombie_atlas.png');
      const img = await loadImage(atlasPath);

      this.types = (data.types || []).map(t => ({
        id: t.id || 'zombie',
        frame: t.frame || {x:0,y:0,w:64,h:64},
        anchor: t.anchor || {x:0.5,y:0.75},
        scale: t.scale ?? 1.0,
        hpMul: t.hpMul ?? 1.0,
        omegaMul: t.omegaMul ?? 1.0,
        rewardMul: t.rewardMul ?? 1.0,
        weight: t.weight ?? 1.0,
      }));
      if (!this.types.length) throw new Error('types[] empty');

      this.atlasImg = img;
      this.ready = true;
      this.error = '';
    }catch(e){
      this.ready = false;
      this.atlasImg = null;
      this.types = [];
      this.error = String(e);
    }
  },
  pickType(){
    if (!this.ready || !this.types.length) return null;
    // weighted random
    let sum = 0;
    for (const t of this.types) sum += t.weight;
    let r = Math.random() * sum;
    for (const t of this.types){
      r -= t.weight;
      if (r <= 0) return t;
    }
    return this.types[this.types.length-1];
  }
};

const TankSprites = {
  ready: false,
  error: '',
  config: null,
  cache: new Map(),
  async load(){
    try{
      const res = await fetch('assets/tanks.json', {cache:'no-store'});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const cfg = await res.json();
      this.config = cfg;

      const srcs = new Set();
      if (cfg?.default?.src) srcs.add('assets/' + cfg.default.src);
      for (const k of Object.keys(cfg?.levels || {})){
        const s = cfg.levels[k]?.src;
        if (s) srcs.add('assets/' + s);
      }

      for (const s of srcs){
        const img = await loadImage(s);
        this.cache.set(s, img);
      }

      this.ready = true;
      this.error = '';
    }catch(e){
      this.ready = false;
      this.error = String(e);
      this.config = null;
      this.cache.clear();
    }
  },
  pick(level){
    if (!this.ready || !this.config) return null;
    const cfg = this.config;

    const keys = Object.keys(cfg.levels || {})
      .map(n=>parseInt(n,10))
      .filter(n=>Number.isFinite(n))
      .sort((a,b)=>a-b);

    let chosen = null;
    for (const k of keys){
      if (k <= level) chosen = cfg.levels[String(k)];
    }
    if (!chosen) chosen = cfg.default || null;
    if (!chosen?.src) return null;

    const full = 'assets/' + chosen.src;
    const img = this.cache.get(full);
    if (!img) return null;

    return {
      img,
      anchor: chosen.anchor || cfg.default?.anchor || {x:0.5,y:0.55},
      scale: chosen.scale ?? cfg.default?.scale ?? 1.0,
    };
  }
};

function loadImage(url){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = ()=>resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// ---------- Board ----------
function initBoard(){
  const totalW = BAL.cols*BAL.cellW + (BAL.cols-1)*BAL.cellGap + BAL.boardPad*2;
  const totalH = BAL.rows*BAL.cellH + (BAL.rows-1)*BAL.cellGap + BAL.boardPad*2;
  const x0 = center.x - totalW/2;
  const y0 = center.y - totalH/2;

  state.cells = [];
  let i = 0;
  for (let r=0;r<BAL.rows;r++){
    for (let c=0;c<BAL.cols;c++){
      const x = x0 + BAL.boardPad + c*(BAL.cellW+BAL.cellGap);
      const y = y0 + BAL.boardPad + r*(BAL.cellH+BAL.cellGap);
      state.cells.push({ i, r, c, x, y, w:BAL.cellW, h:BAL.cellH, tank:null });
      i++;
    }
  }
  state.boardRect = { x:x0, y:y0, w:totalW, h:totalH };

  const hangarRadius = Math.max(totalW, totalH) / 2 + 22;
  BAL.tankOrbitRadius = Math.max(120, hangarRadius + 26);
  BAL.fenceRadius = BAL.tankOrbitRadius + 26;
  BAL.zombieTrackRadius = BAL.fenceRadius + 26;
  BAL.zombieTrackWidth = 16;

  buildBackground();
}

function buildBackground(){
  const bg = document.createElement('canvas');
  bg.width = canvas.width;
  bg.height = canvas.height;
  const bctx = bg.getContext('2d');

  const grad = bctx.createLinearGradient(0, 0, 0, bg.height);
  grad.addColorStop(0, '#2f7a3d');
  grad.addColorStop(0.5, '#266f36');
  grad.addColorStop(1, '#6b4a2c');
  bctx.fillStyle = grad;
  bctx.fillRect(0, 0, bg.width, bg.height);

  for (let y = 0; y < bg.height; y += 34){
    for (let x = 0; x < bg.width; x += 42){
      const n = seededNoise(x, y);
      const w = 60 + n * 20;
      const h = 40 + n * 18;
      const rx = x + n * 18;
      const ry = y + n * 16;
      bctx.fillStyle = n > 0.52 ? 'rgba(112,77,46,.55)' : 'rgba(47,103,57,.35)';
      bctx.beginPath();
      bctx.ellipse(rx, ry, w * 0.5, h * 0.5, n * Math.PI, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  for (let i = 0; i < 1800; i++){
    const x = (i * 53) % bg.width;
    const y = (i * 91) % bg.height;
    const n = seededNoise(x * 1.3, y * 1.7);
    bctx.fillStyle = n > 0.5 ? 'rgba(84,141,75,.55)' : 'rgba(92,64,39,.5)';
    bctx.fillRect(x, y, 2 + n * 2, 2 + n * 2);
  }

  for (let i = 0; i < 520; i++){
    const x = (i * 37) % bg.width;
    const y = (i * 71) % bg.height;
    const n = seededNoise(x * 2.1, y * 1.9);
    bctx.strokeStyle = `rgba(33,82,40,${0.28 + n * 0.3})`;
    bctx.lineWidth = 1;
    bctx.beginPath();
    bctx.moveTo(x, y);
    bctx.lineTo(x + 6 + n * 8, y - 6 - n * 6);
    bctx.stroke();
  }

  backgroundLayer.canvas = bg;
  backgroundLayer.ctx = bctx;
  backgroundLayer.ready = true;
}

function makeTank(level, onTrack = false){
  return { id: crypto.randomUUID(), level, cooldown: 0, onTrack };
}

function tryBuyTank(){
  if (state.coins < BAL.buyCostLv1) return;
  const empty = state.cells.find(c=>!c.tank);
  if (!empty) return;
  state.coins -= BAL.buyCostLv1;
  empty.tank = makeTank(1, false);
  popText(empty.x+empty.w/2, empty.y+empty.h/2, '+Tank', '#7dffb2');
}

function mergeCells(fromIdx, toIdx){
  if (fromIdx === toIdx) return false;
  const a = state.cells[fromIdx];
  const b = state.cells[toIdx];
  if (!a.tank || !b.tank) return false;
  if (a.tank.level !== b.tank.level) return false;

  const lvl = a.tank.level + 1;
  b.tank = makeTank(lvl, false);
  a.tank = null;

  burst(b.x+b.w/2, b.y+b.h/2, 20, 'rgba(125,255,178,.85)');
  popText(b.x+b.w/2, b.y+b.h/2-16, `Lv${lvl}!`, '#eaf1ff');
  return true;
}

// ---------- Economy / boost ----------
function incomeMult(){
  return (nowSec() < state.boostUntil) ? BAL.boostMult : 1;
}

function tankStats(level){
  const dmg = BAL.dmgBase * Math.pow(BAL.dmgMultPerLevel, level-1);
  const fr = BAL.fireRateBase + BAL.fireRateAddPerLevel*(level-1);
  const range = BAL.rangeBase + BAL.rangePerLevel*(level-1);
  const prof = projectileProfile(level);
  // Tie AOE to profile but also allow slight growth with level.
  const aoe = clamp(prof.aoeBase + prof.aoePerLevel*(level-1), prof.aoeMin, prof.aoeMax);
  return { dmg, fr, range, aoe, prof };
}

function projectileProfile(level){
  // Different projectile & impact styles by level bands.
  // 1-3: AP shell (small aoe)
  // 4-6: HE (bigger aoe + bright explosion)
  // 7-9: Toxic (aoe + poison pool DOT)
  // 10+: Tesla (aoe + chain lightning)
  if (level <= 3) return {
    kind:'ap',
    speed: 820,
    r: 4.0,
    color:'#ffd36b',
    glow:'rgba(255,211,107,.25)',
    trail:'rgba(255,211,107,.12)',
    aoeBase: 18,
    aoePerLevel: 2.4,
    aoeMin: 16,
    aoeMax: 40,
  };
  if (level <= 6) return {
    kind:'he',
    speed: 740,
    r: 5.6,
    color:'#ff7a6b',
    glow:'rgba(255,122,107,.26)',
    trail:'rgba(255,122,107,.12)',
    aoeBase: 28,
    aoePerLevel: 3.2,
    aoeMin: 24,
    aoeMax: 58,
  };
  if (level <= 9) return {
    kind:'toxic',
    speed: 700,
    r: 5.0,
    color:'#b8ff3b',
    glow:'rgba(184,255,59,.22)',
    trail:'rgba(184,255,59,.10)',
    aoeBase: 30,
    aoePerLevel: 3.4,
    aoeMin: 26,
    aoeMax: 64,
    poolLife: 3.6,
    poolDpsMul: 0.20,
  };
  return {
    kind:'tesla',
    speed: 900,
    r: 4.6,
    color:'#8bd3ff',
    glow:'rgba(139,211,255,.25)',
    trail:'rgba(139,211,255,.10)',
    aoeBase: 26,
    aoePerLevel: 2.8,
    aoeMin: 26,
    aoeMax: 66,
    chainRange: 84,
    chainJumps: 3,
    chainMul: 0.45,
  };
}

// ---------- Zombies (constant population) ----------
function edgeSpawnR(){
  return Math.max(BAL.edgeSpawnRadius, Math.max(canvas.width, canvas.height)*0.62);
}

function makeZombie(fromEdge=true){
  const t = ZombieSprites.pickType();

  const theta = Math.random() * Math.PI*2;
  const dir = Math.random() < 0.5 ? -1 : 1;

  const baseHp = BAL.zombieHpBase * (1 + (Math.random()*2-1)*BAL.zombieHpVar);
  const baseOmega = (BAL.omegaBase + (Math.random()*2-1)*BAL.omegaVar) * dir;

  const targetR = BAL.zombieTrackRadius + (Math.random()*2-1)*BAL.zombieTrackWidth;
  const r = fromEdge ? edgeSpawnR() : targetR;

  return {
    id: crypto.randomUUID(),
    type: t,
    theta,
    anchorTheta: theta,
    swayPhase: Math.random() * Math.PI * 2,
    swaySpeed: (0.6 + Math.random() * 0.8) * (t?.omegaMul ?? 1.0),
    r,
    targetR,
    omega: baseOmega * (t?.omegaMul ?? 1.0),
    hp: baseHp * (t?.hpMul ?? 1.0),
    maxHp: baseHp * (t?.hpMul ?? 1.0),
    rewardMul: (t?.rewardMul ?? 1.0),
    anim: Math.random()*10,
  };
}

function ensureZombieCount(){
  while (state.zombies.length < BAL.zombieCountTarget) state.zombies.push(makeZombie(true));
  if (state.zombies.length > BAL.zombieCountTarget) state.zombies.length = BAL.zombieCountTarget;
}

function zombiePos(z){
  return {
    x: center.x + Math.cos(z.theta) * z.r,
    y: center.y + Math.sin(z.theta) * z.r,
  };
}

function stepZombies(dt){
  for (const z of state.zombies){
    z.swayPhase += dt * z.swaySpeed;
    z.theta = z.anchorTheta + Math.sin(z.swayPhase) * BAL.zombieSwayAmp;

    // Join ring from edge
    const t = 1 - Math.exp(-dt * BAL.edgeJoinSpeed);
    z.r = z.r + (z.targetR - z.r) * t;
    z.r -= BAL.zombieFencePush * dt;

    const fenceLimit = BAL.fenceRadius + BAL.fenceKeepout;
    if (z.r < fenceLimit) z.r = fenceLimit;

    const sp = Math.abs(z.omega) * BAL.zombieBobSpeedMul;
    z.anim += dt * (2.2 + sp);
  }
}

// ---------- Combat: visible projectiles ----------
function stepTanks(dt){
  for (const cell of state.cells){
    const tank = cell.tank;
    if (!tank || !tank.onTrack) continue;

    tank.cooldown = Math.max(0, tank.cooldown - dt);
    if (tank.cooldown > 0) continue;

    const s = tankStats(tank.level);

    // pick nearest zombie in range
    let best = null;
    let bestD = Infinity;
    const pos = tankOrbitPos(cell, nowSec());
    const sx = pos.x;
    const sy = pos.y;

    for (const z of state.zombies){
      const p = zombiePos(z);
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d <= s.range && d < bestD){ best = z; bestD = d; }
    }
    if (!best) continue;

    tank.cooldown = 1 / s.fr;

    const tp = zombiePos(best);
    spawnProjectile({
      fromX: sx,
      fromY: sy,
      toZombieId: best.id,
      toX: tp.x,
      toY: tp.y,
      level: tank.level,
      dmg: s.dmg,
      aoe: s.aoe,
      prof: s.prof,
    });

    burst(sx, sy, 5, 'rgba(255,255,255,.55)');
  }
}

function tankOrbitPos(cell, timeSec){
  const total = BAL.rows * BAL.cols;
  const offset = (cell.i / total) * Math.PI * 2;
  const angle = timeSec * BAL.tankOrbitSpeed + offset;
  return {
    x: center.x + Math.cos(angle) * BAL.tankOrbitRadius,
    y: center.y + Math.sin(angle) * BAL.tankOrbitRadius,
  };
}

function spawnProjectile(p){
  state.projectiles.push({
    x: p.fromX,
    y: p.fromY,
    toX: p.toX,
    toY: p.toY,
    toZombieId: p.toZombieId,
    speed: p.prof.speed,
    r: p.prof.r,
    color: p.prof.color,
    glow: p.prof.glow,
    trail: p.prof.trail,
    kind: p.prof.kind,
    dmg: p.dmg,
    aoe: p.aoe,
    level: p.level,
    // keep profile so impact can read extra params
    prof: p.prof,
    life: 2.0,
  });
}

function stepProjectiles(dt){
  const zmap = new Map(state.zombies.map(z => [z.id, z]));
  const next = [];

  for (const b of state.projectiles){
    b.life -= dt;
    if (b.life <= 0) continue;

    // update target point (moving zombie)
    const z = zmap.get(b.toZombieId);
    if (z){
      const p = zombiePos(z);
      b.toX = p.x;
      b.toY = p.y;
    }

    const dx = b.toX - b.x;
    const dy = b.toY - b.y;
    const dist = Math.hypot(dx,dy) || 1;
    const vx = dx/dist;
    const vy = dy/dist;

    b.x += vx * b.speed * dt;
    b.y += vy * b.speed * dt;

    // trail particles
    particle(b.x - vx*8, b.y - vy*8, Math.max(1.5, b.r*0.55), b.trail, 0.25);

    if (dist < Math.max(10, b.r*2.2)){
      impactAt(b.x, b.y, b);
      continue;
    }

    next.push(b);
  }

  state.projectiles = next;
}

function impactAt(x,y,b){
  // Base AOE damage
  for (const z of state.zombies){
    const p = zombiePos(z);
    const d = Math.hypot(p.x-x, p.y-y);
    if (d <= b.aoe){
      const falloff = 0.55 + 0.45*(1 - d/b.aoe);
      z.hp -= b.dmg * falloff;
    }
  }

  // Extra effects per kind
  if (b.kind === 'toxic'){
    addDecal({
      kind:'pool',
      x, y,
      r: b.aoe*0.70,
      life: b.prof?.poolLife ?? 3.6,
      dps: b.dmg * (b.prof?.poolDpsMul ?? 0.20),
      color:'rgba(184,255,59,.16)'
    });
  }

  if (b.kind === 'tesla'){
    chainLightning(x,y,b);
  }

  // Visual impact rings
  state.impacts.push({x,y,r:0,maxR:b.aoe,life:0.30,max:0.30,kind:b.kind});
  burst(x,y, (b.kind==='he'?30:22), b.glow);
}

function chainLightning(x,y,b){
  const range = b.prof?.chainRange ?? 84;
  const jumps = b.prof?.chainJumps ?? 3;
  const mul = b.prof?.chainMul ?? 0.45;

  let curX = x, curY = y;
  const hit = new Set();

  for (let i=0;i<jumps;i++){
    let best = null;
    let bestD = Infinity;

    for (const z of state.zombies){
      if (hit.has(z.id)) continue;
      const p = zombiePos(z);
      const d = Math.hypot(p.x-curX, p.y-curY);
      if (d <= range && d < bestD){ best = z; bestD = d; }
    }
    if (!best) break;

    hit.add(best.id);
    const p = zombiePos(best);

    // visual bolt
    state.impacts.push({x:curX,y:curY,tx:p.x,ty:p.y,life:0.10,max:0.10,kind:'bolt'});

    best.hp -= b.dmg * mul;
    curX = p.x;
    curY = p.y;
  }
}

// ---------- Decals (persistent effects) ----------
function addDecal(d){
  if (state.decals.length > BAL.maxDecals) state.decals.shift();
  state.decals.push({
    kind: d.kind,
    x: d.x,
    y: d.y,
    r: d.r,
    life: d.life,
    max: d.life,
    dps: d.dps || 0,
    color: d.color || 'rgba(125,255,178,.14)',
  });
}

function stepDecals(dt){
  const next = [];
  for (const d of state.decals){
    d.life -= dt;
    if (d.life <= 0) continue;

    if (d.kind === 'pool' && d.dps > 0){
      // Apply DOT inside pool
      for (const z of state.zombies){
        const p = zombiePos(z);
        const dist = Math.hypot(p.x-d.x, p.y-d.y);
        if (dist <= d.r){
          z.hp -= d.dps * dt;
        }
      }
    }

    next.push(d);
  }
  state.decals = next;
}

// ---------- Kills / respawn ----------
function cleanupKills(){
  const mult = incomeMult();
  const alive = [];
  for (const z of state.zombies){
    if (z.hp <= 0){
      state.coins += BAL.coinsPerKillBase * z.rewardMul * mult;
      const p = zombiePos(z);
      burst(p.x, p.y, 18, 'rgba(125,255,178,.18)');
    } else alive.push(z);
  }
  state.zombies = alive;
  ensureZombieCount();
}

// ---------- Particles ----------
function particle(x,y,r,color,life){
  if (state.particles.length > BAL.maxParticles) return;
  state.particles.push({x,y,r,color,life,max:life,vx:(Math.random()*2-1)*40,vy:(Math.random()*2-1)*40});
}

function burst(x,y,count,color){
  for (let i=0;i<count;i++) particle(x,y,Math.random()*2.6+1.0,color,Math.random()*0.30+0.14);
}

function popText(x,y,text,color){
  state.particles.push({kind:'text',x,y,text,color,life:0.95,max:0.95,vy:-26});
}

function stepParticles(dt){
  const next = [];
  for (const p of state.particles){
    p.life -= dt;
    if (p.life <= 0) continue;
    if (p.kind === 'text'){
      p.y += (p.vy||-20)*dt;
      next.push(p);
      continue;
    }
    p.x += p.vx*dt;
    p.y += p.vy*dt;
    p.r *= 0.985;
    next.push(p);
  }
  state.particles = next;
}

// ---------- UI ----------
function updateUI(){
  ui.coins.textContent = Math.floor(state.coins);
  ui.zcount.textContent = `${state.zombies.length}/${BAL.zombieCountTarget}`;
  ui.buyCost.textContent = BAL.buyCostLv1;

  const left = state.boostUntil - nowSec();
  ui.boostState.textContent = left > 0 ? `x${BAL.boostMult} ${Math.ceil(left)}s` : '—';

  // show both sprite systems status
  ui.spr.textContent =
    `${ZombieSprites.ready ? 'Z:OK' : 'Z:OFF'} ${TankSprites?.ready ? 'T:OK' : 'T:OFF'}`;

  const tanks = state.cells.filter(c=>c.tank).map(c=>c.tank.level).sort((a,b)=>a-b);
  const maxL = tanks.length ? Math.max(...tanks) : 0;
  ui.tankInfo.textContent = `Count: ${tanks.length}/${BAL.rows*BAL.cols}\nMax level: ${maxL}\nLevels: ${tanks.join(', ') || '-'}`;

  ui.buy.disabled = state.coins < BAL.buyCostLv1 || !state.cells.some(c=>!c.tank);
}

// ---------- Input ----------
function getPointerPos(evt){
  const r = canvas.getBoundingClientRect();
  const x = (evt.clientX - r.left) * (canvas.width / r.width);
  const y = (evt.clientY - r.top) * (canvas.height / r.height);
  return {x,y};
}

function cellAt(x,y){
  for (const c of state.cells){
    if (x>=c.x && x<=c.x+c.w && y>=c.y && y<=c.y+c.h) return c;
  }
  return null;
}

canvas.addEventListener('pointerdown', (e)=>{
  const p = getPointerPos(e);
  const trackCell = tankOnTrackAt(p.x, p.y, nowSec());
  if (trackCell !== null){
    const trackTank = state.cells[trackCell].tank;
    trackTank.onTrack = false;
    trackTank.cooldown = 0;
    popText(p.x, p.y, 'Hangar', '#eaf1ff');
    return;
  }
  const c = cellAt(p.x, p.y);
  if (!c || !c.tank) return;
  if (c.tank.onTrack){
    c.tank.onTrack = false;
    c.tank.cooldown = 0;
    popText(p.x, p.y, 'Hangar', '#eaf1ff');
    return;
  }
  state.dragging = {
    cellIndex: c.i,
    tank: c.tank,
    dx: p.x - (c.x+c.w/2),
    dy: p.y - (c.y+c.h/2),
    x: p.x, y: p.y,
    startX: p.x,
    startY: p.y,
    moved: false,
  };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e)=>{
  if (!state.dragging) return;
  const p = getPointerPos(e);
  state.dragging.x = p.x;
  state.dragging.y = p.y;
  const dx = p.x - state.dragging.startX;
  const dy = p.y - state.dragging.startY;
  if (Math.hypot(dx, dy) > 6) state.dragging.moved = true;
});

canvas.addEventListener('pointerup', (e)=>{
  if (!state.dragging) return;
  const p = getPointerPos(e);
  const target = cellAt(p.x, p.y);

  const from = state.cells[state.dragging.cellIndex];
  from.tank = state.dragging.tank;

  if (!state.dragging.moved){
    from.tank.onTrack = true;
    popText(from.x+from.w/2, from.y+from.h/2, 'Track!', '#bfe3ff');
  } else if (target){
    const merged = mergeCells(from.i, target.i);
    if (!merged && !target.tank){
      target.tank = from.tank;
      from.tank = null;
    }
  }
  state.dragging = null;
});

ui.buy.addEventListener('click', ()=> tryBuyTank());
ui.boost.addEventListener('click', ()=> { state.boostUntil = nowSec() + BAL.boostDurationSec; });

// ---------- Render ----------
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  drawBackground();
  drawTrack();
  drawZombieFence();
  drawTankTrack();
  drawBoard();
  drawOrbitingTanks();
  drawDecals();
  drawZombies();
  drawProjectiles();
  drawImpacts();
  drawParticles();

  // If sprites failed to load, show a small hint on canvas
  if (!ZombieSprites.ready){
    drawHint('Sprites OFF (assets/zombies.json).');
  }
}

function drawBackground(){
  if (backgroundLayer.ready && backgroundLayer.canvas){
    ctx.drawImage(backgroundLayer.canvas, 0, 0);
    return;
  }
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0, '#2f7a3d');
  g.addColorStop(1, '#6b4a2c');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

function drawTrack(){
  ctx.save();
  ctx.translate(center.x, center.y);

  ctx.beginPath();
  ctx.arc(0,0,BAL.zombieTrackRadius,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(110,168,255,.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0,0,BAL.zombieTrackRadius + BAL.zombieTrackWidth,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(125,255,178,.07)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0,0,BAL.zombieTrackRadius - BAL.zombieTrackWidth,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(125,255,178,.06)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function drawTankTrack(){
  ctx.save();
  ctx.translate(center.x, center.y);

  ctx.beginPath();
  ctx.arc(0,0,BAL.tankOrbitRadius,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(255,140,140,.30)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0,0,BAL.tankOrbitRadius + BAL.tankTrackWidth,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0,0,BAL.tankOrbitRadius - BAL.tankTrackWidth,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(0,0,0,.16)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function drawZombieFence(){
  const r = BAL.fenceRadius;
  ctx.save();
  ctx.translate(center.x, center.y);

  ctx.strokeStyle = 'rgba(235, 208, 140, .5)';
  ctx.lineWidth = BAL.fenceWidth;
  ctx.beginPath();
  ctx.arc(0,0,r,0,Math.PI*2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0,0,0,.28)';
  ctx.lineWidth = BAL.fenceWidth * 0.35;
  ctx.beginPath();
  ctx.arc(0,0,r-5,0,Math.PI*2);
  ctx.stroke();

  const posts = 40;
  const postScale = BAL.fenceWidth / 4;
  for (let i=0;i<posts;i++){
    const a = (i/posts) * Math.PI*2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = 'rgba(255, 228, 170, .5)';
    ctx.strokeStyle = 'rgba(0,0,0,.22)';
    ctx.lineWidth = 1.5 * postScale;
    rr(ctx, -3 * postScale, -10 * postScale, 6 * postScale, 18 * postScale, 2 * postScale);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawFence(br){
  // simple fence around hangar (visual only)
  ctx.save();

  const pad = 8;
  const x0 = br.x + pad, y0 = br.y + pad;
  const x1 = br.x + br.w - pad, y1 = br.y + br.h - pad;

  // posts
  ctx.fillStyle = 'rgba(255, 219, 140, .22)';
  ctx.strokeStyle = 'rgba(0,0,0,.18)';
  ctx.lineWidth = 2;

  const step = 22;
  for (let x=x0; x<=x1; x+=step){
    rr(ctx, x-4, y0-10, 8, 14, 3); ctx.fill(); ctx.stroke();
    rr(ctx, x-4, y1-4, 8, 14, 3); ctx.fill(); ctx.stroke();
  }
  for (let y=y0; y<=y1; y+=step){
    rr(ctx, x0-10, y-4, 14, 8, 3); ctx.fill(); ctx.stroke();
    rr(ctx, x1-4, y-4, 14, 8, 3); ctx.fill(); ctx.stroke();
  }

  // rails
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = 'rgba(255, 219, 140, .18)';
  ctx.lineWidth = 4;

  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); ctx.stroke();

  ctx.restore();
}

function drawBoard(){
  const br = state.boardRect;
  ctx.save();

  ctx.fillStyle = 'rgba(8,12,22,.66)';
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 1;
  rr(ctx, br.x, br.y, br.w, br.h, 16);
  ctx.fill();
  ctx.stroke();

  drawFence(br);

  for (const c of state.cells){
    const hovered = state.dragging && cellAt(state.dragging.x, state.dragging.y)?.i === c.i;

    rr(ctx, c.x, c.y, c.w, c.h, 10);
    ctx.fillStyle = hovered ? 'rgba(110,168,255,.14)' : 'rgba(255,255,255,.05)';
    ctx.fill();
    ctx.strokeStyle = hovered ? 'rgba(110,168,255,.28)' : 'rgba(255,255,255,.10)';
    ctx.stroke();

    if (c.tank){
      drawTankSlot(c);
    }
  }

  if (state.dragging){
    drawTank(
      state.dragging.x - state.dragging.dx,
      state.dragging.y - state.dragging.dy,
      state.dragging.tank.level,
      true
    );
  }

  ctx.restore();
}

function drawTankSlot(cell){
  const cx = cell.x + cell.w/2;
  const cy = cell.y + cell.h/2;
  ctx.save();
  ctx.fillStyle = cell.tank.onTrack ? 'rgba(10,12,16,.38)' : 'rgba(0,0,0,.30)';
  rr(ctx, cx-14, cy-10, 28, 20, 8);
  ctx.fill();
  ctx.fillStyle = cell.tank.onTrack ? 'rgba(234,241,255,.5)' : '#eaf1ff';
  ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Lv${cell.tank.level}`, cx, cy);
  ctx.restore();
}

function drawOrbitingTanks(){
  const t = nowSec();
  for (const c of state.cells){
    if (!c.tank || !c.tank.onTrack) continue;
    if (state.dragging && state.dragging.cellIndex === c.i) continue;
    const pos = tankOrbitPos(c, t);
    drawTank(pos.x, pos.y, c.tank.level);
  }
}

function drawTank(x,y,level,ghost=false){
  // Try sprite-based tanks if assets/tanks.json exists
  const spr = TankSprites?.pick?.(level);
  if (spr){
    ctx.save();
    ctx.translate(x,y);
    ctx.globalAlpha = ghost ? 0.78 : 1;
    if (muted){
      ctx.filter = 'grayscale(1) brightness(0.75)';
      ctx.globalAlpha *= 0.6;
    }

    const baseScale = compact ? 0.065 : 0.085;            // tuned for typical PNG sizes
    const levelScale = 1.0 + Math.min(0.20, level*0.010);
    const s = baseScale * levelScale * (spr.scale ?? 1.0);

    const w = spr.img.width * s;
    const h = spr.img.height * s;

    ctx.drawImage(
      spr.img,
      -w * (spr.anchor?.x ?? 0.5),
      -h * (spr.anchor?.y ?? 0.55),
      w, h
    );

    // level badge (same as vector)
    const tier = Math.floor((level-1)/3);
    const badge = ['rgba(0,0,0,.35)','rgba(0,0,0,.35)','rgba(110,168,255,.22)','rgba(125,255,178,.22)','rgba(185,139,255,.22)'][clamp(tier,0,4)];
    ctx.fillStyle = badge;
    rr(ctx, -16, 6, 32, 16, 8);
    ctx.fill();
    ctx.fillStyle = '#eaf1ff';
    ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Lv${level}`, 0, 14);

    ctx.restore();
    return;
  }

  // Fallback: vector tank (smaller)
  const baseScale = compact ? 0.56 : 0.72;
  const levelScale = 1.0 + Math.min(0.20, level*0.010);
  const scale = baseScale * levelScale;

  ctx.save();
  ctx.translate(x,y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = ghost ? 0.78 : 1;
  if (muted){
    ctx.globalAlpha *= 0.6;
  }

  const tier = Math.floor((level-1)/3);
  const hull = ['#b83232','#c63a3a','#d14646','#e05a5a','#f07171'][clamp(tier,0,4)];
  const edge = 'rgba(255,255,255,.22)';

  // Silhouette differences by tier
  const turretR = 10 + clamp(tier,0,4)*1.4;
  const barrelW = 22 + clamp(tier,0,4)*3.2;
  const doubleBarrel = tier >= 3;

  // tracks
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  rr(ctx, -30, -16, 60, 14, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  for (let i=-24;i<=24;i+=8) ctx.fillRect(i, -14, 4, 10);

  // hull
  ctx.fillStyle = hull;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  rr(ctx, -24, -28, 48, 24, 9);
  ctx.fill();
  ctx.stroke();

  // armor plates
  if (tier >= 2){
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    rr(ctx, -22, -26, 18, 6, 3);
    rr(ctx, 4, -26, 18, 6, 3);
    ctx.fill();
  }

  // turret
  ctx.beginPath();
  ctx.arc(0,-20,turretR,0,Math.PI*2);
  ctx.fillStyle = shade(hull, -18);
  ctx.fill();
  ctx.stroke();

  // barrel
  ctx.save();
  ctx.translate(6,-22);
  ctx.rotate(-0.06);
  ctx.fillStyle = shade(hull, -30);
  if (doubleBarrel){
    rr(ctx, 0, -5, barrelW, 4, 2);
    rr(ctx, 0, 1, barrelW, 4, 2);
  } else {
    rr(ctx, 0, -3, barrelW, 6, 3);
  }
  ctx.fill();
  ctx.restore();

  // level badge
  const badge = ['rgba(0,0,0,.35)','rgba(0,0,0,.35)','rgba(110,168,255,.22)','rgba(125,255,178,.22)','rgba(185,139,255,.22)'][clamp(tier,0,4)];
  ctx.fillStyle = badge;
  rr(ctx, -16, 1, 32, 16, 8);
  ctx.fill();

  ctx.fillStyle = '#eaf1ff';
  ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Lv${level}`, 0, 9);

  // glow for high tier
  if (tier >= 3){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(185,139,255,.22)';
    ctx.lineWidth = 2;
    rr(ctx, -26, -30, 52, 26, 10);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawZombies(){
  for (const z of state.zombies){
    const p = zombiePos(z);
    if (ZombieSprites.ready && ZombieSprites.atlasImg && z.type){
      drawZombieSprite(p.x, p.y, z);
    } else {
      drawZombieFallback(p.x, p.y, z);
    }
  }
}

function drawZombieSprite(x,y,z){
  const img = ZombieSprites.atlasImg;
  const t = z.type;
  const f = t.frame;
  const a = t.anchor;

  const scale = (t.scale ?? 1.0) * BAL.zombieScaleMul;
  const w = f.w * scale;
  const h = f.h * scale;

  const bob = Math.sin(z.anim || 0) * BAL.zombieBobAmp;
  const face = z.theta + (z.omega >= 0 ? Math.PI/2 : -Math.PI/2);

  // shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.20)';
  ctx.beginPath();
  ctx.ellipse(x, y + BAL.zombieShadowY, BAL.zombieShadowW*scale, BAL.zombieShadowH*scale, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // body (rotated + bob)
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(face);

  ctx.drawImage(img, f.x, f.y, f.w, f.h, -w * a.x, -h * a.y, w, h);
  ctx.restore();

  // HP bar (not rotated)
  const hp01 = clamp(z.hp / z.maxHp, 0, 1);
  const topY = (y + bob) - h * a.y;
  const bw = 26, bh = 4;
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(x - bw/2, topY - 10, bw, bh);
  ctx.fillStyle = hp01 > 0.45 ? '#7dffb2' : '#ff7a6b';
  ctx.fillRect(x - bw/2, topY - 10, bw*hp01, bh);
}

function drawZombieFallback(x,y,z){
  const bob = Math.sin(z.anim || 0) * BAL.zombieBobAmp;
  const face = z.theta + (z.omega >= 0 ? Math.PI/2 : -Math.PI/2);
  const s = BAL.zombieScaleMul;

  // shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.20)';
  ctx.beginPath();
  ctx.ellipse(x, y + BAL.zombieShadowY, BAL.zombieShadowW*s, BAL.zombieShadowH*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(face);
  ctx.scale(s, s);

  // ragged head
  ctx.fillStyle = 'rgba(60, 190, 120, .95)';
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-12, -6);
  ctx.quadraticCurveTo(-2, -20, 10, -14);
  ctx.quadraticCurveTo(20, -6, 12, 8);
  ctx.quadraticCurveTo(4, 20, -10, 14);
  ctx.quadraticCurveTo(-22, 8, -12, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // eyes
  ctx.fillStyle = 'rgba(0,0,0,.62)';
  ctx.fillRect(-5, -6, 2, 2);
  ctx.fillRect(3, -7, 2, 2);

  // mouth
  ctx.strokeStyle = 'rgba(0,0,0,.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, 2);
  ctx.lineTo(6, 3);
  ctx.stroke();

  ctx.restore();

  // HP bar
  const hp01 = clamp(z.hp / z.maxHp, 0, 1);
  const bw = 24, bh = 4;
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(x - bw/2, (y + bob) - 26*s, bw, bh);
  ctx.fillStyle = hp01 > 0.45 ? '#7dffb2' : '#ff7a6b';
  ctx.fillRect(x - bw/2, (y + bob) - 26*s, bw*hp01, bh);
}

function drawProjectiles(){
  for (const b of state.projectiles){
    // glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = b.glow;
    ctx.beginPath();
    ctx.arc(b.x,b.y,b.r*2.2,0,Math.PI*2);
    ctx.fill();
    ctx.restore();

    // core
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.fill();

    // small shape hint by kind
    if (b.kind === 'ap'){
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(b.x-1, b.y-4, 2, 8);
    }
    if (b.kind === 'he'){
      ctx.strokeStyle = 'rgba(255,255,255,.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x,b.y,b.r+2,0,Math.PI*2);
      ctx.stroke();
    }
    if (b.kind === 'tesla'){
      ctx.strokeStyle = 'rgba(139,211,255,.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x-6, b.y);
      ctx.lineTo(b.x+6, b.y);
      ctx.stroke();
    }
  }
}

function drawImpacts(){
  for (const fx of state.impacts){
    const t = fx.life / fx.max;

    if (fx.kind === 'bolt'){
      ctx.save();
      ctx.globalAlpha = t;
      ctx.strokeStyle = 'rgba(139,211,255,.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx.x, fx.y);
      const mx = (fx.x + fx.tx)/2;
      const my = (fx.y + fx.ty)/2;
      ctx.lineTo(mx + (Math.random()*2-1)*8, my + (Math.random()*2-1)*8);
      ctx.lineTo(fx.tx, fx.ty);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const col = fx.kind === 'toxic' ? 'rgba(184,255,59,' : (fx.kind === 'he' ? 'rgba(255,122,107,' : 'rgba(255,211,107,');

    ctx.strokeStyle = `${col}${0.22*t})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI*2);
    ctx.stroke();

    ctx.strokeStyle = `${col}${0.10*t})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, fx.r*0.72, 0, Math.PI*2);
    ctx.stroke();

    ctx.restore();
  }
}

function drawDecals(){
  for (const d of state.decals){
    const t = d.life / d.max;
    ctx.save();
    ctx.globalAlpha = 0.8 * t;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles(){
  for (const p of state.particles){
    const t = p.life / p.max;
    if (p.kind === 'text'){
      ctx.save();
      ctx.globalAlpha = clamp(t,0,1);
      ctx.fillStyle = p.color;
      ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.globalAlpha = clamp(t,0,1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHint(text){
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  rr(ctx, 14, 14, 360, 34, 12);
  ctx.fill();
  ctx.fillStyle = 'rgba(234,241,255,.86)';
  ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillText(text, 28, 36);
  ctx.restore();
}

function tankOnTrackAt(x,y,timeSec){
  let best = null;
  let bestD = Infinity;
  for (const c of state.cells){
    if (!c.tank || !c.tank.onTrack) continue;
    const p = tankOrbitPos(c, timeSec);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < 20 && d < bestD){
      best = c.i;
      bestD = d;
    }
  }
  return best;
}

// ---------- Helpers ----------
function rr(ctx, x,y,w,h,r){
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

function shade(hex, delta){
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgb(${clamp(r+delta,0,255)},${clamp(g+delta,0,255)},${clamp(b+delta,0,255)})`;
}

function seededNoise(x, y){
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// ---------- Impacts tick ----------
function stepImpacts(dt){
  const next = [];
  for (const fx of state.impacts){
    fx.life -= dt;
    if (fx.life <= 0) continue;
    if (fx.kind !== 'bolt'){
      const k = 1 - fx.life / fx.max;
      fx.r = fx.maxR * k;
    }
    next.push(fx);
  }
  state.impacts = next;
}

// ---------- Main loop ----------
let last = performance.now();
function loop(now){
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  ensureZombieCount();
  stepZombies(dt);
  stepTanks(dt);
  stepProjectiles(dt);
  stepDecals(dt);
  cleanupKills();
  stepImpacts(dt);
  stepParticles(dt);

  updateUI();
  draw();

  requestAnimationFrame(loop);
}

// ---------- Boot ----------
async function boot(){
  initBoard();

  // starter tanks
  state.cells[0].tank = makeTank(1, true);
  state.cells[1].tank = makeTank(1, true);

  await ZombieSprites.load();
  // optional tanks (won't break if missing)
  await TankSprites.load();

  ensureZombieCount();
  updateUI();
  requestAnimationFrame(loop);
}

boot();

/*
assets/zombies.json example:
{
  "atlas": "zombie_atlas.png",
  "types": [
    {"id":"walker","frame":{"x":0,"y":0,"w":64,"h":64},"anchor":{"x":0.5,"y":0.75},"scale":1.2,"hpMul":1.0,"omegaMul":1.0,"rewardMul":1.0,"weight":1.0},
    {"id":"runner","frame":{"x":64,"y":0,"w":64,"h":64},"anchor":{"x":0.5,"y":0.75},"scale":1.1,"hpMul":0.85,"omegaMul":1.35,"rewardMul":0.9,"weight":0.7}
  ]
}
*/
