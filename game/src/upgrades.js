// upgrades.js — the Dew Shop catalogue.
// Between waves the keeper spends dew on permanent upgrades. Each entry has
// a level cap and a rising cost; `describe` says what the next level does so
// the shop screen can print it. Stats live in world.js's `stats` object and
// every apply() mutates exactly the fields it names.

export const UPGRADES = [
  {
    id: 'damage',
    name: 'Kindled Bolts',
    icon: 'bolt',
    maxLevel: 6,
    baseCost: 30,
    costGrowth: 1.55,
    blurb: 'Each bolt of light strikes harder.',
    describe: (lvl) => `Bolt damage 10 → ${10 + (lvl + 1) * 4}`,
    apply(stats, lvl) { stats.damage = 10 + lvl * 4; },
  },
  {
    id: 'fireRate',
    name: 'Quickwick Hands',
    icon: 'wick',
    maxLevel: 6,
    baseCost: 28,
    costGrowth: 1.55,
    blurb: 'Throw bolts in a faster rhythm.',
    describe: (lvl) => `Fire rate → ${(5 + (lvl + 1) * 0.9).toFixed(1)} /s`,
    apply(stats, lvl) { stats.fireRate = 5 + lvl * 0.9; },
  },
  {
    id: 'multishot',
    name: 'Split Flame',
    icon: 'split',
    maxLevel: 3,
    baseCost: 70,
    costGrowth: 1.9,
    blurb: 'Your flame forks into extra bolts.',
    describe: (lvl) => `Bolts per shot → ${lvl + 2}`,
    apply(stats, lvl) { stats.multishot = 1 + lvl; },
  },
  {
    id: 'swift',
    name: 'Emberstride Boots',
    icon: 'boot',
    maxLevel: 4,
    baseCost: 22,
    costGrowth: 1.5,
    blurb: 'Move like a spark on the wind.',
    describe: (lvl) => `Move speed → ${Math.round(235 * (1 + (lvl + 1) * 0.09))}`,
    apply(stats, lvl) { stats.moveSpeed = 235 * (1 + lvl * 0.09); },
  },
  {
    id: 'vitality',
    name: 'Heartwood Charm',
    icon: 'heart',
    maxLevel: 5,
    baseCost: 26,
    costGrowth: 1.5,
    blurb: 'More hearts, and mend a little now.',
    describe: (lvl) => `Max health → ${100 + (lvl + 1) * 25}`,
    apply(stats, lvl) { stats.maxHp = 100 + lvl * 25; },
  },
  {
    id: 'magnet',
    name: 'Dewcall Lantern',
    icon: 'magnet',
    maxLevel: 4,
    baseCost: 18,
    costGrowth: 1.5,
    blurb: 'Dew drifts to you from farther away.',
    describe: (lvl) => `Dew pull radius → ${90 + (lvl + 1) * 45}`,
    apply(stats, lvl) { stats.magnetRadius = 90 + lvl * 45; },
  },
  {
    id: 'dash',
    name: 'Flickerstep',
    icon: 'dash',
    maxLevel: 3,
    baseCost: 24,
    costGrowth: 1.6,
    blurb: 'Dash again sooner after each flicker.',
    describe: (lvl) => `Dash cooldown → ${(2.6 - (lvl + 1) * 0.45).toFixed(2)}s`,
    apply(stats, lvl) { stats.dashCooldown = 2.6 - lvl * 0.45; },
  },
  {
    id: 'lanternWard',
    name: 'Lantern Ward',
    icon: 'ward',
    maxLevel: 5,
    baseCost: 32,
    costGrowth: 1.5,
    blurb: 'Re-glass and reinforce the Great Lantern.',
    describe: (lvl) => `Lantern max → ${300 + (lvl + 1) * 60}, repaired +60`,
    apply(stats, lvl) { stats.lanternMaxHp = 300 + lvl * 60; },
  },
];

export function upgradeById(id) {
  return UPGRADES.find((u) => u.id === id);
}

export function costAt(upgrade, currentLevel) {
  if (currentLevel >= upgrade.maxLevel) return Infinity;
  return Math.round(upgrade.baseCost * Math.pow(upgrade.costGrowth, currentLevel));
}

// Fresh level-0 stats, before any purchase.
export function baseStats() {
  const stats = {};
  for (const u of UPGRADES) u.apply(stats, 0);
  stats.damage = 10;
  stats.fireRate = 5;
  stats.multishot = 1;
  return stats;
}
