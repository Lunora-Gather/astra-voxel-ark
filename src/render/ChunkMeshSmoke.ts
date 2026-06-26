import type { BlockId } from '../blocks'
import type { WorldBlock } from '../world/ChunkManager'
import { buildChunkLookup, buildChunkMeshData } from './ChunkMeshBuilder'
import { createChunkMeshDiagnostics } from './ChunkMeshDiagnostics'

export type ChunkMeshSmokeResult = ReturnType<typeof createChunkMeshDiagnostics>

export function createFlatSmokeChunk(width = 6, depth = 6, id: BlockId = 'grass'): WorldBlock[] {
  const blocks: WorldBlock[] = []

  for (let x = 0; x < width; x += 1) {
    for (let z = 0; z < depth; z += 1) {
      blocks.push({ x, y: 0, z, id })
    }
  }

  return blocks
}

export function runChunkMeshSmoke(blocks = createFlatSmokeChunk()): ChunkMeshSmokeResult {
  const lookup = buildChunkLookup(blocks)
  const meshData = buildChunkMeshData(blocks, lookup)
  return createChunkMeshDiagnostics(meshData.stats)
}

export function assertChunkMeshSmoke(result = runChunkMeshSmoke()) {
  if (result.blockCount <= 0) {
    throw new Error('Chunk mesh smoke failed: expected at least one block')
  }

  if (result.visibleFaceCount <= 0) {
    throw new Error('Chunk mesh smoke failed: expected visible faces')
  }

  if (result.greedyQuadCount <= 0) {
    throw new Error('Chunk mesh smoke failed: expected greedy quads')
  }

  if (result.triangleCount !== result.greedyQuadCount * 2) {
    throw new Error('Chunk mesh smoke failed: triangle count must equal greedyQuadCount * 2')
  }

  if (result.vertexCount !== result.greedyQuadCount * 4) {
    throw new Error('Chunk mesh smoke failed: vertex count must equal greedyQuadCount * 4')
  }

  return result
}
