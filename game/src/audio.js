// Neon Void — synthesized sound. No audio files: every effect is an
// oscillator (or a short noise burst) through the Web Audio API, built on
// the first user gesture so browsers allow it. M toggles mute.
let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  return true;
}

export function unlockAudio() { ensure(); }
export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.35;
  return muted;
}

// A single oscillator blip: frequency slides from f0 to f1 over `dur`.
function blip({ type = 'square', f0 = 440, f1 = null, dur = 0.08, vol = 0.5, delay = 0 }) {
  if (muted || !ensure()) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, f0), t0);
  if (f1 !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Filtered noise burst for explosions and hits.
function noise({ dur = 0.25, vol = 0.5, freq = 1200, delay = 0 }) {
  if (muted || !ensure()) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq, t0);
  filter.frequency.exponentialRampToValueAtTime(120, t0 + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t0);
}

export const sfx = {
  shoot() { blip({ type: 'square', f0: 880, f1: 320, dur: 0.07, vol: 0.16 }); },
  hit() { noise({ dur: 0.08, vol: 0.25, freq: 2600 }); },
  explode() {
    noise({ dur: 0.35, vol: 0.5, freq: 900 });
    blip({ type: 'sine', f0: 220, f1: 40, dur: 0.3, vol: 0.4 });
  },
  playerHit() {
    noise({ dur: 0.4, vol: 0.55, freq: 700 });
    blip({ type: 'sawtooth', f0: 160, f1: 40, dur: 0.35, vol: 0.4 });
  },
  pickup() {
    blip({ type: 'sine', f0: 660, f1: 660, dur: 0.08, vol: 0.3 });
    blip({ type: 'sine', f0: 990, f1: 990, dur: 0.12, vol: 0.3, delay: 0.07 });
  },
  waveStart() {
    blip({ type: 'triangle', f0: 330, f1: 660, dur: 0.22, vol: 0.35 });
    blip({ type: 'triangle', f0: 495, f1: 990, dur: 0.22, vol: 0.25, delay: 0.12 });
  },
  dash() { noise({ dur: 0.12, vol: 0.2, freq: 3200 }); },
  gameOver() {
    blip({ type: 'sawtooth', f0: 220, f1: 55, dur: 0.9, vol: 0.35 });
    noise({ dur: 0.8, vol: 0.3, freq: 500, delay: 0.1 });
  },
  uiClick() { blip({ type: 'sine', f0: 1200, f1: 900, dur: 0.05, vol: 0.25 }); },
};
