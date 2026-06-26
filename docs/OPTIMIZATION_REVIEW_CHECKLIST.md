# Optimization review checklist

Use this checklist before opening or merging the architecture/performance optimization branch.

## Scope check

- The branch must keep `src/main.ts` behavior unchanged unless the PR explicitly says it is a main integration PR.
- New modules should stay opt-in through feature flags or explicit bootstrap calls.
- No optimization path should become the default renderer until diagnostics and smoke tests pass.
- Save data compatibility must be preserved.

## Required commands

Run these before review:

```bash
npm ci
npm run typecheck
npm run smoke:optimization
npm run verify
```

`npm run verify` should run `smoke:optimization` before the existing HUD smoke path.

## Code review focus

### App runtime

- `bootstrapMainOptimizations(...)` should be the preferred `main.ts` entry point.
- `createOptimizationRuntime(...)` should remain useful for lower-level tests or future non-main entry points.
- `MainBootstrapSmoke` should use legacy string keys, not packed numeric keys.
- `OptimizationSmoke` should cover feature flags, chunk mesh, render layers, and main bootstrap.

### Performance controls

- `PerformanceSampler` should be side-effect free and browser/Node safe.
- `AdaptiveQualityController` must pass both average FPS and average frame time into threshold helpers.
- Quality decisions should be advisory until the live UI/settings path applies them explicitly.
- `ChunkRebuildScheduler` should throttle rebuild work by batch size.

### Rendering path

- Greedy mesh building should default to greedy-safe layers only.
- Water, vegetation, and transparent blocks should stay out of opaque greedy meshing.
- Geometry disposal should happen when a rendered chunk is removed.
- Chunk mesh rendering should remain opt-in.

### Legacy bridge

- Legacy `Map<string, BlockId>` data should remain the source of truth until a dedicated migration PR.
- `LegacyChunkMirrorController` should mirror set/delete operations but not replace reads yet.
- Invalid legacy keys should be skipped safely.

## Manual smoke checklist

Desktop:

- Start game.
- Move, jump, look around.
- Break a block.
- Place a block.
- Save and reload.
- Export and import save.
- Reset world.
- Toggle settings menu.

Mobile layout:

- Landscape prompt behaves correctly.
- Joystick works.
- Touch look works.
- Place button works.
- Hold-break works.
- HUD remains readable.

Optimization flags:

- `#chunk-mesh-diagnostics=1` logs diagnostics without rendering new chunk meshes.
- `#particle-pool=1` does not change block placement/collision behavior.
- `#light-budget=1` does not hide all important lights unexpectedly.
- `#terrain-worker=1` falls back safely if workers are unavailable.
- Keep `#chunk-mesh-renderer=1` for a separate controlled test only.

## Merge guidance

Prefer splitting final integration into small PRs:

1. Safe infrastructure and docs.
2. Optimization runtime bootstrap only, no behavior change.
3. Diagnostics flag for legacy world data.
4. Particle pool opt-in test.
5. Light budget opt-in test.
6. Terrain worker opt-in test.
7. Chunk mesh diagnostics.
8. Single debug chunk mesh renderer.
9. Opaque chunk mesh renderer rollout.
