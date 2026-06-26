import type { ChunkMeshStats } from './ChunkMeshBuilder'

export type ChunkMeshDiagnostics = ChunkMeshStats & {
  faceReductionRatio: number
  greedyReductionRatio: number
  meshCoverageRatio: number
  trianglesPerMeshedBlock: number
  verticesPerMeshedBlock: number
}

export function createChunkMeshDiagnostics(stats: ChunkMeshStats): ChunkMeshDiagnostics {
  const naiveFaceCount = Math.max(1, stats.meshedBlockCount * 6)
  const visibleFaceCount = Math.max(1, stats.visibleFaceCount)
  const meshedBlockCount = Math.max(1, stats.meshedBlockCount)
  const blockCount = Math.max(1, stats.blockCount)

  return {
    ...stats,
    faceReductionRatio: 1 - stats.visibleFaceCount / naiveFaceCount,
    greedyReductionRatio: 1 - stats.greedyQuadCount / visibleFaceCount,
    meshCoverageRatio: stats.meshedBlockCount / blockCount,
    trianglesPerMeshedBlock: stats.triangleCount / meshedBlockCount,
    verticesPerMeshedBlock: stats.vertexCount / meshedBlockCount,
  }
}

export function formatChunkMeshDiagnostics(diagnostics: ChunkMeshDiagnostics) {
  return [
    `blocks=${diagnostics.blockCount}`,
    `meshed=${diagnostics.meshedBlockCount}`,
    `skipped=${diagnostics.skippedBlockCount}`,
    `faces=${diagnostics.visibleFaceCount}`,
    `quads=${diagnostics.greedyQuadCount}`,
    `groups=${diagnostics.geometryGroupCount}`,
    `tris=${diagnostics.triangleCount}`,
    `verts=${diagnostics.vertexCount}`,
    `coverage=${formatPercent(diagnostics.meshCoverageRatio)}`,
    `faceReduction=${formatPercent(diagnostics.faceReductionRatio)}`,
    `greedyReduction=${formatPercent(diagnostics.greedyReductionRatio)}`,
  ].join(' ')
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`
}
