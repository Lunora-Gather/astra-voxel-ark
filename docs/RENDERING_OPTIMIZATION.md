# Rendering optimization notes

This document describes the new rendering optimization pipeline that is being staged before it is wired into `src/main.ts`.

## Current active renderer

The live game still uses the existing `main.ts` instanced-block renderer. This keeps the current playable build stable while the chunk mesh path is prepared and reviewed.

## New staged pipeline

The new staged path is:

```text
WorldBlock[]
  -> collectVisibleFaces(...)
  -> buildGreedyQuads(...)
  -> buildGreedyGeometryGroups(...)
  -> ChunkMeshRenderer.upsertChunk(...)
```

Implemented modules:

- `src/render/VoxelMesher.ts` collects visible voxel faces.
- `src/render/GreedyMesher.ts` merges same-type, same-direction, same-plane faces into rectangular quads.
- `src/render/GreedyGeometry.ts` converts greedy quads into `THREE.BufferGeometry`.
- `src/render/ChunkMeshBuilder.ts` runs the complete data pipeline and returns useful stats.
- `src/render/ChunkMeshRenderer.ts` owns chunk mesh groups, upserts rebuilt chunks, and disposes geometry when chunks unload.

## Integration strategy

Do not immediately replace the existing renderer. Use a staged rollout:

1. Build chunk mesh data in diagnostics mode only.
2. Compare visible face counts against current exposed-face statistics.
3. Compare greedy quad count against visible face count.
4. Render a single debug chunk with the new geometry path.
5. Render nearby opaque chunks with the new geometry path.
6. Keep transparent blocks, water, vegetation and particles on the old path until opaque chunks are stable.
7. Remove the old opaque block instance path only after smoke tests pass.

## Suggested diagnostics

Track these values per chunk:

- block count
- visible face count
- greedy quad count
- geometry group count
- triangle count
- vertex count
- build time
- rendered chunk mesh count

Expected direction:

- visible face count should be lower than `blockCount * 6`;
- greedy quad count should be lower than visible face count on flat terrain;
- triangle count should be `greedyQuadCount * 2`;
- vertex count should be `greedyQuadCount * 4` before vertex sharing optimization.

## Known limitations

- `GreedyGeometry` currently emits one geometry per block type, not a shared multi-material geometry.
- UVs are scaled by quad size; material tiling may need tuning per texture.
- Transparent and animated materials should remain separate from opaque greedy geometry.
- Face lighting and ambient occlusion are not implemented yet.
- Materials are reused from the existing material registry; material disposal must still be owned by the app-level renderer.
