import { GUARD_FOV } from './guard.js';
import { conePoints, clamp } from './vision.js';

const hud = {
  level: document.getElementById('level-name'),
  alarmFill: document.getElementById('alarm-fill'),
  status: document.getElementById('status-text'),
  loot: document.getElementById('loot-count'),
  emp: document.getElementById('emp-charges'),
  sneak: document.getElementById('sneak-state'),
};

const MONO = '"Consolas","Cascadia Mono","Menlo",monospace';

export function computeView(level, cw, ch) {
  const scale = Math.min((cw - 30) / level.w, (ch - 30) / level.h);
  return { scale, ox: (cw - level.w * scale) / 2, oy: (ch - level.h * scale) / 2 };
}

function guardConeColor(s) {
  if (s < 0.35) return { fill: '255,224,102', edge: '255,224,102' };
  if (s < 0.7) return { fill: '255,159,67', edge: '255,159,67' };
  return { fill: '255,82,82', edge: '255,82,82' };
}

function drawPolygon(ctx, pts, fill, edge, lw) {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = lw ?? 1.5;
    ctx.stroke();
  }
}

function drawFloor(g, ctx) {
  const { w, h } = g.level;
  ctx.fillStyle = '#10141d';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(70,84,120,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 40; x < w; x += 40) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 40; y < h; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
}

function drawShadow(g, ctx) {
  ctx.fillStyle = 'rgba(3,5,9,0.55)';
  for (const r of g.level.shadow) ctx.fillRect(r.x, r.y, r.w, r.h);
}

function drawLights(g, ctx) {
  for (const l of g.level.lights) {
    const grad = ctx.createRadialGradient(l.x, l.y, 8, l.x, l.y, l.r);
    grad.addColorStop(0, 'rgba(255,222,140,0.16)');
    grad.addColorStop(0.6, 'rgba(255,222,140,0.07)');
    grad.addColorStop(1, 'rgba(255,222,140,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,222,140,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCover(g, ctx) {
  for (const c of g.level.cover) {
    if (c.type === 'desk') {
      ctx.fillStyle = '#38455f';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = '#4d5f82';
      ctx.fillRect(c.x + 2, c.y + 2, c.w - 4, 5);
      ctx.strokeStyle = '#232c40';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
    } else if (c.type === 'crate') {
      ctx.fillStyle = '#7a5a34';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = '#95713f';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
      ctx.strokeStyle = 'rgba(149,113,63,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c.x + 3, c.y + 3);
      ctx.lineTo(c.x + c.w - 3, c.y + c.h - 3);
      ctx.moveTo(c.x + c.w - 3, c.y + 3);
      ctx.lineTo(c.x + 3, c.y + c.h - 3);
      ctx.stroke();
    } else if (c.type === 'shelf') {
      ctx.fillStyle = '#4a3a28';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = '#6b533a';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      ctx.strokeStyle = 'rgba(107,83,58,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = c.y + 7; y < c.y + c.h - 3; y += 7) {
        ctx.moveTo(c.x + 3, y);
        ctx.lineTo(c.x + c.w - 3, y);
      }
      ctx.stroke();
    } else if (c.type === 'plant') {
      ctx.fillStyle = '#3a2f26';
      ctx.fillRect(c.x + 5, c.y + 5, c.w - 10, c.h - 10);
      ctx.fillStyle = '#2f6b3f';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2 - 4, 8, 0, Math.PI * 2);
      ctx.arc(c.x + c.w / 2 - 6, c.y + c.h / 2 + 3, 6, 0, Math.PI * 2);
      ctx.arc(c.x + c.w / 2 + 6, c.y + c.h / 2 + 3, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawWalls(g, ctx) {
  for (const w of g.level.walls) {
    ctx.fillStyle = '#2c3550';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = 'rgba(86,102,148,0.5)';
    ctx.fillRect(w.x, w.y, w.w, 3);
    ctx.strokeStyle = '#1b2135';
    ctx.lineWidth = 1;
    ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
  }
}

function drawExit(g, ctx) {
  const e = g.exit;
  if (g.exitOpen) {
    const pulse = 0.5 + 0.5 * Math.sin(g.time * 5);
    ctx.fillStyle = `rgba(70,224,124,${0.18 + pulse * 0.16})`;
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.strokeStyle = `rgba(70,224,124,${0.65 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(e.x + 1, e.y + 1, e.w - 2, e.h - 2);
    ctx.fillStyle = '#8effb0';
    ctx.font = `bold ${13}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', e.x + e.w / 2, e.y + e.h / 2);
  } else {
    ctx.fillStyle = 'rgba(20,16,20,0.85)';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.strokeStyle = 'rgba(255,82,82,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(e.x + 1, e.y + 1, e.w - 2, e.h - 2);
    ctx.strokeStyle = 'rgba(255,82,82,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = e.x + 8; x < e.x + e.w; x += 14) {
      ctx.moveTo(x, e.y + 4);
      ctx.lineTo(x - 6, e.y + e.h - 4);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,130,130,0.7)';
    ctx.font = `bold ${9}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOCKED', e.x + e.w / 2, e.y + e.h / 2);
  }
}

function drawLoot(g, ctx) {
  for (const l of g.level.loot) {
    if (l.taken) continue;
    const gold = l.kind === 'gold';
    const col = gold ? '255,211,77' : '89,242,255';
    const pulse = 0.5 + 0.5 * Math.sin(g.time * 3 + l.x);
    const grad = ctx.createRadialGradient(l.x, l.y, 3, l.x, l.y, 46 + pulse * 8);
    grad.addColorStop(0, `rgba(${col},0.5)`);
    grad.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 46 + pulse * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(g.time * (gold ? 0.9 : -0.7));
    ctx.fillStyle = `rgb(${col})`;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawNoise(g, ctx) {
  for (const ring of g.noiseRings) {
    const k = ring.t / ring.dur;
    const alpha = 0.4 * (1 - k);
    ctx.strokeStyle = `rgba(200,220,255,${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCones(g, ctx) {
  for (const guard of g.guards) {
    const col = guardConeColor(guard.suspicion);
    const pts = conePoints(guard.x, guard.y, guard.facing, GUARD_FOV, guard.visRange, g.sight, 36);
    drawPolygon(ctx, pts, `rgba(${col.fill},0.13)`, `rgba(${col.edge},0.45)`, 1.5);
  }
  for (const cam of g.cameras) {
    if (g.empTimer > 0) {
      const pts = conePoints(cam.x, cam.y, cam.dir, cam.fov, cam.range * 0.35, g.sight, 14);
      drawPolygon(ctx, pts, 'rgba(120,130,150,0.04)', 'rgba(120,130,150,0.12)', 1);
      continue;
    }
    const col = cam.sees ? { fill: '255,45,149', edge: '255,45,149' } : { fill: '255,64,208', edge: '255,64,208' };
    const pts = conePoints(cam.x, cam.y, cam.dir, cam.fov, cam.range, g.sight, 36);
    drawPolygon(ctx, pts, `rgba(${col.fill},${cam.sees ? 0.2 : 0.12})`, `rgba(${col.edge},${cam.sees ? 0.6 : 0.4})`, 1.5);
  }
}

function drawCameras(g, ctx) {
  for (const cam of g.cameras) {
    const off = g.empTimer > 0;
    ctx.strokeStyle = '#1b2135';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cam.x, cam.y);
    const mount = 10;
    ctx.lineTo(cam.x + Math.cos(cam.dir) * mount, cam.y + Math.sin(cam.dir) * mount);
    ctx.stroke();
    ctx.fillStyle = off ? '#2a3040' : '#39415a';
    ctx.strokeStyle = off ? '#3a4256' : '#5a688f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(cam.x - 7, cam.y - 5, 14, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = off ? '#556' : cam.sees ? '#ff2d95' : '#ff40d0';
    ctx.beginPath();
    ctx.arc(cam.x + Math.cos(cam.dir) * 6, cam.y + Math.sin(cam.dir) * 6, 3, 0, Math.PI * 2);
    ctx.fill();
    if (off && Math.floor(g.time * 6) % 2 === 0) {
      ctx.strokeStyle = '#6ee7ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cam.x - 4, cam.y - 4);
      ctx.lineTo(cam.x + 4, cam.y + 4);
      ctx.moveTo(cam.x + 4, cam.y - 4);
      ctx.lineTo(cam.x - 4, cam.y + 4);
      ctx.stroke();
    }
  }
}

function drawGuards(g, ctx) {
  for (const guard of g.guards) {
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(guard.x, guard.y + guard.r * 0.75, guard.r * 0.9, guard.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a9a4a';
    ctx.strokeStyle = '#2c3518';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, guard.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5c6a33';
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.facing) * 5, guard.y + Math.sin(guard.facing) * 5, guard.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c2410';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(guard.x + Math.cos(guard.facing) * (guard.r - 2), guard.y + Math.sin(guard.facing) * (guard.r - 2));
    ctx.lineTo(guard.x + Math.cos(guard.facing) * (guard.r + 6), guard.y + Math.sin(guard.facing) * (guard.r + 6));
    ctx.stroke();
    if (guard.suspicion > 0.15) {
      const col = guardConeColor(guard.suspicion);
      const bounce = Math.sin(g.time * 9) * 2;
      ctx.fillStyle = `rgb(${col.edge})`;
      ctx.font = `bold ${16 + Math.floor(guard.suspicion * 5)}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('!', guard.x, guard.y - guard.r - 4 + bounce);
    }
  }
}

function drawPlayer(g, ctx) {
  const p = g.player;
  ctx.globalAlpha = p.sneaking ? 0.85 : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + p.r * 0.75, p.r * 0.85, p.r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8ecf4';
  ctx.strokeStyle = '#0c0f16';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#39415a';
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.facing) * (p.r - 1), p.y + Math.sin(p.facing) * (p.r - 1));
  ctx.lineTo(p.x + Math.cos(p.facing + 2.5) * (p.r * 0.55), p.y + Math.sin(p.facing + 2.5) * (p.r * 0.55));
  ctx.lineTo(p.x + Math.cos(p.facing - 2.5) * (p.r * 0.55), p.y + Math.sin(p.facing - 2.5) * (p.r * 0.55));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  if (p.empFlash > 0) {
    const k = 1 - p.empFlash / 0.6;
    ctx.strokeStyle = `rgba(110,231,255,${(1 - k) * 0.8})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, k * 260, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function centerText(ctx, txt, x, y, size, color, weight = 'bold') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, x, y);
}

function drawScreens(g, ctx) {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  if (g.state === 'play') {
    if (g.toast !== null && g.toast.t > 0) {
      ctx.globalAlpha = clamp(g.toast.t / 0.4, 0, 1);
      ctx.fillStyle = 'rgba(5,7,12,0.82)';
      ctx.strokeStyle = 'rgba(255,211,77,0.5)';
      ctx.lineWidth = 1;
      const w = 380;
      ctx.fillRect(cw / 2 - w / 2, ch - 74, w, 34);
      ctx.strokeRect(cw / 2 - w / 2, ch - 74, w, 34);
      centerText(ctx, g.toast.text, cw / 2, ch - 57, 13, '#ffd34d');
      ctx.globalAlpha = 1;
    }
    return;
  }
  ctx.fillStyle = 'rgba(4,6,11,0.8)';
  ctx.fillRect(0, 0, cw, ch);
  centerText(ctx, `LEVEL ${g.levelIndex + 1} / 3`, cw / 2, 74, 13, '#5d6a83');
  if (g.state === 'title') {
    ctx.fillStyle = 'rgba(255,211,77,0.12)';
    ctx.fillRect(0, 0, cw, 3);
    centerText(ctx, 'MIDNIGHT VAULT', cw / 2, 208, 54, '#ffd34d');
    centerText(ctx, 'Sneak in. Grab the loot. Slip out unseen.', cw / 2, 268, 17, '#c8d2e4');
    centerText(ctx, 'WASD / ARROWS move      SHIFT sneak', cw / 2, 330, 14, '#8a97b0', 'normal');
    centerText(ctx, 'E emp pulse      R restart      1-3 jump level', cw / 2, 356, 14, '#8a97b0', 'normal');
    centerText(ctx, 'Cones spot you: guards turn red, cameras magenta.', cw / 2, 398, 13, '#5d6a83', 'normal');
    if ((g.time * 2) % 1 < 0.75) {
      centerText(ctx, 'PRESS ANY KEY', cw / 2, 476, 18, '#e8ecf4');
    }
  } else if (g.state === 'caught') {
    ctx.fillStyle = 'rgba(120,10,10,0.28)';
    ctx.fillRect(0, 0, cw, ch);
    centerText(ctx, 'CAUGHT', cw / 2, 236, 58, '#ff5252');
    const by = g.caughtBy === 'camera' ? 'A SECURITY CAMERA MADE YOU.' : 'A GUARD MADE YOU.';
    centerText(ctx, by, cw / 2, 300, 18, '#ffb3b3');
    centerText(ctx, 'R — RESTART THE LEVEL', cw / 2, 366, 16, '#c8d2e4');
  } else if (g.state === 'clear') {
    centerText(ctx, 'ROOM CLEARED', cw / 2, 236, 50, '#46e07c');
    centerText(ctx, `TIME ${g.levelTime.toFixed(1)}s`, cw / 2, 296, 18, '#c8d2e4');
    if ((g.time * 2) % 1 < 0.75) {
      centerText(ctx, 'PRESS ANY KEY FOR THE NEXT ROOM', cw / 2, 360, 16, '#e8ecf4');
    }
  } else if (g.state === 'final') {
    centerText(ctx, 'HEIST COMPLETE', cw / 2, 226, 50, '#ffd34d');
    centerText(ctx, `TOTAL TIME ${g.totalTime.toFixed(1)}s`, cw / 2, 288, 19, '#c8d2e4');
    centerText(ctx, 'The vault sleeps. You do not.', cw / 2, 324, 14, '#5d6a83', 'normal');
    if ((g.time * 2) % 1 < 0.75) {
      centerText(ctx, 'R — PLAY AGAIN', cw / 2, 392, 17, '#e8ecf4');
    }
  }
}

export function updateHud(g) {
  hud.level.textContent = `${g.levelIndex + 1} · ${g.level.name}`;
  const a = g.alarm;
  hud.alarmFill.style.width = `${(a * 100).toFixed(1)}%`;
  hud.alarmFill.className = a > 0.88 ? 'crit' : a > 0.65 ? 'hot' : a > 0.35 ? 'warn' : '';
  hud.loot.textContent = `${g.lootTaken}/${g.lootTotal}`;
  hud.emp.textContent = ('◆'.repeat(g.empCharges) + '◇'.repeat(Math.max(0, 2 - g.empCharges))).split('').join(' ');
  hud.sneak.textContent = g.player.sneaking ? 'ON' : 'UP';
  let status = 'HIDDEN';
  let cls = '';
  if (g.state !== 'play') {
    status = '—';
  } else if (g.guardSpot !== null || g.cameraSpot !== null) {
    status = g.cameraSpot !== null ? 'SPOTTED — CAMERA' : 'SPOTTED — GUARD';
    cls = 'seen';
  } else if (g.exitOpen) {
    status = 'EXIT OPEN — RUN';
    cls = 'caution';
  } else if (a > 0.12) {
    status = 'SUSPICION RISING';
    cls = 'caution';
  }
  hud.status.textContent = status;
  hud.status.className = cls;
}

export function render(g, ctx) {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, cw, ch);
  const { scale, ox, oy } = g.view;
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  drawFloor(g, ctx);
  drawShadow(g, ctx);
  drawLights(g, ctx);
  drawExit(g, ctx);
  drawLoot(g, ctx);
  drawNoise(g, ctx);
  drawCones(g, ctx);
  drawCover(g, ctx);
  drawWalls(g, ctx);
  drawCameras(g, ctx);
  drawGuards(g, ctx);
  drawPlayer(g, ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawScreens(g, ctx);
  updateHud(g);
}
