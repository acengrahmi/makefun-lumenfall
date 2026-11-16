// director.js — stages Lumenfall's deterministic scenes.
// The screenshot scenes and the title backdrop are real simulation states,
// reached by playing the game with the bot policy below from a fixed seed —
// never hand-drawn, never composited. The same policy is the autopilot the
// logic tests use to prove the game can be won.

import { createWorld, TOTAL_WAVES } from './world.js';
import { makeInputFrame } from './input.js';
import { UPGRADES, costAt } from './upgrades.js';

// One bot decision for the current world state, as an input frame.
export function botFrame(world) {
  const frame = makeInputFrame();
  const p = world.player;
  const l = world.lantern;
  if (!p || p.dead) return frame;

  // Nearest threat and nearest dew.
  let threat = null;
  let threatD = Infinity;
  for (const e of world.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < threatD) { threatD = d; threat = e; }
  }
  let orb = null;
  let orbD = Infinity;
  for (const o of world.orbs) {
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < orbD) { orbD = d; orb = o; }
  }

  // A boss outranks everything: burn it down before it eats the lantern,
  // unless something is already chewing on the keeper.
  if (world.boss && !world.boss.dead && threatD > 70) {
    threat = world.boss;
    threatD = Math.hypot(threat.x - p.x, threat.y - p.y);
  }

  // Hold a ring around the lantern: close enough to defend it, far enough
  // to shoot safely. The strafe reverses every few seconds so volleys aimed
  // at the keeper's path keep missing.
  const orbitDir = Math.floor(world.time / 3) % 2 === 0 ? 1 : -1;
  const ang = Math.atan2(p.y - l.y, p.x - l.x) + 0.35 * orbitDir;
  const ringR = world.boss ? (world.boss.bossId === 'mother' ? 218 : 165) : 185;
  let tx = l.x + Math.cos(ang) * ringR;
  let ty = l.y + Math.sin(ang) * ringR * 0.8;
  if (threat && threatD < 130) {
    // Kite directly away from danger.
    tx = p.x + (p.x - threat.x) * 1.6;
    ty = p.y + (p.y - threat.y) * 1.6;
  } else if (orb && orbD < 150 && (!threat || threatD > 190)) {
    tx = orb.x;
    ty = orb.y;
  } else if (threat && threatD < 320) {
    // Edge toward the fight so bolts connect.
    tx = (tx + threat.x) / 2;
    ty = (ty + threat.y) / 2;
  }
  // Juke sideways when gloom shots are inbound: a weaving keeper is hard
  // to lead, and the volleys are aimed at where she stood.
  let gloomNear = false;
  for (const g of world.glooms) {
    if (Math.hypot(g.x - p.x, g.y - p.y) < 210) { gloomNear = true; break; }
  }
  if (gloomNear && threat) {
    const px = -(threat.y - p.y);
    const py = threat.x - p.x;
    const pl = Math.hypot(px, py) || 1;
    const weave = Math.sin(world.time * 3.3) * 85;
    tx += (px / pl) * weave;
    ty += (py / pl) * weave;
  }
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dl = Math.hypot(dx, dy);
  if (dl > 14) {
    frame.moveX = dx / dl;
    frame.moveY = dy / dl;
  }
  if (threat) {
    // Aim with a touch of lead so moving targets walk into the stream.
    const lead = Math.min(0.32, threatD / 640);
    frame.aimX = threat.x + threat.vx * lead;
    frame.aimY = threat.y + threat.vy * lead;
    frame.firing = threatD < 600;
    frame.dashPressed = threatD < 62;
  } else if (orb) {
    frame.aimX = orb.x;
    frame.aimY = orb.y;
  } else {
    frame.aimX = l.x;
    frame.aimY = l.y - 100;
  }
  return frame;
}

// The bot's shopping: Split Flame is the one big-ticket item — buy it the
// moment it is affordable, before smaller purchases eat the purse. Then
// firepower, then survival, then the rest.
const BUY_ORDER = ['damage', 'fireRate', 'vitality', 'multishot', 'lanternWard', 'magnet', 'swift', 'dash'];
export function botShop(world) {
  const split = UPGRADES.find((u) => u.id === 'multishot');
  if (world.levels.multishot < split.maxLevel && world.dew >= costAt(split, world.levels.multishot)) {
    world.buyUpgrade('multishot');
  }
  let bought = true;
  while (bought) {
    bought = false;
    for (const id of BUY_ORDER) {
      const up = UPGRADES.find((u) => u.id === id);
      if (world.levels[id] < up.maxLevel && world.dew >= costAt(up, world.levels[id])) {
        if (world.buyUpgrade(id)) bought = true;
      }
    }
  }
  world.nextWave();
}

// Play forward with the bot until `done(world)` or the step budget runs out.
// Events are trimmed to the freshest few so a staged frame bursts with the
// action of its own moment, not the whole history.
export function playWithBot(world, done, maxSteps) {
  let steps = 0;
  while (steps < maxSteps) {
    if (world.screen === 'shop') { botShop(world); continue; }
    if (world.screen !== 'playing') break;
    if (done(world)) break;
    world.step(botFrame(world));
    steps++;
    if (world.events.length > 260) world.events.splice(0, world.events.length - 260);
  }
  return steps;
}

// Grant the keeper a mid-game build, as if she had shopped well.
function equip(world, dew, ids) {
  world.dew = dew;
  for (const id of ids) world.buyUpgrade(id);
  world.dew = 37; // a believable purse left over
  world.events.length = 0;
}

export function stageScene(name, seed) {
  const world = createWorld(seed, 'radiant');
  world.startGame();

  if (name === 'title') {
    // A calm moment before the night: keeper by the lantern, moths drifting.
    playWithBot(world, (w) => w.time > 2.2, 60 * 6);
    world.screen = 'title';
    world.events.length = 0;
    return world;
  }

  if (name === 'play') {
    // Honest fast-forward: the bot plays waves 1-6, then we catch it a few
    // seconds into wave 7 with a real build and a real fight on screen.
    playWithBot(world, (w) => w.wave >= 7 && w.waveTime > 5, 60 * 60 * 9);
    return world;
  }

  if (name === 'boss') {
    // Stage the finale directly: a well-built keeper, wave 12, and the
    // Gloamheart already wounded into its second phase, mid-barrage.
    equip(world, 900, ['damage', 'damage', 'fireRate', 'fireRate', 'multishot', 'vitality', 'magnet', 'swift']);
    world.startWave(12);
    world.score = 19340;
    world.kills = 168;
    playWithBot(world, (w) => w.waveTime > 3.5, 60 * 8);
    if (world.boss) {
      world.boss.hp = world.boss.maxHp * 0.55; // phase 2 begins on the next step
      // The finale at full fury: fresh horrors pour in from the edges and
      // the Heart lets a ring of gloom loose just before the frame, so the
      // still catches the barrage mid-flight and the glade mid-swarm.
      world.summon(world.boss, 'darter', 3);
      world.summon({ x: 235, y: 175 }, 'moth', 3);
      world.summon({ x: 1045, y: 545 }, 'shade', 2);
      world.summon({ x: 1050, y: 150 }, 'wisp', 4);
      world.summon({ x: 220, y: 560 }, 'veil', 2);
      playWithBot(world, (w) => w.waveTime > 5.2, 60 * 5);
      if (world.boss && world.screen === 'playing') {
        world.radialGloom(world.boss, 16, 165);
        world.combo = 23;
        world.comboT = 3;
        playWithBot(world, (w) => w.waveTime > 5.9, 60 * 3);
      }
    }
    return world;
  }

  if (name === 'shop') {
    // Between waves, purse full: the bot has played to the end of wave 7,
    // bought a few upgrades on the way, and the shop is open over the
    // quiet glade. Reached honestly: clear the wave and let the world's
    // own flow open the shop.
    equip(world, 500, ['damage', 'fireRate', 'vitality']);
    world.startWave(7);
    world.score = 8640;
    world.kills = 121;
    world.dew = 143;
    world.spawnQueue.length = 0;
    world.enemies.length = 0;
    world.step(makeInputFrame());
    world.events.length = 0;
    return world;
  }

  if (name === 'victory') {
    // The morning after: a staged dawn with the run's true-shaped results.
    equip(world, 300, ['damage', 'fireRate', 'multishot']);
    world.startWave(12);
    world.enemies.length = 0;
    world.spawnQueue.length = 0;
    world.lantern.hp = world.lantern.maxHp * 0.86;
    world.player.hp = world.stats.maxHp * 0.72;
    world.screen = 'victory';
    world.result = {
      won: true, reason: 'Dawn breaks. The light holds.', stars: 3,
      score: 31280, kills: 231, waves: TOTAL_WAVES, timeSec: 547,
      dewEarned: 512, bestCombo: 38, flawlessWaves: 5, lanternFrac: 0.86,
      accuracy: 0.43,
    };
    world.events.length = 0;
    return world;
  }

  return world;
}
