/**
 * Pack 8 — supercomputer sprite loader hitbox config.
 * Run: node Test/pack8/supercomputerSpriteLoaderHitbox.test.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message + ' (expected ' + expected + ', got ' + actual + ')');
  }
}

async function test(name, fn) {
  try {
    await fn();
    passCount++;
    console.log('  \u2713 ' + name);
  } catch (error) {
    failCount++;
    failures.push({ name: name, error: error.message });
    console.log('  \u2717 ' + name + ' \u2014 ' + error.message);
  }
}

function FakeImage() {
  this.complete = true;
  this.naturalWidth = 128;
  this.naturalHeight = 128;
  this._src = '';
  this.onload = null;
  this.onerror = null;
}

Object.defineProperty(FakeImage.prototype, 'src', {
  get: function () {
    return this._src;
  },
  set: function (value) {
    this._src = value;
    if (typeof this.onload === 'function') this.onload();
  },
});

const root = path.resolve(__dirname, '../..');
const spriteLoadersSource = fs.readFileSync(path.join(root, 'src', 'render', 'spriteLoaders.js'), 'utf8');

async function createSupercomputerSprites(customConfig) {
  const sandbox = {
    console: console,
    Image: FakeImage,
    fetch: async function (url) {
      if (url !== 'assets/supercomputer.json') {
        throw new Error('Unexpected fetch url: ' + url);
      }
      return {
        ok: true,
        json: async function () {
          return customConfig;
        },
      };
    },
    window: { Game: {} },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
  };
  sandbox.window.console = console;
  sandbox.window.Image = FakeImage;
  sandbox.window.fetch = sandbox.fetch;
  vm.runInNewContext(spriteLoadersSource, sandbox, { filename: 'spriteLoaders.js' });
  const loaders = sandbox.window.Game.SpriteLoaders.createSpriteLoaders({});
  await loaders.SupercomputerSprites.load();
  return loaders.SupercomputerSprites;
}

async function run() {
  console.log('\n── Pack 8: Supercomputer sprite loader hitbox config ──');

  await test('SSLH-1: SupercomputerSprites.load keeps hitbox geometry from supercomputer.json', async () => {
    const sprites = await createSupercomputerSprites({
      atlas: 'supercomputer_atlas.png',
      renderScale: 0.85,
      hitbox: { w: 116, h: 84, offsetX: 13, offsetY: -27 },
      animations: {
        idle: { x: 0, y: 0, w: 96, h: 96, frames: 1, frameRateFps: 1, loop: true },
        work: { x: 0, y: 0, w: 96, h: 96, frames: 1, frameRateFps: 1, loop: true },
      },
    });

    assert(sprites.config && sprites.config.hitbox, 'runtime config keeps hitbox object');
    assertEqual(sprites.config.hitbox.w, 116, 'loader keeps hitbox width');
    assertEqual(sprites.config.hitbox.h, 84, 'loader keeps hitbox height');
    assertEqual(sprites.config.hitbox.offsetX, 13, 'loader keeps hitbox offsetX');
    assertEqual(sprites.config.hitbox.offsetY, -27, 'loader keeps hitbox offsetY');
  });

  console.log('\n═══════════════════════════');
  console.log('SupercomputerSpriteLoaderHitbox: ' + passCount + ' passed, ' + failCount + ' failed');
  if (failures.length) {
    failures.forEach(function (failure) {
      console.log('  - ' + failure.name + ': ' + failure.error);
    });
  }
  console.log('═══════════════════════════\n');
  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(function (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});