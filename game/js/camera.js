import { TAU, clamp, dist, inCone, losClear } from './vision.js';

const ALARM_RATE = 0.85;
const ACQUIRE = 0.2;

export function createCameras(level) {
  return level.cameras.map((def, i) => ({
    id: i,
    x: def.x,
    y: def.y,
    dir0: def.dir,
    dir: def.dir,
    amp: def.amp,
    speed: def.speed,
    phase: (i * Math.PI) / 1.618,
    fov: def.fov,
    range: def.range,
    sees: false,
    seenFor: 0,
  }));
}

export function updateCameras(g, dt) {
  const p = g.player;
  g.cameraSpot = null;
  if (g.empTimer > 0) {
    g.empTimer -= dt;
    if (g.empTimer <= 0) {
      g.empTimer = 0;
      g.toast = { text: 'CAMERAS BACK ONLINE', t: 1.6 };
    }
  }
  for (const cam of g.cameras) {
    cam.phase += dt * cam.speed;
    cam.dir = cam.dir0 + Math.sin(cam.phase) * cam.amp;
    if (g.empTimer > 0) {
      cam.sees = false;
      continue;
    }
    const zoneBoost = g.playerZone === 'light' ? 1.2 : g.playerZone === 'shadow' ? 0.6 : 1;
    const range = cam.range * zoneBoost * (p.sneaking ? 0.9 : 1);
    const d = dist(cam.x, cam.y, p.x, p.y);
    let sees = d <= range;
    if (sees) sees = inCone(p.x, p.y, cam.x, cam.y, cam.dir, cam.fov, range);
    if (sees) sees = losClear(cam.x, cam.y, p.x, p.y, g.sight);
    cam.sees = sees;
    cam.seenFor = sees ? cam.seenFor + dt : 0;
    if (sees && cam.seenFor >= ACQUIRE) {
      const closeness = clamp(1.2 - d / range, 0.2, 1.2);
      if (g.cameraSpot === null || closeness > g.cameraSpot.closeness) {
        g.cameraSpot = { sees: true, closeness };
      }
    }
  }
  if (g.cameraSpot !== null) {
    g.alarm = clamp(g.alarm + ALARM_RATE * g.cameraSpot.closeness * dt, 0, 1);
    g.lastSensor = 'camera';
    if (g.alarm >= 1) g.pendingCatch = 'camera';
  }
}
