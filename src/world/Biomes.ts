import type { BlockId } from '../blocks'

export type BiomeId = 'star-meadow' | 'moon-coast' | 'amber-reach' | 'crystal-highlands'

export type BiomeDefinition = {
  id: BiomeId
  name: string
  surface: BlockId
  subsurface: BlockId
  treeTrunk: BlockId
  treeChance: number
}

export const BIOMES: Record<BiomeId, BiomeDefinition> = {
  'star-meadow': {
    id: 'star-meadow',
    name: 'Star Meadow',
    surface: 'grass',
    subsurface: 'dirt',
    treeTrunk: 'wood',
    treeChance: 0.032,
  },
  'moon-coast': {
    id: 'moon-coast',
    name: 'Moon Coast',
    surface: 'sand',
    subsurface: 'sand',
    treeTrunk: 'birch',
    treeChance: 0.012,
  },
  'amber-reach': {
    id: 'amber-reach',
    name: 'Amber Reach',
    surface: 'clay',
    subsurface: 'gravel',
    treeTrunk: 'spruce',
    treeChance: 0.018,
  },
  'crystal-highlands': {
    id: 'crystal-highlands',
    name: 'Crystal Highlands',
    surface: 'moss',
    subsurface: 'stone',
    treeTrunk: 'spruce',
    treeChance: 0.024,
  },
}

export function getBiomeAt(x: number, z: number): BiomeDefinition {
  const continental = waveNoise(x * 0.018, z * 0.018)
  const detail = waveNoise((x + 137) * 0.041, (z - 83) * 0.041)
  const value = continental * 0.72 + detail * 0.28
  if (value < 0.25) return BIOMES['moon-coast']
  if (value < 0.5) return BIOMES['star-meadow']
  if (value < 0.73) return BIOMES['amber-reach']
  return BIOMES['crystal-highlands']
}

function waveNoise(x: number, z: number) {
  return (Math.sin(x * 1.7 + Math.cos(z * 0.7)) + Math.cos(z * 1.3 - Math.sin(x * 0.8)) + 2) / 4
}
