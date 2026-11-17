# Neon Void

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/utukk/neon-void/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/utukk/neon-void/reward.svg)](https://make.fun/bounty/best-game-01)

An original top-down neon arena survival shooter, built for make.fun's
**best-game-01** bounty ("Make the best game"). Vanilla JavaScript + Canvas
2D, no dependencies, no network — open `game/index.html` in desktop Chrome
and play offline.

## The game

You are the last pilot in the Void. Geometric hostiles pour in wave after
wave; survive them, chain kills into a combo multiplier, and pick one of
three upgrades between waves to build your ship.

- **Move** — WASD / arrow keys
- **Aim + fire** — mouse, hold click (or hold Space)
- **Dash** — Shift, a short burst with brief invulnerability (cooldown shown in the HUD)
- **Pause / mute / restart** — P / M / R

Enemies escalate as the waves climb: **chasers** hunt you down, **spinners**
dart in wobbling arcs, **shooters** keep their distance and fire orbs, and
**splitters** break into two fast minis when destroyed. You have 3 hull;
lose them all and the Void claims you.

Between waves you choose one of three upgrades — rapid fire, split shot,
heavy rounds, thrusters, faster dash recharge, reinforced hull, piercing
rounds, railgun coils — so no two runs build the same ship.

Sound is synthesized live with WebAudio (shots, hits, explosions, pickups,
wave horns); there are no audio files. Particles, screen shake, hit flash,
floating score text and a wave banner give every action feedback.

## Play it

```sh
node serve.ts   # serves game/ on http://localhost:8080
```

or open `game/index.html` from any static server.

## Layout

- `game/` — the game: `index.html` plus `src/` (`main.js`, `world.js`,
  `render.js`, `input.js`, `audio.js`, `config.js`)
- `screenshots/` — renders of the game running: title, mid-wave play,
  upgrade choice, game over
- `main.ts` — the entry program: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
