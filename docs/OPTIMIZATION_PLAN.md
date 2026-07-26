# AstraVoxel Ark v1.0 Optimization Baseline

This document records the performance and maintainability baseline of the v1.0.0 single-player release. Historical migration scaffolding and experimental default-off pipelines were removed before release; the modules listed here are the paths used by the live game.

## Release goals

1. Keep the single-player loop responsive on low-memory phones and older integrated GPUs.
2. Bound CPU work, GPU resources, resident chunks and local-storage writes.
3. Preserve deterministic worlds and v8 save compatibility.
4. Keep multiplayer behind the reserved session boundary.
5. Run `npm run verify` before every release.

## Live architecture

```text
src/
  app/            ParticleEffectsPipeline
  game/           settings, save activity, page lifecycle
  performance/    device profile, frame limiter, quality profile, pressure guard
  player/         movement, collision, block picking
  render/         chunk meshes, greedy meshing, particles, lights, sky decoration
  session/        local session and reserved multiplayer gateway
  singleplayer/   inventory, crafting, objectives, survival, building
  systems/        audio
  world/          chunks, terrain, biomes, flora, landmarks, saves
  workers/        procedural terrain worker
```

`src/main.ts` remains the composition root. Gameplay rules and reusable performance components live in focused modules and are covered by runtime or static smoke tests.

## Implemented performance work

### Startup and quality

- Four hardware tiers: `ultra-low`, `low`, `standard`, and `high`.
- Persisted quality loads before WebGL allocation.
- Eco and Low avoid MSAA at startup.
- Eco starts at a 0.56 render scale, Near view and 30 FPS.
- Adaptive render scale stays inside the active quality band.
- A hysteresis pressure guard sheds work in `strained` and `critical` states and restores it gradually.

### World streaming

- Deterministic terrain planning runs in `proceduralTerrainWorker.ts`.
- Worker results carry a generation epoch so stale world data is rejected.
- Resident chunks are evicted outside the retention radius.
- Terrain queues, apply budgets and dirty-mesh rebuilds are bounded per frame.
- Runtime block coordinates use packed numeric keys; strings are created only at save boundaries.

### Rendering

- Opaque terrain uses visible-face collection and greedy chunk meshes.
- Transparent, cutout, emissive and decorative blocks remain in appropriate render layers.
- Break and shard particles use two bounded instanced pools.
- Clouds, sparkles, grass and biome flora use instanced draw objects.
- Point lights use a reusable distance/priority budget.
- Shadows, full-screen compositing, animation and lights are reduced or disabled by Eco and pressure protection.

### Interaction and persistence

- Block picking, collision, movement and mining reuse mutable result state on hot paths.
- Building previews update only when target, pattern, facing, inventory, world or player position changes.
- Autosaves are coalesced through an idle queue.
- Background/page lifecycle saves suppress duplicate writes and preserve a last-good backup.
- Performance HUD updates are rate-limited and optional.

## Release verification

`npm run verify` must pass all of the following:

- TypeScript type checking.
- Production Vite build.
- Static architecture, performance, save and gameplay guards.
- Runtime smoke modules loaded by the Electron test build.
- Desktop, short-landscape, touch-landscape and touch-portrait interaction scenarios.
- Settings migration, save/load/recovery and local-write failure paths.

The GitHub Pages and package workflows run the same verification command before deployment or artifact publication.

## Next optimization targets

- Continue extracting cohesive UI and game-loop responsibilities only when the live boundary is clear.
- Profile texture memory and initial Three.js download cost on real Android hardware.
- Add richer structures and crafting content without increasing unbounded scene objects.
- Keep new world decoration inside existing instanced batches where possible.
- Add device-lab frame traces for representative 2 GB, 4 GB and integrated-GPU hardware.

## Non-goals for v1.0.0

- No active multiplayer transport or synchronization.
- No renderer rewrite.
- No save-format reset.
- No experimental code kept solely for a possible future architecture.
