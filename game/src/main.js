// main.js — Lumenfall's boot and frame loop.
// Owns the canvas, the screen state machine (title → playing ⇄ shop →
// victory/defeat), the fixed-step accumulator, sound triggers drained from
// the world's event queue, and the deterministic screenshot mode
// (?shot=<scene>&seed=<n>) the entry's screenshots are taken with.

import { createWorld, STEP } from './world.js';
import { createRenderer } from './render.js';
import { drawTitle, drawShop, drawEnd } from './screens.js';
import { attachInput } from './input.js';
import { makeAudio } from './audio.js';
import { stageScene, botFrame, botShop } from './director.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const audio = makeAudio();

const ui = {
  screen: 'title', // 'title' | 'game'
  difficulty: 'radiant',
  mouse: { x: 0, y: 0 },
  best: 0,
  paused: false,
  speed: 1,
  regions: [],
};
try {
  ui.best = Number(localStorage.getItem('lumenfall-best') || 0) || 0;
} catch (err) { /* private mode: no saved best */ }

function toWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

const input = attachInput(canvas, (cx, cy) => toWorld(cx, cy));

// The title's attract mode: a bot game plays itself behind the menu.
let backdrop = stageScene('title', 7);
let world = null;

function startRun() {
  world = createWorld((Math.random() * 1e9) >>> 0, ui.difficulty);
  world.startGame();
  ui.screen = 'game';
  ui.paused = false;
  ui.speed = 1;
}

function saveBest(score) {
  if (score > ui.best) {
    ui.best = score;
    try { localStorage.setItem('lumenfall-best', String(ui.best)); } catch (err) { /* ignore */ }
  }
}

let lastShootSfx = 0;
let lastHitSfx = 0;
let lastOrbSfx = 0;
function playEvents(events, now) {
  for (const ev of events) {
    switch (ev.type) {
      case 'shoot': if (now - lastShootSfx > 55) { audio.shoot(); lastShootSfx = now; } break;
      case 'hit': if (now - lastHitSfx > 45) { audio.hit(); lastHitSfx = now; } break;
      case 'die': audio.enemyDie(); break;
      case 'orb': if (now - lastOrbSfx > 40) { audio.orb(); lastOrbSfx = now; } break;
      case 'hurt': audio.hurt(); break;
      case 'lanternHurt': audio.lanternHurt(); break;
      case 'dash': audio.dash(); break;
      case 'buy': audio.buy(); break;
      case 'denied': audio.denied(); break;
      case 'wave': audio.waveHorn(); break;
      case 'bossSpawn': audio.bossRoar(); break;
      case 'victory': audio.victory(); break;
      case 'defeat': audio.defeat(); break;
      default: break;
    }
  }
}

function handleAction(region) {
  if (!region) return;
  if (region.action === 'difficulty') {
    ui.difficulty = region.id;
  } else if (region.action === 'start') {
    audio.unlock();
    startRun();
  } else if (region.action === 'buy' && world) {
    world.buyUpgrade(region.id);
  } else if (region.action === 'nextWave' && world) {
    world.nextWave();
  } else if (region.action === 'restart') {
    audio.unlock();
    startRun();
  }
}

canvas.addEventListener('pointermove', (ev) => {
  const rect = canvas.getBoundingClientRect();
  ui.mouse = toWorld(ev.clientX - rect.left, ev.clientY - rect.top);
});
canvas.addEventListener('pointerdown', (ev) => {
  audio.unlock();
  const rect = canvas.getBoundingClientRect();
  const p = toWorld(ev.clientX - rect.left, ev.clientY - rect.top);
  ui.mouse = p;
  for (const region of ui.regions) {
    if (p.x >= region.x && p.x <= region.x + region.w && p.y >= region.y && p.y <= region.y + region.h) {
      handleAction(region);
      return;
    }
  }
});
window.addEventListener('keydown', (ev) => {
  audio.unlock();
  if (ev.code === 'KeyM') audio.toggleMute();
  if (ev.code === 'Enter') {
    if (ui.screen === 'title') startRun();
    else if (world && world.screen === 'shop') world.nextWave();
    else if (world && (world.screen === 'victory' || world.screen === 'defeat')) startRun();
  }
});

function drawPaused() {
  const ctx = renderer.ctx;
  ctx.save();
  ctx.fillStyle = 'rgba(4,5,16,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.font = '700 54px "Palatino Linotype", Georgia, serif';
  ctx.fillStyle = '#f4ecd8';
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 6);
  ctx.font = '600 17px Verdana, sans-serif';
  ctx.fillStyle = '#9aa3c7';
  ctx.fillText('P or Esc to resume · M to mute', canvas.width / 2, canvas.height / 2 + 30);
  ctx.restore();
}

let lastTs = 0;
let accumulator = 0;
function frameLoop(ts) {
  requestAnimationFrame(frameLoop);
  const dtReal = Math.min(0.1, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  const now = performance.now();

  if (ui.screen === 'title') {
    // Attract mode: the bot defends the lantern behind the menu.
    accumulator += dtReal;
    let guard = 0;
    while (accumulator >= STEP && guard < 5) {
      if (backdrop.screen === 'shop') botShop(backdrop);
      if (backdrop.screen === 'playing') backdrop.step(botFrame(backdrop));
      if (backdrop.screen === 'victory' || backdrop.screen === 'defeat') {
        backdrop = stageScene('title', 7 + ((Math.random() * 500) | 0));
      }
      accumulator -= STEP;
      guard++;
    }
    const events = backdrop.events.splice(0, backdrop.events.length);
    renderer.consumeEvents(events);
    renderer.drawWorld(backdrop, dtReal, { hud: false });
    ui.regions = drawTitle(renderer.ctx, backdrop, ui);
    return;
  }

  if (!world) return;
  const frame = input.snapshot();
  if (frame.pausePressed && world.screen === 'playing') ui.paused = !ui.paused;
  if (frame.speedPressed) ui.speed = ui.speed === 1 ? 2 : 1;

  if (!ui.paused && world.screen === 'playing') {
    accumulator += dtReal * ui.speed;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      world.step(frame);
      accumulator -= STEP;
      guard++;
      if (world.screen !== 'playing') { accumulator = 0; break; }
    }
  }
  const events = world.events.splice(0, world.events.length);
  renderer.consumeEvents(events);
  playEvents(events, now);
  if (world.result) saveBest(world.result.score);

  renderer.drawWorld(world, dtReal, { hud: true });
  if (world.screen === 'shop') {
    ui.regions = drawShop(renderer.ctx, world, ui);
  } else if (world.screen === 'victory' || world.screen === 'defeat') {
    ui.regions = drawEnd(renderer.ctx, world, ui);
  } else {
    ui.regions = [];
  }
  if (ui.paused) drawPaused();
}

// ---- deterministic screenshot mode ----
const params = new URLSearchParams(location.search);
if (params.has('shot')) {
  const name = params.get('shot');
  const seed = Number(params.get('seed') || 7);
  const sceneWorld = stageScene(name, seed);
  renderer.seedScenery(seed * 31 + 5);
  renderer.consumeEvents(sceneWorld.events.splice(0, sceneWorld.events.length));
  ui.difficulty = 'radiant';
  ui.best = 12840;
  if (name === 'title') {
    renderer.drawWorld(sceneWorld, 0, { hud: false });
    drawTitle(renderer.ctx, sceneWorld, ui);
  } else if (name === 'victory') {
    renderer.drawWorld(sceneWorld, 0, { hud: false });
    drawEnd(renderer.ctx, sceneWorld, ui);
  } else if (name === 'shop') {
    renderer.drawWorld(sceneWorld, 0, { hud: false });
    drawShop(renderer.ctx, sceneWorld, ui);
  } else {
    renderer.drawWorld(sceneWorld, 0, { hud: true });
  }
  window.__shotReady = true;
} else {
  requestAnimationFrame(frameLoop);
}
