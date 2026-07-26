# AstraVoxel Ark Optimization Plan

This document tracks the staged optimization roadmap for AstraVoxel Ark. The goal is to improve performance, maintainability, and release confidence without breaking the current playable build.

## Current technical baseline

- Shared Vite + TypeScript + Three.js codebase.
- Web deployment through GitHub Pages.
- Android shell through Capacitor.
- Linux and Windows desktop shells through Electron Builder.
- The game already has chunk metadata, dirty chunk tracking, instanced block rendering, adaptive render scale, HUD smoke tests, local saves, and touch controls.

## Optimization principles

1. Keep `main` playable.
2. Prefer small, reviewable commits.
3. Separate safe engineering improvements from high-risk renderer rewrites.
4. Always run `npm run verify` before merging.
5. Measure before and after renderer changes.

## Phase 1: Safe engineering pass

Status: mostly complete on `optimize/architecture-performance-pass`.

- Add an explicit `typecheck` script.
- Keep `build` as typecheck plus Vite build.
- Tighten Vite production output settings.
- Keep Electron security defaults strict.
- Split CI into verification and deployment workflows.
- Add a dedicated packaging workflow for web, desktop, and Android outputs.
- Document the optimization roadmap.

## Phase 2: Source modularization

Status: active migration. The typed `SettingsStore`, v8 `SaveSystem`, and shared `AudioSystem` now own their live persistence or runtime boundaries. Performance budgets, packed block keys, `ChunkManager`, `BlockPicker`, collision helpers, `TerrainGenerator`, terrain worker/client, block render layers, visible-face helpers, greedy face merge helpers, buffer geometry builders, chunk mesh renderer management, point-light budgeting, particle pooling, and app-level runtime adapters have standalone modules for continued extraction.

Target structure:

```text
src/
  app/
    GameApp.ts
    bootstrap.ts
  game/
    GameLoop.ts
    GameState.ts
    Settings.ts
  world/
    BlockRegistry.ts
    Chunk.ts
    ChunkManager.ts
    SaveSystem.ts
    TerrainGenerator.ts
  render/
    Effects.ts
    InstancedBlockRenderer.ts
    Materials.ts
    Renderer.ts
    SceneLighting.ts
    VoxelMesher.ts
  player/
    BlockPicker.ts
    Collision.ts
    PlayerController.ts
  ui/
    Hotbar.ts
    Hud.ts
    PauseMenu.ts
    PerformanceHud.ts
    TouchControls.ts
  systems/
    AudioSystem.ts
    ExplorationSystem.ts
    SurvivalSystem.ts
```

Recommended extraction order:

1. `SaveSystem` and save validation — integrated.
2. `Settings` and local storage settings — integrated.
3. `AudioSystem` — integrated.
4. `BlockPicker` and placement helpers — picker integrated; placement policy remains in the game adapter.
5. `PlayerController` and collision helpers — allocation-free motion and collision controllers integrated; DOM input binding remains in the game adapter.
6. `TerrainGenerator`.
7. `ChunkManager`.
8. Renderer and effects modules.

## Phase 3: Runtime performance pass

Status: core paths integrated. Streamed terrain uses the worker pipeline; opaque terrain uses budgeted greedy chunk meshes; particle effects use pools; point lights are distance-budgeted; and resident terrain chunks are evicted outside the retention radius. Diagnostics and runtime adapters remain available for deeper profiling and further main-loop extraction.

Local persistence now also exposes a compact shared activity state and coalesces delayed autosaves,
so constrained devices avoid redundant serialization while players retain visible failure feedback.

The live runtime now includes a hysteresis-based pressure guard. It temporarily scales mesh,
terrain, light and cosmetic work without changing persisted player settings, rejects stale
out-of-radius terrain results, and restores budgets in stages after sustained recovery.

High-impact tasks:

- Cap active glow and crystal point lights by camera distance.
- Replace mesh-per-particle effects with pooled particles.
- Runtime block keys are packed numeric identities across world, renderer, mining and exploration
  hot paths; v8 saves retain their compatible string representation.
- Move terrain chunk generation into a Web Worker.
- Add chunk-level mesh building for visible faces.
- Add greedy meshing for opaque voxel faces.
- Split opaque, cutout, transparent, emissive, decoration, and effects render layers.

## Phase 4: Gameplay clarity

- Convert Beacon Trail into a visible quest/objective system.
- Add simple crafting recipes.
- Named save slots are integrated as isolated, resilient metadata with responsive editing and name-aware exports.
- Biome-aware landmark templates are integrated with deterministic legacy coordinates, named navigation and resident-chunk cleanup.
- Block coordinates are integrated with budgeted HUD updates, copy feedback and compact-menu fallback.
- Contextual onboarding is integrated with save-aware progression, touch-specific prompts and a
  compact help-panel fallback for short or constrained displays.
- Block hardness and tool-speed progression are integrated through one allocation-free mining
  session shared by desktop and touch input paths.
- Crafting clarity is integrated with exact material availability, reward previews, idempotent
  bulk claiming, safe max-batch crafting and responsive ingredient chips.
- Expedition content is segmented into Journey, Backpack and Workshop views so short displays render
  one focused task at a time without duplicating progression state.
- Four bounded building patterns are integrated with reusable planning storage, atomic validation,
  batched world mutation and a one-draw instanced preview.
- Stable building targets reuse validated preview transforms and material state until target,
  orientation, inventory, world or player-collision inputs change; placement still revalidates live.
- Build undo is integrated as a 32-action transient command history with nine-change caps, batched
  reversal and no save-schema or cross-world state.
- Fall impact is integrated through the existing motion/collision result and deterministic survival
  rules, with no additional scene objects or per-frame DOM allocation.
- Water movement is integrated into the shared allocation-free motion controller using two packed
  block lookups, bounded vertical speed and change-only Jump/Swim feedback.
- Ark shelter rest closes the cold-night loop through a deterministic time/distance rule and existing
  save fields, with one Journey card and no scene or per-frame allocation.
- Clouds and sparkles are integrated through two instanced draw objects with packed reusable state,
  preserving tier-specific counts and adaptive animation budgets while removing up to 192 individual
  decoration meshes from the scene graph.
- Block-break and shard particles share two instanced pools instead of one scene mesh per particle;
  per-tier capacities remain bounded, block color stays per instance and burst setup is allocation-free.
- Glow and crystal lights use persistent registered entries and one reusable candidate buffer, keeping
  priority/range behavior while eliminating periodic wrappers, sorted copies and active/inactive slices.
- Dirty mesh work fills bounded caller-owned chunk and block buffers, eliminating the live frame's
  dirty-Set copy/slice and its per-chunk all-block/filter array pair.
- Add a performance/debug panel for draw calls, geometries, textures, chunks, and dirty queues — integrated.

## Phase 5: Testing and release confidence

Recommended checks:

- Unit tests for terrain determinism, save/load validation and inventory. Block picking now has runtime smoke coverage for axes, diagonals, normals, reach and result reuse; collision covers walls, footprint support, stepping and landing.
- Integration smoke tests for break/place/save/load.
- Performance smoke test that records average FPS, minimum FPS, chunk count, block count, draw calls, geometries, and textures.
- Separate package workflow for Linux, Windows, and Android artifacts.

## Do not merge until

- `npm ci` succeeds.
- `npm run typecheck` succeeds.
- `npm run verify` succeeds.
- A quick manual web smoke test confirms start, movement, break, place, save, load, menu, and mobile layout.
