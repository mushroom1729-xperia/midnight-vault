import { moveCircle } from './vision.js';

const SPEED_WALK = 150;
const SPEED_SNEAK = 76;
const NOISE_GAP = 0.42;
const NOISE_MAX = 100;

export function createPlayer(level) {
  return {
    x: level.start.x,
    y: level.start.y,
    r: 11,
    facing: -Math.PI / 2,
    sneaking: false,
    moving: false,
    stepT: 0,
    stepSide: 1,
    noiseT: 0,
    empFlash: 0,
  };
}

export function updatePlayer(g, dt) {
  const p = g.player;
  const keys = g.input.keys;
  let dx = 0;
  let dy = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;
  p.sneaking = keys.has('ShiftLeft') || keys.has('ShiftRight');
  p.moving = dx !== 0 || dy !== 0;
  if (p.moving) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    const speed = p.sneaking ? SPEED_SNEAK : SPEED_WALK;
    moveCircle(p, dx * speed * dt, dy * speed * dt, g.sight);
    p.facing = Math.atan2(dy, dx);
    p.stepT += dt;
    const gap = p.sneaking ? 0.52 : 0.34;
    if (p.stepT >= gap) {
      p.stepT -= gap;
      p.stepSide *= -1;
      g.sfx.step(p.sneaking);
    }
    if (!p.sneaking) {
      p.noiseT -= dt;
      if (p.noiseT <= 0) {
        p.noiseT = NOISE_GAP;
        g.noiseRings.push({ x: p.x, y: p.y, t: 0, dur: 0.7, max: NOISE_MAX, heard: new Set() });
      }
    } else {
      p.noiseT = 0.12;
    }
  } else {
    p.stepT = 0;
    p.noiseT = 0.12;
  }
  if (p.empFlash > 0) p.empFlash -= dt;
  if (g.input.pressed.has('KeyE') && g.state === 'play') {
    if (g.empTimer > 0) {
      g.toast = { text: 'CAMERAS ALREADY DOWN', t: 1.4 };
    } else if (g.empCharges > 0) {
      g.empCharges -= 1;
      g.empTimer = 5;
      p.empFlash = 0.6;
      g.sfx.zap();
      g.toast = { text: 'EMP PULSE — CAMERAS DOWN 5s', t: 2.2 };
    }
  }
}
