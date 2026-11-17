// Neon Void — simulation. Everything that moves, collides, spawns and
// dies lives here; rendering (render.js) only draws what this builds.
// The loop in main.js owns the screens (title / upgrade / pause / over)
// and calls update() while the game is playing.
import { VIEW, PLAYER, ENEMIES, COMBO_WINDOW, COMBO_MAX, UPGRADES, wavePlan } from './config.js';
import { sfx } from './audio.js';

// Small deterministic PRNG so a ?seed= URL replays the same arena.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, pool) {
  let total = 0;
  for (const t of pool) total += ENEMIES[t].spawnWeight;
  let roll = rng() * total;
  for (const t of pool) {
    roll -= ENEMIES[t].spawnWeight;
    if (roll <= 0) return t;
  }
  return pool[0];
}

export function createWorld(seed) {
  const rng = mulberry32(seed);
  return {
    rng,
    time: 0,
    wave: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    shake: 0,
    flash: 0,
    banner: null,      // { text, sub, timer }
    spawnQueue: 0,
    spawnTimer: 0,
    spawnPool: [],
    upgradeChoices: [],
    player: {
      x: VIEW.w / 2, y: VIEW.h / 2, vx: 0, vy: 0, angle: -Math.PI / 2,
      radius: PLAYER.radius, hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
      speed: PLAYER.speed, fireInterval: PLAYER.fireInterval,
      bulletSpeed: PLAYER.bulletSpeed, bulletDamage: PLAYER.bulletDamage,
      multishot: 0, pierce: 0, dashCooldown: PLAYER.dashCooldown,
      fireCd: 0, dashCd: 0, dashTime: 0, dashX: 0, dashY: 0, invuln: 0,
    },
    bullets: [],       // { x, y, vx, vy, damage, pierce, radius }
    enemies: [],       // { type, x, y, vx, vy, hp, maxHp, radius, speed, score, color, angle, fireCd, phase }
    ebullets: [],      // { x, y, vx, vy, radius }
    particles: [],     // { x, y, vx, vy, life, maxLife, size, color }
    texts: [],         // { x, y, life, text, color, size }
  };
}

export function startWave(world) {
  world.wave += 1;
  const plan = wavePlan(world.wave);
  world.spawnPool = plan.pool;
  world.spawnQueue = plan.count;
  world.spawnTimer = 0.6;
  world.banner = { text: `WAVE ${world.wave}`, sub: `${plan.count} hostiles inbound`, timer: 2.2 };
  sfx.waveStart();
}

function spawnEnemy(world) {
  const rng = world.rng;
  const type = pickWeighted(rng, world.spawnPool);
  const def = ENEMIES[type];
  // Pick an edge point at least 220px from the player.
  let x = 0, y = 0;
  for (let tries = 0; tries < 12; tries++) {
    const edge = Math.floor(rng() * 4);
    if (edge === 0) { x = rng() * VIEW.w; y = -30; }
    else if (edge === 1) { x = rng() * VIEW.w; y = VIEW.h + 30; }
    else if (edge === 2) { x = -30; y = rng() * VIEW.h; }
    else { x = VIEW.w + 30; y = rng() * VIEW.h; }
    const dx = x - world.player.x, dy = y - world.player.y;
    if (dx * dx + dy * dy > 220 * 220) break;
  }
  const hpScale = 1 + Math.floor((world.wave - 1) / 3);
  world.enemies.push({
    type, x, y, vx: 0, vy: 0,
    hp: def.hp + (type === 'mini' ? 0 : hpScale - 1), maxHp: def.hp + (type === 'mini' ? 0 : hpScale - 1),
    radius: def.radius, speed: def.speed * (0.9 + rng() * 0.2),
    score: def.score, color: def.color, angle: rng() * Math.PI * 2,
    fireCd: 1.5 + rng(), phase: rng() * Math.PI * 2,
  });
}

function burst(world, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = world.rng() * Math.PI * 2;
    const s = speed * (0.3 + world.rng() * 0.7);
    world.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.5 + world.rng() * 0.4, maxLife: 0.9,
      size: 1.5 + world.rng() * 2.5, color,
    });
  }
}

function addText(world, x, y, text, color, size = 14) {
  world.texts.push({ x, y, life: 0.9, text, color, size });
}

function killEnemy(world, enemy, index) {
  const mult = Math.max(1, world.combo);
  const gained = enemy.score * mult;
  world.score += gained;
  world.kills += 1;
  world.combo = Math.min(COMBO_MAX, world.combo + 1);
  world.bestCombo = Math.max(world.bestCombo, world.combo);
  world.comboTimer = COMBO_WINDOW;
  addText(world, enemy.x, enemy.y, `+${gained}`, enemy.color, mult >= 4 ? 18 : 14);
  if (mult >= 4) addText(world, enemy.x, enemy.y - 20, `COMBO x${mult}`, '#ffd166', 13);
  burst(world, enemy.x, enemy.y, enemy.color, enemy.type === 'splitter' ? 26 : 16, 260);
  world.shake = Math.min(10, world.shake + 3);
  sfx.explode();
  if (enemy.type === 'splitter') {
    for (let i = 0; i < 2; i++) {
      const a = world.rng() * Math.PI * 2;
      world.enemies.push({
        type: 'mini', x: enemy.x + Math.cos(a) * 14, y: enemy.y + Math.sin(a) * 14,
        vx: Math.cos(a) * 160, vy: Math.sin(a) * 160,
        hp: 1, maxHp: 1, radius: ENEMIES.mini.radius, speed: ENEMIES.mini.speed,
        score: ENEMIES.mini.score, color: ENEMIES.mini.color,
        angle: a, fireCd: 0, phase: world.rng() * Math.PI * 2,
      });
    }
  }
  world.enemies.splice(index, 1);
}

function damagePlayer(world) {
  const p = world.player;
  if (p.invuln > 0 || p.dashTime > 0) return false;
  p.hp -= 1;
  p.invuln = PLAYER.invulnTime;
  world.combo = 0;
  world.comboTimer = 0;
  world.shake = 14;
  world.flash = 0.55;
  burst(world, p.x, p.y, '#ff3b30', 24, 300);
  sfx.playerHit();
  return true;
}

// Three distinct upgrades, drawn at random for the between-wave choice.
export function pickUpgrades(world) {
  const pool = [...UPGRADES];
  const out = [];
  while (out.length < 3 && pool.length > 0) {
    const i = Math.floor(world.rng() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export function applyUpgrade(world, id) {
  const up = UPGRADES.find((u) => u.id === id);
  if (!up) return;
  up.apply(world.player);
  sfx.pickup();
  addText(world, world.player.x, world.player.y - 30, up.name, '#ffd166', 16);
}

// Ambient motion that keeps running even when the simulation is paused
// (upgrade choice, pause, game over): particles settle, floating text
// fades, shake and the hit flash decay, the banner and combo timers run out.
export function updateAmbient(world, dt) {
  world.shake = Math.max(0, world.shake - dt * 26);
  world.flash = Math.max(0, world.flash - dt * 1.8);
  if (world.banner) {
    world.banner.timer -= dt;
    if (world.banner.timer <= 0) world.banner = null;
  }
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) { world.particles.splice(i, 1); continue; }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= Math.exp(-2.2 * dt);
    pt.vy *= Math.exp(-2.2 * dt);
  }
  for (let i = world.texts.length - 1; i >= 0; i--) {
    const t = world.texts[i];
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) world.texts.splice(i, 1);
  }
}

// One simulation step. Returns 'wave-cleared' or 'player-dead' when the
// loop should leave the playing state, otherwise null.
export function update(world, dt, input) {
  const p = world.player;
  world.time += dt;
  updateAmbient(world, dt);

  // --- player movement ---
  const axis = input.moveAxis();
  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.vx = p.dashX * PLAYER.dashSpeed;
    p.vy = p.dashY * PLAYER.dashSpeed;
  } else {
    p.vx += axis.x * PLAYER.accel * dt;
    p.vy += axis.y * PLAYER.accel * dt;
    const damp = Math.exp(-PLAYER.drag * dt);
    p.vx *= damp;
    p.vy *= damp;
    const sp = Math.hypot(p.vx, p.vy);
    const max = p.speed;
    if (sp > max) { p.vx = (p.vx / sp) * max; p.vy = (p.vy / sp) * max; }
  }
  p.x = Math.max(p.radius, Math.min(VIEW.w - p.radius, p.x + p.vx * dt));
  p.y = Math.max(p.radius, Math.min(VIEW.h - p.radius, p.y + p.vy * dt));
  p.angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
  p.fireCd -= dt;
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.invuln -= dt;

  // Dash on Shift, or on Space pressed while standing still is not a dash:
  // Shift is the dash key; Space is fire (see input.firing).
  if (input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight')) {
    if (p.dashCd <= 0 && p.dashTime <= 0) {
      let dx = axis.x, dy = axis.y;
      if (dx === 0 && dy === 0) { dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
      const len = Math.hypot(dx, dy);
      p.dashX = dx / len; p.dashY = dy / len;
      p.dashTime = PLAYER.dashTime;
      p.dashCd = p.dashCooldown;
      burst(world, p.x, p.y, '#22e6ff', 10, 180);
      sfx.dash();
    }
  }

  // --- firing ---
  if (input.firing && p.fireCd <= 0) {
    p.fireCd = p.fireInterval;
    const shots = p.multishot + 1;
    const spread = 0.14;
    for (let i = 0; i < shots; i++) {
      const off = (i - (shots - 1) / 2) * spread;
      const a = p.angle + off;
      world.bullets.push({
        x: p.x + Math.cos(a) * (p.radius + 6),
        y: p.y + Math.sin(a) * (p.radius + 6),
        vx: Math.cos(a) * p.bulletSpeed, vy: Math.sin(a) * p.bulletSpeed,
        damage: p.bulletDamage, pierce: p.pierce, radius: PLAYER.bulletRadius,
      });
    }
    sfx.shoot();
  }

  // --- spawning ---
  if (world.spawnQueue > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = 0.45;
      world.spawnQueue -= 1;
      spawnEnemy(world);
    }
  }

  // --- bullets ---
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -20 || b.x > VIEW.w + 20 || b.y < -20 || b.y > VIEW.h + 20) {
      world.bullets.splice(i, 1);
      continue;
    }
    for (let j = world.enemies.length - 1; j >= 0; j--) {
      const e = world.enemies[j];
      const dx = b.x - e.x, dy = b.y - e.y;
      const rr = b.radius + e.radius;
      if (dx * dx + dy * dy < rr * rr) {
        e.hp -= b.damage;
        burst(world, b.x, b.y, e.color, 4, 140);
        sfx.hit();
        if (e.hp <= 0) killEnemy(world, e, j);
        if (b.pierce > 0) { b.pierce -= 1; }
        else { world.bullets.splice(i, 1); }
        break;
      }
    }
  }

  // --- enemies ---
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    const dx = p.x - e.x, dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist, ny = dy / dist;
    if (e.type === 'chaser' || e.type === 'mini') {
      e.vx += nx * e.speed * 3.2 * dt;
      e.vy += ny * e.speed * 3.2 * dt;
      const sp = Math.hypot(e.vx, e.vy);
      if (sp > e.speed) { e.vx = (e.vx / sp) * e.speed; e.vy = (e.vy / sp) * e.speed; }
      e.angle = Math.atan2(e.vy, e.vx);
    } else if (e.type === 'spinner') {
      e.phase += dt * 5;
      const px = -ny, py = nx;
      const wob = Math.sin(e.phase) * 0.9;
      e.vx = (nx + px * wob) * e.speed;
      e.vy = (ny + py * wob) * e.speed;
      e.angle += dt * 7;
    } else if (e.type === 'shooter') {
      // Keep ~260px away, strafe slowly, and fire orbs at the player.
      const want = dist < 230 ? -1 : dist > 320 ? 1 : 0;
      e.vx = nx * want * e.speed + -ny * 40;
      e.vy = ny * want * e.speed + nx * 40;
      e.angle = Math.atan2(dy, dx);
      e.fireCd -= dt;
      if (e.fireCd <= 0 && dist < 460) {
        e.fireCd = 2.4;
        world.ebullets.push({
          x: e.x + nx * (e.radius + 6), y: e.y + ny * (e.radius + 6),
          vx: nx * 170, vy: ny * 170, radius: 6,
        });
        sfx.shoot();
      }
    } else if (e.type === 'splitter') {
      e.vx += nx * e.speed * 2.4 * dt;
      e.vy += ny * e.speed * 2.4 * dt;
      const sp = Math.hypot(e.vx, e.vy);
      if (sp > e.speed) { e.vx = (e.vx / sp) * e.speed; e.vy = (e.vy / sp) * e.speed; }
      e.angle += dt * 2;
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.x = Math.max(-40, Math.min(VIEW.w + 40, e.x));
    e.y = Math.max(-40, Math.min(VIEW.h + 40, e.y));

    // Touching the player hurts.
    const pdx = p.x - e.x, pdy = p.y - e.y;
    const prr = p.radius + e.radius - 2;
    if (pdx * pdx + pdy * pdy < prr * prr) {
      if (damagePlayer(world)) {
        // Knock the enemy back so one touch is one hit.
        e.x -= nx * 26; e.y -= ny * 26;
        if (p.hp <= 0) return 'player-dead';
      }
    }
  }

  // --- enemy bullets ---
  for (let i = world.ebullets.length - 1; i >= 0; i--) {
    const b = world.ebullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -20 || b.x > VIEW.w + 20 || b.y < -20 || b.y > VIEW.h + 20) {
      world.ebullets.splice(i, 1);
      continue;
    }
    const dx = p.x - b.x, dy = p.y - b.y;
    const rr = p.radius + b.radius - 2;
    if (dx * dx + dy * dy < rr * rr) {
      world.ebullets.splice(i, 1);
      if (damagePlayer(world) && p.hp <= 0) return 'player-dead';
    }
  }

  // --- wave cleared: nothing left to spawn or fight ---
  if (world.spawnQueue === 0 && world.enemies.length === 0 && world.ebullets.length === 0) {
    return 'wave-cleared';
  }
  return null;
}
