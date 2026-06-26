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
  }

  deleteBlock(x: number, y: number, z: number) {
    const packedKey = packBlockKey(x, y, z)
    const existing = this.blocks.get(packedKey)
    if (!existing) return false

    this.blocks.delete(packedKey)
    const chunkKey = this.getChunkKeyForBlock(existing.x, existing.z)
    this.chunks.get(chunkKey)?.blocks.delete(packedKey)
    this.markChunkDirty(chunkKey)
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

  getDirtyChunks() {
    return [...this.dirtyChunks].map((key) => this.chunks.get(key)).filter((chunk): chunk is ChunkRecord => Boolean(chunk))
  }

  clearDirtyChunk(key: string) {
    const chunk = this.chunks.get(key)
    if (chunk) chunk.dirty = false
    this.dirtyChunks.delete(key)
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
