// world.js — Lumenfall's simulation core.
// Pure logic, no DOM: the same world is stepped by the live game (through
// main.js), by the headless logic tests and autopilot, and by the staged
// screenshot scenes. One fixed step is 1/60 s; everything random comes from
// the world's seeded generator, so a seed replays exactly.

import { makeRng } from './rng.js';
import { createEnemy, createBoss, updateEnemy, deathSpawns, BOSSES } from './enemies.js';
import { UPGRADES, upgradeById, baseStats, costAt } from './upgrades.js';

export const WORLD_W = 1280;
export const WORLD_H = 720;
export const TOTAL_WAVES = 12;
export const STEP = 1 / 60;

export const DIFFICULTIES = {
  ember:   { name: 'Ember',   hpMul: 0.8,  dmgMul: 0.75, speedMul: 0.95, scoreMul: 1.0, dewMul: 1.15 },
  radiant: { name: 'Radiant', hpMul: 1.0,  dmgMul: 1.0,  speedMul: 1.0,  scoreMul: 1.5, dewMul: 1.0 },
  eclipse: { name: 'Eclipse', hpMul: 1.3,  dmgMul: 1.3,  speedMul: 1.06, scoreMul: 2.2, dewMul: 0.9 },
};

const BOSS_WAVES = { 4: 'herald', 8: 'mother', 12: 'gloamheart' };

// What each wave sends at the lantern, besides its boss.
function waveComposition(wave) {
  switch (wave) {
    case 1: return [['moth', 8]];
    case 2: return [['moth', 10], ['wisp', 4]];
    case 3: return [['moth', 8], ['wisp', 6], ['shade', 3]];
    case 4: return [['moth', 6]];
    case 5: return [['moth', 10], ['spitter', 4], ['wisp', 6]];
    case 6: return [['splitter', 5], ['moth', 8], ['shade', 4]];
    case 7: return [['veil', 4], ['spitter', 4], ['wisp', 8], ['moth', 6]];
    case 8: return [['wisp', 6]];
    case 9: return [['darter', 6], ['shade', 5], ['splitter', 4]];
    case 10: return [['brute', 3], ['spitter', 5], ['veil', 4], ['moth', 10]];
    case 11: return [['brute', 4], ['darter', 6], ['veil', 5], ['shade', 6]];
    case 12: return [['moth', 8], ['wisp', 6]];
    default: return [['moth', 6]];
  }
}

export function createWorld(seed, difficultyKey = 'radiant') {
  const diff = DIFFICULTIES[difficultyKey] || DIFFICULTIES.radiant;
  const rng = makeRng(seed);

  const world = {
    screen: 'title',
    difficulty: difficultyKey,
    diff,
    rng,
    time: 0,
    wave: 0,
    waveTime: 0,
    stats: baseStats(),
    levels: {},
    player: null,
    lantern: null,
    enemies: [],
    bolts: [],
    glooms: [],
    orbs: [],
    spawnQueue: [],
    spawnT: 0,
    boss: null,
    score: 0,
    dew: 0,
    dewEarned: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    flawlessWaves: 0,
    waveDamageTaken: false,
    banner: null,
    result: null,
    events: [],
    shakeTrauma: 0,
    slowmo: 0,
  };
  for (const u of UPGRADES) world.levels[u.id] = 0;

  function resetActors() {
    world.player = {
      x: WORLD_W / 2, y: WORLD_H / 2 + 130, radius: 14,
      hp: world.stats.maxHp, fireT: 0, iframes: 0,
      dashT: 0, dashTime: 0, dashDirX: 1, dashDirY: 0,
      aimAngle: -Math.PI / 2, moveAngle: -Math.PI / 2, dead: false,
    };
    world.lantern = {
      x: WORLD_W / 2, y: WORLD_H / 2, radius: 26,
      hp: world.stats.lanternMaxHp, maxHp: world.stats.lanternMaxHp,
    };
  }
  resetActors();

  function emit(type, data) {
    world.events.push(Object.assign({ type }, data));
  }

  function enemyScale() {
    const growth = 1 + (world.wave - 1) * 0.17;
    return {
      hp: diff.hpMul * growth,
      speed: diff.speedMul * (1 + (world.wave - 1) * 0.012),
      dmg: diff.dmgMul,
    };
  }

  function spawnPoint() {
    // On a wide ring around the glade, clamped inside the world.
    const a = rng.angle();
    const r = rng.range(520, 660);
    return {
      x: Math.min(WORLD_W - 24, Math.max(24, WORLD_W / 2 + Math.cos(a) * r)),
      y: Math.min(WORLD_H - 24, Math.max(24, WORLD_H / 2 + Math.sin(a) * r * 0.62)),
    };
  }

  function addEnemy(kind) {
    const p = spawnPoint();
    const e = createEnemy(kind, p.x, p.y, enemyScale(), rng);
    e.touchT = 0;
    world.enemies.push(e);
    return e;
  }

  // ---- verbs the enemy behaviours call ----
  world.fireGloom = (from, target) => {
    const d = Math.hypot(target.x - from.x, target.y - from.y) || 1;
    world.glooms.push({
      x: from.x, y: from.y,
      vx: ((target.x - from.x) / d) * 215, vy: ((target.y - from.y) / d) * 215,
      radius: 6, dmg: 10 * diff.dmgMul, life: 4.5,
    });
    emit('gloom', { x: from.x, y: from.y });
  };
  world.volleyGloom = (from, target, n) => {
    const base = Math.atan2(target.y - from.y, target.x - from.x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.22;
      world.glooms.push({
        x: from.x, y: from.y, vx: Math.cos(a) * 208, vy: Math.sin(a) * 208,
        radius: 6, dmg: 9 * diff.dmgMul, life: 4.5,
      });
    }
    emit('gloom', { x: from.x, y: from.y });
  };
  world.radialGloom = (from, count, speed) => {
    const off = rng.angle();
    for (let i = 0; i < count; i++) {
      const a = off + (i / count) * Math.PI * 2;
      world.glooms.push({
        x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        radius: 6, dmg: 12 * diff.dmgMul, life: 5,
      });
    }
    emit('gloom', { x: from.x, y: from.y });
  };
  world.summon = (from, kind, n) => {
    for (let i = 0; i < n; i++) {
      const a = rng.angle();
      const e = createEnemy(kind,
        Math.min(WORLD_W - 20, Math.max(20, from.x + Math.cos(a) * 70)),
        Math.min(WORLD_H - 20, Math.max(20, from.y + Math.sin(a) * 70)),
        enemyScale(), rng);
      e.touchT = 0;
      world.enemies.push(e);
      emit('summon', { x: e.x, y: e.y });
    }
  };
  world.onBossPhase = (boss) => {
    emit('bossPhase', { x: boss.x, y: boss.y, phase: boss.phase });
    world.shakeTrauma = Math.min(1, world.shakeTrauma + 0.45);
    world.banner = { text: `${BOSSES[boss.bossId].name}`, sub: `Phase ${boss.phase} — it rages!`, t: 0, dur: 2.2 };
  };
  world.onBossShield = (boss) => {
    emit('bossShield', { x: boss.x, y: boss.y });
  };

  function damagePlayer(amount) {
    const p = world.player;
    if (p.iframes > 0 || p.dead) return;
    p.hp -= amount;
    p.iframes = 0.7;
    world.waveDamageTaken = true;
    world.shakeTrauma = Math.min(1, world.shakeTrauma + 0.35);
    emit('hurt', { x: p.x, y: p.y });
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      endGame(false, 'The keeper has fallen.');
    }
  }

  function damageLantern(amount) {
    const l = world.lantern;
    l.hp -= amount;
    world.waveDamageTaken = true;
    world.shakeTrauma = Math.min(1, world.shakeTrauma + 0.3);
    emit('lanternHurt', { x: l.x, y: l.y });
    if (l.hp <= 0) {
      l.hp = 0;
      endGame(false, 'The Great Lantern is snuffed.');
    }
  }

  function endGame(won, reason) {
    if (world.screen === 'victory' || world.screen === 'defeat') return;
    world.screen = won ? 'victory' : 'defeat';
    const lanternFrac = world.lantern.hp / world.lantern.maxHp;
    let stars = 0;
    if (won) {
      stars = 1 + (lanternFrac >= 0.45 ? 1 : 0) + (lanternFrac >= 0.8 && world.player.hp / world.stats.maxHp >= 0.4 ? 1 : 0);
    }
    world.result = {
      won, reason,
      stars,
      score: Math.round(world.score),
      kills: world.kills,
      waves: world.wave,
      timeSec: Math.round(world.time),
      dewEarned: world.dewEarned,
      bestCombo: world.bestCombo,
      flawlessWaves: world.flawlessWaves,
      lanternFrac,
      accuracy: world.shotsFired > 0 ? world.shotsHit / world.shotsFired : 0,
    };
    emit(won ? 'victory' : 'defeat', {});
  }

  function dropDew(x, y, amount) {
    // Split large drops so the glade sparkles but never floods with orbs.
    let remaining = Math.max(1, Math.round(amount * diff.dewMul));
    while (remaining > 0) {
      const v = Math.min(remaining, 5);
      remaining -= v;
      const a = rng.angle();
      const d = rng.range(4, 26);
      world.orbs.push({
        x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
        vx: Math.cos(a) * rng.range(20, 70), vy: Math.sin(a) * rng.range(20, 70),
        value: v, t: rng.range(0, 6), life: 25,
      });
    }
  }

  function killEnemy(e) {
    e.dead = true;
    world.kills++;
    world.combo++;
    world.comboT = 3;
    if (world.combo > world.bestCombo) world.bestCombo = world.combo;
    if (world.combo === 15 || world.combo === 30 || world.combo === 50 || world.combo === 80) {
      emit('combo', { x: e.x, y: e.y - 30, combo: world.combo });
    }
    const comboMul = 1 + Math.min(world.combo, 50) * 0.02;
    world.score += e.score * diff.scoreMul * comboMul;
    dropDew(e.x, e.y, e.dew);
    for (const kind of deathSpawns(e)) {
      const child = createEnemy(kind, e.x + rng.range(-14, 14), e.y + rng.range(-14, 14), enemyScale(), rng);
      child.touchT = 0;
      world.enemies.push(child);
    }
    emit('die', { x: e.x, y: e.y, kind: e.kind, boss: e.kind === 'boss' });
    if (e.kind === 'boss') {
      world.boss = null;
      world.shakeTrauma = 1;
      world.slowmo = 0.5;
    }
  }

  function damageEnemy(e, dmg, dirX, dirY) {
    if (e.shield > 0) {
      e.shield -= dmg;
      e.shieldTimer = 0;
      e.flash = 0.06;
      emit('hitShield', { x: e.x, y: e.y });
      if (e.shield <= 0) emit('shieldBreak', { x: e.x, y: e.y });
      return;
    }
    e.hp -= dmg;
    e.flash = 0.08;
    if (e.kind === 'boss') e.aggroT = 4;
    const push = 26 * (1 - e.knockResist);
    e.x += dirX * push * 0.12;
    e.y += dirY * push * 0.12;
    if (e.hp <= 0) killEnemy(e);
  }

  // ---- flow ----
  world.startGame = () => {
    world.stats = baseStats();
    for (const u of UPGRADES) world.levels[u.id] = 0;
    resetActors();
    world.enemies = [];
    world.bolts = [];
    world.glooms = [];
    world.orbs = [];
    world.score = 0;
    world.dew = 0;
    world.dewEarned = 0;
    world.kills = 0;
    world.shotsFired = 0;
    world.shotsHit = 0;
    world.combo = 0;
    world.bestCombo = 0;
    world.flawlessWaves = 0;
    world.result = null;
    world.time = 0;
    world.startWave(1);
  };

  world.startWave = (n) => {
    world.wave = n;
    world.waveTime = 0;
    world.waveDamageTaken = false;
    world.screen = 'playing';
    const queue = [];
    for (const [kind, count] of waveComposition(n)) {
      for (let i = 0; i < count; i++) queue.push(kind);
    }
    // Shuffle so kinds interleave through the wave.
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(rng.float() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    world.spawnQueue = queue;
    world.spawnT = 0.5;
    const bossId = BOSS_WAVES[n];
    if (bossId) {
      const def = BOSSES[bossId];
      const boss = createBoss(bossId, WORLD_W / 2, 92, {
        hp: diff.hpMul * (1 + (n - 1) * 0.06), speed: diff.speedMul, dmg: diff.dmgMul,
      });
      boss.touchT = 0;
      world.enemies.push(boss);
      world.boss = boss;
      world.banner = { text: def.name, sub: def.title, t: 0, dur: 3.2 };
      emit('bossSpawn', { x: boss.x, y: boss.y });
    } else {
      world.banner = { text: `WAVE ${n}`, sub: n === 1 ? 'The Gloam comes. Hold the light.' : '', t: 0, dur: 2.4 };
      emit('wave', { wave: n });
    }
  };

  world.buyUpgrade = (id) => {
    const up = upgradeById(id);
    if (!up) return false;
    const lvl = world.levels[id];
    const cost = costAt(up, lvl);
    if (lvl >= up.maxLevel || world.dew < cost) {
      emit('denied', {});
      return false;
    }
    world.dew -= cost;
    world.levels[id] = lvl + 1;
    up.apply(world.stats, lvl + 1);
    if (id === 'vitality') world.player.hp = Math.min(world.stats.maxHp, world.player.hp + 25);
    if (id === 'lanternWard') {
      world.lantern.maxHp = world.stats.lanternMaxHp;
      world.lantern.hp = Math.min(world.lantern.maxHp, world.lantern.hp + 60);
    }
    emit('buy', { id });
    return true;
  };

  world.nextWave = () => {
    if (world.screen !== 'shop') return;
    world.startWave(world.wave + 1);
  };

  // ---- the step ----
  world.step = (frame) => {
    if (world.screen !== 'playing') return;
    const dt = STEP;
    world.time += dt;
    world.waveTime += dt;
    if (world.banner) {
      world.banner.t += dt;
      if (world.banner.t >= world.banner.dur) world.banner = null;
    }
    if (world.shakeTrauma > 0) world.shakeTrauma = Math.max(0, world.shakeTrauma - dt * 1.6);
    if (world.comboT > 0) {
      world.comboT -= dt;
      if (world.comboT <= 0) world.combo = 0;
    }

    const p = world.player;
    const s = world.stats;

    // Spawning.
    if (world.spawnQueue.length > 0) {
      world.spawnT -= dt;
      if (world.spawnT <= 0 && world.enemies.length < 42) {
        world.spawnT = Math.max(0.35, 0.95 - world.wave * 0.045);
        addEnemy(world.spawnQueue.pop());
      }
    }

    // Player movement and dash.
    if (p.iframes > 0) p.iframes -= dt;
    if (p.dashT > 0) p.dashT -= dt;
    let mx = frame.moveX, my = frame.moveY;
    const mlen = Math.hypot(mx, my);
    if (mlen > 0.01) {
      p.moveAngle = Math.atan2(my, mx);
      if (mlen > 1) { mx /= mlen; my /= mlen; }
    }
    p.aimAngle = Math.atan2(frame.aimY - p.y, frame.aimX - p.x);
    if (frame.dashPressed && p.dashT <= 0 && p.dashTime <= 0) {
      p.dashTime = 0.16;
      p.dashT = s.dashCooldown;
      p.dashDirX = mlen > 0.01 ? mx / (mlen || 1) : Math.cos(p.aimAngle);
      p.dashDirY = mlen > 0.01 ? my / (mlen || 1) : Math.sin(p.aimAngle);
      p.iframes = Math.max(p.iframes, 0.22);
      emit('dash', { x: p.x, y: p.y });
    }
    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.x += p.dashDirX * s.moveSpeed * 3.1 * dt;
      p.y += p.dashDirY * s.moveSpeed * 3.1 * dt;
    } else {
      p.x += mx * s.moveSpeed * dt;
      p.y += my * s.moveSpeed * dt;
    }
    p.x = Math.min(WORLD_W - 18, Math.max(18, p.x));
    p.y = Math.min(WORLD_H - 18, Math.max(18, p.y));

    // Firing.
    if (p.fireT > 0) p.fireT -= dt;
    if (frame.firing && p.fireT <= 0) {
      p.fireT = 1 / s.fireRate;
      const n = s.multishot;
      for (let i = 0; i < n; i++) {
        const a = p.aimAngle + (i - (n - 1) / 2) * 0.07;
        world.bolts.push({
          x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18,
          vx: Math.cos(a) * 640, vy: Math.sin(a) * 640,
          radius: 5, dmg: s.damage, life: 1.15,
        });
      }
      world.shotsFired += n;
      emit('shoot', { x: p.x, y: p.y, angle: p.aimAngle });
    }

    // Bolts.
    for (const b of world.bolts) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > WORLD_W + 20 || b.y < -20 || b.y > WORLD_H + 20) {
        b.dead = true;
        continue;
      }
      for (const e of world.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d < e.radius + b.radius) {
          b.dead = true;
          world.shotsHit++;
          const bl = Math.hypot(b.vx, b.vy) || 1;
          damageEnemy(e, b.dmg, b.vx / bl, b.vy / bl);
          emit('hit', { x: b.x, y: b.y });
          break;
        }
      }
    }
    world.bolts = world.bolts.filter((b) => !b.dead);

    // Enemies.
    for (const e of world.enemies) {
      if (e.dead) continue;
      updateEnemy(world, e, dt);
      if (e.touchT > 0) e.touchT -= dt;
      // Contact with the keeper.
      const dp = Math.hypot(p.x - e.x, p.y - e.y);
      if (dp < e.radius + p.radius && e.touchT <= 0 && !p.dead) {
        e.touchT = 0.9;
        damagePlayer(e.touchPlayer);
      }
      // Contact with the lantern: lesser creatures snuff themselves on it;
      // bosses grind against it and stay.
      const dl = Math.hypot(world.lantern.x - e.x, world.lantern.y - e.y);
      if (dl < e.radius + world.lantern.radius) {
        if (e.kind === 'boss') {
          if (e.touchT <= 0) {
            e.touchT = 1.0;
            damageLantern(e.touchLantern);
          }
        } else {
          damageLantern(e.touchLantern);
          killEnemySilent(e);
        }
      }
    }
    world.enemies = world.enemies.filter((e) => !e.dead);

    // Gloom shots.
    for (const g of world.glooms) {
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.life -= dt;
      if (g.life <= 0) { g.dead = true; continue; }
      if (Math.hypot(p.x - g.x, p.y - g.y) < p.radius + g.radius && !p.dead) {
        g.dead = true;
        damagePlayer(g.dmg);
      } else if (Math.hypot(world.lantern.x - g.x, world.lantern.y - g.y) < world.lantern.radius + g.radius) {
        g.dead = true;
        damageLantern(g.dmg * 0.7);
      }
    }
    world.glooms = world.glooms.filter((g) => !g.dead);

    // Dew orbs.
    for (const o of world.orbs) {
      o.t += dt;
      o.life -= dt;
      if (o.life <= 0) { o.dead = true; continue; }
      const dx = p.x - o.x, dy = p.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d < s.magnetRadius) {
        const pull = 340 * (1 - d / (s.magnetRadius * 1.6));
        o.vx += (dx / (d || 1)) * pull * dt * 6;
        o.vy += (dy / (d || 1)) * pull * dt * 6;
      }
      o.vx *= 0.92;
      o.vy *= 0.92;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (d < p.radius + 12 && !p.dead) {
        o.dead = true;
        world.dew += o.value;
        world.dewEarned += o.value;
        world.score += o.value * 2;
        emit('orb', { x: o.x, y: o.y });
      }
    }
    world.orbs = world.orbs.filter((o) => !o.dead);

    // Wave clear?
    if (world.screen === 'playing' && world.spawnQueue.length === 0 && world.enemies.length === 0) {
      if (!world.waveDamageTaken) world.flawlessWaves++;
      world.score += 100 + world.wave * 25;
      // The lantern breathes out dew after every held wave: a steady wage
      // that keeps the shop meaningful even on a lean night.
      const wage = 10 + world.wave * 2;
      world.dew += wage;
      world.dewEarned += wage;
      if (world.wave >= TOTAL_WAVES) {
        endGame(true, 'Dawn breaks. The light holds.');
      } else {
        world.screen = 'shop';
        emit('shopOpen', { wave: world.wave });
      }
    }
  };

  function killEnemySilent(e) {
    // A creature that throws itself on the lantern still leaves its dew,
    // but grants no combo — the keeper did not earn it.
    e.dead = true;
    world.kills++;
    dropDew(e.x, e.y, e.dew);
    emit('die', { x: e.x, y: e.y, kind: e.kind, boss: false });
    if (e.kind === 'boss') world.boss = null;
  }

  return world;
}
