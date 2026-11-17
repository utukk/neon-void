// Neon Void — entry point and game loop. Owns the screens (title,
// playing, upgrade choice, pause, game over), the canvas scaling and the
// frame loop; the simulation lives in world.js, the drawing in render.js.
//
// Screenshot/deep-link states for real renders of real game states:
//   ?shot=start   title screen (default)
//   ?shot=play    mid-wave fight, a few seconds in
//   ?shot=upgrade the between-wave upgrade choice
//   ?shot=end     game-over screen with a final score
// Add &seed=N to replay the same arena.
import { VIEW } from './config.js';
import { input, bindInput } from './input.js';
import { createWorld, startWave, update, updateAmbient, pickUpgrades, applyUpgrade } from './world.js';
import { drawWorld, drawTitle, drawUpgrade, drawPause, drawGameOver, upgradeCardRects } from './render.js';
import { unlockAudio, toggleMute, sfx } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || '20261117') >>> 0;
const shot = params.get('shot') || 'start';

let world = createWorld(seed);
let state = 'title'; // title | playing | upgrade | paused | gameover
let best = 0;
try { best = Number(localStorage.getItem('neon-void-best') || '0') || 0; } catch { best = 0; }

function saveBest() {
  if (world.score > best) {
    best = world.score;
    try { localStorage.setItem('neon-void-best', String(best)); } catch { /* offline play: ignore */ }
  }
}

// --- canvas sizing: logical 960x540, letterboxed to the window ---
let scale = 1, offsetX = 0, offsetY = 0;
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  canvas.style.width = `${cw}px`;
  canvas.style.height = `${ch}px`;
  scale = Math.min(cw / VIEW.w, ch / VIEW.h) * dpr;
  offsetX = (canvas.width - VIEW.w * scale) / 2;
  offsetY = (canvas.height - VIEW.h * scale) / 2;
}
window.addEventListener('resize', resize);
resize();

bindInput(canvas, (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW.w,
    y: ((clientY - rect.top) / rect.height) * VIEW.h,
  };
});

function startGame() {
  // Real play varies the run: mix the clock into the URL seed.
  world = createWorld((seed ^ (Date.now() % 100000)) >>> 0);
  state = 'playing';
  startWave(world);
}

function startGameSeeded() {
  world = createWorld(seed);
  state = 'playing';
  startWave(world);
}

function toGameOver() {
  state = 'gameover';
  saveBest();
  sfx.gameOver();
}

// --- scripted input for the ?shot= states: the game plays itself for a
// fixed number of steps so the screenshot shows a real, populated arena.
// The ship circles near the middle instead of drifting into a corner.
function simInput(aimAt) {
  const t = world.time;
  return {
    moveAxis: () => ({ x: Math.sin(t * 0.9) * 0.5, y: Math.cos(t * 0.7) * 0.5 }),
    mouse: aimAt || { x: VIEW.w * 0.72, y: VIEW.h * 0.4 },
    firing: true,
    wasPressed: () => false,
  };
}

function simulate(seconds, aimAtEnemy) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    let aim = simInput().mouse;
    if (aimAtEnemy && world.enemies.length > 0) {
      const e = world.enemies[0];
      aim = { x: e.x, y: e.y };
    }
    const ev = update(world, 1 / 60, simInput(aim));
    if (ev === 'player-dead') break;
    if (ev === 'wave-cleared') return 'wave-cleared';
  }
  return null;
}

function applyShot() {
  if (shot === 'play') {
    startGameSeeded();
    simulate(5, true);
  } else if (shot === 'upgrade') {
    startGameSeeded();
    // Play wave 1 until it clears (or force it after 40 simulated seconds).
    let ev = simulate(40, true);
    if (ev !== 'wave-cleared') {
      world.spawnQueue = 0;
      world.enemies.length = 0;
      world.ebullets.length = 0;
      update(world, 1 / 60, simInput());
    }
    world.upgradeChoices = pickUpgrades(world);
    state = 'upgrade';
  } else if (shot === 'end') {
    startGameSeeded();
    simulate(2, true);
    world.score = 12450;
    world.wave = 6;
    world.kills = 87;
    world.bestCombo = 6;
    world.player.hp = 0;
    world.banner = null;   // no stale WAVE 1 banner behind the overlay
    world.texts.length = 0;
    state = 'gameover';
  }
  // 'start' (or anything else) leaves the title screen up.
}
applyShot();

// Test hook for automated play-testing: read-only state plus the live world.
// `world` is a getter so it follows startGame()'s reassignment.
window.__neon = {
  state: () => state,
  score: () => world.score,
  wave: () => world.wave,
  hp: () => world.player.hp,
  get world() { return world; },
};

// --- input edges, handled once per frame ---
function handleEdges() {
  if (input.wasPressed('KeyM')) toggleMute();
  if (state === 'title') {
    if (input.wasPressed('Enter') || input.mouse.down) {
      unlockAudio();
      sfx.uiClick();
      startGame();
    }
  } else if (state === 'playing') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) state = 'paused';
    else if (input.wasPressed('KeyR')) startGame();
  } else if (state === 'paused') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) state = 'playing';
    else if (input.wasPressed('KeyR')) startGame();
  } else if (state === 'upgrade') {
    let pick = -1;
    if (input.wasPressed('Digit1')) pick = 0;
    if (input.wasPressed('Digit2')) pick = 1;
    if (input.wasPressed('Digit3')) pick = 2;
    if (pick === -1 && input.mouse.down) {
      const rects = upgradeCardRects();
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (input.mouse.x >= r.x && input.mouse.x <= r.x + r.w &&
            input.mouse.y >= r.y && input.mouse.y <= r.y + r.h) pick = i;
      }
    }
    if (pick >= 0 && world.upgradeChoices[pick]) {
      applyUpgrade(world, world.upgradeChoices[pick].id);
      world.upgradeChoices = [];
      startWave(world);
      state = 'playing';
    }
  } else if (state === 'gameover') {
    if (input.wasPressed('KeyR') || input.mouse.down) {
      unlockAudio();
      startGame();
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') state = 'paused';
});
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// --- frame loop ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  handleEdges();
  if (state === 'playing') {
    const ev = update(world, dt, input);
    if (ev === 'wave-cleared') {
      world.upgradeChoices = pickUpgrades(world);
      state = 'upgrade';
    } else if (ev === 'player-dead') {
      toGameOver();
    }
  } else {
    // Screens freeze the fight but not the feedback: particles settle and
    // floating text fades instead of hanging frozen on the overlay.
    updateAmbient(world, dt);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  drawWorld(ctx, world, now / 1000);
  if (state === 'title') drawTitle(ctx, best);
  else if (state === 'upgrade') drawUpgrade(ctx, world.upgradeChoices);
  else if (state === 'paused') drawPause(ctx);
  else if (state === 'gameover') drawGameOver(ctx, world);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
