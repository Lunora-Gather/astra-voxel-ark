import type { ChunkMeshDiagnostics } from '../render'

export type RuntimeDebugStats = {
  fps: number
  frameMs: number
  chunkCount: number
  dirtyChunkCount: number
  blockCount: number
  renderedChunkMeshCount: number
  chunkMesh?: ChunkMeshDiagnostics
}

export function formatRuntimeDebugStats(stats: RuntimeDebugStats) {
  const parts = [
    `FPS ${Math.round(stats.fps)}`,
    `${Math.round(stats.frameMs * 10) / 10}ms`,
    `chunks ${stats.chunkCount}`,
    `dirty ${stats.dirtyChunkCount}`,
    `blocks ${stats.blockCount}`,
    `meshes ${stats.renderedChunkMeshCount}`,
  ]

  if (stats.chunkMesh) {
    parts.push(
      `meshed ${stats.chunkMesh.meshedBlockCount}`,
      `skipped ${stats.chunkMesh.skippedBlockCount}`,
      `coverage ${formatPercent(stats.chunkMesh.meshCoverageRatio)}`,
      `greedy ${formatPercent(stats.chunkMesh.greedyReductionRatio)}`,
    )
  }

  return parts.join(' · ')
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`
}
