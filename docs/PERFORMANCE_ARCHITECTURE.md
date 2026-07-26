# Performance architecture

The single-player runtime treats low-end hardware as a first-class target.

## Device policy

`src/performance/DeviceProfile.ts` classifies the current device into `ultra-low`, `low`,
`standard`, or `high`. The policy controls pixel ratio, dynamic render scale, frame target,
terrain concurrency, mesh rebuild time, particles, point lights, and decorative animation.
The graphics setting remains an override inside the safe bounds of the detected device.

`src/performance/RuntimePerformanceGuard.ts` adds a second, transient layer for sustained runtime
pressure. Sample hysteresis moves through `normal`, `strained`, and `critical` rather than reacting
to individual slow frames. It scales visible-face summaries, greedy-mesh work, terrain cadence,
cosmetics and point lights. Critical pressure temporarily subtracts one from the effective terrain
radius, never below the spawn-safe radius, without rewriting the player's stored view distance.
Recovery happens one level at a time.

## Terrain pipeline

`src/world/ProceduralTerrain.ts` is the deterministic source of terrain, biome materials,
ores, vegetation, trees, and landmarks. Initial spawn terrain can be built synchronously;
streamed terrain is planned by `src/workers/proceduralTerrainWorker.ts`. The main thread only
applies completed plans in bounded batches.

Worker requests are guarded by a generation epoch. Loading or resetting a world invalidates
old responses so stale terrain cannot leak into the new session.

Queued and completed terrain plans are also checked against the current effective radius before
main-thread application. This prevents distant work requested before a pressure transition or fast
player movement from consuming frame time; returning to that area queues deterministic terrain again.

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
- Hold-to-mine progress reuses one session result object and reads absolute time, so slow frames do
  not lengthen mining or allocate progress objects.
- Break and shard particles use two shared instanced pools. Active instances stay compact, inactive
  effects submit no draw, and burst setup reuses position and velocity storage.
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
- Biome, tool-tier and coordinate text share one 750 ms DOM update budget; minimal HUDs omit the
  persistent location card while retaining coordinates in the paused World details.
- Contextual onboarding updates only on gameplay events. Constrained touch layouts reuse the
  existing help panel instead of adding a second visible overlay or per-frame DOM work.
- Recipe availability, reward previews and bulk-claim state are rendered only when progression or
  inventory changes; none participate in the frame loop.

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

Multi-block building keeps its hot path bounded to nine voxels. `BuildPatternPlanner` mutates a
preallocated position buffer, placement wraps all edits in one world batch, and the preview uses one
`InstancedMesh` regardless of pattern size. Single-block mode retains the original lightweight mesh;
no blueprint creates a mesh or draw call per planned block.

`BuildPreviewCache` also separates aiming frequency from preview rebuild frequency. Stable targets
reuse their validated transforms and material state instead of repeating collision checks and GPU
instance-buffer uploads every frame. Target coordinates, face normal, selected material, pattern,
wall axis, inventory count, world mutation version and exact player position form the invalidation
contract. The actual placement action always plans and validates again independently.

## Packed runtime block identity

The live block map, visual references, chunk buckets, grass anchors, glow lights, mining targets,
landmark shards and player deltas use the 51-bit `PackedBlockKey` from `src/world/blockKey.ts`.
Aim, collision, mesh exposure checks and placement therefore perform numeric `Map`/`Set` lookups
without allocating `"x,y,z"` strings. A mutable decode target supports iteration without temporary
coordinate objects. Serialization stringifies keys only when producing the existing v8 JSON schema;
loading and deterministic landmark plans parse those legacy strings once at their boundary.

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

## Sky decoration batching

`src/render/SkyDecorationSystem.ts` owns cloud and sparkle rendering. Every quality tier uses one
instanced cloud mesh and one instanced sparkle mesh, replacing up to 192 independent decoration
meshes with two draw objects. Packed typed-array state and reusable transform objects keep animation
allocation-free, while the existing adaptive budgets still cap how many cloud and sparkle instances
are rewritten each frame. Ultra-low mode retains its reduced counts and can omit sparkles entirely.

## Compatibility boundary

Multiplayer remains a disabled session gateway. Performance and world-lifecycle code is
owned by the local single-player runtime, while the session boundary remains available for a
future authoritative multiplayer implementation.
