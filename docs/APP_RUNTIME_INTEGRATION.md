# Optimization runtime integration

The `src/app` layer is a thin integration facade for gradually wiring optimization modules into `src/main.ts` without replacing the active game entry point.

## Entry point

Use `createOptimizationRuntime(...)` from `src/app`:

```ts
import { createOptimizationRuntime } from './app'

const optimization = createOptimizationRuntime({
  terrainOptions: { chunkSize: CHUNK_SIZE },
})
```

The runtime returns:

- `flags`: parsed opt-in feature flags;
- `diagnostics`: optional startup diagnostics result;
- `terrain`: a terrain pipeline that can use worker generation or synchronous fallback;
- `dispose()`: cleanup hook for worker-backed paths.

## Feature flags

All experimental paths are opt-in through URL hash flags:

- `#opt-diagnostics=1`
- `#chunk-mesh-diagnostics=1`
- `#chunk-mesh-renderer=1`
- `#terrain-worker=1`
- `#particle-pool=1`
- `#light-budget=1`

Do not enable these by default until smoke tests pass.

## Dirty chunk mesh diagnostics

Use `rebuildDirtyChunkMeshes(...)` to rebuild diagnostics without replacing the live renderer:

```ts
const updates = rebuildDirtyChunkMeshes(chunkManager, chunkMeshRenderer, {
  render: false,
  limit: 2,
})
```

Switch `render` to `true` only for controlled debug chunks after diagnostics match the existing exposed-face counts.

## Terrain generation

Use the runtime terrain pipeline as the only call site:

```ts
const chunk = await optimization.terrain.generateChunk(cx, cz)
```

Without `#terrain-worker=1`, this uses synchronous terrain generation. With the flag, it uses `TerrainWorkerClient` when `Worker` is available.

## Debug display

`formatRuntimeDebugStats(...)` in `src/ui/DebugStats.ts` can format runtime stats and chunk mesh diagnostics into a HUD-safe string.

## Safety notes

- Keep legacy render paths active until chunk mesh smoke passes.
- Keep transparent/water/vegetation blocks on the old path until separate render layers are implemented.
- Keep feature flags opt-in until CI and manual smoke tests pass.
