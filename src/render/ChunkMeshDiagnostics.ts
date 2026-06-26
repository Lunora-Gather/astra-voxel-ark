import type { ChunkMeshStats } from './ChunkMeshBuilder'

export type ChunkMeshDiagnostics = ChunkMeshStats & {
  faceReductionRatio: number
  greedyReductionRatio: number
  trianglesPerBlock: number
  verticesPerBlock: number
}

export function createChunkMeshDiagnostics(stats: ChunkMeshStats): ChunkMeshDiagnostics {
  const naiveFaceCount = Math.max(1, stats.blockCount * 6)
  const visibleFaceCount = Math.max(1, stats.visibleFaceCount)
  const blockCount = Math.max(1, stats.blockCount)

  return {
    ...stats,
    faceReductionRatio: 1 - stats.visibleFaceCount / naiveFaceCount,
    greedyReductionRatio: 1 - stats.greedyQuadCount / visibleFaceCount,
    trianglesPerBlock: stats.triangleCount / blockCount,
    verticesPerBlock: stats.vertexCount / blockCount,
  }
}

export function formatChunkMeshDiagnostics(diagnostics: ChunkMeshDiagnostics) {
  return [
    `blocks=${diagnostics.blockCount}`,
    `faces=${diagnostics.visibleFaceCount}`,
    `quads=${diagnostics.greedyQuadCount}`,
    `groups=${diagnostics.geometryGroupCount}`,
    `tris=${diagnostics.triangleCount}`,
    `verts=${diagnostics.vertexCount}`,
    `faceReduction=${formatPercent(diagnostics.faceReductionRatio)}`,
    `greedyReduction=${formatPercent(diagnostics.greedyReductionRatio)}`,
  ].join(' ')
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`
}
