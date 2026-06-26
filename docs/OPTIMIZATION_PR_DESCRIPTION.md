# Optimization PR description draft

Use this body when opening the first architecture/performance optimization PR.

## Suggested title

```text
Stage architecture and performance optimization scaffolding
```

## Summary

This PR prepares AstraVoxel Ark for safer performance work without replacing the active `src/main.ts` game loop or renderer by default.

It adds:

- explicit typecheck/build/verify scripts;
- Vite and Electron safety improvements;
- packaging workflow updates;
- standalone modules for settings, saves, audio, block picking, collision, terrain, workers, chunk management, particle pooling, light budgeting, visible-face meshing, greedy meshing, chunk geometry, chunk mesh rendering, diagnostics and smoke helpers;
- app-level optimization runtime adapters with default-off feature flags;
- legacy world bridge helpers that can mirror existing `Map<string, BlockId>` world data without replacing it;
- performance sampling, adaptive quality decisions, and chunk rebuild throttling;
- review, risk, rollout and rendering documentation.

## Behavior change

Expected default behavior change: none.

The active game should continue to use the existing `src/main.ts` renderer and legacy world map unless a future PR explicitly wires in `bootstrapMainOptimizations(...)` or a URL feature flag.

## Validation

Run before review:

```bash
npm ci
npm run typecheck
npm run smoke:optimization
npm run verify
```

Manual smoke:

- Start game.
- Move, jump, break and place blocks.
- Save, load, export and import.
- Check mobile/touch HUD behavior.
- Confirm no experimental optimization path is active without a URL flag.

## Feature flags prepared by this PR

- `#opt-diagnostics=1`
- `#chunk-mesh-diagnostics=1`
- `#chunk-mesh-renderer=1`
- `#terrain-worker=1`
- `#particle-pool=1`
- `#light-budget=1`

## Review notes

Reviewers should focus on:

- whether new modules are safe while unused;
- whether default-off flags protect current gameplay;
- whether legacy save/world compatibility is preserved;
- whether static smoke checks cover key integration hazards;
- whether risky renderer changes remain staged for follow-up PRs.

## Follow-up PRs

Recommended follow-up order:

1. Main bootstrap call only, no behavior change.
2. Legacy world diagnostics under `#chunk-mesh-diagnostics=1`.
3. Mirror block set/delete operations into `LegacyChunkMirrorController`.
4. Particle pool opt-in test.
5. Light budget opt-in test.
6. Terrain worker opt-in test.
7. Chunk mesh diagnostics on throttled dirty chunks.
8. Single debug chunk renderer.
9. Opaque chunk mesh rollout.
