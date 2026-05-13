'use strict';
const fs = require('fs');
const targets = [5000, 10000, 20000, 50000, 100000];
const fmtRu = (n) => n.toLocaleString('ru-RU').replace(/\u00A0/g, ' '); // use NBSP fix; actually toLocaleString may use NBSP
const fmtEn = (n) => n.toLocaleString('en-US');

function patch(path) {
  let c = fs.readFileSync(path, 'utf8');
  targets.forEach((n, i) => {
    const idx = i + 1;
    // RU pattern existing
    const ruNum = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const enNum = n.toLocaleString('en-US');
    // RU rewrite
    const ruOld = `'Активируйте авто-объединение ${ruNum} раз'`;
    const ruNew = `'Объединить ${ruNum} танков используя авто-объединение'`;
    if (c.includes(ruOld)) { c = c.replace(ruOld, ruNew); console.log(path, idx, 'RU patched'); }
    // EN rewrite (json uses double quotes; fallback uses single quotes)
    const enOldJson = `"Trigger auto-merge ${enNum} times"`;
    const enNewJson = `"Merge ${enNum} tanks using auto-merge"`;
    if (c.includes(enOldJson)) { c = c.replace(enOldJson, enNewJson); console.log(path, idx, 'EN(json) patched'); }
    const enOldJs = `'Trigger auto-merge ${enNum} times'`;
    const enNewJs = `'Merge ${enNum} tanks using auto-merge'`;
    if (c.includes(enOldJs)) { c = c.replace(enOldJs, enNewJs); console.log(path, idx, 'EN(js) patched'); }
  });
  fs.writeFileSync(path, c, 'utf8');
}

patch('src/i18n/en.json');
patch('src/i18n/fallbackStrings.js');
console.log('DONE');
