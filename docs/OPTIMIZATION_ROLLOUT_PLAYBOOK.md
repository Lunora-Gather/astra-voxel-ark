# Optimization rollout playbook

This playbook describes how to safely turn the optimization scaffolding into runtime behavior.

## Golden rule

Do not enable more than one risky path at a time. Prefer one feature flag, one manual smoke test, and one rollback point per PR.

## Phase 0: Infrastructure only

Goal: merge safe modules, docs, scripts and workflows.

Expected behavior change: none.

Checks:

```bash
npm ci
npm run typecheck
npm run smoke:optimization
npm run verify
```

Rollback:

- Revert the infrastructure PR if typecheck/build fails.
- No runtime rollback should be needed because `main.ts` is unchanged.

## Phase 1: Bootstrap only

Goal: add `bootstrapMainOptimizations(...)` to `src/main.ts` without using any optimization output.

Enabled flags: none.

Acceptance:

- Game starts normally.
- No new renderer is active.
- No visible gameplay difference.
- No save format change.

Rollback:

- Remove the bootstrap call.

## Phase 2: Diagnostics only

Goal: enable legacy world diagnostics under `#chunk-mesh-diagnostics=1`.

Acceptance:

- Normal URL has no extra diagnostics.
- Diagnostics URL logs chunk mesh summaries.
- The renderer remains unchanged.
- Frame time remains acceptable because diagnostics are limited.

Rollback:

- Remove the diagnostics call or stop using the flag.

## Phase 3: Legacy mirror writes

Goal: mirror block set/delete operations into `LegacyChunkMirrorController`.

Acceptance:

- Old `blockData` remains source of truth.
- Break/place behavior is unchanged.
- Dirty chunk diagnostics update after break/place.

Rollback:

- Remove calls to `syncBlockSet(...)` and `syncBlockDelete(...)`.

## Phase 4: Low-risk runtime adapters

Test one flag per PR:

- `#particle-pool=1`
- `#light-budget=1`
- `#terrain-worker=1`

Acceptance:

- Particle pool: visual differences are acceptable and no extra meshes leak.
- Light budget: important lights remain visible enough for gameplay.
- Terrain worker: generated chunks match synchronous fallback expectations.

Rollback:

- Stop using the flag.
- Keep the old path as default.

## Phase 5: Chunk mesh diagnostics with throttling

Goal: enqueue dirty chunks and process small batches through diagnostics.

Acceptance:

- `ChunkRebuildScheduler` limits work per frame.
- Diagnostics do not stall the game.
- Boundary dirty chunks are detected when edge blocks change.

Rollback:

- Clear `chunkRebuilds` and stop calling diagnostics.

## Phase 6: Single debug chunk renderer

Goal: render one controlled opaque chunk through `ChunkMeshRenderer`.

Acceptance:

- Geometry appears in the expected location.
- No water/leaves/transparent blocks are included in the opaque mesh.
- Removing the chunk disposes geometry.

Rollback:

- Disable `#chunk-mesh-renderer=1`.
- Remove the rendered debug chunk.

## Phase 7: Nearby opaque chunk rollout

Goal: gradually replace nearby opaque block instances with chunk meshes.

Acceptance:

- No missing faces at chunk boundaries.
- Draw calls and geometry counts improve or remain acceptable.
- Transparent/water/vegetation paths remain correct.
- Save/load remains unaffected.

Rollback:

- Re-enable legacy opaque instance rendering.
- Clear `ChunkMeshRenderer` state.

## Phase 8: Default renderer switch

Goal: make the new opaque chunk renderer the default only after repeated smoke passes.

Required evidence:

- Desktop manual smoke passes.
- Mobile manual smoke passes.
- `npm run verify` passes.
- Diagnostics show expected face/quad reductions.
- Rollback is a one-commit revert or a single feature flag flip.
