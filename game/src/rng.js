// rng.js — deterministic seeded randomness for Lumenfall.
// The whole simulation draws from one of these generators so a run with the
// same seed replays exactly: logic tests, the autopilot and the staged
// screenshot scenes all depend on that.

export function makeRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  const nextUint = () => {
    // mulberry32: small, fast, good enough distribution for a game.
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const rng = {
    // Float in [0, 1).
    float() {
      return nextUint() / 4294967296;
    },
    // Float in [min, max).
    range(min, max) {
      return min + rng.float() * (max - min);
    },
    // Integer in [min, max] inclusive.
    int(min, max) {
      return min + Math.floor(rng.float() * (max - min + 1));
    },
    // True with probability p.
    chance(p) {
      return rng.float() < p;
    },
    // Pick one element of an array.
    pick(items) {
      return items[Math.floor(rng.float() * items.length)];
    },
    // Angle in radians, any direction.
    angle() {
      return rng.float() * Math.PI * 2;
    },
    // A fresh independent stream derived from this one (particles, ambience).
    fork() {
      return makeRng(nextUint());
    },
  };
  return rng;
}

// A tiny string hash so named scenes ("boss", "victory") get stable seeds.
export function seedFromName(name) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
