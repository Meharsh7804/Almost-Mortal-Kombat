# RIFTBOUND

A browser-based 2D anime fighting game built with Phaser 3, TypeScript and Vite.

**Current status: Phase 1 - Core Combat Prototype.** The project now includes a complete local
two-player training match: movement, jumping, crouching, light and heavy attacks, hitbox collision,
damage, hitstun, knockdowns, health HUD, victory screen and rematch flow. All visuals remain
procedural, with no external art or audio dependencies.

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
- Light and heavy punches with startup, active and recovery frames.
- Frame-accurate hitbox/hurtbox collision, one hit per target per attack and trade handling.
- Damage, health clamping, knockback, hitstun, knockdown, launching and K.O. detection.
- READY/FIGHT intro countdown, hitstop, camera shake, hit flashes and spark particles.
- Health HUD, phase announcements, victory/draw overlay, rematch and return-to-menu flow.
- Shared 60 Hz fixed-timestep clock driven by Phaser's single RAF loop.
- Responsive page shell with a landscape hint on narrow portrait screens.
- Type-checked production build, ESLint, Prettier and 76 unit tests.

No external images, fonts, audio or network requests are used. Every visual is generated at runtime
with Phaser graphics and canvas textures. In development builds, press **`** to toggle hitbox,
hurtbox and pushbox visualization.

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
- `src/combat/` owns frame data, attack state, hitbox math, damage and combat orchestration.
- `src/controllers/` translates browser keyboard events into device-agnostic input snapshots.
- `src/systems/` owns match phases, intro timing, victory detection and restart.
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
accumulator behavior, collision math, attack frame phases, damage and knockback, fighter movement
and states, input press edges, combat trades/hitstop and match victory/restart flow.

## Assets

The game still ships with an empty external asset manifest. `public/assets` contains folders for
characters, arenas, effects, audio, fonts and UI artwork. Future assets should be registered in
`src/data/AssetManifest.ts`; scenes must not hard-code asset URLs.

## Roadmap

Phase 1 establishes the playable combat foundation for later work:

1. Character selection, round best-of-three flow and match configuration.
2. CPU opponents and an AI controller layer.
3. External character/arena art, animation pipelines and audio.
4. Additional moves, blocking, throws and special meters.
5. Online or additional local match modes.

## Browser Support

Designed for current desktop versions of Chrome, Edge, Firefox and Safari. Phaser falls back to the
Canvas renderer when WebGL 2 is unavailable. A landscape layout is strongly recommended on mobile.
