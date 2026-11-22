export const TAU = Math.PI * 2;

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function angNorm(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

export function angLerp(a, b, t) {
  return a + angNorm(b - a) * clamp(t, 0, 1);
}

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function circleRect(cx, cy, cr, r) {
  const nx = clamp(cx, r.x, r.x + r.w);
  const ny = clamp(cy, r.y, r.y + r.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < cr * cr;
}

export function moveCircle(ent, dx, dy, rects) {
  ent.x += dx;
  for (const r of rects) {
    if (circleRect(ent.x, ent.y, ent.r, r)) {
      if (dx > 0) ent.x = r.x - ent.r;
      else if (dx < 0) ent.x = r.x + r.w + ent.r;
    }
  }
  ent.y += dy;
  for (const r of rects) {
    if (circleRect(ent.x, ent.y, ent.r, r)) {
      if (dy > 0) ent.y = r.y - ent.r;
      else if (dy < 0) ent.y = r.y + r.h + ent.r;
    }
  }
}

export function segHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const slab = (p, d, lo, hi) => {
    if (Math.abs(d) < 1e-9) return p >= lo && p <= hi;
    let ta = (lo - p) / d;
    let tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    return t0 <= t1;
  };
  if (!slab(x1, dx, r.x, r.x + r.w)) return false;
  if (!slab(y1, dy, r.y, r.y + r.h)) return false;
  return t0 <= t1 && t1 >= 0 && t0 <= 1;
}

export function losClear(x1, y1, x2, y2, rects) {
  for (const r of rects) {
    if (segHitsRect(x1, y1, x2, y2, r)) return false;
  }
  return true;
}

export function rayHit(x, y, ang, maxDist, rects) {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  let best = maxDist;
  for (const r of rects) {
    let t0 = 0;
    let t1 = best;
    let hit = true;
    const slab = (p, d, lo, hi) => {
      if (Math.abs(d) < 1e-9) {
        if (p < lo || p > hi) hit = false;
        return;
      }
      let ta = (lo - p) / d;
      let tb = (hi - p) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) hit = false;
    };
    slab(x, dx, r.x, r.x + r.w);
    if (!hit) continue;
    slab(y, dy, r.y, r.y + r.h);
    if (!hit) continue;
    if (t0 > 0 && t0 < best) best = t0;
  }
  return best;
}

export function conePoints(x, y, dir, fov, range, rects, rays = 40) {
  const half = fov / 2;
  const angles = [];
  for (let i = 0; i <= rays; i++) angles.push(dir - half + (fov * i) / rays);
  for (const r of rects) {
    const corners = [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x, r.y + r.h],
      [r.x + r.w, r.y + r.h],
    ];
    for (const [cx, cy] of corners) {
      const a = Math.atan2(cy - y, cx - x);
      if (Math.abs(angNorm(a - dir)) > half) continue;
      if (dist(x, y, cx, cy) > range) continue;
      angles.push(a - 0.0004, a + 0.0004);
    }
  }
  angles.sort((a, b) => a - b);
  const pts = [[x, y]];
  for (const a of angles) {
    const d = rayHit(x, y, a, range, rects);
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  return pts;
}

export function inCone(px, py, cx, cy, dir, fov, range) {
  const d = dist(cx, cy, px, py);
  if (d > range) return false;
  const a = Math.abs(angNorm(angleTo(cx, cy, px, py) - dir));
  return a <= fov / 2;
}
