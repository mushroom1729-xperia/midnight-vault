import { LEVELS, sightRects } from './levels.js';
import { createPlayer, updatePlayer } from './player.js';
import { createGuards, updateGuards } from './guard.js';
import { createCameras, updateCameras } from './camera.js';
import { sfx } from './audio.js';
import { render, computeView } from './render.js';
import { dist, pointInRect, clamp } from './vision.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const game = {
  state: 'title',
  levelIndex: 0,
  level: LEVELS[0],
  view: { scale: 1, ox: 0, oy: 0 },
  input: { keys: new Set(), pressed: new Set() },
  sfx,
  time: 0,
  levelTime: 0,
  totalTime: 0,
  alarm: 0,
  lastSensor: null,
  pendingCatch: null,
  caughtBy: null,
  caughtAt: 0,
  exitOpen: false,
  lootTaken: 0,
  lootTotal: 1,
  empCharges: 2,
  empTimer: 0,
  noiseRings: [],
  toast: null,
  tickT: 0,
  playerZone: null,
  guardSpot: null,
  cameraSpot: null,
  player: { x: 0, y: 0, r: 11, sneaking: false },
};

function buildLevel(i) {
  game.levelIndex = i;
  game.level = LEVELS[i];
  game.sight = sightRects(game.level);
  game.player = createPlayer(game.level);
  game.guards = createGuards(game.level);
  game.cameras = createCameras(game.level);
  game.loot = game.level.loot.map((l) => ({ ...l, taken: false }));
  game.lootTotal = game.loot.length;
  game.lootTaken = 0;
  game.exit = { ...game.level.exit };
  game.exitOpen = false;
  game.alarm = 0;
  game.lastSensor = null;
  game.pendingCatch = null;
  game.caughtBy = null;
  game.empCharges = 2;
  game.empTimer = 0;
  game.noiseRings = [];
  game.toast = null;
  game.tickT = 0;
  game.levelTime = 0;
  game.playerZone = null;
  game.guardSpot = null;
  game.cameraSpot = null;
  game.view = computeView(game.level, canvas.width, canvas.height);
}

function computeZone() {
  const p = game.player;
  for (const l of game.level.lights) {
    if (dist(p.x, p.y, l.x, l.y) < l.r) {
      game.playerZone = 'light';
      return;
    }
  }
  for (const r of game.level.shadow) {
    if (pointInRect(p.x, p.y, r)) {
      game.playerZone = 'shadow';
      return;
    }
  }
  game.playerZone = null;
}

function updateNoiseRings(dt) {
  for (const ring of game.noiseRings) {
    ring.t += dt;
    const k = clamp(ring.t / ring.dur, 0, 1);
    ring.radius = ring.max * k * (2 - k);
  }
  game.noiseRings = game.noiseRings.filter((ring) => ring.t < ring.dur);
}

function doCatch(by) {
  game.state = 'caught';
  game.caughtBy = by;
  game.caughtAt = game.time;
  sfx.sting();
}

function updatePlay(dt) {
  computeZone();
  updatePlayer(game, dt);
  updateGuards(game, dt);
  updateCameras(game, dt);
  if (game.guardSpot !== null) {
    game.alarm = clamp(game.alarm + 0.34 * game.guardSpot.closeness * dt, 0, 1);
    game.lastSensor = 'guard';
    if (game.alarm >= 1 && game.pendingCatch === null) game.pendingCatch = 'guard';
  }
  if (game.guardSpot === null && game.cameraSpot === null) {
    game.alarm = clamp(game.alarm - 0.22 * dt, 0, 1);
  }
  if (game.alarm > 0.02) {
    game.tickT -= dt;
    if (game.tickT <= 0) {
      game.tickT = 0.55 - 0.42 * game.alarm;
      sfx.tick(game.alarm);
    }
  }
  if (game.pendingCatch !== null) {
    doCatch(game.pendingCatch);
    return;
  }
  for (const l of game.loot) {
    if (!l.taken && dist(game.player.x, game.player.y, l.x, l.y) < 20) {
      l.taken = true;
      game.lootTaken += 1;
      sfx.chime();
      if (game.lootTaken >= game.lootTotal) {
        game.exitOpen = true;
        sfx.open();
        game.toast = { text: 'ALL LOOT SECURED — EXIT OPEN', t: 2.4 };
      } else {
        game.toast = { text: 'LOOT SECURED', t: 1.8 };
      }
    }
  }
  if (game.exitOpen && pointInRect(game.player.x, game.player.y, game.exit)) {
    if (game.levelIndex === LEVELS.length - 1) {
      game.state = 'final';
      game.totalTime += game.levelTime;
      sfx.jingle();
    } else {
      game.state = 'clear';
      sfx.jingle();
    }
    return;
  }
  if (!game.exitOpen && pointInRect(game.player.x, game.player.y, game.exit) && (game.toast === null || game.toast.t <= 0)) {
    game.toast = { text: 'EXIT LOCKED — GRAB THE LOOT FIRST', t: 1.6 };
  }
  game.levelTime += dt;
}

function update(dt) {
  game.time += dt;
  if (game.toast !== null) {
    game.toast.t -= dt;
    if (game.toast.t <= 0) game.toast = null;
  }
  updateNoiseRings(dt);
  if (game.state === 'play') updatePlay(dt);
}

function startLevel(i) {
  buildLevel(i);
  game.state = 'play';
}

function handleKey(code, repeat) {
  if (code === 'Digit1' || code === 'Numpad1') startLevel(0);
  else if (code === 'Digit2' || code === 'Numpad2') startLevel(1);
  else if (code === 'Digit3' || code === 'Numpad3') startLevel(2);
  else if (code === 'KeyR') {
    if (game.state === 'final') {
      game.totalTime = 0;
      buildLevel(0);
      game.state = 'title';
    } else {
      startLevel(game.levelIndex);
    }
  } else if (game.state === 'title') {
    game.state = 'play';
  } else if (game.state === 'clear') {
    startLevel(game.levelIndex + 1);
  } else if (game.state === 'caught') {
    if (game.time - game.caughtAt > 0.8) startLevel(game.levelIndex);
  }
}

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  sfx.unlock();
  if (!e.repeat) {
    game.input.keys.add(e.code);
    game.input.pressed.add(e.code);
    handleKey(e.code, e.repeat);
  }
});

window.addEventListener('keyup', (e) => {
  game.input.keys.delete(e.code);
});

window.addEventListener('blur', () => {
  game.input.keys.clear();
});

window.addEventListener('pointerdown', () => {
  sfx.unlock();
  if (game.state === 'title') game.state = 'play';
});

const params = new URLSearchParams(location.search);
const lv = Number.parseInt(params.get('level') ?? '', 10);
const startLevelIndex = lv >= 1 && lv <= 3 ? lv - 1 : 0;
buildLevel(startLevelIndex);
if (lv >= 1 && lv <= 3) game.state = 'play';

function tick(dt) {
  update(dt);
  game.input.pressed.clear();
  render(game, ctx);
}

let last = performance.now();
let sawFrame = true;
function step(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  tick(dt);
}
function frame(now) {
  sawFrame = true;
  step(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(() => {
  if (sawFrame) {
    sawFrame = false;
    return;
  }
  step(performance.now());
}, 1000 / 60);
