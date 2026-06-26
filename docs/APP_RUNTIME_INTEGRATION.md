# Optimization runtime integration

The `src/app` layer is a thin integration facade for gradually wiring optimization modules into `src/main.ts` without replacing the active game entry point.

## Preferred entry point

For `src/main.ts`, prefer `bootstrapMainOptimizations(...)`:

```ts
import { bootstrapMainOptimizations } from './app'

const mainOptimization = bootstrapMainOptimizations({
  blockData,
  chunkSize: CHUNK_SIZE,
  scene,
  camera,
  particlePoolSize: lowPowerMode ? 90 : 220,
  maxActivePointLights: lowPowerMode ? 8 : 24,
  lowPowerMode,
})
```

This creates the runtime, mirrors the legacy world map, and runs chunk mesh diagnostics only when enabled by URL flags.

## Lower-level runtime entry point

Use `createOptimizationRuntime(...)` directly only when you do not need the legacy world mirror:

```ts
import { createOptimizationRuntime } from './app'

const optimization = createOptimizationRuntime({
  terrainOptions: { chunkSize: CHUNK_SIZE },
  scene,
  camera,
  particlePoolSize: 160,
  maxActivePointLights: 24,
  lowPowerMode,
})
```

The runtime returns:

- `flags`: parsed opt-in feature flags;
- `diagnostics`: optional startup diagnostics result;
- `terrain`: a terrain pipeline that can use worker generation or synchronous fallback;
- `particles`: optional pooled particle effects pipeline when a scene is provided;
- `lights`: optional point-light budget pipeline when a camera is provided;
- `dispose()`: cleanup hook for worker-backed and pooled paths.

## Feature flags

All experimental paths are opt-in through URL hash flags:

- `#opt-diagnostics=1`
- `#chunk-mesh-diagnostics=1`
- `#chunk-mesh-renderer=1`
- `#terrain-worker=1`
- `#particle-pool=1`
- `#light-budget=1`

Do not enable these by default until smoke tests pass.

## Legacy world bridge

`bootstrapMainOptimizations(...)` already mirrors the current `blockData` map. If you wire lower-level APIs manually, use `diagnoseLegacyWorld(...)` first when connecting the current `main.ts` string-key block map. This lets the new chunk mesh pipeline inspect existing world data without replacing the active renderer:

```ts
const diagnostics = diagnoseLegacyWorld(blockData, {
  chunkSize: CHUNK_SIZE,
  limit: 4,
})
console.info(formatLegacyWorldDiagnostics(diagnostics))
```

For incremental mirroring through the bootstrap facade, use:

```ts
mainOptimization.syncBlockSet(blockKey(x, y, z), id)
mainOptimization.syncBlockDelete(blockKey(x, y, z))
```

## Dirty chunk mesh diagnostics

Use `rebuildDirtyChunkMeshes(...)` or `mainOptimization.chunkMirror.diagnoseDirtyChunks(...)` to rebuild diagnostics without replacing the live renderer:

```ts
const updates = mainOptimization.chunkMirror.diagnoseDirtyChunks({ limit: 2 })
```

Switch `render` to `true` only for controlled debug chunks after diagnostics match the existing exposed-face counts.

## Terrain generation

Use the runtime terrain pipeline as the only call site:

```ts
const chunk = await mainOptimization.optimization.terrain.generateChunk(cx, cz)
```

Without `#terrain-worker=1`, this uses synchronous terrain generation. With the flag, it uses `TerrainWorkerClient` when `Worker` is available.

## Particle effects

Use `mainOptimization.optimization.particles` as an opt-in replacement for mesh-per-particle burst effects:

```ts
mainOptimization.optimization.particles?.createBreakBurst({ position, blockId })
mainOptimization.optimization.particles?.createShardBurst(position)
mainOptimization.optimization.particles?.update(deltaSeconds)
```

Without `#particle-pool=1`, the pipeline is inert and does not allocate pooled meshes.

## Light budget

Use `mainOptimization.optimization.lights?.apply(lights)` after point lights are registered. Without `#light-budget=1`, all provided lights remain visible and the pipeline behaves as a no-op fallback.

## Smoke checks

`runOptimizationSmoke()` aggregates the current optimization smoke helpers:

- feature-flag parsing;
- chunk mesh smoke;
- render-layer smoke.

`assertMainBootstrapSmoke()` verifies the bootstrap facade and legacy mirror set/delete path.

These can be wired into a future test runner or a debug-only startup path.

## Debug display

`formatRuntimeDebugStats(...)` in `src/ui/DebugStats.ts` can format runtime stats and chunk mesh diagnostics into a HUD-safe string.

## Safety notes

- Keep legacy render paths active until chunk mesh smoke passes.
- Keep transparent/water/vegetation blocks on the old path until separate render layers are implemented.
- Keep feature flags opt-in until CI and manual smoke tests pass.
