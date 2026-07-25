# Performance architecture

The single-player runtime treats low-end hardware as a first-class target.

## Device policy

`src/performance/DeviceProfile.ts` classifies the current device into `ultra-low`, `low`,
`standard`, or `high`. The policy controls pixel ratio, dynamic render scale, frame target,
terrain concurrency, mesh rebuild time, particles, point lights, and decorative animation.
The graphics setting remains an override inside the safe bounds of the detected device.

## Terrain pipeline

`src/world/ProceduralTerrain.ts` is the deterministic source of terrain, biome materials,
ores, vegetation, trees, and landmarks. Initial spawn terrain can be built synchronously;
streamed terrain is planned by `src/workers/proceduralTerrainWorker.ts`. The main thread only
applies completed plans in bounded batches.

Worker requests are guarded by a generation epoch. Loading or resetting a world invalidates
old responses so stale terrain cannot leak into the new session.

## Residency

The runtime distinguishes:

- discovered chunks, which are persisted in the v8 delta save;
- resident chunks, which currently occupy CPU and GPU memory;
- queued or worker-owned chunks, which are not yet visible.

`src/world/ChunkResidency.ts` selects the farthest resident chunks outside the retention
radius. Eviction removes deterministic terrain but keeps the discovery record, removed-block
deltas, collected shards, and player-placed blocks. Returning to an area regenerates terrain
and reapplies those deltas.

## Main-thread budgets

- Opaque terrain uses greedy chunk meshes.
- Mesh rebuilds have both a batch limit and a millisecond budget.
- Terrain plans are applied at most one chunk per accepted frame.
- Particle meshes are pooled.
- Point lights use allocation and active-light budgets.
- Hidden pages do no rendering work.
- Paused screens run at 10 FPS.
- Active gameplay uses a timestamp gate at the persisted 30 or 60 FPS target; constrained devices
  default to 30 FPS instead of running the heavy simulation at the display's full refresh rate.
- Ultra-low devices tune adaptive quality against a 30 FPS target without imposing a
  refresh-rate-dependent frame cap.
- Autosaves serialize during an idle callback when available.
- Constrained tiers disable live HUD backdrop blur and render one nine-slot palette at a time;
  all 18 materials remain available in the paused backpack.

## Compatibility boundary

Multiplayer remains a disabled session gateway. Performance and world-lifecycle code is
owned by the local single-player runtime, while the session boundary remains available for a
future authoritative multiplayer implementation.
