import type { BlockId } from '../blocks'
import type { WorldBlock } from '../world/ChunkManager'
import { filterGreedyMeshBlocks, groupBlockIdsByRenderLayer } from './BlockRenderLayers'

export type RenderLayerSmokeResult = {
  layerCount: number
  greedyEligibleIds: BlockId[]
  skippedIds: BlockId[]
}

export function runRenderLayerSmoke(): RenderLayerSmokeResult {
  const sampleBlocks: WorldBlock[] = [
    { x: 0, y: 0, z: 0, id: 'grass' },
    { x: 1, y: 0, z: 0, id: 'stone' },
    { x: 2, y: 0, z: 0, id: 'water' },
    { x: 3, y: 0, z: 0, id: 'leaves' },
    { x: 4, y: 0, z: 0, id: 'glow' },
  ]

  const greedyBlocks = filterGreedyMeshBlocks(sampleBlocks)
  const greedyEligibleIds = greedyBlocks.map((block) => block.id)
  const skippedIds = sampleBlocks.filter((block) => !greedyEligibleIds.includes(block.id)).map((block) => block.id)

  return {
    layerCount: groupBlockIdsByRenderLayer().size,
    greedyEligibleIds,
    skippedIds,
  }
}

export function assertRenderLayerSmoke(result = runRenderLayerSmoke()) {
  if (result.layerCount < 3) {
    throw new Error('Render layer smoke failed: expected multiple render layers')
  }

  if (!result.greedyEligibleIds.includes('grass') || !result.greedyEligibleIds.includes('stone')) {
    throw new Error('Render layer smoke failed: opaque blocks should be greedy eligible')
  }

  if (!result.greedyEligibleIds.includes('glow')) {
    throw new Error('Render layer smoke failed: emissive solid blocks should be greedy eligible')
  }

  if (!result.skippedIds.includes('water') || !result.skippedIds.includes('leaves')) {
    throw new Error('Render layer smoke failed: water and leaves should not be greedy meshed')
  }

  return result
}
