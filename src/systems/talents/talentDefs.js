// Talent V1 definitions data — extracted from game.js
// This file MUST load before game.js (via <script> in index.html)

const TALENT_DEFS = [];
const ACTIVE_TALENT_INDEX = [null, null, null];

function sanitizeTalentIconBaseName(name){
  // Keep it stable and filesystem-safe (Windows + web servers)
  return String(name || '')
    .trim()
    .replace(/[:\\/]/g, ' ')
    .replace(/[<>"|?*]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'talent';
}

function talentIconPath(name){
  return `assets/Telent_icon/${sanitizeTalentIconBaseName(name)}.png`;
}

// Talent tree layout: row, slot (column 0-2), parents (indices within branch)
// Pattern: 3+3+3+3+2+2+1 = 17 talents per branch
// Row gating: row N requires N*5 points spent in branch
const TALENT_LAYOUT = [
  // Row 0 (0 pts): 3 talents
  { row: 0, slot: 0, parents: [] },
  { row: 0, slot: 1, parents: [] },
  { row: 0, slot: 2, parents: [] },
  // Row 1 (5 pts): 3 talents
  { row: 1, slot: 0, parents: [0] },
  { row: 1, slot: 1, parents: [0, 1, 2] },
  { row: 1, slot: 2, parents: [2] },
  // Row 2 (10 pts): 3 talents
  { row: 2, slot: 0, parents: [3] },
  { row: 2, slot: 1, parents: [3, 4, 5] },
  { row: 2, slot: 2, parents: [5] },
  // Row 3 (15 pts): 3 talents
  { row: 3, slot: 0, parents: [6] },
  { row: 3, slot: 1, parents: [6, 7, 8] },
  { row: 3, slot: 2, parents: [8] },
  // Row 4 (20 pts): 2 talents
  { row: 4, slot: 0, parents: [9, 10] },
  { row: 4, slot: 2, parents: [10, 11] },
  // Row 5 (25 pts): 2 talents
  { row: 5, slot: 0, parents: [12] },
  { row: 5, slot: 2, parents: [13] },
  // Row 6 (30 pts): 1 talent (active)
  { row: 6, slot: 1, parents: [14, 15] },
];

// Build edges for SVG lines: { from: idx, to: idx }
const TALENT_EDGES = [];
TALENT_LAYOUT.forEach((node, i) => {
  node.parents.forEach(p => TALENT_EDGES.push({ from: p, to: i }));
});

const TALENT_ROW_POINTS = 5; // points needed per row tier

function addTalent(branch, name, desc, maxRank, kind, apply){
  const id = `${branch}-${TALENT_DEFS.length}`;
  const prev = ACTIVE_TALENT_INDEX[branch];
  const idx = TALENT_DEFS.filter(d => d.branch === branch).length;
  const layout = TALENT_LAYOUT[idx] || { row: 0, slot: 1, parents: [] };
  const def = { id, branch, name, desc, maxRank, prev, kind, apply, row: layout.row, slot: layout.slot, parents: layout.parents, icon: talentIconPath(name) };
  TALENT_DEFS.push(def);
  ACTIVE_TALENT_INDEX[branch] = TALENT_DEFS.length - 1;
}

function initTalentDefs(){
  if (TALENT_DEFS.length) return;
  const addMul = (mods, key, perRank, rank) => { mods[key] *= 1 + perRank * rank; };
  const addChance = (mods, key, perRank, rank) => { mods[key] += perRank * rank; };
  const addCooldown = (mods, perRank, rank) => { mods.activeCooldownMul *= 1 - perRank * rank; };

  // Attack branch (17)
  addTalent(0, 'Калибр', 'Урон +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'dmgMul', 0.07, r));
  addTalent(0, 'Бронебойные', 'Урон +30%.', 1, 'passive', (mods, r) => addMul(mods, 'dmgMul', 0.30, r));
  addTalent(0, 'Фокусировка', 'Дальность +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'rangeMul', 0.07, r));
  addTalent(0, 'Дальний выстрел', 'Дальность +30%.', 1, 'passive', (mods, r) => addMul(mods, 'rangeMul', 0.30, r));
  addTalent(0, 'Разрывные боеприпасы', 'AOE +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'aoeMul', 0.07, r));
  addTalent(0, 'Широкий взрыв', 'AOE +30%.', 1, 'passive', (mods, r) => addMul(mods, 'aoeMul', 0.30, r));
  addTalent(0, 'Отравляющие осколки', 'Шанс DOT +6% за ранг.', 5, 'passive', (mods, r) => addChance(mods, 'dotChance', 0.06, r));
  addTalent(0, 'Токсичная волна', 'Шанс DOT +25%.', 1, 'passive', (mods, r) => addChance(mods, 'dotChance', 0.25, r));
  addTalent(0, 'Кислотный урон', 'DOT-урон +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'dotDpsMul', 0.07, r));
  addTalent(0, 'Горящий яд', 'DOT-урон +30%.', 1, 'passive', (mods, r) => addMul(mods, 'dotDpsMul', 0.30, r));
  addTalent(0, 'Контроль зоны', 'AOE +6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'aoeMul', 0.06, r));
  addTalent(0, 'Разгон урона', 'Урон +6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'dmgMul', 0.06, r));
  addTalent(0, 'Смертоносный заряд', 'Урон +35%.', 1, 'passive', (mods, r) => addMul(mods, 'dmgMul', 0.35, r));
  addTalent(0, 'Шрапнель', 'AOE +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'aoeMul', 0.07, r));
  addTalent(0, 'Огневой поток', 'Урон +8% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'dmgMul', 0.08, r));
  addTalent(0, 'Снайперский финал', 'Дальность +35%.', 1, 'passive', (mods, r) => addMul(mods, 'rangeMul', 0.35, r));
  addTalent(0, 'Активка: Шквал', 'На 6с усиливает урон и AOE.', 1, 'active', (mods) => {
    mods.activeBranches.add(0);
  });

  // Speed branch (17)
  addTalent(1, 'Калибровка затвора', 'Скорострельность +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'fireRateMul', 0.07, r));
  addTalent(1, 'Турбозатвор', 'Скорострельность +30%.', 1, 'passive', (mods, r) => addMul(mods, 'fireRateMul', 0.30, r));
  addTalent(1, 'Двойной выстрел', 'Шанс двойного выстрела +5% за ранг.', 5, 'passive', (mods, r) => addChance(mods, 'doubleShotChance', 0.05, r));
  addTalent(1, 'Дуплет', 'Шанс двойного выстрела +20%.', 1, 'passive', (mods, r) => addChance(mods, 'doubleShotChance', 0.20, r));
  addTalent(1, 'Стабильная орбита', 'Скорость орбиты +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'orbitSpeedMul', 0.07, r));
  addTalent(1, 'Рывок орбиты', 'Скорость орбиты +30%.', 1, 'passive', (mods, r) => addMul(mods, 'orbitSpeedMul', 0.30, r));
  addTalent(1, 'Синхронизация', 'Постоянно увеличивает скорострельность на 6% за ранг. Текущая прибавка скорости - {current}%', 5, 'passive', (mods, r) => addMul(mods, 'fireRateMul', 0.06, r));
  TALENT_DEFS[TALENT_DEFS.length - 1].effects = [{ perRank: 0.06 }];
  addTalent(1, 'Механизм спарки', 'Шанс двойного выстрела +4% за ранг.', 5, 'passive', (mods, r) => addChance(mods, 'doubleShotChance', 0.04, r));
  addTalent(1, 'Импульс', 'Скорострельность +35%.', 1, 'passive', (mods, r) => addMul(mods, 'fireRateMul', 0.35, r));
  addTalent(1, 'Реактивный контур', 'Скорость орбиты +8% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'orbitSpeedMul', 0.08, r));
  addTalent(1, 'Сокращение перезарядки', 'Кулдауны активки -8% за ранг.', 5, 'passive', (mods, r) => addCooldown(mods, 0.08, r));
  addTalent(1, 'Молниеносность', 'Кулдауны активки -30%.', 1, 'passive', (mods, r) => addCooldown(mods, 0.30, r));
  addTalent(1, 'Сверхскорострельность', 'Скорострельность +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'fireRateMul', 0.07, r));
  addTalent(1, 'Серия', 'Шанс двойного выстрела +22%.', 1, 'passive', (mods, r) => addChance(mods, 'doubleShotChance', 0.22, r));
  addTalent(1, 'Разгон орбиты', 'Скорость орбиты +9% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'orbitSpeedMul', 0.09, r));
  addTalent(1, 'Стартовый импульс', 'Скорострельность +35%.', 1, 'passive', (mods, r) => addMul(mods, 'fireRateMul', 0.35, r));
  addTalent(1, 'Активка: Перегрев', 'На 6с резко ускоряет стрельбу и орбиту.', 1, 'active', (mods) => {
    mods.activeBranches.add(1);
  });

  // Economy branch (17)
  addTalent(2, 'Скидки', 'Стоимость покупки -6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'buyCostMul', -0.06, r));
  addTalent(2, 'Оптовые закупки', 'Стоимость покупки -25%.', 1, 'passive', (mods, r) => addMul(mods, 'buyCostMul', -0.25, r));
  addTalent(2, 'Увеличенный выкуп', 'Награда монетами +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'coinsMul', 0.07, r));
  addTalent(2, 'Премия за убийство', 'Награда монетами +30%.', 1, 'passive', (mods, r) => addMul(mods, 'coinsMul', 0.30, r));
  addTalent(2, 'Копилка опыта', 'Опыт +7% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'xpMul', 0.07, r));
  addTalent(2, 'Ускоренное обучение', 'Опыт +30%.', 1, 'passive', (mods, r) => addMul(mods, 'xpMul', 0.30, r));
  addTalent(2, 'Снабжение', 'Награда монетами +6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'coinsMul', 0.06, r));
  addTalent(2, 'Казначей', 'Награда монетами +35%.', 1, 'passive', (mods, r) => addMul(mods, 'coinsMul', 0.35, r));
  addTalent(2, 'Экономия топлива', 'Стоимость покупки -5% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'buyCostMul', -0.05, r));
  addTalent(2, 'Инвестор', 'Опыт +8% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'xpMul', 0.08, r));
  addTalent(2, 'Бонус за выстрел', 'Награда за выстрел +6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'coinsMul', 0.06, r));
  addTalent(2, 'Золотая лихорадка', 'Опыт +35%.', 1, 'passive', (mods, r) => addMul(mods, 'xpMul', 0.35, r));
  addTalent(2, 'Скидка на снаряды', 'Стоимость покупки -6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'buyCostMul', -0.06, r));
  addTalent(2, 'Программа лояльности', 'Награда монетами +8% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'coinsMul', 0.08, r));
  addTalent(2, 'Стимул обучения', 'Опыт +6% за ранг.', 5, 'passive', (mods, r) => addMul(mods, 'xpMul', 0.06, r));
  addTalent(2, 'Контракт века', 'Стоимость покупки -35%.', 1, 'passive', (mods, r) => addMul(mods, 'buyCostMul', -0.35, r));
  addTalent(2, 'Активка: Золотой час', 'На 6с увеличивает монеты и опыт.', 1, 'active', (mods) => {
    mods.activeBranches.add(2);
  });
}

function baseMods(){
  return {
    dmgMul: 1,
    rangeMul: 1,
    aoeMul: 1,
    fireRateMul: 1,
    doubleShotChance: 0,
    dotChance: 0,
    dotDpsMul: 1,
    orbitSpeedMul: 1,
    buyCostMul: 1,
    coinsMul: 1,
    xpMul: 1,
    activeCooldownMul: 1,
    activeBranches: new Set(),
  };
}

function computeModsFromApplied(applied, debugOverrides){
  initTalentDefs();
  const mods = baseMods();
  TALENT_DEFS.forEach((def, i) => {
    let rank = applied[i] || 0;
    if (debugOverrides && debugOverrides[i]) {
      if (debugOverrides[i] === 'off') return;
      if (debugOverrides[i] === 'on') rank = def.kind === 'active' ? 1 : def.maxRank;
    }
    if (rank <= 0) return;
    def.apply(mods, rank);
  });
  mods.doubleShotChance = Math.max(0, Math.min(0.9, mods.doubleShotChance));
  mods.dotChance = Math.max(0, Math.min(0.9, mods.dotChance));
  return mods;
}
