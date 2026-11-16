// screens.js — Lumenfall's menu screens: title, the Dew Shop, victory and
// defeat. Each draw function paints over the world and returns the list of
// clickable regions it laid out, so main.js can route the mouse to them.

import { WORLD_W, WORLD_H, TOTAL_WAVES, DIFFICULTIES } from './world.js';
import { UPGRADES, costAt } from './upgrades.js';
import { FONT_TITLE, FONT_BODY, PALETTE, roundRectPath } from './render.js';

function panel(ctx, x, y, w, h, alpha = 0.88) {
  roundRectPath(ctx, x, y, w, h, 18);
  ctx.fillStyle = `rgba(10,12,32,${alpha})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,217,138,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function button(ctx, x, y, w, h, label, mouse, opts = {}) {
  const hover = mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
  roundRectPath(ctx, x, y, w, h, 12);
  ctx.fillStyle = opts.disabled
    ? 'rgba(40,42,70,0.8)'
    : hover ? 'rgba(255,190,90,0.92)' : 'rgba(214,150,52,0.88)';
  ctx.fill();
  ctx.font = `700 ${opts.size || 20}px ${FONT_BODY}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = opts.disabled ? '#6d7396' : '#231303';
  ctx.fillText(label, x + w / 2, y + h / 2 + (opts.size || 20) * 0.36);
  return { x, y, w, h };
}

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = PALETTE.gold;
    ctx.shadowColor = 'rgba(255,190,80,0.9)';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.strokeStyle = 'rgba(244,236,216,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function icon(ctx, id, cx, cy, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.4;
  switch (id) {
    case 'bolt':
      ctx.beginPath();
      ctx.moveTo(2, -11); ctx.lineTo(-6, 2); ctx.lineTo(-1, 2); ctx.lineTo(-2, 11); ctx.lineTo(6, -2); ctx.lineTo(1, -2);
      ctx.closePath(); ctx.fill();
      break;
    case 'wick':
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.quadraticCurveTo(7, -2, 5, 4);
      ctx.quadraticCurveTo(3, 10, 0, 10);
      ctx.quadraticCurveTo(-3, 10, -5, 4);
      ctx.quadraticCurveTo(-7, -2, 0, -11);
      ctx.fill();
      break;
    case 'split':
      for (const dx of [-8, 0, 8]) {
        ctx.beginPath(); ctx.arc(dx, -4 + Math.abs(dx) * 0.4, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(dx, -1); ctx.stroke();
      }
      break;
    case 'boot':
      ctx.beginPath();
      ctx.moveTo(-4, -10); ctx.lineTo(3, -10); ctx.lineTo(3, 3); ctx.lineTo(10, 6); ctx.lineTo(10, 10);
      ctx.lineTo(-4, 10); ctx.closePath(); ctx.fill();
      break;
    case 'heart':
      ctx.beginPath();
      ctx.moveTo(0, 9);
      ctx.bezierCurveTo(-13, -1, -7, -11, 0, -5);
      ctx.bezierCurveTo(7, -11, 13, -1, 0, 9);
      ctx.fill();
      break;
    case 'magnet':
      ctx.beginPath();
      ctx.arc(0, -1, 8, Math.PI, 0);
      ctx.lineTo(8, 9); ctx.lineTo(3, 9); ctx.lineTo(3, -1);
      ctx.arc(0, -1, 3, 0, Math.PI, true);
      ctx.lineTo(-3, 9); ctx.lineTo(-8, 9); ctx.lineTo(-8, -1);
      ctx.closePath(); ctx.fill();
      break;
    case 'dash':
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-11 + i * 2, -6 + i * 6);
        ctx.lineTo(1 + i * 2, -6 + i * 6);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(4, -9); ctx.lineTo(12, 0); ctx.lineTo(4, 9); ctx.stroke();
      break;
    case 'ward':
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.quadraticCurveTo(8, -9, 9, -8);
      ctx.quadraticCurveTo(9, 4, 0, 11);
      ctx.quadraticCurveTo(-9, 4, -9, -8);
      ctx.quadraticCurveTo(-8, -9, 0, -11);
      ctx.stroke();
      break;
    default: break;
  }
  ctx.restore();
}

export function drawTitle(ctx, world, ui) {
  const regions = [];
  ctx.save();
  ctx.fillStyle = 'rgba(4,5,16,0.45)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.textAlign = 'center';
  // Title with a lantern glow behind the words.
  ctx.font = `700 96px ${FONT_TITLE}`;
  ctx.shadowColor = 'rgba(255,180,60,0.85)';
  ctx.shadowBlur = 42;
  ctx.fillStyle = PALETTE.goldCore;
  ctx.fillText('LUMENFALL', WORLD_W / 2, 168);
  ctx.shadowBlur = 0;
  ctx.font = `600 23px ${FONT_BODY}`;
  ctx.fillStyle = PALETTE.paper;
  ctx.fillText('— Lanterns Against the Gloam —', WORLD_W / 2, 208);
  ctx.font = `500 17px ${FONT_BODY}`;
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText('Twelve waves of darkness come to snuff the Great Lantern.', WORLD_W / 2, 258);
  ctx.fillText('You are its keeper. Hold the light until dawn.', WORLD_W / 2, 284);

  // Difficulty choices.
  const diffs = Object.entries(DIFFICULTIES);
  const bw = 240, bh = 74, gap = 26;
  const totalW = bw * 3 + gap * 2;
  let x = (WORLD_W - totalW) / 2;
  ctx.font = `700 15px ${FONT_BODY}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText('CHOOSE THE NIGHT', WORLD_W / 2, 336);
  for (const [key, d] of diffs) {
    const selected = ui.difficulty === key;
    roundRectPath(ctx, x, 352, bw, bh, 12);
    ctx.fillStyle = selected ? 'rgba(84,56,16,0.95)' : 'rgba(13,15,38,0.95)';
    ctx.fill();
    ctx.strokeStyle = selected ? PALETTE.gold : 'rgba(154,163,199,0.4)';
    ctx.lineWidth = selected ? 2.6 : 1.4;
    ctx.stroke();
    ctx.font = `700 21px ${FONT_TITLE}`;
    ctx.fillStyle = selected ? PALETTE.goldCore : PALETTE.paper;
    ctx.fillText(d.name.toUpperCase(), x + bw / 2, 384);
    ctx.font = `500 13px ${FONT_BODY}`;
    ctx.fillStyle = PALETTE.dim;
    const sub = key === 'ember' ? 'A gentler dark · score ×1.0'
      : key === 'radiant' ? 'The true night · score ×1.5'
      : 'A hungry dark · score ×2.2';
    ctx.fillText(sub, x + bw / 2, 408);
    regions.push({ action: 'difficulty', id: key, x, y: 352, w: bw, h: bh });
    x += bw + gap;
  }

  const start = button(ctx, WORLD_W / 2 - 170, 462, 340, 62, 'BEGIN THE NIGHT', ui.mouse, { size: 23 });
  regions.push({ action: 'start', ...start });

  ctx.font = `500 15.5px ${FONT_BODY}`;
  ctx.fillStyle = PALETTE.paper;
  ctx.fillText('Move  WASD / Arrows      Aim  Mouse      Fire  Hold Click      Dash  Shift / Space', WORLD_W / 2, 566);
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText('Pause  P      Speed  1 / 2      Mute  M      ·      Slay the Gloam, gather dew, and shop between waves.', WORLD_W / 2, 592);
  if (ui.best > 0) {
    ctx.font = `700 16px ${FONT_BODY}`;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`Best score  ${ui.best.toLocaleString('en-US')}`, WORLD_W / 2, 636);
  }
  ctx.restore();
  return regions;
}

export function drawShop(ctx, world, ui) {
  const regions = [];
  ctx.save();
  ctx.fillStyle = 'rgba(4,5,16,0.55)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  const px = 90, py = 56, pw = WORLD_W - 180, ph = WORLD_H - 112;
  panel(ctx, px, py, pw, ph);
  ctx.textAlign = 'center';
  ctx.font = `700 38px ${FONT_TITLE}`;
  ctx.fillStyle = PALETTE.goldCore;
  ctx.fillText('THE DEW SHOP', WORLD_W / 2, py + 52);
  ctx.font = `600 16px ${FONT_BODY}`;
  ctx.fillStyle = PALETTE.paper;
  ctx.fillText(`Wave ${world.wave} of ${TOTAL_WAVES} held. The dark gathers again…`, WORLD_W / 2, py + 80);
  ctx.font = `700 19px ${FONT_BODY}`;
  ctx.fillStyle = PALETTE.dew;
  ctx.fillText(`💧 ${world.dew} dew to spend`, WORLD_W / 2, py + 108);

  // Upgrade cards, 4 across and 2 down.
  const cols = 4, rows = 2;
  const cw = (pw - 60 - (cols - 1) * 16) / cols;
  const ch = 168;
  for (let i = 0; i < UPGRADES.length; i++) {
    const up = UPGRADES[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = px + 30 + col * (cw + 16);
    const y = py + 128 + row * (ch + 14);
    const lvl = world.levels[up.id];
    const maxed = lvl >= up.maxLevel;
    const cost = costAt(up, lvl);
    const afford = !maxed && world.dew >= cost;
    roundRectPath(ctx, x, y, cw, ch, 12);
    ctx.fillStyle = 'rgba(20,22,52,0.92)';
    ctx.fill();
    ctx.strokeStyle = afford ? 'rgba(255,217,138,0.55)' : 'rgba(120,128,170,0.3)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    icon(ctx, up.icon, x + 26, y + 28, afford || maxed ? PALETTE.gold : '#5d6488');
    ctx.textAlign = 'left';
    ctx.font = `700 16.5px ${FONT_BODY}`;
    ctx.fillStyle = PALETTE.paper;
    ctx.fillText(up.name, x + 48, y + 34);
    // Level pips.
    for (let s = 0; s < up.maxLevel; s++) {
      ctx.beginPath();
      ctx.arc(x + 50 + s * 13, y + 50, 4, 0, Math.PI * 2);
      ctx.fillStyle = s < lvl ? PALETTE.gold : 'rgba(244,236,216,0.22)';
      ctx.fill();
    }
    ctx.font = `500 12.5px ${FONT_BODY}`;
    ctx.fillStyle = PALETTE.dim;
    wrapText(ctx, up.blurb, x + 14, y + 76, cw - 28, 16);
    ctx.font = `600 12.5px ${FONT_BODY}`;
    ctx.fillStyle = '#c9d2f2';
    if (!maxed) wrapText(ctx, up.describe(lvl), x + 14, y + 116, cw - 28, 16);
    // Buy strip.
    const by = y + ch - 36;
    roundRectPath(ctx, x + 10, by, cw - 20, 27, 8);
    ctx.fillStyle = maxed ? 'rgba(60,64,96,0.7)' : afford ? 'rgba(214,150,52,0.9)' : 'rgba(52,55,88,0.8)';
    ctx.fill();
    ctx.font = `700 14px ${FONT_BODY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = maxed ? '#8b91ad' : afford ? '#231303' : '#79809f';
    ctx.fillText(maxed ? 'MASTERED' : `BUY · 💧 ${cost}`, x + cw / 2, by + 18.5);
    if (!maxed) regions.push({ action: 'buy', id: up.id, x: x + 10, y: by, w: cw - 20, h: 27 });
  }

  const next = button(ctx, WORLD_W / 2 - 190, py + ph - 58, 380, 46,
    `FACE WAVE ${world.wave + 1}  →`, ui.mouse, { size: 19 });
  regions.push({ action: 'nextWave', ...next });
  ctx.restore();
  return regions;
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (ctx.measureText(trial).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineH;
    } else {
      line = trial;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

// The keeper's grade for the night, from the raw score.
export function rankForScore(score) {
  if (score >= 30000) return 'S';
  if (score >= 22000) return 'A';
  if (score >= 15000) return 'B';
  if (score >= 9000) return 'C';
  return 'D';
}

function statGrid(ctx, world, cx, y) {
  const r = world.result;
  const mins = Math.floor(r.timeSec / 60);
  const secs = String(r.timeSec % 60).padStart(2, '0');
  const rows = [
    ['Score', r.score.toLocaleString('en-US')],
    ['Creatures felled', `${r.kills}`],
    ['Time in the dark', `${mins}:${secs}`],
    ['Dew gathered', `${r.dewEarned}`],
    ['Best kill streak', `×${r.bestCombo}`],
    ['Flawless waves', `${r.flawlessWaves}`],
    ['Bolt accuracy', `${Math.round((r.accuracy || 0) * 100)}%`],
  ];
  ctx.font = `600 17px ${FONT_BODY}`;
  let yy = y;
  for (const [k, v] of rows) {
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(k, cx - 14, yy);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.paper;
    ctx.fillText(v, cx + 14, yy);
    yy += 27;
  }
  return yy;
}

export function drawEnd(ctx, world, ui) {
  const regions = [];
  const r = world.result;
  ctx.save();
  ctx.fillStyle = r.won ? 'rgba(6,8,20,0.55)' : 'rgba(10,2,10,0.66)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  const pw = 560, ph = 520;
  const px = (WORLD_W - pw) / 2, py = (WORLD_H - ph) / 2;
  panel(ctx, px, py, pw, ph, 0.96);
  ctx.textAlign = 'center';
  if (r.won) {
    ctx.font = `700 52px ${FONT_TITLE}`;
    ctx.shadowColor = 'rgba(255,180,60,0.8)';
    ctx.shadowBlur = 26;
    ctx.fillStyle = PALETTE.goldCore;
    ctx.fillText('DAWN BREAKS', WORLD_W / 2, py + 76);
    ctx.shadowBlur = 0;
    for (let i = 0; i < 3; i++) {
      star(ctx, WORLD_W / 2 + (i - 1) * 74, py + 128, 27, i < r.stars);
    }
    ctx.font = `600 16px ${FONT_BODY}`;
    ctx.fillStyle = PALETTE.paper;
    ctx.fillText('The Great Lantern still burns. The glade is safe — tonight.', WORLD_W / 2, py + 166);
    ctx.font = `700 21px ${FONT_TITLE}`;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`— RANK ${rankForScore(r.score)} —`, WORLD_W / 2, py + 198);
  } else {
    ctx.font = `700 46px ${FONT_TITLE}`;
    ctx.fillStyle = '#e8b7c2';
    ctx.fillText('THE LIGHT GOES OUT', WORLD_W / 2, py + 76);
    ctx.font = `600 16.5px ${FONT_BODY}`;
    ctx.fillStyle = PALETTE.paper;
    ctx.fillText(r.reason, WORLD_W / 2, py + 116);
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(`The night claimed you on wave ${r.waves} of ${TOTAL_WAVES}.`, WORLD_W / 2, py + 142);
  }
  statGrid(ctx, world, WORLD_W / 2, py + (r.won ? 234 : 190));
  const again = button(ctx, WORLD_W / 2 - 150, py + ph - 74, 300, 52,
    r.won ? 'PLAY AGAIN' : 'TRY AGAIN', ui.mouse, { size: 21 });
  regions.push({ action: 'restart', ...again });
  ctx.restore();
  return regions;
}
