import { BLOCKS, type BlockDef, type BlockId } from '../blocks'

export type RenderLayer = 'opaque' | 'cutout' | 'transparent' | 'water' | 'emissive' | 'vegetation'

export type LayeredBlockDef = BlockDef & {
  renderLayer: RenderLayer
  greedyMeshEligible: boolean
}

const VEGETATION_BLOCKS = new Set<BlockId>(['leaves'])
const WATER_BLOCKS = new Set<BlockId>(['water'])

export const BLOCK_RENDER_LAYERS: Record<BlockId, RenderLayer> = BLOCKS.reduce((layers, block) => {
  layers[block.id] = getRenderLayer(block)
  return layers
}, {} as Record<BlockId, RenderLayer>)

export const LAYERED_BLOCKS: LayeredBlockDef[] = BLOCKS.map((block) => ({
  ...block,
  renderLayer: BLOCK_RENDER_LAYERS[block.id],
  greedyMeshEligible: isGreedyMeshEligible(block.id),
}))

export function getRenderLayer(block: BlockDef): RenderLayer {
  if (WATER_BLOCKS.has(block.id)) return 'water'
  if (VEGETATION_BLOCKS.has(block.id)) return 'vegetation'
  if (block.transparent || typeof block.opacity === 'number') return 'transparent'
  if (block.emissive) return 'emissive'
  return 'opaque'
}

export function isGreedyMeshEligible(id: BlockId) {
  const layer = BLOCK_RENDER_LAYERS[id]
  return layer === 'opaque' || layer === 'emissive'
}

export function isTransparentRenderLayer(layer: RenderLayer) {
  return layer === 'transparent' || layer === 'water' || layer === 'vegetation'
}

export function filterGreedyMeshBlocks<T extends { id: BlockId }>(blocks: Iterable<T>) {
  return [...blocks].filter((block) => isGreedyMeshEligible(block.id))
}

export function groupBlockIdsByRenderLayer() {
  const groups = new Map<RenderLayer, BlockId[]>()
  for (const block of LAYERED_BLOCKS) {
    const group = groups.get(block.renderLayer)
    if (group) group.push(block.id)
    else groups.set(block.renderLayer, [block.id])
  }
  return groups
}
