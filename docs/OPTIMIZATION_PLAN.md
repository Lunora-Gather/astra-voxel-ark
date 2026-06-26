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

Status: scaffolding started. `Settings`, `SaveSystem`, `AudioSystem`, performance budgets, packed block keys, `ChunkManager`, `BlockPicker`, collision helpers, `TerrainGenerator`, terrain worker/client, visible-face helpers, greedy face merge helpers, point-light budgeting, and particle pooling now have standalone modules ready for incremental integration.

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

1. `SaveSystem` and save validation.
2. `Settings` and local storage settings.
3. `AudioSystem`.
4. `BlockPicker` and placement helpers.
5. `PlayerController` and collision helpers.
6. `TerrainGenerator`.
7. `ChunkManager`.
8. Renderer and effects modules.

## Phase 3: Runtime performance pass

Status: helper modules started, main-loop integration still pending. Terrain worker scaffolding is ready but not wired into the active terrain queue yet. Greedy face merging is scaffolded at the algorithm layer but not yet connected to Three.js buffer geometry output.

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
- Add named save slots.
- Add biome/landmark templates.
- Add a performance/debug panel for draw calls, geometries, textures, chunks, and dirty queues.

## Phase 5: Testing and release confidence

Recommended checks:

- Unit tests for terrain determinism, save/load validation, inventory, block picking, and placement collision.
- Integration smoke tests for break/place/save/load.
- Performance smoke test that records average FPS, minimum FPS, chunk count, block count, draw calls, geometries, and textures.
- Separate package workflow for Linux, Windows, and Android artifacts.

## Do not merge until

- `npm ci` succeeds.
- `npm run typecheck` succeeds.
- `npm run verify` succeeds.
- A quick manual web smoke test confirms start, movement, break, place, save, load, menu, and mobile layout.
