// enemies.js — the Gloam host: eight creature kinds and three bosses.
// Every kind is data (hit points, speed, size, reward) plus a behaviour
// function. Behaviours receive the world and act through its public verbs
// (damagePlayer, damageLantern, fireGloom, summon) so this file never needs
// to know how the world stores its entities.

export const ENEMY_KINDS = {
  moth: {
    name: 'Pale Moth', hp: 18, speed: 62, radius: 13,
    touchPlayer: 8, touchLantern: 6, dew: 1, score: 10, knockResist: 0,
  },
  wisp: {
    name: 'Gloam Wisp', hp: 8, speed: 122, radius: 8,
    touchPlayer: 5, touchLantern: 4, dew: 1, score: 15, knockResist: 0,
  },
  shade: {
    name: 'Hollow Shade', hp: 30, speed: 94, radius: 12,
    touchPlayer: 10, touchLantern: 8, dew: 2, score: 20, knockResist: 0.1,
  },
  spitter: {
    name: 'Soot Spitter', hp: 24, speed: 50, radius: 13,
    touchPlayer: 6, touchLantern: 5, dew: 2, score: 25, knockResist: 0,
  },
  splitter: {
    name: 'Bulb Husk', hp: 38, speed: 54, radius: 15,
    touchPlayer: 8, touchLantern: 8, dew: 2, score: 25, knockResist: 0.2,
  },
  veil: {
    name: 'Veilweaver', hp: 44, speed: 58, radius: 14,
    touchPlayer: 10, touchLantern: 9, dew: 3, score: 35, knockResist: 0.2,
  },
  darter: {
    name: 'Umbral Darter', hp: 16, speed: 74, radius: 10,
    touchPlayer: 9, touchLantern: 6, dew: 2, score: 20, knockResist: 0,
  },
  brute: {
    name: 'Cinder Brute', hp: 120, speed: 34, radius: 22,
    touchPlayer: 18, touchLantern: 20, dew: 4, score: 40, knockResist: 0.7,
  },
};

export const BOSSES = {
  herald: {
    name: 'THE HOLLOW HERALD', title: 'First of the Snuffing',
    hp: 800, speed: 44, radius: 30, touchPlayer: 16, touchLantern: 16,
    dew: 55, score: 600,
  },
  mother: {
    name: 'MOTHER OF VEILS', title: 'She Who Blinds the Light',
    hp: 1750, speed: 38, radius: 36, touchPlayer: 20, touchLantern: 20,
    dew: 80, score: 1200,
  },
  gloamheart: {
    name: 'THE GLOAMHEART', title: 'The Dark That Ends the Night',
    hp: 4300, speed: 46, radius: 42, touchPlayer: 24, touchLantern: 24,
    dew: 160, score: 2500,
  },
};

export function createEnemy(kind, x, y, scale, rng) {
  const def = ENEMY_KINDS[kind];
  return {
    kind, bossId: null, x, y,
    vx: 0, vy: 0,
    hp: def.hp * scale.hp, maxHp: def.hp * scale.hp,
    shield: kind === 'veil' ? 30 * scale.hp : 0,
    shieldMax: kind === 'veil' ? 30 * scale.hp : 0,
    shieldTimer: 0,
    speed: def.speed * scale.speed,
    radius: def.radius,
    touchPlayer: def.touchPlayer * scale.dmg,
    touchLantern: def.touchLantern * scale.dmg,
    dew: def.dew, score: def.score,
    knockResist: def.knockResist,
    t: rng.range(0, 10), // personal phase for wobble/jitter
    state: 'seek', stateT: 0,
    fireT: rng.range(1.2, 2.6),
    flash: 0, dead: false,
  };
}

export function createBoss(bossId, x, y, scale) {
  const def = BOSSES[bossId];
  return {
    kind: 'boss', bossId, x, y,
    vx: 0, vy: 0,
    hp: def.hp * scale.hp, maxHp: def.hp * scale.hp,
    shield: 0, shieldMax: 0, shieldTimer: 0,
    speed: def.speed * scale.speed,
    radius: def.radius,
    touchPlayer: def.touchPlayer * scale.dmg,
    touchLantern: def.touchLantern * scale.dmg,
    dew: def.dew, score: def.score,
    knockResist: 0.9,
    t: 0, state: 'seek', stateT: 0,
    fireT: 3, summonT: 5, phase: 1, shieldWavesDone: 0, aggroT: 0,
    flash: 0, dead: false,
  };
}

function seekTarget(world, e) {
  // Creatures hunger for the lantern's light first, but snap at the keeper
  // when she strays close: whichever target is nearer draws them.
  const p = world.player;
  const l = world.lantern;
  const dp = Math.hypot(p.x - e.x, p.y - e.y);
  const dl = Math.hypot(l.x - e.x, l.y - e.y);
  return dp < dl * 0.85 ? { x: p.x, y: p.y, isPlayer: true, dist: dp }
                        : { x: l.x, y: l.y, isPlayer: false, dist: dl };
}

function moveToward(e, tx, ty, speed, dt) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.vx = (dx / d) * speed;
  e.vy = (dy / d) * speed;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.facing = Math.atan2(dy, dx);
}

export function updateEnemy(world, e, dt) {
  e.t += dt;
  e.stateT += dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.shieldMax > 0 && e.shield <= 0) {
    e.shieldTimer += dt;
    if (e.shieldTimer > 4) { e.shield = e.shieldMax; e.shieldTimer = 0; }
  }
  if (e.kind === 'boss') { updateBoss(world, e, dt); return; }

  const target = seekTarget(world, e);
  switch (e.kind) {
    case 'moth': {
      const wob = Math.sin(e.t * 3.1) * 26;
      moveToward(e, target.x + Math.cos(e.t * 2.3) * wob, target.y + Math.sin(e.t * 2.7) * wob, e.speed, dt);
      break;
    }
    case 'wisp': {
      const jx = Math.sin(e.t * 11) * 18;
      const jy = Math.cos(e.t * 13) * 18;
      moveToward(e, target.x + jx, target.y + jy, e.speed, dt);
      break;
    }
    case 'shade': {
      if (e.state === 'seek') {
        moveToward(e, target.x, target.y, e.speed, dt);
        if (target.dist < 190 && e.stateT > 0.8) { e.state = 'windup'; e.stateT = 0; }
      } else if (e.state === 'windup') {
        e.vx *= 0.8; e.vy *= 0.8;
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.stateT > 0.45) {
          e.state = 'lunge'; e.stateT = 0;
          const d = Math.hypot(target.x - e.x, target.y - e.y) || 1;
          e.vx = ((target.x - e.x) / d) * 430;
          e.vy = ((target.y - e.y) / d) * 430;
        }
      } else {
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.stateT > 0.38) { e.state = 'seek'; e.stateT = 0; }
      }
      break;
    }
    case 'spitter': {
      const anchor = Math.hypot(world.lantern.x - e.x, world.lantern.y - e.y);
      if (anchor > 300) moveToward(e, world.lantern.x, world.lantern.y, e.speed, dt);
      else if (anchor < 210) moveToward(e, e.x * 2 - world.lantern.x, e.y * 2 - world.lantern.y, e.speed, dt);
      else { e.vx = 0; e.vy = 0; }
      e.fireT -= dt;
      if (e.fireT <= 0 && anchor < 430) {
        e.fireT = 2.4;
        world.fireGloom(e, world.player);
      }
      break;
    }
    case 'darter': {
      if (e.state === 'seek') {
        // Circle the keeper, looking for an opening.
        const px = world.player.x, py = world.player.y;
        const ang = Math.atan2(e.y - py, e.x - px) + dt * 1.6;
        const r = 120;
        moveToward(e, px + Math.cos(ang) * r, py + Math.sin(ang) * r, e.speed * 1.5, dt);
        if (e.stateT > 1.4) { e.state = 'lunge'; e.stateT = 0;
          const d = Math.hypot(px - e.x, py - e.y) || 1;
          e.vx = ((px - e.x) / d) * 380; e.vy = ((py - e.y) / d) * 380; }
      } else {
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.stateT > 0.42) { e.state = 'seek'; e.stateT = 0; }
      }
      break;
    }
    default: { // splitter, veil, brute: the slow, sure advance
      moveToward(e, target.x, target.y, e.speed, dt);
    }
  }
}

function updateBoss(world, e, dt) {
  const frac = e.hp / e.maxHp;
  const newPhase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
  if (newPhase !== e.phase) {
    e.phase = newPhase;
    world.onBossPhase(e);
  }
  if (e.aggroT > 0) e.aggroT -= dt;
  // A boss stung by the keeper's bolts turns on her: while aggro lasts it
  // hunts the player instead of grinding the lantern, so a brave keeper
  // can draw the duel away from the light.
  const target = e.aggroT > 0
    ? { x: world.player.x, y: world.player.y, isPlayer: true, dist: Math.hypot(world.player.x - e.x, world.player.y - e.y) }
    : seekTarget(world, e);
  const speedMul = e.phase === 3 && e.bossId === 'gloamheart' ? 1.45 : 1;
  moveToward(e, target.x, target.y, e.speed * speedMul, dt);

  e.summonT -= dt;
  e.fireT -= dt;

  if (e.bossId === 'herald') {
    if (e.summonT <= 0) {
      e.summonT = e.phase === 1 ? 6.5 : 4.5;
      world.summon(e, e.phase === 3 ? 'shade' : 'moth', e.phase === 3 ? 2 : 3);
    }
    if (e.phase >= 2 && e.fireT <= 0) {
      e.fireT = 3.6;
      world.radialGloom(e, 10, 150);
    }
  } else if (e.bossId === 'mother') {
    if ((frac <= 0.66 && e.shieldWavesDone === 0) || (frac <= 0.33 && e.shieldWavesDone === 1)) {
      e.shieldWavesDone++;
      e.shield = 240 * (e.maxHp / BOSSES.mother.hp);
      e.shieldMax = e.shield;
      world.summon(e, 'veil', 2);
      world.onBossShield(e);
    }
    if (e.summonT <= 0) { e.summonT = 7; world.summon(e, 'wisp', 3); }
    if (e.fireT <= 0) {
      e.fireT = e.phase === 3 ? 2.6 : 3.4;
      world.volleyGloom(e, world.player, 3);
    }
  } else if (e.bossId === 'gloamheart') {
    if (e.summonT <= 0) {
      e.summonT = e.phase === 1 ? 6 : 4;
      world.summon(e, e.phase >= 2 ? 'darter' : 'moth', 3);
    }
    if (e.phase >= 2 && e.fireT <= 0) {
      e.fireT = e.phase === 3 ? 2.6 : 3.8;
      world.radialGloom(e, e.phase === 3 ? 16 : 12, 165);
    }
  }
}

// What leaves the body when a kind dies: husks burst into wisps, everything
// drops its dew (handled by the world), bosses shake the night.
export function deathSpawns(e) {
  if (e.kind === 'splitter') return ['wisp', 'wisp', 'wisp'];
  return [];
}
