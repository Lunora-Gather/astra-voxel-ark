import type { BlockId } from '../blocks'
import { getBiomeAt, type BiomeId } from './Biomes'
import { isSpawnAreaProtected } from './SpawnArea'

export type LandmarkTemplateId = 'moss-shrine' | 'crystal-bloom' | 'waystone'
export type LandmarkBlock = { x: number; y: number; z: number; id: BlockId }
export type LandmarkPlan = {
  templateId: LandmarkTemplateId
  name: string
  biomeId: BiomeId
  origin: { x: number; y: number; z: number }
  blocks: LandmarkBlock[]
  shardKeys: string[]
}

type RelativeLandmarkBlock = readonly [dx: number, dy: number, dz: number, id: BlockId]

const MOSS_SHRINE_BLOCKS: readonly RelativeLandmarkBlock[] = [
  [0, 0, 0, 'moss'], [1, 0, 0, 'stone'], [-1, 0, 0, 'moss'], [0, 0, 1, 'stone'],
  [0, 1, 0, 'brick'], [1, 1, 0, 'moss'], [0, 1, 1, 'brick'], [0, 2, 0, 'glow'],
  [-1, 0, 1, 'gravel'], [1, 0, 1, 'gravel'],
]

const WAYSTONE_BLOCKS: readonly RelativeLandmarkBlock[] = [
  [0, 0, 0, 'obsidian'],
  [0, 1, 0, 'stone'],
  [0, 2, 0, 'crystal'],
  [1, 0, 0, 'gravel'],
  [-1, 0, 0, 'gravel'],
]

const LANDMARK_NAMES: Record<LandmarkTemplateId, Record<BiomeId, string>> = {
  'moss-shrine': {
    'star-meadow': 'Meadow Shrine',
    'moon-coast': 'Tide Shrine',
    'amber-reach': 'Amber Shrine',
    'crystal-highlands': 'Highland Shrine',
  },
  'crystal-bloom': {
    'star-meadow': 'Star Bloom',
    'moon-coast': 'Moon Bloom',
    'amber-reach': 'Sunstone Bloom',
    'crystal-highlands': 'Prism Bloom',
  },
  waystone: {
    'star-meadow': 'Meadow Waystone',
    'moon-coast': 'Coast Waystone',
    'amber-reach': 'Amber Waystone',
    'crystal-highlands': 'Highland Waystone',
  },
}

export function buildLandmarkPlan(
  cx: number,
  cz: number,
  chunkSize: number,
  worldSeed: number,
  terrainHeightAt: (x: number, z: number) => number,
): LandmarkPlan | null {
  const roll = seededLandmarkHash(cx * 92821 + cz * 68917 + 17, worldSeed)
  if (roll > 0.28) return null

  const originX = cx * chunkSize + 2 + Math.floor(seededLandmarkHash(cx * 317 + cz * 911 + 3, worldSeed) * 4)
  const originZ = cz * chunkSize + 2 + Math.floor(seededLandmarkHash(cx * 613 + cz * 271 + 5, worldSeed) * 4)
  if (isSpawnAreaProtected(originX, originZ, 3)) return null
  const originY = terrainHeightAt(originX, originZ) + 1
  if (originY <= 4) return null

  const templateId: LandmarkTemplateId = roll < 0.11
    ? 'moss-shrine'
    : roll < 0.2
      ? 'crystal-bloom'
      : 'waystone'
  const relativeBlocks = templateId === 'moss-shrine'
    ? MOSS_SHRINE_BLOCKS
    : templateId === 'waystone'
      ? WAYSTONE_BLOCKS
      : buildCrystalBloomBlocks(cx, cz, worldSeed)
  const blocks = relativeBlocks.map(([dx, dy, dz, id]) => ({
    x: originX + dx,
    y: originY + dy,
    z: originZ + dz,
    id,
  }))
  const shardKeys = blocks
    .filter(({ id }) => id === 'glow' || id === 'crystal')
    .map(({ x, y, z }) => `${x},${y},${z}`)
  const biomeId = getBiomeAt(originX, originZ, worldSeed).id
  return {
    templateId,
    name: LANDMARK_NAMES[templateId][biomeId],
    biomeId,
    origin: { x: originX, y: originY, z: originZ },
    blocks,
    shardKeys,
  }
}

function buildCrystalBloomBlocks(cx: number, cz: number, worldSeed: number): RelativeLandmarkBlock[] {
  const clusterSize = 4 + Math.floor(seededLandmarkHash(cx * 149 + cz * 463 + 29, worldSeed) * 4)
  const blocks: RelativeLandmarkBlock[] = []
  for (let i = 0; i < clusterSize; i += 1) {
    const dx = Math.floor(seededLandmarkHash(cx * 101 + cz * 103 + i * 37, worldSeed) * 3) - 1
    const dz = Math.floor(seededLandmarkHash(cx * 107 + cz * 109 + i * 41, worldSeed) * 3) - 1
    blocks.push([dx, i > 3 ? 1 : 0, dz, i === 0 ? 'glow' : 'crystal'])
  }
  return blocks
}

function seededLandmarkHash(value: number, worldSeed: number) {
  return hashNoise(value + (worldSeed === 0 ? 0 : worldSeed * 0.61803398875))
}

function hashNoise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}
