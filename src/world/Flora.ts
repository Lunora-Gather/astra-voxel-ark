import type { BiomeId } from './Biomes'

export type FloraVariantId = 0 | 1 | 2 | 3 | 4

export type FloraDefinition = {
  id: FloraVariantId
  name: string
  color: number
  widthScale: number
  heightScale: number
  biomeId: BiomeId | null
}

const FLORA_BY_BIOME: Record<BiomeId, FloraVariantId> = {
  'star-meadow': 1,
  'moon-coast': 2,
  'amber-reach': 3,
  'crystal-highlands': 4,
}

export const FLORA_DEFINITIONS: readonly FloraDefinition[] = [
  { id: 0, name: 'Meadow Grass', color: 0x91e66f, widthScale: 1, heightScale: 1, biomeId: null },
  { id: 1, name: 'Star Blossom', color: 0xffa9dc, widthScale: 0.72, heightScale: 1.18, biomeId: 'star-meadow' },
  { id: 2, name: 'Moon Reed', color: 0x83dcff, widthScale: 0.62, heightScale: 1.34, biomeId: 'moon-coast' },
  { id: 3, name: 'Amber Bloom', color: 0xffc75f, widthScale: 0.78, heightScale: 1.12, biomeId: 'amber-reach' },
  { id: 4, name: 'Prism Flower', color: 0xc79cff, widthScale: 0.68, heightScale: 1.24, biomeId: 'crystal-highlands' },
]

export function selectFloraVariant(biomeId: BiomeId, roll: number): FloraVariantId {
  return Number.isFinite(roll) && roll < 0.18 ? FLORA_BY_BIOME[biomeId] : 0
}

export function getFloraDefinition(id: FloraVariantId) {
  return FLORA_DEFINITIONS[id] ?? FLORA_DEFINITIONS[0]
}
