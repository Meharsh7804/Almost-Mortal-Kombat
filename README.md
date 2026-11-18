# RIFTBOUND

A browser-based 2D anime fighting game built with Phaser 3, TypeScript and Vite.

**Current status: Phase 3 - Character Identities and Procedural Animation.** The project now includes
a complete local two-player training match with movement, jumping, crouching, light/heavy attacks,
hitbox collision, damage, hitstun, knockdowns, frame data, input buffering, combo scaling, attack
cancelling, standing and crouching block, perfect guard, dodge, an energy meter, four special attacks,
projectiles and combat events. Phase 3 adds distinct KAI and RHEA visual identities, modular
joint-based rigs, 21 deterministic animation clips, pooled event-driven combat VFX and a dev-only
animation debug panel. All visuals remain procedural, with no external art or audio dependencies.

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
- Two procedurally rendered fighters, KAI and RHEA, with distinct silhouettes, hair, outfits, auras
  and victory poses.
- Modular joint-based rigs with independently animated torso, head, hair, scarf/headband tails, arms
  and legs, stable ground alignment, facing mirroring and white hit-flash layers.
- 21 deterministic animation clips driven by the fixed 60 Hz simulation clock, covering idle,
  locomotion, jump phases, landing, attacks, guard, dodge, hit reactions, knockdown/get-up, victory
  and defeat.
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
- Event-driven, pooled visual feedback for light/heavy hits, block, perfect guard, dodge, landing and
  knockdown dust, projectile launches and impacts, combo bursts, defeat bursts and K.O. effects.
- Projectile trails, hitstop, screen shake and hit flashes; the reduced-motion preference disables
  camera shake and tones down extra particle effects.
- Frame-accurate hitbox/hurtbox collision, one hit per target per attack and trade handling.
- Damage, health clamping, knockback, hitstun, knockdown, launching and K.O. detection.
- READY/FIGHT intro countdown, victory/draw overlay, rematch and return-to-menu flow.
- Shared 60 Hz fixed-timestep clock driven by Phaser's single RAF loop.
- Responsive page shell with a landscape hint on narrow portrait screens.
- Type-checked production build, ESLint, Prettier and 177 unit tests.

No external images, fonts, audio or network requests are used. Every visual is generated at runtime
with Phaser graphics and canvas textures. In development builds, press **`** to toggle hitbox,
hurtbox, pushbox and projectile visualization plus the animation-state panel.

## Character Identities

Visual identity is data-driven in `src/data/CharacterVisuals.ts`; gameplay stats, frame data,
specials and collision remain owned by `src/data/FighterData.ts` and the combat engine.

- **KAI** — cyan gi, spiked hair, headband with trailing tails, sash, wrapped forearms and a calm,
  slow-pulsing aura. Idle motion is relaxed; attacks lead with clean straight extensions. Victory
  pose raises a fist.
- **RHEA** — orange/ember bodysuit, ponytail, long scarf and a faster, flickering aura. Idle motion
  is more compact; attacks carry a stronger forward lean and broader follow-through. Victory pose
  crosses her arms.
- Each config supplies palette, skin/hair, proportions, outfit, aura behaviour and idle, movement,
  attack and hit-motion profiles. Unknown roster ids receive a palette-derived fallback config so a
  future fighter can render before bespoke art exists.

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
- `src/ui/fighter/` contains the layered procedural fighter rig; `src/ui/FighterView.ts` adapts the
  simulation and animation state into that rig.
- `src/data/` owns asset manifests, texture keys, fighter stats, visual identities and arena bounds.
- `src/entities/` owns fighter simulation and the validated state machine.
- `src/combat/` owns frame data, attacks, hitboxes, input buffering, combos, projectiles, combat
  events, damage and combat orchestration.
- `src/animation/` owns Phaser-free animation contracts, clip definitions, the deterministic clip
  clock, the gameplay resolver, the procedural pose library and the headless `FighterAnimator`.
- `src/controllers/` translates browser keyboard events into device-agnostic input snapshots.
- `src/systems/` owns match phases, energy, intro timing, victory detection and restart.
- `src/ui/Accessibility.ts` exposes the reduced-motion preference; `src/ui/CombatVfx.ts` renders
  pooled combat feedback.
- `src/ai/` remains reserved for a later phase.

### Animation pipeline

Combat remains the sole authority for fighter state, attack phases, hitstun, knockdowns and match
flow. Animation is a one-way presentation layer:

1. `AnimationTypes.ts` defines the 21 clip ids, priority table and request/snapshot contracts.
2. `AnimationDefinitions.ts` stores durations, looping policy, cross-fade lengths and fallbacks.
3. `AnimationResolver.ts` maps the current fighter observation to a stable, keyed animation request.
   Attack and reaction keys identify one gameplay instance, so a clip does not restart every tick.
4. `AnimationController.ts` advances exactly one frame per fixed simulation tick and enforces
   interruption, completion, fallback and terminal-defeat rules.
5. `FighterAnimator.ts` is the headless per-fighter brain. It blends poses, detects landings and
   get-ups, plays perfect-guard reactions and exposes a debug snapshot.
6. `ProceduralPose.ts` samples the animation clip into joint angles using breathing, stride, attack
   anticipation/recovery, two-bone leg IK and character-specific motion profiles.
7. `ui/fighter/FighterRig.ts` maps the pose onto layered Phaser containers with independent pivots,
   mirrored facing and duplicate white hit-flash parts.
8. `ui/FighterView.ts` is the presentation adapter. `render()` only reads the current pose and draws
   shadows, auras, dodge trails and facing markers; it never advances animation time.

`BattleScene` calls `tickSimulation()` once per fixed tick after `match.update()`. Animation clocks
freeze during hitstop so hit reactions and attacks stay frame-synchronised with combat. Wall-clock
time and randomness are not used, which keeps identical observation sequences deterministic.

The priority order is `DEFEAT > VICTORY > KNOCKDOWN > KNOCKBACK > HIT_REACTION > SPECIAL_ATTACK >
HEAVY_ATTACK > LIGHT_ATTACK > PERFECT_GUARD > BLOCK > DODGE > GET_UP > LANDING > JUMP > CROUCH >
WALK > IDLE`. Looping clips may always yield to a different gameplay silhouette; committed one-shots
require a higher/equal priority or completion. These rules, the resolver, pose sampling and the
animator are covered by headless Vitest suites.

### Visual feedback

`CombatVfx` consumes presentation cues from typed `CombatEvent`s and from match snapshots. A fixed
pool of 14 impact graphics plus reused particle emitters renders light/heavy impacts, guard and
perfect-guard rings, dodge trails, landing and knockdown dust, combo bursts, defeat bursts and
projectile launch flashes. Projectile ids are tracked to spawn a flash exactly once per projectile.
Effects are recycled in place and never write to fighter, combat or input state. Reduced motion
disables camera shake and reduces particle counts.

### Project structure

```text
.
├── public/assets/          # Future external asset roots (currently empty)
├── src/
│   ├── animation/          # Clip data, controller, resolver, poses and fighter animator
│   ├── combat/             # Frame data, attacks, hitboxes, damage and combat engine
│   ├── controllers/        # Keyboard mapping and input snapshots
│   ├── core/               # Game config, bootstrap and fixed-timestep loop
│   ├── data/               # Asset manifest, texture keys, fighter stats and visual identities
│   ├── entities/           # Fighter simulation and state machine
│   ├── scenes/             # Boot, Preload, Menu and Battle scenes
│   ├── styles/             # Page shell and responsive CSS
│   ├── systems/            # Match flow, victory detection and restart
│   ├── ui/                 # Theme, arena, rigs, HUD, victory screen and textures
│   ├── utils/              # Shared collision math
│   └── main.ts             # Application entry point
├── tests/                  # Gameplay, input, simulation and animation tests
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
- In development builds, press **`** to toggle collision debug boxes, projectile boxes and the
  animation-state panel.

## Testing

```bash
npm run test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

The 177-test suite covers the frozen configuration contract, scene ordering, fixed 60 Hz stepping,
accumulator behavior, collision math, attack frame phases and cancel windows, damage and knockback,
fighter movement and states, input press edges, input buffering, combo scaling, blocking and perfect
guard, dodge invulnerability/cooldown, energy spending, projectiles, combat trades/hitstop and match
victory/restart flow. Phase 3 adds headless tests for animation priority and interruption, looping and
one-shot completion/fallback, same-instance restart protection, defeat locking, gameplay-state and
attack mapping, facing-relative dodge selection, character visual configs and fallbacks, procedural
pose determinism and IK, landing/get-up triggers, perfect-guard reactions, victory/defeat transitions
and reset determinism.

## Animation Clips

| Group              | Clips                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Locomotion         | IDLE, WALK_FORWARD, WALK_BACKWARD, CROUCH, JUMP_START, JUMP_RISE, JUMP_FALL, LANDING           |
| Defense and dodge  | BLOCK, PERFECT_GUARD, DODGE_FORWARD, DODGE_BACKWARD                                           |
| Offense            | LIGHT_ATTACK, HEAVY_ATTACK, SPECIAL_ATTACK                                                     |
| Reactions          | HIT_REACTION, KNOCKBACK, KNOCKDOWN, GET_UP                                                     |
| Match result       | VICTORY, DEFEAT                                                                                |

Attack and reaction durations use the current combat lifecycle where appropriate. Idle, walk, crouch,
block, jump arc and victory loop; attacks, dodges, landings, reactions and defeat are one-shots.
Landing, jump start, perfect guard and get-up have explicit fallbacks so a missing gameplay
observation cannot leave the rig stuck on a finished clip.

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

## Limitations

- Fighters are still drawn by the procedural rig. There is no sprite-sheet or texture-atlas animation
  backend yet, though the Phaser-free animator/pose layers are designed to support one.
- Bespoke visual configs exist for KAI and RHEA only. Other roster ids use a palette-derived fallback.
- There is no character select, round/best-of-three flow, CPU AI, audio or network play yet.
- The animation panel is part of the development-only debug overlay and is hidden during normal play.
- Reduced motion scales particle counts and disables camera shake; it does not remove all VFX.

## Roadmap

Phase 3 completes the character-identity and procedural-animation foundation:

1. Character selection, best-of-three rounds and match configuration.
2. A sprite-sheet/atlas animation backend, external character/arena art and audio.
3. CPU opponents and an AI controller layer.
4. Ultimate attacks using the reserved 100-energy cost, throws and aerial specials.
5. Online or additional local match modes.

## Browser Support

Designed for current desktop versions of Chrome, Edge, Firefox and Safari. Phaser falls back to the
Canvas renderer when WebGL 2 is unavailable. A landscape layout is strongly recommended on mobile.
