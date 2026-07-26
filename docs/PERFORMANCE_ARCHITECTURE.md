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
and reapplies those deltas. Runtime landmark shard and name indexes are evicted with their chunk
and rebuilt from the shared deterministic template when it becomes resident again, preventing
stale compass targets and keeping navigation memory proportional to resident terrain.

## Main-thread budgets

- Opaque terrain uses greedy chunk meshes.
- Mesh rebuilds have both a batch limit and a millisecond budget.
- Terrain plans are applied at most one chunk per accepted frame.
- Player motion reuses one step object and caps simulation deltas at 50 ms; keyboard and touch
  share the same normalized acceleration path without per-frame vector allocation.
- Particle meshes are pooled.
- Point lights use allocation and active-light budgets.
- Hidden pages do no rendering work.
- Paused screens run at 10 FPS.
- Active gameplay uses a timestamp gate at the persisted 30 or 60 FPS target; constrained devices
  default to 30 FPS instead of running the heavy simulation at the display's full refresh rate.
- Ultra-low devices tune adaptive quality against a 30 FPS target without imposing a
  refresh-rate-dependent frame cap.
- Autosaves serialize during an idle callback when available.
- Idle autosaves are coalesced to one pending callback and cancelled before world transitions,
  preventing redundant serialization and late writes against a different active slot.
- Constrained tiers disable live HUD backdrop blur and render one nine-slot palette at a time;
  all 18 materials remain available in the paused backpack.

## Audio lifecycle

`src/systems/AudioSystem.ts` is the only owner of Web Audio nodes. It applies persistent master
volume and mute state without creating an `AudioContext` during boot or settings hydration. The
context is unlocked lazily by the player's start gesture, unsupported browsers degrade without
interrupting gameplay, and the page lifecycle disposes the shared graph. Gameplay code requests
named sound effects through `src/systems/soundEffects.ts` instead of allocating oscillators itself.

## Settings persistence

`src/game/settings.ts` owns the complete live settings schema, device-aware bounds, legacy-field
migration and storage error boundary. Existing `astra-voxel-ark-settings-v1` data remains compatible.
Malformed data falls back to the current device defaults; out-of-range view distance is capped by the
detected device tier; and failed writes leave the previous stored settings intact while the selected
setting still applies for the current session.

## Interaction hot path

`src/player/BlockPicker.ts` owns the exact integer-centered voxel DDA used by aiming, mining,
placement previews and middle-click material selection. The live picker reuses its direction, hit and
normal objects, so the per-frame crosshair query does not allocate temporary vectors. Consumers use
the returned coordinates and block id directly instead of reparsing a block key and performing a
second lookup. The heavier picker smoke module is loaded only by Electron smoke URLs.

## Player collision hot path

`src/player/Collision.ts` owns the integer-centered block and eye-point player collision contract.
Horizontal wall sliding, one-block stepping, vertical landing, load-time escape and placement safety all
share one resolver with reusable probes and result objects. Ground lookup starts at the highest block
that can actually fit below the current eye height instead of scanning from the fixed world ceiling,
and it verifies the player's true footprint so merely adjacent raised blocks cannot cause hovering.

## Live diagnostics

The optional performance HUD is grouped into frame, world-load and renderer-resource rows. It reports
FPS, average frame time, adaptive render scale, runtime tier, resident/discovered chunks, blocks,
terrain/mesh queues, draw calls, triangles, geometries and textures. Large counters use compact
`k`/`m` notation, and hidden diagnostics do not perform DOM writes. Enabling the panel while paused
shows the latest collected frame immediately. Minimal layouts constrain it to the right safe column,
and the menu hides its redundant toggle button so the two controls cannot overlap.

## Compatibility boundary

Multiplayer remains a disabled session gateway. Performance and world-lifecycle code is
owned by the local single-player runtime, while the session boundary remains available for a
future authoritative multiplayer implementation.
