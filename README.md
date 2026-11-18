# RIFTBOUND

A browser-based 2D anime fighting game built with Phaser 3, TypeScript and Vite.

**Current status: Phase 2 - Advanced Combat.** The project now includes a complete local two-player
training match with movement, jumping, crouching, light/heavy attacks, hitbox collision, damage,
hitstun, knockdowns, frame data, input buffering, combo scaling, attack cancelling, standing and
crouching block, perfect guard, dodge, an energy meter, four special attacks, projectiles, combat
events, an expanded HUD and improved visual feedback. All visuals remain procedural, with no
external art or audio dependencies.

## Stack

- Phaser 3.90 with automatic WebGL / Canvas renderer selection
- TypeScript 5.9 in strict mode
- Vite 7 for development and production builds
- Vitest for unit tests
- ESLint and Prettier

## Quick Start

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Open the URL printed by Vite (default `http://localhost:5173`).

### Commands

| Command                | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start the Vite development server        |
| `npm run build`        | Type-check and create a production build |
| `npm run preview`      | Preview the production build             |
| `npm run test`         | Run the Vitest suite once                |
| `npm run test:watch`   | Run Vitest in watch mode                 |
| `npm run typecheck`    | Run TypeScript without emitting files    |
| `npm run lint`         | Lint the project                         |
| `npm run lint:fix`     | Lint and apply safe fixes                |
| `npm run format`       | Format all files with Prettier           |
| `npm run format:check` | Verify formatting without writing        |

## Playable Features

- 1280x720 logical resolution with 16:9 `FIT` scaling and centered framing.
- Boot, Preload, Menu and Battle scenes with a complete title-to-fight handoff.
- Two procedurally rendered fighters, KAI and RHEA, with per-player color identity.
- Walking, jumping, crouching, automatic facing and pushbox separation.
- Data-driven attacks with startup, active, recovery, hitstun, blockstun, chip damage, hitstop and
  cancel windows.
- Light punch, heavy punch and crouching low kick with HIGH/MID/LOW guard rules.
- 8-frame input buffering, including inputs pressed during hitstop.
- Combos with per-hit damage scaling (100/90/80/70/60%) and a 60-frame combo timeout.
- Contact-gated attack cancels: light chains into light/heavy/special, heavy cancels into special,
  with chain-depth and repeat caps to prevent infinite loops.
- Standing and crouching block, guard-direction validation, chip damage and a 4-frame perfect guard
  that removes chip damage, halves blockstun and grants energy.
- Forward/backward dodge with 15 energy, 12 frames, 5 invulnerability frames and a 45-frame cooldown.
- 100-point energy meter: +5 on light hits, +8 on heavy hits, +6 on perfect guard and +3 when taking
  damage; specials cost 25 and dodge costs 15.
- Four specials: KAI's Energy Blast and Rising Strike, RHEA's Shadow Dash and Thunder Kick.
- Pooled projectiles with ownership, lifetime, guard/dodge interaction and one-hit-per-target logic.
- Typed combat events for hits, blocks, perfect guards, combos, dodges, specials and K.O.s.
- HUD energy meters, dodge cooldown labels, combo counter, special/perfect-guard notices and block
  tint feedback.
- Perfect-guard rings, guard/dodge particles, projectile trails, hitstop, screen shake and hit flashes;
  reduced-motion preference disables camera shake and tones down extra particle effects.
- Frame-accurate hitbox/hurtbox collision, one hit per target per attack and trade handling.
- Damage, health clamping, knockback, hitstun, knockdown, launching and K.O. detection.
- READY/FIGHT intro countdown, victory/draw overlay, rematch and return-to-menu flow.
- Shared 60 Hz fixed-timestep clock driven by Phaser's single RAF loop.
- Responsive page shell with a landscape hint on narrow portrait screens.
- Type-checked production build, ESLint, Prettier and 133 unit tests.

No external images, fonts, audio or network requests are used. Every visual is generated at runtime
with Phaser graphics and canvas textures. In development builds, press **`** to toggle hitbox,
hurtbox, pushbox and projectile visualization.

## Architecture

### Single loop, fixed simulation

Phaser owns the only `requestAnimationFrame` loop. `Game` subscribes to Phaser's `PRE_STEP` event
and forwards the render delta into `GameLoop`. The loop accumulates render time and executes zero or
more fixed 60 Hz simulation ticks, capped at five catch-up steps per frame. Long stalls are clamped
to 250 ms and any remaining backlog is dropped to avoid a catch-up spiral.

Future gameplay systems subscribe with `addFixedUpdate`; rendering stays frame-based and can use
`interpolationAlpha` to smooth between simulation ticks. Scenes retrieve the shared loop through the
scene registry rather than importing a mutable global singleton.

### Engine boundary

- `src/core/GameConfig.ts` is a pure, frozen configuration contract with no Phaser dependency.
- `src/core/Game.ts` maps that contract onto Phaser and owns engine startup and teardown.
- `src/core/GameLoop.ts` is the fixed-timestep clock and exposes subscription and diagnostic APIs.
- `src/scenes/` contains scene-level orchestration only.
- `src/ui/` contains reusable procedural UI components, arena rendering and the shared visual theme.
- `src/data/` owns asset manifests, texture keys, fighter stats and arena bounds.
- `src/entities/` owns fighter simulation and the validated state machine.
- `src/combat/` owns frame data, attacks, hitboxes, input buffering, combos, projectiles, combat
  events, damage and combat orchestration.
- `src/controllers/` translates browser keyboard events into device-agnostic input snapshots.
- `src/systems/` owns match phases, energy, intro timing, victory detection and restart.
- `src/ui/Accessibility.ts` exposes the reduced-motion preference; `src/ui/CombatVfx.ts` renders
  projectile, guard and dodge effects.
- `src/ai/` and `src/animation/` remain reserved for later phases.

### Project structure

```text
.
├── public/assets/          # Future external asset roots (currently empty)
├── src/
│   ├── combat/             # Frame data, attacks, hitboxes, damage and combat engine
│   ├── controllers/        # Keyboard mapping and input snapshots
│   ├── core/               # Game config, bootstrap and fixed-timestep loop
│   ├── data/               # Asset manifest, texture keys, fighter stats and arena
│   ├── entities/           # Fighter simulation and state machine
│   ├── scenes/             # Boot, Preload, Menu and Battle scenes
│   ├── styles/             # Page shell and responsive CSS
│   ├── systems/            # Match flow, victory detection and restart
│   ├── ui/                 # Theme, arena, fighters, HUD, victory screen and textures
│   ├── utils/              # Shared collision math
│   └── main.ts             # Application entry point
├── tests/                  # Gameplay, input and simulation tests
├── index.html
├── vite.config.ts
└── package.json
```

## Controls

| Action      | Player 1 | Player 2     |
| ----------- | -------- | ------------ |
| Move        | A / D    | Left / Right |
| Jump        | W        | Up Arrow     |
| Crouch      | S        | Down Arrow   |
| Light punch | F        | J            |
| Heavy punch | G        | K            |
| Block       | T        | O            |
| Special 1   | H        | U            |
| Special 2   | Y        | I            |
| Dodge       | Q        | P            |

- Hold block to guard; block within four frames of an incoming hit for a perfect guard. HIGH attacks
  require standing block, LOW attacks require crouching block, and MID attacks can be guarded either
  way. Specials are blocked by the matching guard height.
- Dodge with no direction held to hop backward, or hold left/right while pressing dodge to move in
  that direction. Dodging costs 15 energy and has 5 invulnerability frames.
- Click or tap **START**, or press **Enter**/**Space**, to enter the battle.
- After a match, choose **REMATCH** or **RETURN TO MENU** (or press **Enter**/**Esc**).
- In development builds, press **`** to toggle collision debug boxes.

## Testing

```bash
npm run test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

The test suite covers the frozen configuration contract, scene ordering, fixed 60 Hz stepping,
accumulator behavior, collision math, attack frame phases and cancel windows, damage and knockback,
fighter movement and states, input press edges, input buffering, combo scaling, blocking and perfect
guard, dodge invulnerability/cooldown, energy spending, projectiles, combat trades/hitstop and match
victory/restart flow.

## Frame Data

| Attack        | Damage | Startup | Active | Recovery | Guard | Cost | Notes                     |
| ------------- | ------ | ------- | ------ | -------- | ----- | ---- | ------------------------- |
| Light Punch   | 5      | 6       | 3      | 12       | HIGH  | -    | Cancels into L/H/Special  |
| Heavy Punch   | 12     | 14      | 4      | 24       | MID   | -    | Launcher/knockdown        |
| Low Kick      | 4      | 5       | 3      | 10       | LOW   | -    | Crouching light           |
| Energy Blast  | 10     | 16      | 2      | 20       | MID   | 25   | Projectile                |
| Rising Strike | 15     | 10      | 5      | 26       | MID   | 25   | Launcher/knockdown        |
| Shadow Dash   | 13     | 12      | 4      | 22       | MID   | 25   | Forward advance           |
| Thunder Kick  | 16     | 15      | 4      | 24       | MID   | 25   | Forward advance/knockdown |

Combo scaling is 100/90/80/70/60% for hits 1-5+ and resets when the victim recovers, blocks or the
60-frame combo timer expires.

## Assets

The game still ships with an empty external asset manifest. `public/assets` contains folders for
characters, arenas, effects, audio, fonts and UI artwork. Future assets should be registered in
`src/data/AssetManifest.ts`; scenes must not hard-code asset URLs.

## Roadmap

Phase 2 completes the advanced combat foundation for later work:

1. Character selection, round best-of-three flow and match configuration.
2. CPU opponents and an AI controller layer.
3. External character/arena art, animation pipelines and audio.
4. Ultimate attacks using the reserved 100-energy cost, throws and aerial specials.
5. Online or additional local match modes.

## Browser Support

Designed for current desktop versions of Chrome, Edge, Firefox and Safari. Phaser falls back to the
Canvas renderer when WebGL 2 is unavailable. A landscape layout is strongly recommended on mobile.
