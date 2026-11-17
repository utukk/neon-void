// Neon Void — rendering. Canvas 2D with a neon look: dark grid arena,
// glowing geometric ships, particles, floating score text and a full HUD.
// Every screen (title, upgrade choice, pause, game over) is drawn here;
// main.js picks which one is on top of the world.
import { VIEW, COLORS } from './config.js';

// A fixed starfield so the background is stable from frame to frame.
const STARS = [];
{
  let s = 1337;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 90; i++) {
    STARS.push({ x: rnd() * VIEW.w, y: rnd() * VIEW.h, r: 0.6 + rnd() * 1.6, tw: rnd() * Math.PI * 2 });
  }
}

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function poly(ctx, x, y, r, sides, angle) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = angle + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawBackground(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  g.addColorStop(0, '#070818');
  g.addColorStop(1, '#04040c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  // Faint grid.
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= VIEW.w; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, VIEW.h); }
  for (let y = 0; y <= VIEW.h; y += 60) { ctx.moveTo(0, y); ctx.lineTo(VIEW.w, y); }
  ctx.stroke();

  // Twinkling stars.
  for (const s of STARS) {
    const a = 0.35 + 0.3 * Math.sin(t * 1.4 + s.tw);
    ctx.globalAlpha = a;
    ctx.fillStyle = COLORS.star;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Arena border.
  ctx.strokeStyle = '#1d2450';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, VIEW.w - 2, VIEW.h - 2);
}

function drawPlayer(ctx, p, t) {
  if (p.hp <= 0) return; // the wreck is gone on the game-over screen
  // Mercy blink after a hit: dim the ship instead of hiding it, so it
  // never vanishes from a screenshot mid-blink.
  ctx.save();
  if (p.invuln > 0 && Math.floor(t * 14) % 2 === 0) ctx.globalAlpha = 0.35;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  glow(ctx, COLORS.player, 18);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-11, -11);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-11, 11);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.playerCore;
  ctx.beginPath();
  ctx.arc(2, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  glow(ctx, e.color, 14);
  ctx.fillStyle = e.color;
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 2;
  if (e.type === 'chaser' || e.type === 'mini') {
    ctx.rotate(e.angle);
    ctx.beginPath();
    ctx.moveTo(e.radius, 0);
    ctx.lineTo(-e.radius * 0.8, -e.radius * 0.75);
    ctx.lineTo(-e.radius * 0.8, e.radius * 0.75);
    ctx.closePath();
    ctx.fill();
  } else if (e.type === 'spinner') {
    ctx.rotate(e.angle);
    ctx.strokeRect(-e.radius * 0.8, -e.radius * 0.8, e.radius * 1.6, e.radius * 1.6);
    ctx.beginPath();
    ctx.moveTo(-e.radius * 0.8, 0);
    ctx.lineTo(e.radius * 0.8, 0);
    ctx.stroke();
  } else if (e.type === 'shooter') {
    ctx.rotate(e.angle);
    poly(ctx, 0, 0, e.radius, 4, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'splitter') {
    ctx.rotate(e.angle);
    poly(ctx, 0, 0, e.radius, 6, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#eafff1';
    ctx.lineWidth = 1.5;
    poly(ctx, 0, 0, e.radius * 0.45, 6, 0);
    ctx.stroke();
  }
  ctx.restore();
  // Health ring for tougher enemies.
  if (e.maxHp > 1 && e.hp < e.maxHp) {
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius + 6, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * e.hp) / e.maxHp);
    ctx.stroke();
  }
}

function drawHUD(ctx, world) {
  const p = world.player;
  ctx.textBaseline = 'alphabetic';
  // Score, top left.
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 26px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${world.score.toLocaleString('en-US')}`, 18, 36);
  // Combo under the score.
  if (world.combo >= 2) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = '700 17px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`COMBO x${world.combo}`, 18, 60);
    ctx.fillStyle = 'rgba(255,209,102,0.35)';
    ctx.fillRect(18, 68, 110 * Math.max(0, world.comboTimer / 2.5), 4);
  }
  // Wave, top centre.
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`WAVE ${world.wave}`, VIEW.w / 2, 34);
  // Hull (lives) as small ships, top right.
  ctx.textAlign = 'right';
  ctx.font = '700 17px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('HULL', VIEW.w - 118, 30);
  for (let i = 0; i < p.maxHp; i++) {
    ctx.save();
    ctx.translate(VIEW.w - 96 + i * 26, 24);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = i < p.hp ? COLORS.player : 'rgba(60,70,110,0.5)';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Dash cooldown, bottom centre.
  const frac = p.dashCd <= 0 ? 1 : 1 - p.dashCd / p.dashCooldown;
  ctx.textAlign = 'center';
  ctx.fillStyle = frac >= 1 ? COLORS.player : COLORS.dim;
  ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(frac >= 1 ? 'DASH READY  [SHIFT]' : 'DASH', VIEW.w / 2, VIEW.h - 26);
  ctx.fillStyle = 'rgba(34,230,255,0.25)';
  ctx.fillRect(VIEW.w / 2 - 70, VIEW.h - 20, 140, 6);
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(VIEW.w / 2 - 70, VIEW.h - 20, 140 * frac, 6);
}

// The world plus HUD, with screen shake and the hit flash.
export function drawWorld(ctx, world, t) {
  ctx.save();
  if (world.shake > 0.3) {
    const s = world.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawBackground(ctx, t);
  for (const b of world.bullets) {
    glow(ctx, COLORS.bullet, 10);
    ctx.fillStyle = COLORS.bullet;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  for (const b of world.ebullets) {
    glow(ctx, COLORS.enemyBullet, 10);
    ctx.fillStyle = COLORS.enemyBullet;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  for (const e of world.enemies) drawEnemy(ctx, e);
  drawPlayer(ctx, world.player, t);
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const ft of world.texts) {
    ctx.globalAlpha = Math.max(0, ft.life / 0.9);
    ctx.fillStyle = ft.color;
    ctx.font = `700 ${ft.size}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;
  drawHUD(ctx, world);
  if (world.banner) {
    ctx.globalAlpha = Math.min(1, world.banner.timer);
    ctx.textAlign = 'center';
    glow(ctx, COLORS.player, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 52px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(world.banner.text, VIEW.w / 2, VIEW.h / 2 - 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.dim;
    ctx.font = '600 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(world.banner.sub, VIEW.w / 2, VIEW.h / 2 + 24);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255,59,48,${world.flash * 0.35})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
}

function dim(ctx, alpha = 0.72) {
  ctx.fillStyle = `rgba(3,4,12,${alpha})`;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
}

function centerText(ctx, text, y, font, color, glowColor = null) {
  ctx.textAlign = 'center';
  if (glowColor) glow(ctx, glowColor, 24);
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.fillText(text, VIEW.w / 2, y);
  ctx.shadowBlur = 0;
}

export function drawTitle(ctx, best) {
  dim(ctx, 0.45);
  centerText(ctx, 'NEON VOID', 150, '800 84px "Segoe UI", system-ui, sans-serif', '#eaf6ff', COLORS.player);
  centerText(ctx, 'SURVIVE THE ARENA  ·  CHAIN THE COMBO  ·  PICK YOUR POWER', 196, '600 16px "Segoe UI", system-ui, sans-serif', COLORS.gold);
  const lines = [
    ['MOVE', 'WASD / ARROW KEYS'],
    ['AIM + FIRE', 'MOUSE — HOLD CLICK  ·  OR HOLD SPACE'],
    ['DASH', 'SHIFT — SHORT BURST, BRIEF INVULNERABILITY'],
    ['PAUSE / MUTE / RESTART', 'P  ·  M  ·  R'],
  ];
  ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
  let y = 258;
  for (const [k, v] of lines) {
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(k, VIEW.w / 2 - 14, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(v, VIEW.w / 2 + 14, y);
    y += 32;
  }
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 280);
  ctx.globalAlpha = pulse;
  centerText(ctx, 'CLICK OR PRESS ENTER TO START', 430, '700 22px "Segoe UI", system-ui, sans-serif', '#ffffff', COLORS.player);
  ctx.globalAlpha = 1;
  if (best > 0) {
    centerText(ctx, `BEST SCORE  ${best.toLocaleString('en-US')}`, 470, '600 15px "Segoe UI", system-ui, sans-serif', COLORS.dim);
  }
}

// Upgrade cards: three choices in a row. Exported so main.js can hit-test
// clicks with the same geometry the renderer uses.
export function upgradeCardRects() {
  const w = 264, h = 168, gap = 22;
  const total = w * 3 + gap * 2;
  const x0 = (VIEW.w - total) / 2;
  const y0 = 218;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y: y0, w, h }));
}

export function drawUpgrade(ctx, choices) {
  dim(ctx, 0.78);
  centerText(ctx, 'WAVE CLEARED', 108, '800 40px "Segoe UI", system-ui, sans-serif', '#ffffff', COLORS.gold);
  centerText(ctx, 'CHOOSE AN UPGRADE — CLICK A CARD OR PRESS 1 / 2 / 3', 146, '600 16px "Segoe UI", system-ui, sans-serif', COLORS.dim);
  const rects = upgradeCardRects();
  choices.forEach((up, i) => {
    const r = rects[i];
    ctx.fillStyle = '#0d1030';
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.dim;
    ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, r.x + r.w / 2, r.y + 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 21px "Segoe UI", system-ui, sans-serif';
    wrapText(ctx, up.name, r.x + r.w / 2, r.y + 66, r.w - 28, 24);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
    wrapText(ctx, up.desc, r.x + r.w / 2, r.y + 104, r.w - 28, 20);
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

export function drawPause(ctx) {
  dim(ctx, 0.6);
  centerText(ctx, 'PAUSED', 240, '800 56px "Segoe UI", system-ui, sans-serif', '#ffffff', COLORS.player);
  centerText(ctx, 'P / ESC — RESUME      R — RESTART', 300, '600 17px "Segoe UI", system-ui, sans-serif', COLORS.dim);
}

export function drawGameOver(ctx, world) {
  dim(ctx, 0.72);
  centerText(ctx, 'SIGNAL LOST', 168, '800 64px "Segoe UI", system-ui, sans-serif', '#ff5c6c', COLORS.danger);
  centerText(ctx, 'THE VOID CLAIMS ANOTHER PILOT', 210, '600 16px "Segoe UI", system-ui, sans-serif', COLORS.dim);
  centerText(ctx, `FINAL SCORE  ${world.score.toLocaleString('en-US')}`, 292, '700 34px "Segoe UI", system-ui, sans-serif', '#ffffff');
  centerText(ctx, `WAVE ${world.wave}  ·  ${world.kills} KILLS  ·  BEST COMBO x${world.bestCombo || 0}`, 332, '600 17px "Segoe UI", system-ui, sans-serif', COLORS.gold);
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 280);
  ctx.globalAlpha = pulse;
  centerText(ctx, 'PRESS R OR CLICK TO PLAY AGAIN', 420, '700 20px "Segoe UI", system-ui, sans-serif', '#ffffff', COLORS.player);
  ctx.globalAlpha = 1;
}
