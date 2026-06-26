import type { BlockId } from '../blocks'
import { ChunkManager } from '../world'
import { rebuildDirtyChunkMeshes, type DirtyChunkMeshUpdate } from './ChunkMeshIntegration'
import {
  applyLegacyBlockDelete,
  applyLegacyBlockSet,
  syncLegacyWorldIntoChunks,
  type LegacyBlockMap,
  type LegacyWorldMirrorResult,
} from './LegacyWorldBridge'

export type LegacyChunkMirrorControllerOptions = {
  chunkSize: number
}

export type LegacyChunkMirrorDiagnosticsOptions = {
  limit?: number
  clearDirty?: boolean
}

export class LegacyChunkMirrorController {
  readonly chunks: ChunkManager
  private lastMirrorResult: LegacyWorldMirrorResult | null = null

  constructor({ chunkSize }: LegacyChunkMirrorControllerOptions) {
    this.chunks = new ChunkManager(chunkSize)
  }

  syncFromLegacyMap(blocks: LegacyBlockMap) {
    this.lastMirrorResult = syncLegacyWorldIntoChunks(this.chunks, blocks)
    return this.lastMirrorResult
  }

  setBlock(key: string, id: BlockId) {
    return applyLegacyBlockSet(this.chunks, key, id)
  }

  deleteBlock(key: string) {
    return applyLegacyBlockDelete(this.chunks, key)
  }

  diagnoseDirtyChunks({ limit = 4, clearDirty = false }: LegacyChunkMirrorDiagnosticsOptions = {}): DirtyChunkMeshUpdate[] {
    return rebuildDirtyChunkMeshes(this.chunks, null, { render: false, limit, clearDirty })
  }

  markAllDirty() {
    this.chunks.markAllChunksDirty()
  }

  get lastSync() {
    return this.lastMirrorResult
  }

  get blockCount() {
    return this.chunks.size
  }

  get chunkCount() {
    return this.chunks.chunkCount
  }
}
