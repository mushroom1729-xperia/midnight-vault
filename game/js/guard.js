import { clamp, dist, angleTo, angLerp, inCone, losClear, moveCircle } from './vision.js';

export const GUARD_FOV = 1.22;
const BASE_RANGE = 270;
const SUSPICION_DECAY = 0.3;
const MEMORY = 0.55;
const HEAR_SUSPICION = 0.3;

export function createGuards(level) {
  return level.guards.map((def, i) => {
    const [x, y] = def.path[0];
    const next = def.path[1] ?? def.path[0];
    return {
      id: i,
      x,
      y,
      r: 13,
      path: def.path.map((p) => p.slice()),
      wp: 1 % def.path.length,
      speed: def.speed,
      pauseDur: def.pause,
      pauseT: 0.4,
      facing: angleTo(x, y, next[0], next[1]),
      lookPhase: i * 1.7,
      suspicion: 0,
      memory: 0,
      turnTo: null,
      turnT: 0,
      moving: false,
    };
  });
}

export function updateGuards(g, dt) {
  const p = g.player;
  g.guardSpot = null;
  for (const guard of g.guards) {
    guard.visRange = effectiveRange(g, p.sneaking);
    updatePatrol(guard, g, dt);
    hearNoise(guard, g);
    const spot = sightCheck(guard, p, g);
    if (spot) {
      guard.memory = MEMORY;
      const sneakFactor = p.sneaking ? 0.78 : 1;
      guard.suspicion = clamp(guard.suspicion + spot.rate * sneakFactor * dt, 0, 1);
      if (guard.suspicion >= 1) {
        g.pendingCatch = 'guard';
        g.alarm = 1;
      }
      if (g.guardSpot === null || spot.closeness > g.guardSpot.closeness) {
        g.guardSpot = spot;
      }
    } else {
      guard.memory -= dt;
      if (guard.memory <= 0) {
        guard.suspicion = clamp(guard.suspicion - SUSPICION_DECAY * dt, 0, 1);
      }
    }
  }
}

function updatePatrol(guard, g, dt) {
  const target = guard.path[guard.wp];
  if (guard.pauseT > 0) {
    guard.pauseT -= dt;
    guard.moving = false;
    guard.lookPhase += dt * 1.7;
    const base = angleTo(guard.x, guard.y, target[0], target[1]);
    guard.facing = base + Math.sin(guard.lookPhase) * 0.7;
    if (guard.turnT > 0) {
      guard.turnT -= dt;
      guard.facing = angLerp(guard.facing, guard.turnTo, 1 - Math.exp(-7 * dt));
    }
    return;
  }
  if (guard.turnT > 0) {
    guard.turnT -= dt;
    guard.facing = angLerp(guard.facing, guard.turnTo, 1 - Math.exp(-7 * dt));
  }
  guard.moving = true;
  const d = dist(guard.x, guard.y, target[0], target[1]);
  const step = guard.speed * dt;
  if (d <= step + 1) {
    guard.x = target[0];
    guard.y = target[1];
    guard.wp = (guard.wp + 1) % guard.path.length;
    guard.pauseT = guard.pauseDur;
    guard.lookPhase = 0;
    return;
  }
  const dir = angleTo(guard.x, guard.y, target[0], target[1]);
  guard.facing = angLerp(guard.facing, dir, 1 - Math.exp(-9 * dt));
  moveCircle(guard, Math.cos(dir) * step, Math.sin(dir) * step, g.sight);
}

function hearNoise(guard, g) {
  for (const ring of g.noiseRings) {
    if (ring.heard.has(guard.id)) continue;
    const d = dist(guard.x, guard.y, ring.x, ring.y);
    if (d <= ring.radius && d <= ring.max) {
      ring.heard.add(guard.id);
      guard.suspicion = clamp(guard.suspicion + HEAR_SUSPICION, 0, 1);
      guard.turnTo = angleTo(guard.x, guard.y, ring.x, ring.y);
      guard.turnT = 1.2;
      guard.memory = MEMORY;
      if (guard.pauseT > 0) guard.lookPhase = 0;
    }
  }
}

function effectiveRange(g, sneaking) {
  const zoneBoost = g.playerZone === 'light' ? 1.25 : g.playerZone === 'shadow' ? 0.55 : 1;
  return BASE_RANGE * zoneBoost * (sneaking ? 0.82 : 1);
}

function sightCheck(guard, p, g) {
  const range = guard.visRange;
  const d = dist(guard.x, guard.y, p.x, p.y);
  if (d > range) return null;
  if (!inCone(p.x, p.y, guard.x, guard.y, guard.facing, GUARD_FOV, range)) return null;
  if (!losClear(guard.x, guard.y, p.x, p.y, g.sight)) return null;
  const closeness = clamp(1.3 - d / range, 0.15, 1.3);
  return {
    sees: true,
    closeness,
    rate: 0.95 * closeness,
    range,
  };
}
