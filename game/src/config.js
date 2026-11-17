// Neon Void — configuration: every tunable number lives here so the
// simulation (world.js) and the presentation (render.js) agree on it.
export const VIEW = { w: 960, h: 540 };

// Neon palette. Background is near-black blue; every entity glows in one
// of these so the scene reads at a glance even when shrunk.
export const COLORS = {
  bg: '#05060f',
  grid: '#12162e',
  star: '#2a3160',
  player: '#22e6ff',
  playerCore: '#e8fbff',
  bullet: '#9df3ff',
  chaser: '#ff2d78',
  spinner: '#ff9f1c',
  shooter: '#b967ff',
  splitter: '#39ff88',
  mini: '#7dffb0',
  enemyBullet: '#ff5ce1',
  particle: '#ffffff',
  text: '#dfe6ff',
  dim: '#8b93b8',
  gold: '#ffd166',
  danger: '#ff3b30',
};

export const PLAYER = {
  radius: 13,
  speed: 265,          // px/s
  accel: 2400,         // px/s^2 toward the held direction
  drag: 6.5,           // exponential damping when no key is held
  maxHp: 3,
  fireInterval: 0.16,  // seconds between shots
  bulletSpeed: 620,
  bulletDamage: 1,
  bulletRadius: 4,
  dashSpeed: 780,      // px/s while dashing
  dashTime: 0.16,      // seconds a dash lasts
  dashCooldown: 1.6,   // seconds before the next dash
  invulnTime: 1.2,     // seconds of mercy after taking a hit
};

// Enemy archetypes. hp scales a little with the wave; speed and score are
// per type. radius is the collision circle.
export const ENEMIES = {
  chaser:   { radius: 15, hp: 2, speed: 118, score: 100, color: COLORS.chaser,   spawnWeight: 10 },
  spinner:  { radius: 12, hp: 1, speed: 205, score: 150, color: COLORS.spinner,  spawnWeight: 7 },
  shooter:  { radius: 16, hp: 3, speed: 82,  score: 200, color: COLORS.shooter,  spawnWeight: 5 },
  splitter: { radius: 19, hp: 4, speed: 72,  score: 250, color: COLORS.splitter, spawnWeight: 4 },
  mini:     { radius: 8,  hp: 1, speed: 235, score: 50,  color: COLORS.mini,     spawnWeight: 0 },
};

// How many enemies a wave fields, and which types may appear in it.
export function wavePlan(wave) {
  const count = 5 + wave * 3;
  const pool = ['chaser'];
  if (wave >= 2) pool.push('spinner');
  if (wave >= 3) pool.push('shooter');
  if (wave >= 4) pool.push('splitter');
  return { count, pool };
}

// Seconds a kill stays "fresh": kills inside this window raise the combo.
export const COMBO_WINDOW = 2.5;
export const COMBO_MAX = 8;

// Upgrades offered between waves. Each has an id, a display name, a
// one-line description and an apply() that mutates the player.
export const UPGRADES = [
  {
    id: 'rapid',
    name: 'RAPID FIRE',
    desc: 'Shoot 22% faster.',
    apply: (p) => { p.fireInterval *= 0.78; },
  },
  {
    id: 'multishot',
    name: 'SPLIT SHOT',
    desc: '+1 bullet per shot, fanned out.',
    apply: (p) => { p.multishot += 1; },
  },
  {
    id: 'damage',
    name: 'HEAVY ROUNDS',
    desc: 'Bullets deal +1 damage.',
    apply: (p) => { p.bulletDamage += 1; },
  },
  {
    id: 'speed',
    name: 'ION THRUSTERS',
    desc: 'Move 18% faster.',
    apply: (p) => { p.speed *= 1.18; },
  },
  {
    id: 'dash',
    name: 'PHASE DASH',
    desc: 'Dash recharges 35% faster.',
    apply: (p) => { p.dashCooldown *= 0.65; },
  },
  {
    id: 'hull',
    name: 'REINFORCED HULL',
    desc: '+1 max hull and repair 1 hull.',
    apply: (p) => { p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 1); },
  },
  {
    id: 'pierce',
    name: 'LANCE ROUNDS',
    desc: 'Bullets pierce +1 enemy.',
    apply: (p) => { p.pierce += 1; },
  },
  {
    id: 'velocity',
    name: 'RAILGUN COILS',
    desc: 'Bullets fly 30% faster.',
    apply: (p) => { p.bulletSpeed *= 1.3; },
  },
];
