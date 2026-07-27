# Maintenance architecture

This document defines the ownership rules for continued development. The goal is to keep
`src/main.ts` as a composition root instead of allowing it to become the implementation home for
every feature.

## Dependency direction

```text
main.ts
  ├─ platform/       browser capability and lifecycle adapters
  ├─ ui/             typed DOM views; no gameplay decisions
  ├─ render/         Three.js rendering and GPU resource ownership
  ├─ player/         movement, collision and voxel picking
  ├─ world/          deterministic terrain, chunks, coordinates and saves
  ├─ singleplayer/   inventory, progression, survival and building rules
  ├─ game/           persisted settings and application lifecycle state
  ├─ systems/        shared runtime services such as audio
  └─ session/        hosting boundary for local or future remote sessions
```

Lower-level modules must not import `main.ts`. Deterministic gameplay and world modules must not
import Three.js or DOM APIs. UI modules may format and cache presentation state, but receive game
state through typed snapshots instead of reading gameplay globals.

## Current composition boundaries

- `platform/RuntimeBootstrap.ts` owns smoke overrides, pointer/touch classification, device-tier
  detection and startup settings/graphics resolution. This guarantees that persisted graphics are
  resolved before WebGL allocation.
- `ui/PerformanceHud.ts` owns performance diagnostic DOM bindings and formatting.
- `ui/SurvivalHud.ts` owns survival diagnostic DOM bindings, throttling and visual styling.
- `world/TerrainNoise.ts` owns bounded terrain-noise caching. World transitions clear that cache.
- `main.ts` remains responsible for connecting input, world mutations, renderer resources and the
  frame loop. New deterministic rules should be extracted before they are wired here.

## Rules for new work

1. Put a rule in `singleplayer/`, `player/` or `world/` before adding its browser or renderer adapter.
2. Pass typed snapshots or callbacks across boundaries; do not let UI modules reach into world maps.
3. Keep per-frame code allocation-free where practical. Reuse vectors, arrays and result objects.
4. Bound every growing collection, queue, cache, history and GPU instance pool.
5. Preserve the v8 save boundary. Add migrations and compatibility coverage before changing it.
6. Add behavioral smoke coverage for extracted logic. Static checks should validate module
   integration, not require implementations to remain inside `main.ts`.
7. Run `npm run verify` before merging release work.

## Recommended next extractions

1. Move the application shell markup and its typed element registry into `ui/`.
2. Introduce a world snapshot adapter that owns serialization and restoration wiring.
3. Move terrain residency queues and worker orchestration behind a `WorldStreamingController`.
4. Move desktop/touch event binding behind an input adapter while keeping `PlayerMotionController`
   platform-independent.
5. Split the frame loop into explicit simulation, world-streaming, presentation and render phases
   only after those adapters have stable contracts.

Large rewrites of the live loop are intentionally avoided: small boundary extractions with full
verification are safer for gameplay, saved worlds and constrained devices.
