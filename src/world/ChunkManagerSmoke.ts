import { ChunkManager, type ChunkRecord, type WorldBlock } from './ChunkManager'

export function assertChunkManagerSmoke() {
  const chunks = new ChunkManager(4)
  chunks.setBlock({ x: 0, y: 1, z: 0, id: 'stone' })
  chunks.setBlock({ x: 3, y: 1, z: 0, id: 'water' })
  chunks.setBlock({ x: 4, y: 1, z: 0, id: 'dirt' })

  const dirtyBuffer: ChunkRecord[] = []
  const firstBatch = chunks.fillDirtyChunks(dirtyBuffer, 1)
  if (firstBatch !== dirtyBuffer || firstBatch.length !== 1 || chunks.dirtyChunkCount < 2) {
    throw new Error('Chunk manager smoke failed: dirty batches should reuse caller storage and respect limits')
  }
  chunks.clearDirtyChunk(firstBatch[0].key)
  chunks.fillDirtyChunks(dirtyBuffer, 8)
  if (dirtyBuffer.some((chunk) => !chunk.dirty)) {
    throw new Error('Chunk manager smoke failed: cleared chunks should not return to the dirty buffer')
  }

  const blockBuffer: WorldBlock[] = []
  const reusableBlocks = chunks.fillChunkBlocks(0, 0, blockBuffer, (block) => block.id !== 'water')
  if (
    reusableBlocks !== blockBuffer ||
    reusableBlocks.length !== 1 ||
    reusableBlocks[0].id !== 'stone'
  ) {
    throw new Error('Chunk manager smoke failed: filtered block reads should reuse caller storage')
  }
  chunks.fillChunkBlocks(1, 0, blockBuffer)
  if (blockBuffer.length !== 1 || blockBuffer[0].id !== 'dirt') {
    throw new Error('Chunk manager smoke failed: reused block buffers should discard previous contents')
  }

  chunks.clear()
  if (chunks.size !== 0 || chunks.chunkCount !== 0 || chunks.dirtyChunkCount !== 0) {
    throw new Error('Chunk manager smoke failed: clear should release blocks, chunks and dirty state')
  }
  return true
}
