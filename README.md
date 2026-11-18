# RIFTBOUND

RIFTBOUND is a browser-based 2D anime fighting game prototype built with Phaser 3, TypeScript, and Vite.

## Features (release candidate scope)
- **Local Versus**: two players on one keyboard
- **CPU Battle**: fight against AI with selectable difficulty/personality (via match setup flow)
- **Training**: lightweight practice match against a CPU-controlled opponent (easy/defensive AI by default)
- **Arcade**: stage ladder/progression flow with run state
- **Playable fighters**: Kai, Rhea
- **Arenas**: Forgotten Temple, Neon District, Reactor Core, Frozen Sanctuary
- **Core combat**: movement, jump, crouch, light/heavy attacks, character specials (energy), blocking/perfect guard, dodge, combos, round timer, KO/time-out rounds
- **Progression/profile (local storage)**: XP/levels, mastery, achievements, unlocks/collection, arcade progress
- **Settings (persistent)**: Master/Music/SFX volume, mute, reduced motion (System/On/Off), screen shake toggle
- **Pause**: in-match pause/resume menu (ESC) with Resume, Restart Match, and Main Menu actions

## Requirements
- **Node.js 20.19+** (or newer compatible version)
- **npm**

## Install & run (development)
```bash
npm install
npm run dev
```
Open the URL printed by Vite (typically `http://localhost:5173`).

## Production build & preview
```bash
npm run build
npm run preview
```
- Production output is generated in `dist/`.
- Vite is configured with `base: './'` for static hosting compatibility.
- For static hosts, serve `dist/` as the site root. If your host requires SPA-style fallback for unknown paths/refreshes, configure fallback to `index.html` (scene navigation is internal to Phaser in this build).

## Scripts
- `npm run dev` — start Vite dev server
- `npm run build` — typecheck + production build
- `npm run preview` — preview production build locally
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript (`tsc --noEmit`)
- `npm run test` — Vitest

## Controls
### Menus
- **Mouse**: click buttons
- **Keyboard**: Up/Down or W/S to navigate, Enter/Space to confirm, Esc to go back (where available)

### Match (default bindings)
**Player 1**
- Move: **A/D** | Jump: **W** | Crouch: **S**
- Light: **F** | Heavy: **G**
- Block: **T** | Specials: **H/Y** | Dodge: **Q**

**Player 2**
- Move: **Left/Right** | Jump: **Up** | Crouch: **Down**
- Light: **J** | Heavy: **K**
- Block: **O** | Specials: **U/I** | Dodge: **P**

**In match**
- **Esc**: Pause / Resume

> Input remapping is not currently available.

## Audio & assets
- Visuals are primarily procedural/runtime-generated.
- Audio is routed through a centralized audio manager and fails safely when audio assets/keys are missing.
- No bundled copyrighted audio assets are included by default. To add audio, place files under `public/assets/audio/` and register keys/paths in `src/data/AssetManifest.ts`.

## Save data
- Profile, progression, and settings are stored in browser local storage.
- The game sanitizes/migrates profile data and falls back safely for invalid/corrupt entries.
- A development-only profile reset option is available in Settings when running in dev mode.

## Known limitations
- No online multiplayer
- No input remapping UI
- No bundled audio files by default (audio hooks are present; playback depends on registered assets)
- Balance, AI behavior, and performance have been iteratively tuned for this release candidate but may require further playtesting

## Project structure (high level)
- `src/core` — game bootstrap and fixed-step loop
- `src/scenes` — menus, selection, battle, results, progression screens
- `src/systems`, `src/combat`, `src/entities` — match/combat logic
- `src/ai` — CPU behavior
- `src/progression` — profile, XP/mastery, achievements, unlocks
- `src/ui` — HUD, menus, VFX/UI helpers
- `src/audio` — centralized audio management
- `public/assets` — static asset location
