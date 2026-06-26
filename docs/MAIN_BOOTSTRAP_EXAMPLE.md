# Main optimization bootstrap example

This example shows the smallest intended `src/main.ts` integration for the staged optimization work. It does not replace the current renderer.

## Import

```ts
import { bootstrapMainOptimizations, updateFrameOptimizations } from './app'
```

## Create the bootstrap

Create this after `scene`, `camera`, `blockData`, `CHUNK_SIZE`, and `lowPowerMode` are available:

```ts
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

With no URL flags enabled, this keeps the active game behavior unchanged.

## Optional diagnostics

Open the game with:

```text
#chunk-mesh-diagnostics=1
```

The bootstrap will run the legacy world diagnostics hook and log chunk mesh summaries without rendering new chunk meshes.

## Mirror block changes

When old code places a block:

```ts
blockData.set(key, id)
mainOptimization.syncBlockSet(key, id)
```

When old code removes a block:

```ts
blockData.delete(key)
mainOptimization.syncBlockDelete(key)
```

This keeps the new `ChunkManager` mirror in sync while the old `Map` remains the source of truth.

## Per-frame update

Inside the existing animation loop:

```ts
const optimizationFrame = updateFrameOptimizations(mainOptimization.optimization, deltaSeconds, {
  fps,
  frameMs,
  chunkCount,
  dirtyChunkCount,
  blockCount,
  renderedChunkMeshCount,
  pointLights,
})
```

The result contains a debug text string plus active particle and light counts.

## Cleanup

On app teardown:

```ts
mainOptimization.dispose()
```

## Rollout order

1. Add the bootstrap with no flags enabled.
2. Open with `#chunk-mesh-diagnostics=1` and compare logs.
3. Mirror block set/delete operations.
4. Add per-frame coordinator in debug mode.
5. Only then test `#particle-pool=1` or `#light-budget=1`.
6. Keep `#chunk-mesh-renderer=1` for a separate controlled test.
