#!/usr/bin/env node
'use strict';

const fs = require('fs');
const filePath = 'd:/Tank-Merge-Zombie-Defense/assets/zombies.json';

const raw = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(raw);

const fencePreset = { top: 5, right: 0, bottom: -10, left: 0 };
const deathPreset = { x: 168, y: 0, w: 27, h: 27, frames: 7 };

let addedFence = 0;
let addedDeath = 0;

data.types = data.types.map(t => {
  const lvl = parseInt(t.id.replace('zombie_lvl', ''));

  // Add fenceOffsetPxBySide right after "id" if missing
  if (!t.fenceOffsetPxBySide) {
    const newT = {};
    for (const [k, v] of Object.entries(t)) {
      newT[k] = v;
      if (k === 'id') {
        newT.fenceOffsetPxBySide = JSON.parse(JSON.stringify(fencePreset));
      }
    }
    addedFence++;
    t = newT;
  }

  // Add death right after "attack" if missing and lvl >= 14
  if (!t.death && lvl >= 14 && lvl <= 60) {
    const newT = {};
    for (const [k, v] of Object.entries(t)) {
      newT[k] = v;
      if (k === 'attack') {
        newT.death = JSON.parse(JSON.stringify(deathPreset));
      }
    }
    addedDeath++;
    t = newT;
  }

  return t;
});

const output = JSON.stringify(data, null, 2) + '\n';
fs.writeFileSync(filePath, output, 'utf8');

console.log('Added fenceOffsetPxBySide to ' + addedFence + ' types');
console.log('Added death to ' + addedDeath + ' types');
console.log('Total types: ' + data.types.length);

// Verify
const verify = JSON.parse(fs.readFileSync(filePath, 'utf8'));
let fc = 0, dc = 0;
verify.types.forEach(t => {
  if (t.fenceOffsetPxBySide) fc++;
  const l = parseInt(t.id.replace('zombie_lvl', ''));
  if (t.death && l >= 14) dc++;
});
console.log('Verify fenceOffsetPxBySide: ' + fc + '/60');
console.log('Verify death (14-60): ' + dc + '/47');
