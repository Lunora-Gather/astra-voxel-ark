import type { BlockId } from '../blocks'
import { packBlockKey, type PackedBlockKey } from './blockKey'

export type BlockPosition = {
  x: number
  y: number
  z: number
}

export type WorldBlock = BlockPosition & {
  id: BlockId
}

export type ChunkCoord = {
  cx: number
  cz: number
}

export type ChunkRecord = ChunkCoord & {
  key: string
  blocks: Set<PackedBlockKey>
  dirty: boolean
}

export class ChunkManager {
  private readonly blocks = new Map<PackedBlockKey, WorldBlock>()
  private readonly chunks = new Map<string, ChunkRecord>()
  private readonly dirtyChunks = new Set<string>()

  constructor(private readonly chunkSize: number) {}

  get size() {
    return this.blocks.size
  }

  get chunkCount() {
    return this.chunks.size
  }

  get dirtyChunkCount() {
    return this.dirtyChunks.size
  }

  getBlock(x: number, y: number, z: number) {
    return this.blocks.get(packBlockKey(x, y, z)) ?? null
  }

  hasBlock(x: number, y: number, z: number) {
    return this.blocks.has(packBlockKey(x, y, z))
  }

  setBlock(block: WorldBlock) {
    const packedKey = packBlockKey(block.x, block.y, block.z)
    const previous = this.blocks.get(packedKey)
    if (previous) {
      const previousChunkKey = this.getChunkKeyForBlock(previous.x, previous.z)
      this.chunks.get(previousChunkKey)?.blocks.delete(packedKey)
      this.markChunkDirty(previousChunkKey)
    }

    this.blocks.set(packedKey, block)
    const chunk = this.getOrCreateChunkForBlock(block.x, block.z)
    chunk.blocks.add(packedKey)
    this.markChunkDirty(chunk.key)
    this.markBoundaryNeighborChunksDirty(block.x, block.z)
  }

  deleteBlock(x: number, y: number, z: number) {
    const packedKey = packBlockKey(x, y, z)
    const existing = this.blocks.get(packedKey)
    if (!existing) return false

    this.blocks.delete(packedKey)
    const chunkKey = this.getChunkKeyForBlock(existing.x, existing.z)
    this.chunks.get(chunkKey)?.blocks.delete(packedKey)
    this.markChunkDirty(chunkKey)
    this.markBoundaryNeighborChunksDirty(existing.x, existing.z)
    return true
  }

  clear() {
    this.blocks.clear()
    this.chunks.clear()
    this.dirtyChunks.clear()
  }

  getChunk(cx: number, cz: number) {
    return this.chunks.get(chunkKey(cx, cz)) ?? null
  }

  getChunkBlocks(cx: number, cz: number) {
    return this.fillChunkBlocks(cx, cz, [])
  }

  fillChunkBlocks(
    cx: number,
    cz: number,
    blocks: WorldBlock[],
    include?: (block: WorldBlock) => boolean,
  ) {
    blocks.length = 0
    const chunk = this.getChunk(cx, cz)
    if (!chunk) return blocks
    for (const packedKey of chunk.blocks) {
      const block = this.blocks.get(packedKey)
      if (block && (!include || include(block))) blocks.push(block)
    }
    return blocks
  }

  getDirtyChunks() {
    return this.fillDirtyChunks([])
  }

  fillDirtyChunks(chunks: ChunkRecord[], limit = Number.POSITIVE_INFINITY) {
    chunks.length = 0
    const boundedLimit = limit === Number.POSITIVE_INFINITY
      ? this.dirtyChunks.size
      : Number.isFinite(limit)
        ? Math.max(0, Math.floor(limit))
        : 0
    if (boundedLimit === 0) return chunks
    for (const key of this.dirtyChunks) {
      const chunk = this.chunks.get(key)
      if (chunk) chunks.push(chunk)
      if (chunks.length >= boundedLimit) break
    }
    return chunks
  }

  clearDirtyChunk(key: string) {
    const chunk = this.chunks.get(key)
    if (chunk) chunk.dirty = false
    this.dirtyChunks.delete(key)
  }

  markAllChunksDirty() {
    for (const key of this.chunks.keys()) {
      this.markChunkDirty(key)
    }
  }

  values() {
    return this.blocks.values()
  }

  entries() {
    return this.blocks.entries()
  }

  private getOrCreateChunkForBlock(x: number, z: number) {
    const { cx, cz } = worldToChunkCoord(x, z, this.chunkSize)
    const key = chunkKey(cx, cz)
    let chunk = this.chunks.get(key)
    if (!chunk) {
      chunk = { key, cx, cz, blocks: new Set(), dirty: false }
      this.chunks.set(key, chunk)
    }
    return chunk
  }

  private getChunkKeyForBlock(x: number, z: number) {
    const { cx, cz } = worldToChunkCoord(x, z, this.chunkSize)
    return chunkKey(cx, cz)
  }

  private markChunkDirty(key: string) {
    const chunk = this.chunks.get(key)
    if (!chunk) return
    chunk.dirty = true
    this.dirtyChunks.add(key)
  }

  private markBoundaryNeighborChunksDirty(x: number, z: number) {
    const localX = positiveModulo(x, this.chunkSize)
    const localZ = positiveModulo(z, this.chunkSize)
    const { cx, cz } = worldToChunkCoord(x, z, this.chunkSize)

    if (localX === 0) this.markChunkDirty(chunkKey(cx - 1, cz))
    if (localX === this.chunkSize - 1) this.markChunkDirty(chunkKey(cx + 1, cz))
    if (localZ === 0) this.markChunkDirty(chunkKey(cx, cz - 1))
    if (localZ === this.chunkSize - 1) this.markChunkDirty(chunkKey(cx, cz + 1))
  }
}

export function chunkKey(cx: number, cz: number) {
  return `${cx},${cz}`
}

export function worldToChunkCoord(x: number, z: number, chunkSize: number): ChunkCoord {
  return {
    cx: Math.floor(x / chunkSize),
    cz: Math.floor(z / chunkSize),
  }
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor
}
