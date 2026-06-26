import { rebuildDirtyChunkMeshes, type DirtyChunkMeshUpdate } from './ChunkMeshIntegration'
import { mirrorLegacyWorldToChunks, type LegacyBlockMap, type LegacyWorldMirrorResult } from './LegacyWorldBridge'

export type LegacyWorldDiagnosticsResult = {
  mirror: LegacyWorldMirrorResult
  updates: DirtyChunkMeshUpdate[]
  summary: string
}

export type LegacyWorldDiagnosticsOptions = {
  chunkSize: number
  limit?: number
  clearDirty?: boolean
}

export function diagnoseLegacyWorld(legacyBlocks: LegacyBlockMap, { chunkSize, limit = 8, clearDirty = false }: LegacyWorldDiagnosticsOptions): LegacyWorldDiagnosticsResult {
  const { chunks, result: mirror } = mirrorLegacyWorldToChunks(legacyBlocks, chunkSize)
  const updates = rebuildDirtyChunkMeshes(chunks, null, { render: false, limit, clearDirty })
  const summary = [
    `mirrored=${mirror.mirroredBlocks}`,
    `skipped=${mirror.skippedBlocks}`,
    `chunks=${mirror.chunkCount}`,
    `diagnosed=${updates.length}`,
  ].join(' ')

  return { mirror, updates, summary }
}

export function formatLegacyWorldDiagnostics(result: LegacyWorldDiagnosticsResult) {
  return [result.summary, ...result.updates.map((update) => update.summary)].join('\n')
}
