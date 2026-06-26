import type { BlockId } from '../blocks'
import { ChunkManager, coordinatesFromStringBlockKey, type WorldBlock } from '../world'

export type LegacyBlockMap = Map<string, BlockId>

export type LegacyWorldMirrorResult = {
  mirroredBlocks: number
  skippedBlocks: number
  chunkCount: number
}

export function mirrorLegacyWorldToChunks(legacyBlocks: LegacyBlockMap, chunkSize: number) {
  const chunks = new ChunkManager(chunkSize)
  const result = syncLegacyWorldIntoChunks(chunks, legacyBlocks)
  return { chunks, result }
}

export function syncLegacyWorldIntoChunks(chunks: ChunkManager, legacyBlocks: LegacyBlockMap): LegacyWorldMirrorResult {
  chunks.clear()
  let mirroredBlocks = 0
  let skippedBlocks = 0

  for (const [key, id] of legacyBlocks) {
    const position = coordinatesFromStringBlockKey(key)
    if (!position) {
      skippedBlocks += 1
      continue
    }

    try {
      chunks.setBlock({ ...position, id })
      mirroredBlocks += 1
    } catch {
      skippedBlocks += 1
    }
  }

  chunks.markAllChunksDirty()

  return {
    mirroredBlocks,
    skippedBlocks,
    chunkCount: chunks.chunkCount,
  }
}

export function legacyBlockToWorldBlock(key: string, id: BlockId): WorldBlock | null {
  const position = coordinatesFromStringBlockKey(key)
  return position ? { ...position, id } : null
}

export function applyLegacyBlockSet(chunks: ChunkManager, key: string, id: BlockId) {
  const block = legacyBlockToWorldBlock(key, id)
  if (!block) return false

  try {
    chunks.setBlock(block)
    return true
  } catch {
    return false
  }
}

export function applyLegacyBlockDelete(chunks: ChunkManager, key: string) {
  const position = coordinatesFromStringBlockKey(key)
  if (!position) return false

  try {
    return chunks.deleteBlock(position.x, position.y, position.z)
  } catch {
    return false
  }
}
