import type { ChunkManager, ChunkRecord } from '../world'
import {
  buildChunkLookup,
  buildChunkMeshData,
  ChunkMeshRenderer,
  createChunkMeshDiagnostics,
  formatChunkMeshDiagnostics,
  type ChunkMeshDiagnostics,
} from '../render'

export type DirtyChunkMeshUpdate = {
  chunk: ChunkRecord
  diagnostics: ChunkMeshDiagnostics
  summary: string
}

export type DirtyChunkMeshUpdateOptions = {
  limit?: number
  clearDirty?: boolean
  render?: boolean
}

export function rebuildDirtyChunkMeshes(
  chunks: ChunkManager,
  renderer?: ChunkMeshRenderer | null,
  { limit = Number.POSITIVE_INFINITY, clearDirty = true, render = false }: DirtyChunkMeshUpdateOptions = {},
) {
  if (render && !renderer) {
    throw new Error('ChunkMeshRenderer is required when render=true')
  }

  const worldLookup = buildChunkLookup(chunks.values())
  const updates: DirtyChunkMeshUpdate[] = []

  for (const chunk of chunks.getDirtyChunks().slice(0, limit)) {
    const chunkBlocks = chunks.getChunkBlocks(chunk.cx, chunk.cz)
    const meshData = buildChunkMeshData(chunkBlocks, worldLookup)
    const diagnostics = createChunkMeshDiagnostics(meshData.stats)

    if (render) {
      renderer?.upsertChunk(chunk.key, meshData.geometryGroups)
    }

    if (clearDirty) {
      chunks.clearDirtyChunk(chunk.key)
    }

    updates.push({
      chunk,
      diagnostics,
      summary: `${chunk.key} ${formatChunkMeshDiagnostics(diagnostics)}`,
    })
  }

  return updates
}
