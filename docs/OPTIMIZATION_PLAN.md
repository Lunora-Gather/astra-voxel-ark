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
5. `PlayerController` and collision helpers — collision resolver integrated; input/velocity controller remains.
6. `TerrainGenerator`.
7. `ChunkManager`.
8. Renderer and effects modules.

## Phase 3: Runtime performance pass

Status: core paths integrated. Streamed terrain uses the worker pipeline; opaque terrain uses budgeted greedy chunk meshes; particle effects use pools; point lights are distance-budgeted; and resident terrain chunks are evicted outside the retention radius. Diagnostics and runtime adapters remain available for deeper profiling and further main-loop extraction.

High-impact tasks:

- Cap active glow and crystal point lights by camera distance.
- Replace mesh-per-particle effects with pooled particles.
- Convert runtime block keys from string keys to packed numeric keys while keeping save files stable.
- Move terrain chunk generation into a Web Worker.
- Add chunk-level mesh building for visible faces.
- Add greedy meshing for opaque voxel faces.
- Split opaque, cutout, transparent, emissive, decoration, and effects render layers.

## Phase 4: Gameplay clarity

- Convert Beacon Trail into a visible quest/objective system.
- Add simple crafting recipes.
- Named save slots are integrated as isolated, resilient metadata with responsive editing and name-aware exports.
- Biome-aware landmark templates are integrated with deterministic legacy coordinates, named navigation and resident-chunk cleanup.
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
