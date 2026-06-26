# Main.ts migration guide

`src/main.ts` is intentionally still the active game entry point. This guide lists the safest order for wiring the new optimization modules into the live game without replacing the entire file at once.

## Rule of thumb

- Keep each migration step small.
- After each step, run `npm run typecheck` and `npm run verify`.
- Avoid changing rendering, save format, and input handling in the same commit.
- Keep old save data readable.

## Step 0: Bootstrap facade

Prefer the one-call bootstrap when adding the first `main.ts` integration:

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

This creates the optimization runtime, mirrors the legacy block map, and runs the diagnostics hook only when enabled by URL flags.

Supported URL hash flags:

- `#opt-diagnostics=1`
- `#chunk-mesh-diagnostics=1`
- `#chunk-mesh-renderer=1`
- `#terrain-worker=1`
- `#particle-pool=1`
- `#light-budget=1`

Keep all flags opt-in until smoke tests prove each path is stable.

## Step 0.5: Legacy chunk diagnostics hook

Before replacing any renderer path, connect diagnostics only. If you do not use the bootstrap facade, wire this manually:

```ts
import { createOptimizationRuntime, runMainDiagnosticsHook } from './app'

const optimization = createOptimizationRuntime({
  terrainOptions: { chunkSize: CHUNK_SIZE },
  scene,
  camera,
  particlePoolSize: 160,
  maxActivePointLights: 24,
  lowPowerMode,
})

runMainDiagnosticsHook({
  flags: optimization.flags,
  blockData,
  chunkSize: CHUNK_SIZE,
  limit: 4,
})
```

This is gated by `#chunk-mesh-diagnostics=1`, so it does nothing in normal play.

## Step 0.6: Legacy chunk mirror controller

If you do not use the bootstrap facade, create the mirror manually:

```ts
import { LegacyChunkMirrorController } from './app'

const chunkMirror = new LegacyChunkMirrorController({ chunkSize: CHUNK_SIZE })
chunkMirror.syncFromLegacyMap(blockData)
```

When old code places or removes a block, mirror the same operation:

```ts
mainOptimization.syncBlockSet(blockKey(x, y, z), id)
mainOptimization.syncBlockDelete(blockKey(x, y, z))
```

Then run dirty chunk diagnostics without rendering:

```ts
const updates = mainOptimization.chunkMirror.diagnoseDirtyChunks({ limit: 2 })
```

## Step 1: Audio adapter

Current target: replace the local `playSound(...)` implementation with `playGameSound(...)` from `src/systems/soundEffects.ts`.

Suggested changes:

```ts
import { playGameSound, unlockGameAudio } from './systems/soundEffects'
```

Then replace calls like:

```ts
playSound('break', 0.12)
```

with:

```ts
playGameSound('break', 0.12)
```

## Step 2: Settings adapter

Use `loadLegacySettings()` and `saveLegacySettings()` from `src/game/legacySettings.ts` first. This preserves the current UI-facing shape while routing persistence through the typed settings module.

## Step 3: Save system

Use `SaveSystem` only around the existing serialize/apply functions first:

- keep `serializeWorld()` as the source of truth;
- replace raw `localStorage.setItem(...)` with `saveSystem.save(...)`;
- replace raw `localStorage.getItem(...)` with `saveSystem.load()`;
- keep import/export behavior unchanged until after verify passes.

## Step 4: Particle pool

Use `mainOptimization.optimization.particles?.createBreakBurst(...)`, `mainOptimization.optimization.particles?.createShardBurst(...)`, and `mainOptimization.optimization.particles?.update(deltaSeconds)` behind the `#particle-pool=1` flag. Do not change particle visuals and collision/placement logic in the same commit.

## Step 5: Light budget

Wire `mainOptimization.optimization.lights?.apply(...)` after glow/crystal lights are registered. Start with a conservative desktop cap of 24 and low-power cap of 0 or 8.

## Step 6: Chunk manager

Start by mirroring writes into `mainOptimization.syncBlockSet(...)` and `mainOptimization.syncBlockDelete(...)` while still reading from the old `Map`. After verify passes, switch read paths to `ChunkManager`. Finally, remove the old map.

## Step 7: Terrain worker

Use `mainOptimization.optimization.terrain.generateChunk(cx, cz)` instead of calling the synchronous generator directly. The runtime will fall back to synchronous generation unless `#terrain-worker=1` is present.

## Step 8: Visible faces and greedy meshing

Migration order:

1. Use `rebuildDirtyChunkMeshes(..., { render: false })` for diagnostics only.
2. Compare face counts with current visible block counts.
3. Use `buildGreedyQuads(...)` to estimate draw-call and vertex reduction.
4. Use `#chunk-mesh-renderer=1` to render one or a few debug chunks.
5. Only then expand the chunk mesh renderer to nearby opaque chunks.

## Step 9: Per-frame coordinator

Use `updateFrameOptimizations(...)` to centralize particle updates, light budgeting, and debug text formatting:

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

## Merge checklist

- `npm run typecheck`
- `npm run verify`
- Desktop smoke: start, move, jump, break, place, save, load, export, import, reset.
- Mobile smoke: joystick, look drag, place, hold-break, portrait prompt, landscape HUD.
