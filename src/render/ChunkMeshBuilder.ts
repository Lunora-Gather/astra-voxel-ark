import type { BlockId } from '../blocks'
import type { WorldBlock } from '../world/ChunkManager'
import { buildGreedyGeometryGroups, type GreedyGeometryGroup } from './GreedyGeometry'
import { buildGreedyQuads, type GreedyQuad } from './GreedyMesher'
import { collectVisibleFaces, type BlockLookup, type VisibleVoxelFace } from './VoxelMesher'

export type ChunkMeshBuildResult = {
  visibleFaces: VisibleVoxelFace[]
  greedyQuads: GreedyQuad[]
  geometryGroups: GreedyGeometryGroup[]
  stats: ChunkMeshStats
}

export type ChunkMeshStats = {
  blockCount: number
  visibleFaceCount: number
  greedyQuadCount: number
  triangleCount: number
  vertexCount: number
  geometryGroupCount: number
}

export function buildChunkMeshData(blocks: Iterable<WorldBlock>, lookup: BlockLookup): ChunkMeshBuildResult {
  const blockList = [...blocks]
  const visibleFaces = collectVisibleFaces(blockList, lookup)
  const greedyQuads = buildGreedyQuads(visibleFaces)
  const geometryGroups = buildGreedyGeometryGroups(greedyQuads)

  return {
    visibleFaces,
    greedyQuads,
    geometryGroups,
    stats: {
      blockCount: blockList.length,
      visibleFaceCount: visibleFaces.length,
      greedyQuadCount: greedyQuads.length,
      triangleCount: geometryGroups.reduce((sum, group) => sum + group.triangleCount, 0),
      vertexCount: geometryGroups.reduce((sum, group) => sum + group.vertexCount, 0),
      geometryGroupCount: geometryGroups.length,
    },
  }
}

export function buildChunkLookup(blocks: Iterable<WorldBlock>): BlockLookup {
  const blockMap = new Map<string, BlockId>()
  for (const block of blocks) {
    blockMap.set(`${block.x},${block.y},${block.z}`, block.id)
  }
  return (x, y, z) => blockMap.get(`${x},${y},${z}`) ?? null
}
