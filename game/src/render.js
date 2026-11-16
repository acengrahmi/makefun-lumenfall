// render.js — everything Lumenfall draws.
// A canvas-2D night glade in layers: parallax starfields and drifting mist,
// a rune-ringed clearing, the Great Lantern's pool of light, then creatures,
// bolts and particles, and the HUD last. Particles and other visual noise
// run on their own seeded generator so staged scenes frame identically.

import { WORLD_W, WORLD_H, TOTAL_WAVES } from './world.js';
import { BOSSES } from './enemies.js';
import { makeRng } from './rng.js';

export const FONT_TITLE = '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif';
export const FONT_BODY = '"Segoe UI", Verdana, Geneva, sans-serif';

export const PALETTE = {
  ink: '#070b1d',
  deep: '#0d1330',
  gold: '#ffd98a',
  goldCore: '#fff3c4',
  dew: '#8ef2d2',
  gloom: '#8d7fb8',
  gloomDark: '#3a2f5e',
  magenta: '#c77dff',
  crimson: '#ff5d7a',
  paper: '#f4ecd8',
  dim: '#9aa3c7',
};

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawBar(ctx, x, y, w, h, frac, fill, back = 'rgba(6,8,20,0.72)') {
  const f = Math.max(0, Math.min(1, frac));
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = back;
  ctx.fill();
  if (f > 0) {
    roundRectPath(ctx, x + 1.5, y + 1.5, Math.max(h - 3, (w - 3) * f), h - 3, (h - 3) / 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(244,236,216,0.35)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.stroke();
}

function makeGlowSprite(color, inner = 'rgba(255,255,255,0.9)') {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let visualRng = makeRng(1234);
  let particles = [];
  let floaters = [];
  let stars = [];
  let mists = [];
  const glowGold = makeGlowSprite('rgba(255,190,80,0.55)');
  const glowDew = makeGlowSprite('rgba(110,240,200,0.5)');
  const glowGloom = makeGlowSprite('rgba(150,110,255,0.45)');
  const glowRed = makeGlowSprite('rgba(255,80,110,0.5)');

  function seedScenery(seed) {
    visualRng = makeRng(seed);
    stars = [];
    for (let layer = 0; layer < 3; layer++) {
      const n = [90, 60, 34][layer];
      for (let i = 0; i < n; i++) {
        stars.push({
          x: visualRng.range(0, WORLD_W), y: visualRng.range(0, WORLD_H * 0.8),
          r: visualRng.range(0.6, layer === 2 ? 2.4 : 1.4),
          layer, tw: visualRng.range(0, Math.PI * 2),
        });
      }
    }
    mists = [];
    for (let i = 0; i < 7; i++) {
      mists.push({
        x: visualRng.range(0, WORLD_W), y: visualRng.range(60, WORLD_H - 60),
        r: visualRng.range(140, 320), sp: visualRng.range(2.5, 7),
        ph: visualRng.range(0, Math.PI * 2),
      });
    }
    particles = [];
    floaters = [];
  }
  seedScenery(1234);

  function burst(x, y, sprite, n, speed, life, size) {
    for (let i = 0; i < n; i++) {
      if (particles.length > 650) return;
      const a = visualRng.angle();
      const sp = visualRng.range(speed * 0.3, speed);
      particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 14,
        life: visualRng.range(life * 0.5, life), maxLife: life,
        size: visualRng.range(size * 0.5, size), sprite,
        drag: 0.9, grav: 26,
      });
    }
  }

  function consumeEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'die':
          burst(ev.x, ev.y, ev.boss ? glowRed : glowGloom, ev.boss ? 46 : 13, ev.boss ? 260 : 170, 0.8, ev.boss ? 46 : 26);
          if (ev.boss) floaters.push({ x: ev.x, y: ev.y - 40, text: 'BOSS FELLED', t: 0, color: PALETTE.gold, size: 30 });
          break;
        case 'hit': burst(ev.x, ev.y, glowGold, 3, 120, 0.3, 14); break;
        case 'hitShield': burst(ev.x, ev.y, glowGloom, 3, 110, 0.3, 14); break;
        case 'shieldBreak':
          burst(ev.x, ev.y, glowGloom, 16, 220, 0.6, 22);
          floaters.push({ x: ev.x, y: ev.y - 24, text: 'WARD BROKEN', t: 0, color: '#cfc4ff', size: 17 });
          break;
        case 'orb': burst(ev.x, ev.y, glowDew, 2, 60, 0.35, 12); break;
        case 'dash': burst(ev.x, ev.y, glowGold, 8, 90, 0.4, 18); break;
        case 'summon': burst(ev.x, ev.y, glowGloom, 7, 80, 0.5, 20); break;
        case 'hurt': burst(ev.x, ev.y, glowRed, 10, 150, 0.5, 20); break;
        case 'lanternHurt': burst(ev.x, ev.y, glowRed, 8, 130, 0.5, 22); break;
        case 'bossPhase':
          burst(ev.x, ev.y, glowRed, 30, 300, 0.9, 34);
          break;
        case 'bossSpawn': burst(ev.x, ev.y, glowGloom, 36, 240, 1, 36); break;
        case 'combo':
          floaters.push({ x: ev.x, y: ev.y, text: `RAMPAGE ×${ev.combo}`, t: 0, color: PALETTE.gold, size: 22 });
          break;
        default: break;
      }
    }
  }

  function drawBackground(world, t) {
    const grad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    grad.addColorStop(0, '#05081a');
    grad.addColorStop(0.55, PALETTE.deep);
    grad.addColorStop(1, '#131038');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // Stars in three parallax layers, gently twinkling.
    for (const s of stars) {
      const drift = (t * (2 + s.layer * 2.4)) % (WORLD_W + 8);
      const x = (s.x + drift) % WORLD_W;
      const a = 0.35 + 0.3 * Math.sin(t * 1.4 + s.tw) + s.layer * 0.14;
      ctx.globalAlpha = Math.max(0.08, Math.min(1, a));
      ctx.fillStyle = s.layer === 2 ? '#ffeec2' : '#cdd8ff';
      ctx.beginPath();
      ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Mist banks sliding through the middle distance.
    for (const m of mists) {
      const x = ((m.x + t * m.sp) % (WORLD_W + m.r * 2)) - m.r;
      const g = ctx.createRadialGradient(x, m.y + Math.sin(t * 0.3 + m.ph) * 8, 4, x, m.y, m.r);
      g.addColorStop(0, 'rgba(90,100,170,0.10)');
      g.addColorStop(1, 'rgba(90,100,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    }
    // The glade: a worn clearing with a rune ring around the lantern.
    const lx = world.lantern.x, ly = world.lantern.y;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.scale(1, 0.62);
    const ground = ctx.createRadialGradient(0, 0, 30, 0, 0, 470);
    ground.addColorStop(0, 'rgba(64,58,110,0.5)');
    ground.addColorStop(0.7, 'rgba(40,36,78,0.35)');
    ground.addColorStop(1, 'rgba(30,26,60,0)');
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.arc(0, 0, 470, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,138,0.20)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 300, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,217,138,0.10)';
    ctx.beginPath();
    ctx.arc(0, 0, 336, 0, Math.PI * 2);
    ctx.stroke();
    // Rune ticks around the ring, slowly turning.
    ctx.rotate(t * 0.02);
    ctx.fillStyle = 'rgba(255,217,138,0.30)';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(292, -2, 16, 4);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawLantern(world, t) {
    const l = world.lantern;
    const frac = l.hp / l.maxHp;
    const flicker = 1 + Math.sin(t * 11) * 0.02 + Math.sin(t * 23.7) * 0.015;
    const lightR = (250 + 130 * frac) * flicker;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + 0.4 * frac;
    ctx.drawImage(glowGold, l.x - lightR, l.y - lightR, lightR * 2, lightR * 2);
    ctx.restore();
    // Post and cage.
    ctx.fillStyle = '#241b3a';
    ctx.fillRect(l.x - 4, l.y + 6, 8, 40);
    ctx.fillStyle = '#171126';
    ctx.beginPath();
    ctx.ellipse(l.x, l.y + 48, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2.5;
    roundRectPath(ctx, l.x - 13, l.y - 20, 26, 32, 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(l.x - 16, l.y - 20);
    ctx.lineTo(l.x, l.y - 32);
    ctx.lineTo(l.x + 16, l.y - 20);
    ctx.stroke();
    // Flame, shrinking as the lantern fades.
    const fh = 9 + 9 * frac + Math.sin(t * 13) * 1.6;
    const flame = ctx.createRadialGradient(l.x, l.y - 4, 1, l.x, l.y - 4, 16);
    flame.addColorStop(0, '#fff6d8');
    flame.addColorStop(0.5, '#ffca66');
    flame.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.ellipse(l.x, l.y - 4, 7.5, fh, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawOrb(o, t) {
    const bob = Math.sin(t * 4 + o.t * 3) * 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.75;
    ctx.drawImage(glowDew, o.x - 13, o.y - 13 + bob, 26, 26);
    ctx.restore();
    ctx.fillStyle = '#d9fff2';
    ctx.beginPath();
    ctx.arc(o.x, o.y + bob, o.value >= 5 ? 4.6 : 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEnemy(e, t) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.flash > 0;
    // Ground glow so creatures read against the dark.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4;
    const gs = e.radius * 3.4;
    ctx.drawImage(e.kind === 'boss' ? glowRed : glowGloom, -gs / 2, -gs / 2, gs, gs);
    ctx.restore();

    const body = flash ? '#ffffff' : null;
    switch (e.kind) {
      case 'moth': {
        const flap = Math.sin(t * 16 + e.t * 5) * 0.55;
        ctx.fillStyle = body || '#cfc4ee';
        for (const s of [-1, 1]) {
          ctx.save();
          ctx.rotate(s * (0.7 + flap * 0.4));
          ctx.beginPath();
          ctx.ellipse(s * 11, -3, 11, 5.5, s * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = body || '#5e548a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'wisp': {
        ctx.fillStyle = body || '#a794e8';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#efeaff';
        ctx.beginPath();
        ctx.arc(-2, -2, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'shade': {
        const windup = e.state === 'windup';
        ctx.fillStyle = body || (windup ? '#7a4fd0' : '#463a75');
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.quadraticCurveTo(13, -6, 11, 12);
        ctx.quadraticCurveTo(0, 7, -11, 12);
        ctx.quadraticCurveTo(-13, -6, 0, -15);
        ctx.fill();
        ctx.fillStyle = windup ? '#ffd2da' : '#ff8fa5';
        ctx.beginPath();
        ctx.arc(-3.5, -3, 1.8, 0, Math.PI * 2);
        ctx.arc(3.5, -3, 1.8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'spitter': {
        ctx.fillStyle = body || '#6d5aa8';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = body || '#8f7cc9';
        ctx.beginPath();
        ctx.arc(0, 2, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.magenta;
        ctx.beginPath();
        ctx.arc(0, -6, 3.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'splitter': {
        ctx.fillStyle = body || '#7d6ab0';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,14,44,0.65)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-8, -10); ctx.lineTo(-1, 0); ctx.lineTo(-7, 9);
        ctx.moveTo(9, -8); ctx.lineTo(2, 1); ctx.lineTo(8, 10);
        ctx.stroke();
        ctx.fillStyle = '#cdbffa';
        for (const [dx, dy] of [[-5, -3], [4, 4], [5, -6]]) {
          ctx.beginPath();
          ctx.arc(dx, dy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'veil': {
        ctx.fillStyle = body || '#584a8f';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e6deff';
        ctx.beginPath();
        ctx.arc(-3, -3, 2.2, 0, Math.PI * 2);
        ctx.arc(3.5, -3, 2.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'darter': {
        const ang = Math.atan2(e.vy, e.vx);
        ctx.rotate(ang);
        ctx.fillStyle = body || '#9a86d9';
        ctx.beginPath();
        ctx.moveTo(13, 0);
        ctx.lineTo(-8, -6.5);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 6.5);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'brute': {
        ctx.fillStyle = body || '#4c3d78';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = body || '#5f4c96';
        ctx.beginPath();
        ctx.arc(-6, -5, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,120,70,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-12, 4); ctx.lineTo(-2, -2); ctx.lineTo(4, 7); ctx.lineTo(13, 1);
        ctx.stroke();
        ctx.fillStyle = '#ffb37a';
        ctx.beginPath();
        ctx.arc(-4, -6, 2.4, 0, Math.PI * 2);
        ctx.arc(5, -6, 2.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'boss': {
        drawBossBody(e, t, body);
        break;
      }
      default: break;
    }
    ctx.restore();

    // Shield bubble for veils and shielded bosses.
    if (e.shield > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(190,170,255,0.8)';
      ctx.fillStyle = 'rgba(140,120,255,0.13)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 7 + Math.sin(t * 5 + e.t) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // Small health pip for the tougher kinds.
    if ((e.maxHp >= 40 || e.kind === 'boss') && e.hp < e.maxHp && e.kind !== 'boss') {
      drawBar(ctx, e.x - 16, e.y - e.radius - 12, 32, 4.5, e.hp / e.maxHp, '#b9a5ff');
    }
  }

  function drawBossBody(e, t, flashBody) {
    const r = e.radius;
    const pulse = 1 + Math.sin(t * 3.2) * 0.04;
    ctx.scale(pulse, pulse);
    if (e.bossId === 'herald') {
      ctx.fillStyle = flashBody || '#3c2f68';
      ctx.beginPath();
      ctx.moveTo(0, -r - 12);
      ctx.quadraticCurveTo(r, -r * 0.4, r * 0.8, r);
      ctx.quadraticCurveTo(0, r * 0.6, -r * 0.8, r);
      ctx.quadraticCurveTo(-r, -r * 0.4, 0, -r - 12);
      ctx.fill();
      ctx.strokeStyle = flashBody || '#c9a86a';
      ctx.lineWidth = 4;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * r * 0.4, -r - 8);
        ctx.quadraticCurveTo(s * r * 1.15, -r - 22, s * r * 1.05, -r * 0.2);
        ctx.stroke();
      }
      ctx.fillStyle = '#ff5d7a';
      ctx.beginPath();
      ctx.arc(-7, -8, 3.4, 0, Math.PI * 2);
      ctx.arc(7, -8, 3.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.bossId === 'mother') {
      ctx.fillStyle = flashBody || '#4a3876';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = flashBody || '#8f7cc9';
      ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + t * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
        ctx.quadraticCurveTo(
          Math.cos(a + 0.4) * r * 1.25, Math.sin(a + 0.4) * r * 1.25,
          Math.cos(a + 0.8) * r * 0.95, Math.sin(a + 0.8) * r * 0.95);
        ctx.stroke();
      }
      ctx.fillStyle = '#e6deff';
      ctx.beginPath();
      ctx.arc(-8, -4, 3.6, 0, Math.PI * 2);
      ctx.arc(8, -4, 3.6, 0, Math.PI * 2);
      ctx.arc(0, 6, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // The Gloamheart: a vast dark heart with a burning core.
      ctx.fillStyle = flashBody || '#2c1e52';
      ctx.beginPath();
      ctx.moveTo(0, r * 0.95);
      ctx.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.8, -r * 1.05, 0, -r * 0.45);
      ctx.bezierCurveTo(r * 0.8, -r * 1.05, r * 1.5, -r * 0.1, 0, r * 0.95);
      ctx.fill();
      const core = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 0.5);
      core.addColorStop(0, '#fff0f4');
      core.addColorStop(0.4, '#ff5d7a');
      core.addColorStop(1, 'rgba(255,60,100,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5 * (1 + Math.sin(t * 5) * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer(world, t) {
    const p = world.player;
    if (p.dead) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.iframes > 0 && Math.floor(t * 18) % 2 === 0) ctx.globalAlpha = 0.45;
    // Her own pool of light.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(glowGold, -52, -52, 104, 104);
    ctx.restore();
    // Cloak.
    ctx.fillStyle = '#b06a2c';
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.quadraticCurveTo(12, -4, 9, 13);
    ctx.quadraticCurveTo(0, 8, -9, 13);
    ctx.quadraticCurveTo(-12, -4, 0, -13);
    ctx.fill();
    ctx.fillStyle = '#e09a4a';
    ctx.beginPath();
    ctx.arc(0, -8, 6.4, 0, Math.PI * 2);
    ctx.fill();
    // Staff with its little lantern, toward the aim.
    const a = p.aimAngle;
    ctx.strokeStyle = '#6e4520';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
    ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19);
    ctx.stroke();
    ctx.fillStyle = PALETTE.goldCore;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 21, Math.sin(a) * 21, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawProjectiles(world) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of world.bolts) {
      ctx.drawImage(glowGold, b.x - 13, b.y - 13, 26, 26);
      ctx.strokeStyle = 'rgba(255,220,150,0.85)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const g of world.glooms) {
      ctx.drawImage(glowGloom, g.x - 15, g.y - 15, 30, 30);
      ctx.fillStyle = '#d9b8ff';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function stepParticles(dt) {
    for (const pt of particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += pt.grav * dt;
      pt.vx *= pt.drag;
      pt.vy *= pt.drag;
    }
    particles = particles.filter((pt) => pt.life > 0);
    for (const f of floaters) {
      f.t += dt;
      f.y -= 26 * dt;
    }
    floaters = floaters.filter((f) => f.t < 1.5);
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of particles) {
      const a = Math.max(0, pt.life / pt.maxLife);
      ctx.globalAlpha = a * 0.85;
      const s = pt.size * (0.5 + a * 0.5);
      ctx.drawImage(pt.sprite, pt.x - s / 2, pt.y - s / 2, s, s);
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    for (const f of floaters) {
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1.5);
      ctx.font = `700 ${f.size}px ${FONT_BODY}`;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  function drawHUD(world) {
    const p = world.player;
    ctx.save();
    // Wave and foes, top-left.
    ctx.textAlign = 'left';
    ctx.font = `700 21px ${FONT_TITLE}`;
    ctx.fillStyle = PALETTE.paper;
    ctx.fillText(`WAVE ${world.wave} / ${TOTAL_WAVES}`, 22, 36);
    ctx.font = `600 14px ${FONT_BODY}`;
    ctx.fillStyle = PALETTE.dim;
    const foes = world.enemies.length + world.spawnQueue.length;
    ctx.fillText(world.boss ? 'The boss is upon the glade!' : `${foes} creatures in the dark`, 22, 58);

    // Lantern health, top-centre.
    ctx.textAlign = 'center';
    ctx.font = `700 14px ${FONT_BODY}`;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('✦ THE GREAT LANTERN ✦', WORLD_W / 2, 26);
    drawBar(ctx, WORLD_W / 2 - 170, 34, 340, 13, world.lantern.hp / world.lantern.maxHp,
      world.lantern.hp / world.lantern.maxHp < 0.3 ? PALETTE.crimson : PALETTE.gold);

    // Score and dew, top-right.
    ctx.textAlign = 'right';
    ctx.font = `700 21px ${FONT_TITLE}`;
    ctx.fillStyle = PALETTE.paper;
    ctx.fillText(`${Math.round(world.score).toLocaleString('en-US')}`, WORLD_W - 22, 36);
    ctx.font = `700 16px ${FONT_BODY}`;
    ctx.fillStyle = PALETTE.dew;
    ctx.fillText(`💧 ${world.dew} dew`, WORLD_W - 22, 60);

    // Keeper health and dash, bottom-left.
    ctx.textAlign = 'left';
    ctx.font = `700 13px ${FONT_BODY}`;
    ctx.fillStyle = PALETTE.paper;
    ctx.fillText('KEEPER', 22, WORLD_H - 44);
    drawBar(ctx, 22, WORLD_H - 38, 210, 12, p.hp / world.stats.maxHp,
      p.hp / world.stats.maxHp < 0.3 ? PALETTE.crimson : '#ff9d5c');
    const dashFrac = 1 - Math.max(0, p.dashT) / world.stats.dashCooldown;
    drawBar(ctx, 22, WORLD_H - 20, 120, 7, dashFrac, PALETTE.dew);
    ctx.font = `600 11px ${FONT_BODY}`;
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('DASH', 150, WORLD_H - 13);

    // Combo, right side.
    if (world.combo >= 5) {
      ctx.textAlign = 'right';
      ctx.font = `800 ${Math.min(44, 24 + world.combo)}px ${FONT_TITLE}`;
      ctx.fillStyle = world.combo >= 25 ? PALETTE.crimson : PALETTE.gold;
      ctx.fillText(`×${world.combo}`, WORLD_W - 24, WORLD_H - 90);
      ctx.font = `600 12px ${FONT_BODY}`;
      ctx.fillStyle = PALETTE.dim;
      ctx.fillText('KILL STREAK', WORLD_W - 24, WORLD_H - 70);
    }

    // Boss health, bottom-centre.
    if (world.boss && !world.boss.dead) {
      const b = world.boss;
      ctx.textAlign = 'center';
      ctx.font = `700 16px ${FONT_TITLE}`;
      ctx.fillStyle = '#ffb3c2';
      ctx.fillText(BOSSES[b.bossId].name, WORLD_W / 2, WORLD_H - 34);
      drawBar(ctx, WORLD_W / 2 - 240, WORLD_H - 28, 480, 11, b.hp / b.maxHp, PALETTE.crimson);
      if (b.shield > 0) {
        drawBar(ctx, WORLD_W / 2 - 240, WORLD_H - 13, 480, 6, b.shield / Math.max(1, b.shieldMax), '#b9a5ff');
      }
    }
    ctx.restore();
  }

  function drawBanner(world) {
    if (!world.banner) return;
    const b = world.banner;
    const inA = Math.min(1, b.t / 0.4);
    const outA = Math.min(1, (b.dur - b.t) / 0.5);
    const a = Math.max(0, Math.min(inA, outA));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `700 46px ${FONT_TITLE}`;
    ctx.fillStyle = PALETTE.goldCore;
    ctx.shadowColor = 'rgba(255,180,60,0.8)';
    ctx.shadowBlur = 22;
    ctx.fillText(b.text, WORLD_W / 2, 150);
    ctx.shadowBlur = 0;
    if (b.sub) {
      ctx.font = `600 18px ${FONT_BODY}`;
      ctx.fillStyle = PALETTE.paper;
      ctx.fillText(b.sub, WORLD_W / 2, 182);
    }
    ctx.restore();
  }

  function drawVignette(world) {
    const g = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.42, WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.86);
    g.addColorStop(0, 'rgba(2,3,10,0)');
    g.addColorStop(1, 'rgba(2,3,10,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // The dark closes in as the lantern fades.
    const frac = world.lantern.hp / world.lantern.maxHp;
    if (frac < 0.45) {
      ctx.fillStyle = `rgba(10,0,16,${(0.45 - frac) * 0.5})`;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
  }

  return {
    ctx,
    seedScenery,
    consumeEvents,
    // One full frame of the world (no menus): used by play and shot scenes.
    // Pass { hud: false } for the title's attract backdrop, where the menu
    // carries the words and the world's own HUD would only clutter it.
    drawWorld(world, dt, opts = {}) {
      const t = world.time;
      ctx.save();
      if (world.shakeTrauma > 0) {
        const s = world.shakeTrauma * world.shakeTrauma * 13;
        ctx.translate(visualRng.range(-s, s), visualRng.range(-s, s));
      }
      drawBackground(world, t);
      for (const o of world.orbs) drawOrb(o, t);
      drawLantern(world, t);
      // Far creatures first so nearer ones overlap them.
      const sorted = [...world.enemies].sort((a, b) => a.y - b.y);
      for (const e of sorted) drawEnemy(e, t);
      drawPlayer(world, t);
      drawProjectiles(world);
      stepParticles(dt);
      drawParticles();
      ctx.restore();
      drawVignette(world);
      if (opts.hud !== false) {
        drawHUD(world);
        drawBanner(world);
      }
    },
    addFloater(x, y, text, color, size) {
      floaters.push({ x, y, text, t: 0, color, size });
    },
  };
}
