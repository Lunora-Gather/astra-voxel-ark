# Optimization risk register

This document lists the main risks introduced by the staged architecture/performance optimization work and how to contain them.

## Risk levels

- Low: easy to detect and easy to roll back.
- Medium: may affect performance or visuals but should not corrupt saves.
- High: may affect save compatibility, world state, or core gameplay.

## Risks

| Area | Risk | Level | Mitigation | Rollback |
| --- | --- | --- | --- | --- |
| Main bootstrap | Bootstrap changes accidentally alter current game behavior | Medium | Keep flags default-off; bootstrap should mirror and diagnose only | Remove bootstrap call from `main.ts` |
| Legacy bridge | New mirror diverges from old `blockData` | Medium | Mirror set/delete only after old map changes; run dirty diagnostics | Stop calling `syncBlockSet` / `syncBlockDelete` |
| Save system | New save validation rejects valid old saves | High | Use `SaveSystem` around existing serialize/apply functions first | Revert to raw localStorage calls |
| Terrain worker | Worker path returns chunks in a different order/timing | Medium | Keep `#terrain-worker=1` opt-in; fallback to sync generation | Remove terrain-worker flag usage |
| Chunk mesh diagnostics | Diagnostics stall frames on large worlds | Medium | Limit chunks per call and use `ChunkRebuildScheduler` | Disable `#chunk-mesh-diagnostics=1` |
| Chunk mesh renderer | Opaque mesh path misses faces at chunk boundaries | High | Use boundary dirty marking and debug single chunk first | Disable `#chunk-mesh-renderer=1` |
| Render layers | Water/leaves/transparent blocks render incorrectly if greedy meshed | High | `filterGreedyMeshBlocks(...)` excludes non-safe layers by default | Keep special layers on legacy path |
| Particle pool | Pooled particles differ from old burst visuals | Low | Keep `#particle-pool=1` opt-in; preserve old path | Disable `#particle-pool=1` |
| Light budget | Important glow/crystal lights become invisible | Medium | Use priorities and conservative caps; start with diagnostics | Disable `#light-budget=1` |
| Adaptive quality | Quality changes too often or conflicts with settings UI | Medium | Use cooldown; quality decisions are advisory first | Ignore `qualityDecision` |
| Static smoke | Static checks are too broad or too narrow | Low | Keep checks token-based and update with modules | Remove `smoke:optimization` from verify |

## Default safety posture

- Feature flags are off by default.
- Legacy renderer remains active by default.
- Legacy `blockData` remains the source of truth until a dedicated migration PR.
- Quality decisions are advisory until explicitly wired to settings/UI.
- Chunk renderer rollout starts with diagnostics, then one debug chunk, then nearby opaque chunks.

## Rollback principles

Prefer disabling integration points before reverting modules:

1. Remove URL flag usage.
2. Remove `bootstrapMainOptimizations(...)` from `main.ts`.
3. Remove calls to `syncBlockSet(...)` and `syncBlockDelete(...)`.
4. Remove runtime use of particles/lights/terrain worker.
5. Keep standalone modules and docs if they do not affect runtime.
