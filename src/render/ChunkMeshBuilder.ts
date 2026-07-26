import type { BlockId } from '../blocks'
import type { WorldBlock } from '../world/ChunkManager'
import { filterGreedyMeshBlocks } from './BlockRenderLayers'
import { buildGreedyGeometryGroups, type GreedyGeometryGroup } from './GreedyGeometry'
import { buildGreedyQuads, type GreedyQuad } from './GreedyMesher'
import { collectVisibleFaces, type BlockLookup, type VisibleVoxelFace } from './VoxelMesher'

export type ChunkMeshBuildOptions = {
  includeNonGreedyBlocks?: boolean
  /** Block ids whose materials differ per face; their quads are grouped by face slot. */
  multiFaceIds?: ReadonlySet<BlockId>
}

export type ChunkMeshBuildResult = {
  visibleFaces: VisibleVoxelFace[]
  greedyQuads: GreedyQuad[]
  geometryGroups: GreedyGeometryGroup[]
  stats: ChunkMeshStats
}

export type ChunkMeshStats = {
  blockCount: number
  meshedBlockCount: number
  skippedBlockCount: number
  visibleFaceCount: number
  greedyQuadCount: number
  triangleCount: number
  vertexCount: number
  geometryGroupCount: number
}

export function buildChunkMeshData(
  blocks: Iterable<WorldBlock>,
  lookup: BlockLookup,
  { includeNonGreedyBlocks = false, multiFaceIds }: ChunkMeshBuildOptions = {},
): ChunkMeshBuildResult {
  const blockList = Array.isArray(blocks) ? (blocks as WorldBlock[]) : [...blocks]
  const meshedBlocks = includeNonGreedyBlocks ? blockList : filterGreedyMeshBlocks(blockList)
  const visibleFaces = collectVisibleFaces(meshedBlocks, lookup)
  const greedyQuads = buildGreedyQuads(visibleFaces)
  const geometryGroups = buildGreedyGeometryGroups(greedyQuads, multiFaceIds)

  let triangleCount = 0
  let vertexCount = 0
  for (const group of geometryGroups) {
    triangleCount += group.triangleCount
    vertexCount += group.vertexCount
  }

  return {
    visibleFaces,
    greedyQuads,
    geometryGroups,
    stats: {
      blockCount: blockList.length,
      meshedBlockCount: meshedBlocks.length,
      skippedBlockCount: blockList.length - meshedBlocks.length,
      visibleFaceCount: visibleFaces.length,
      greedyQuadCount: greedyQuads.length,
      triangleCount,
      vertexCount,
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
