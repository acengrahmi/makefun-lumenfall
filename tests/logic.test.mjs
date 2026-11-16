// logic.test.mjs — Lumenfall's headless validation.
// Run: node tests/logic.test.mjs
// Covers determinism, combat, the dew economy, bosses, win/lose flow, and a
// full autopilot playthrough that must WIN on Radiant (the balance gate).

import { createWorld, TOTAL_WAVES, STEP } from '../game/src/world.js';
import { makeInputFrame } from '../game/src/input.js';
import { botFrame, botShop, playWithBot } from '../game/src/director.js';
import { makeRng } from '../game/src/rng.js';

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name} ${detail}`);
  }
}

function digest(world) {
  const p = world.player;
  return [
    world.screen, world.wave, Math.round(world.score), world.dew, world.kills,
    Math.round(p.x), Math.round(p.y), Math.round(p.hp), Math.round(world.lantern.hp),
    world.enemies.length,
  ].join('|');
}

// 1. Same seed + same inputs replay exactly.
{
  const frames = [];
  const frng = makeRng(99);
  for (let i = 0; i < 900; i++) {
    const f = makeInputFrame();
    f.moveX = frng.range(-1, 1);
    f.moveY = frng.range(-1, 1);
    f.aimX = frng.range(0, 1280);
    f.aimY = frng.range(0, 720);
    f.firing = frng.chance(0.6);
    frames.push(f);
  }
  const run = () => {
    const w = createWorld(4242, 'radiant');
    w.startGame();
    for (const f of frames) {
      if (w.screen === 'shop') botShop(w);
      if (w.screen !== 'playing') break;
      w.step(f);
    }
    return digest(w);
  };
  check('determinism: same seed replays identically', run() === run());
}

// 2. The rng itself is seed-stable.
{
  const a = makeRng(7);
  const b = makeRng(7);
  check('rng: same seed, same stream',
    [a.float(), a.int(1, 9), a.range(2, 3)].join() === [b.float(), b.int(1, 9), b.range(2, 3)].join());
}

// 3. Combat: a moth parked in the line of fire dies and pays dew + score.
{
  const w = createWorld(11, 'radiant');
  w.startGame();
  w.spawnQueue.length = 0;
  w.enemies.length = 0;
  const p = w.player;
  p.x = 300; p.y = 360;
  // Summon one moth straight ahead of the keeper via the world's own verb.
  w.summon({ x: 380, y: 360 }, 'moth', 1);
  const before = w.kills;
  const f = makeInputFrame();
  f.aimX = 400; f.aimY = 360; f.firing = true;
  for (let i = 0; i < 60 * 4 && w.kills === before; i++) w.step(f);
  check('combat: bolts kill a moth', w.kills > before, `kills=${w.kills}`);
  check('combat: the kill scored', w.score > 0, `score=${w.score}`);
  check('combat: dew orbs dropped', w.orbs.length > 0 || w.dew > 0);
}

// 4. The shop: buys apply, costs deduct, poverty and caps refuse.
{
  const w = createWorld(12, 'radiant');
  w.startGame();
  w.dew = 100;
  const dmgBefore = w.stats.damage;
  check('shop: buy succeeds with dew', w.buyUpgrade('damage') === true);
  check('shop: stat applied', w.stats.damage > dmgBefore);
  check('shop: dew deducted', w.dew === 70, `dew=${w.dew}`);
  w.dew = 0;
  check('shop: buy refused when poor', w.buyUpgrade('fireRate') === false);
  w.dew = 100000;
  for (let i = 0; i < 10; i++) w.buyUpgrade('multishot');
  check('shop: level cap honoured', w.levels.multishot === 3, `lvl=${w.levels.multishot}`);
}

// 5. Lantern sacrifice: a creature that reaches the lantern wounds it.
{
  const w = createWorld(13, 'radiant');
  w.startGame();
  w.spawnQueue.length = 0;
  w.enemies.length = 0;
  w.summon({ x: w.lantern.x + 20, y: w.lantern.y }, 'moth', 1);
  const hpBefore = w.lantern.hp;
  const f = makeInputFrame();
  for (let i = 0; i < 30; i++) w.step(f);
  check('lantern: contact wounds the lantern', w.lantern.hp < hpBefore,
    `hp ${hpBefore} -> ${w.lantern.hp}`);
}

// 6. Boss waves bring a boss with phases.
{
  const w = createWorld(14, 'radiant');
  w.startGame();
  w.startWave(4);
  check('boss: wave 4 spawns the Herald', !!w.boss && w.boss.bossId === 'herald');
  w.boss.hp = w.boss.maxHp * 0.5;
  const f = makeInputFrame();
  w.step(f);
  check('boss: phase advances when wounded', w.boss.phase === 2, `phase=${w.boss.phase}`);
}

// 7. Defeat when the lantern falls.
{
  const w = createWorld(15, 'radiant');
  w.startGame();
  w.spawnQueue.length = 0;
  w.enemies.length = 0;
  w.lantern.hp = 4;
  w.summon({ x: w.lantern.x + 18, y: w.lantern.y }, 'brute', 1);
  const f = makeInputFrame();
  for (let i = 0; i < 90 && w.screen === 'playing'; i++) w.step(f);
  check('defeat: lantern snuffed ends the run', w.screen === 'defeat', `screen=${w.screen}`);
  check('defeat: result recorded', !!w.result && w.result.won === false);
}

// 8. Wave flow: clearing a wave opens the shop; the shop opens the next wave.
{
  const w = createWorld(16, 'radiant');
  w.startGame();
  w.spawnQueue.length = 0;
  w.enemies.length = 0;
  w.step(makeInputFrame());
  check('flow: cleared wave opens the shop', w.screen === 'shop', `screen=${w.screen}`);
  w.nextWave();
  check('flow: shop leads to wave 2', w.screen === 'playing' && w.wave === 2);
}

// 9. THE BALANCE GATE: the autopilot wins a full game on Radiant.
{
  const w = createWorld(2027, 'radiant');
  w.startGame();
  playWithBot(w, () => false, 60 * 60 * 25);
  check('autopilot: wins on Radiant', w.screen === 'victory',
    `screen=${w.screen} wave=${w.wave} hp=${Math.round(w.player.hp)} lantern=${Math.round(w.lantern.hp)} kills=${w.kills}`);
  if (w.result) {
    check('autopilot: victory result has stars', w.result.stars >= 1, `stars=${w.result.stars}`);
    console.log(`      run: score=${w.result.score} kills=${w.result.kills} time=${w.result.timeSec}s ` +
      `stars=${w.result.stars} lantern=${Math.round(w.result.lanternFrac * 100)}% combo=×${w.result.bestCombo}`);
  }
}

// 10. And on Ember, for margin.
{
  const w = createWorld(2028, 'ember');
  w.startGame();
  playWithBot(w, () => false, 60 * 60 * 25);
  check('autopilot: wins on Ember', w.screen === 'victory', `screen=${w.screen} wave=${w.wave}`);
}

// 11. Eclipse should be brutal: the same bot is not guaranteed anything,
// but it must at least reach the mid-game.
{
  const w = createWorld(2029, 'eclipse');
  w.startGame();
  playWithBot(w, () => false, 60 * 60 * 25);
  check('autopilot: Eclipse reaches wave 6+', w.wave >= 6 || w.screen === 'victory',
    `screen=${w.screen} wave=${w.wave}`);
  console.log(`      eclipse: screen=${w.screen} wave=${w.wave} kills=${w.kills}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
