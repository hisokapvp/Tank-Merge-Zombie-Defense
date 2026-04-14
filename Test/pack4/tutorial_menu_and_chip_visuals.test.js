/**
 * Pack 4 — tutorial menu ownership and chip projectile visual overrides.
 * Run: node Test/pack4/tutorial_menu_and_chip_visuals.test.js
 */

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function test(name, fn) {
  try {
    fn();
    passCount += 1;
    console.log('  OK ' + name);
  } catch (error) {
    failCount += 1;
    failures.push({ name, error: error.message });
    console.log('  FAIL ' + name + ' - ' + error.message);
  }
}

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const bigMenuRuntimeJs = fs.readFileSync(path.join(root, 'src/ui/bigMenuRuntime.js'), 'utf-8');
const hangarChipsUiJs = fs.readFileSync(path.join(root, 'src/ui/hangarChipsUI.js'), 'utf-8');
const productionLineUiJs = fs.readFileSync(path.join(root, 'src/ui/productionLineUI.js'), 'utf-8');
const undergroundHangarUiJs = fs.readFileSync(path.join(root, 'src/ui/undergroundHangarUI.js'), 'utf-8');
const inputGuardsJs = fs.readFileSync(path.join(root, 'src/ui/inputGuards.js'), 'utf-8');
const chipCraftLayoutJs = fs.readFileSync(path.join(root, 'src/ui/chipCraftLayout.js'), 'utf-8');
const bootstrapJs = fs.readFileSync(path.join(root, 'src/core/bootstrap.js'), 'utf-8');
const gameJs = fs.readFileSync(path.join(root, 'game.js'), 'utf-8');
const chipsJsonText = fs.readFileSync(path.join(root, 'assets/chips.json'), 'utf-8');

console.log('\n-- Pack 4: Tutorial menu and chip projectile visuals --');

test('TMC-1: tutorial toggle remains only in the small menu', () => {
  assert(indexHtml.indexOf('id="menuTutorialToggle"') !== -1, 'small menu tutorial toggle remains in HTML');
  assert(indexHtml.indexOf('id="bigMenuRootTutorial"') === -1, 'big menu root tutorial toggle is removed from HTML');
  assert(bigMenuRuntimeJs.indexOf('ui.bigMenuRootTutorial') === -1, 'big menu runtime no longer binds tutorial root toggle');
  assert(bootstrapJs.indexOf("opts.ui.menuTutorialToggle && opts.ui.menuTutorialToggle.addEventListener('change'") !== -1, 'small menu toggle still drives tutorial runtime');
  assert(gameJs.indexOf('if (ui.bigMenuRootTutorial) ui.bigMenuRootTutorial.checked = !tutDisabled;') === -1, 'global tutorial sync no longer writes into removed big menu toggle');
});

test('TMC-2: tank purchase immediately notifies tutorial runtime', () => {
  assert(gameJs.indexOf('TutorialRuntime.handleTankPurchased({') !== -1, 'purchase flow notifies tutorial runtime immediately');
  assert(gameJs.indexOf("cause: 'user'") !== -1, 'tutorial purchase notification keeps user cause');
});

test('TMC-3: chips.json exposes per-modifier projectile and impact atlas overrides', () => {
  const chips = JSON.parse(chipsJsonText);
  const mod1 = chips && chips.modifiers ? chips.modifiers['1'] : null;
  const mod2 = chips && chips.modifiers ? chips.modifiers['2'] : null;
  const mod8 = chips && chips.modifiers ? chips.modifiers['8'] : null;
  const mod10 = chips && chips.modifiers ? chips.modifiers['10'] : null;
  const mod15 = chips && chips.modifiers ? chips.modifiers['15'] : null;
  const mod27 = chips && chips.modifiers ? chips.modifiers['27'] : null;
  assert(mod1 && mod1.bulletSprite && mod1.impactSprite, 'modifier 1 defines custom bulletSprite and impactSprite');
  assertEqual(mod1.bulletSprite.src, 'chip_effects_atlas.png', 'modifier 1 bullet override points to the requested chip effects atlas');
  assertEqual(mod1.impactSprite.src, 'bullet_atlas.png', 'modifier 1 impact override points to bullet atlas');
  assert(mod2 && mod2.bulletSprite && mod2.impactSprite, 'modifier 2 now also defines projectile sprite overrides');
  assert(mod8 && mod8.impactSprite && mod8.impactSpriteNormal, 'modifier 8 defines separate nuclear and normal impact sprites');
  assertEqual(mod8.impactSprite.src, 'Explosion.png', 'modifier 8 nuclear impact override uses explosion atlas');
  assertEqual(mod8.impactSpriteNormal.src, 'bullet_atlas.png', 'modifier 8 normal impact override keeps base bullet atlas');
  assert(mod15 && mod15.bulletSprite && mod15.impactSprite, 'modifier 15 defines projectile sprite overrides in the higher tier range');
  assert(mod27 && mod27.impactSprite && mod27.impactSpriteNormal, 'modifier 27 also exposes the dual impact sprite contract');
  assert(mod10 && !mod10.bulletSprite && !mod10.impactSprite, 'modifier 10 keeps projectile fallback fields absent');
  assert(mod10 && mod10.effectSprite && mod10.effectSprite.src === 'impact_fire.png', 'modifier 10 defines effectSprite atlas config');
});

test('TMC-3A: helper modules for drag guards and chip craft layout are wired into the runtime', () => {
  assert(indexHtml.indexOf('src/ui/inputGuards.js') !== -1, 'index loads the shared input guard helper');
  assert(indexHtml.indexOf('src/ui/chipCraftLayout.js') !== -1, 'index loads the chip craft layout helper');
  assert(inputGuardsJs.indexOf("TOUCH_DRAG_HOST_ATTR = 'data-input-drag-host'") !== -1, 'input guard helper defines the shared drag-host attribute');
  assert(inputGuardsJs.indexOf('installDocumentContextMenuGuard') !== -1, 'input guard helper exposes the document contextmenu guard');
  assert(chipCraftLayoutJs.indexOf('buildEnergyRailLayout') !== -1, 'chip craft layout helper exposes the energy rail builder');
  assert(hangarChipsUiJs.indexOf('layoutApi.buildEnergyRailLayout(panel)') !== -1, 'hangar chip craft preview consumes the shared energy rail helper');
  assert(gameJs.indexOf('installDocumentContextMenuGuard(document)') !== -1, 'game runtime delegates the document contextmenu guard into the shared helper');
  assert(productionLineUiJs.indexOf('inputGuards.markTouchDragHost(cell)') !== -1, 'production storage cells are tagged as shared drag hosts');
  assert(undergroundHangarUiJs.indexOf('markRenderedDragHosts(body);') !== -1, 'underground hangar re-tags rendered drag hosts after each render');
});

test('TMC-4: ChipEffects keeps nuclear bullet visuals on all shots and still splits normal-vs-nuke impact sprites', () => {
  const globalObj = globalThis;
  globalObj.window = globalObj;
  globalObj.Game = globalObj.Game || {};
  globalObj.Image = function ImageStub() {
    this.complete = true;
    this.naturalWidth = 1;
    this.src = '';
  };

  const chipEffectsCode = fs.readFileSync(path.join(root, 'src/mechanics/chipEffects.js'), 'utf-8');
  const chipEffectsFn = new Function('window', 'global', chipEffectsCode);
  chipEffectsFn(globalObj, globalObj);

  const chipEffects = globalObj.Game.ChipEffects;
  const chips = JSON.parse(chipsJsonText);
  chipEffects.loadChipsCfg(chips);

  const mod1Override = chipEffects.buildChipBulletCfgOverride([1]);
  const mod8PlainOverride = chipEffects.buildChipBulletCfgOverride([8], null);
  const mod8NukeOverride = chipEffects.buildChipBulletCfgOverride([8], { isNuke: true });
  const mod10Override = chipEffects.buildChipBulletCfgOverride([10]);
  const mod10Bullet = chipEffects.getModBulletSprite(10);
  const mod10Impact = chipEffects.getModImpactSprite(10);
  const mod10Effect = chipEffects.getModEffectSprite(10);
  const mod27PlainImpact = chipEffects.getModImpactSpriteNormal(27);

  assert(mod1Override && mod1Override.bulletSprite && mod1Override.impactSprite, 'modifier 1 override resolves both custom sprites');
  assert(mod8PlainOverride && mod8PlainOverride.bulletSprite && mod8PlainOverride.bulletSprite.src === 'bullet_nuke.png', 'modifier 8 keeps the nuclear bullet sprite even when the shot is on normal cooldown');
  assert(mod8PlainOverride && mod8PlainOverride.impactSprite && mod8PlainOverride.impactSprite.src === 'impact_nuke.png', 'modifier 8 still uses the normal impact sprite when the shot is not nuclear');
  assert(mod8NukeOverride && mod8NukeOverride.impactSprite && mod8NukeOverride.impactSprite.src === 'Nuclear_Explosion.png', 'modifier 8 keeps the explosion atlas for actual nuclear shots');
  assert(mod27PlainImpact && mod27PlainImpact.src === 'impact_nuke.png', 'modifier 27 exposes the normal-impact atlas through the dedicated getter');
  assertEqual(mod10Override, null, 'modifier 10 falls back to base projectile visuals when projectile overrides are absent');
  assertEqual(mod10Bullet, null, 'modifier 10 has no custom bullet override');
  assertEqual(mod10Impact, null, 'modifier 10 has no custom impact override');
  assert(mod10Effect && mod10Effect.src === 'impact_fire.png', 'modifier 10 exposes effect sprite override separately from projectile visuals');
});

test('TMC-5: hangar tech modal exposes dedicated help entry point', () => {
  assert(indexHtml.indexOf('id="modsHangarHelpBtn"') !== -1, 'hangar overlay includes help button near the close control');
  assert(indexHtml.indexOf('data-tech-help-open="true"') !== -1, 'hangar overlay help button advertises tech-help action');
  assert(hangarChipsUiJs.indexOf('syncTechUnlockHelpButtonCopy') !== -1, 'hangar UI keeps help button copy synchronized through runtime');
  assert(hangarChipsUiJs.indexOf('_showTechUnlockHelpModal') !== -1, 'hangar UI exposes dedicated help modal handler');
});

test('TMC-6: hangar tutorial target markers stay on slot render path only', () => {
  assert(hangarChipsUiJs.indexOf("var tutorialSlotAttr = (def.type === 'red' && def.slotId === 'slot1')") !== -1, 'first red slot tutorial marker is derived from rendered slot definition');
  assert(hangarChipsUiJs.indexOf("'data-slot-type=\"' + def.type + '\" data-slot-id=\"' + def.slotId + '\"' + tutorialSlotAttr + ' '") !== -1, 'rendered slot polygon includes tutorial marker attribute');

  const feedStart = hangarChipsUiJs.indexOf('function feedChipsForTech');
  const feedEnd = hangarChipsUiJs.indexOf('function _sortChipsByLevelThenCount');
  const feedSection = feedStart !== -1 && feedEnd !== -1 ? hangarChipsUiJs.slice(feedStart, feedEnd) : '';
  assert(feedSection.indexOf('data-tutorial-hangar-first-red-slot') === -1, 'feedChipsForTech does not contain leaked tutorial slot marker code');
});

console.log('\n==============================');
console.log('TutorialMenuAndChipVisuals: ' + passCount + ' passed, ' + failCount + ' failed');
if (failures.length) {
  failures.forEach(function (failure) {
    console.log('  - ' + failure.name + ': ' + failure.error);
  });
}
console.log('==============================\n');
process.exit(failCount > 0 ? 1 : 0);