import { getBiomeAt } from './Biomes'
import { FLORA_DEFINITIONS, getFloraDefinition, selectFloraVariant } from './Flora'
import { buildProceduralChunkPlan } from './ProceduralTerrain'

export function assertFloraSystemSmoke() {
  const biomeIds = ['star-meadow', 'moon-coast', 'amber-reach', 'crystal-highlands'] as const
  biomeIds.forEach((biomeId, index) => {
    const flowering = selectFloraVariant(biomeId, 0)
    if (flowering !== index + 1 || getFloraDefinition(flowering).biomeId !== biomeId) {
      throw new Error(`Flora system smoke failed: ${biomeId} should select its own deterministic plant`)
    }
    if (selectFloraVariant(biomeId, 0.99) !== 0) {
      throw new Error('Flora system smoke failed: common tufts should remain grass')
    }
  })

  if (FLORA_DEFINITIONS.length !== 5 || new Set(FLORA_DEFINITIONS.map(({ color }) => color)).size !== 5) {
    throw new Error('Flora system smoke failed: flora definitions should stay compact and visually distinct')
  }

  let flowerCount = 0
  for (let cx = -5; cx <= 5; cx += 1) {
    for (let cz = -5; cz <= 5; cz += 1) {
      const plan = buildProceduralChunkPlan(cx, cz, 8, 0x2468ace0)
      if (plan.grassTufts.length > 64) {
        throw new Error('Flora system smoke failed: a chunk should expose at most one tuft per terrain column')
      }
      const blockKeys = new Set(plan.blocks.map(({ x, y, z }) => `${x},${y},${z}`))
      plan.grassTufts.forEach(([x, y, z, variant]) => {
        if (!blockKeys.has(`${x},${y},${z}`)) {
          throw new Error('Flora system smoke failed: every tuft needs a resident terrain anchor')
        }
        const definition = getFloraDefinition(variant)
        if (variant > 0 && definition.biomeId !== getBiomeAt(x, z, 0x2468ace0).id) {
          throw new Error('Flora system smoke failed: plant variant does not match its biome')
        }
        if (variant > 0) flowerCount += 1
      })
    }
  }
  if (flowerCount === 0) {
    throw new Error('Flora system smoke failed: sampled terrain exposed no decorative plants')
  }

  const first = buildProceduralChunkPlan(2, -3, 8, 0x2468ace0).grassTufts
  const repeat = buildProceduralChunkPlan(2, -3, 8, 0x2468ace0).grassTufts
  if (JSON.stringify(first) !== JSON.stringify(repeat)) {
    throw new Error('Flora system smoke failed: flora placement is not deterministic')
  }
}
