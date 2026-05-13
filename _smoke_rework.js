'use strict';
const fs = require('fs');
const vm = require('vm');

['game.js','src/mechanics/autoMerge.js','src/mechanics/achievements.js','src/mechanics/achievementRewards.js','src/i18n/fallbackStrings.js'].forEach(p => {
  try { new Function(fs.readFileSync(p,'utf8')); console.log(p, 'SYNTAX_OK'); }
  catch(e){ console.log(p, 'SYNTAX_FAIL', e.message); }
});

const ru = JSON.parse(fs.readFileSync('src/i18n/ru.json','utf8'));
const en = JSON.parse(fs.readFileSync('src/i18n/en.json','utf8'));

global.window = global;
global.window.Game = {
  I18n: {
    t(k, p) {
      let v = ru[k];
      if (v && p && p.target !== undefined) v = String(v).replace('{target}', p.target);
      return v || k;
    }
  }
};

['src/mechanics/achievements.js','src/mechanics/achievementRewards.js','src/mechanics/autoMerge.js'].forEach(p => {
  vm.runInThisContext(fs.readFileSync(p,'utf8'), { filename: p });
});

const A = global.window.Game.Achievements;
const defs = A.getDefinitions().filter(d => d.familyId === 'auto_merge_addict');
console.log('FAMILY_COUNT', defs.length);
defs.forEach(d => {
  const desc = global.window.Game.I18n.t(d.descKey, { target: d.target });
  const descEn = (en[d.descKey] || '').replace('{target}', d.target);
  const title = global.window.Game.I18n.t(d.titleKey);
  const reward = global.window.Game.I18n.t(d.rewardKey);
  console.log(d.id, '| descKey=', d.descKey, '| RU="', desc, '" | EN="', descEn, '" | title="', title, '" | reward="', reward, '"');
});

// Smoke: state cascade
const state = { stats: {}, achievements: {} };
A.ensureState ? A.ensureState(state) : null;
A.recordAutoMergeActivations(state, 5000);
A.recordAutoMergeActivations(state, 15000);
console.log('UNLOCKED@20000', Object.keys(state.achievements.unlocked || {}).filter(k => k.startsWith('auto_merge_addict')));
A.recordAutoMergeActivations(state, 80000);
console.log('UNLOCKED@100000', Object.keys(state.achievements.unlocked || {}).filter(k => k.startsWith('auto_merge_addict')));
