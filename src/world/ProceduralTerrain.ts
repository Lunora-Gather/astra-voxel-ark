import type { BlockId } from '../blocks'
import { getBiomeAt } from './Biomes'
import { terrainNoise } from '../worldMath'
import { buildLandmarkPlan, type LandmarkPlan } from './LandmarkTemplates'
import { selectFloraVariant, type FloraVariantId } from './Flora'
import { getWorldSeedOffsets, normalizeWorldSeed } from './WorldSeed'

export type ProceduralBlock = { x: number; y: number; z: number; id: BlockId }
export type ProceduralChunkPlan = {
  cx: number
  cz: number
  blocks: ProceduralBlock[]
  grassTufts: Array<[number, number, number, FloraVariantId]>
  landmarkShardKeys: string[]
  landmark: LandmarkPlan | null
}

export function buildProceduralChunkPlan(cx: number, cz: number, chunkSize: number, worldSeed = 0): ProceduralChunkPlan {
  const normalizedSeed = normalizeWorldSeed(worldSeed)
  const blockMap = new Map<string, ProceduralBlock>()
  const grassTufts: Array<[number, number, number, FloraVariantId]> = []
  const add = (x: number, y: number, z: number, id: BlockId) => {
    const key = `${x},${y},${z}`
    if (!blockMap.has(key)) blockMap.set(key, { x, y, z, id })
  }
  const startX = cx * chunkSize
  const startZ = cz * chunkSize

  for (let x = startX; x < startX + chunkSize; x += 1) {
    for (let z = startZ; z < startZ + chunkSize; z += 1) {
      const height = proceduralTerrainHeightAt(x, z, normalizedSeed)
      const biome = getBiomeAt(x, z, normalizedSeed)
      for (let y = 0; y <= height; y += 1) {
        add(x, y, z, terrainBlockAt(x, y, z, height, biome.surface, biome.subsurface, normalizedSeed))
      }
      if (height < 3) add(x, 3, z, 'water')
      if (height > 3 && seededNoise(normalizedSeed, x, height, z, 11) < 0.065) {
        grassTufts.push([x, height, z, selectFloraVariant(biome.id, seededNoise(normalizedSeed, x, height, z, 15))])
      }
      if (height > 4 && seededNoise(normalizedSeed, x, height, z, 12) < biome.treeChance) {
        addTree(add, x, height + 1, z, biome.treeTrunk, normalizedSeed)
      }
      if (height > 2 && seededNoise(normalizedSeed, x, height, z, 13) < 0.016) {
        add(x, height + 1, z, seededNoise(normalizedSeed, x, height, z, 14) > 0.5 ? 'crystal' : 'glow')
      }
    }
  }

  const landmark = buildLandmarkPlan(
    cx,
    cz,
    chunkSize,
    normalizedSeed,
    (x, z) => proceduralTerrainHeightAt(x, z, normalizedSeed),
  )
  landmark?.blocks.forEach(({ x, y, z, id }) => add(x, y, z, id))
  return {
    cx,
    cz,
    blocks: [...blockMap.values()],
    grassTufts,
    landmarkShardKeys: landmark?.shardKeys ?? [],
    landmark,
  }
}

export function proceduralTerrainHeightAt(x: number, z: number, worldSeed = 0) {
  const [offsetX, offsetZ] = getWorldSeedOffsets(worldSeed)
  return Math.max(1, Math.floor(terrainNoise(x + offsetX, z + offsetZ) + 5.2 - Math.hypot(x, z) * 0.012))
}

function terrainBlockAt(x: number, y: number, z: number, height: number, surface: BlockId, subsurface: BlockId, worldSeed: number): BlockId {
  const depth = height - y
  const oreRoll = seededNoise(worldSeed, x, y, z, 91)
  if (depth === 0) return height <= 3 ? 'sand' : surface
  if (depth <= 2) {
    if (height <= 4) return 'sand'
    if (seededNoise(worldSeed, x, y, z, 93) < 0.12) return 'clay'
    return seededNoise(worldSeed, x, y, z, 94) < 0.1 ? 'gravel' : subsurface
  }
  if (y <= 2 && oreRoll < 0.09) return 'obsidian'
  if (depth >= 5 && oreRoll < 0.012) return 'gold'
  if (depth >= 4 && oreRoll < 0.045) return 'copper'
  if (depth >= 6 && oreRoll < 0.052) return 'crystal'
  return 'stone'
}

function addTree(add: (x: number, y: number, z: number, id: BlockId) => void, x: number, y: number, z: number, trunkId: BlockId, worldSeed: number) {
  const trunk = 3 + Math.floor(seededNoise(worldSeed, x, y, z, 21) * 2)
  for (let i = 0; i < trunk; i += 1) add(x, y + i, z, trunkId)
  const top = y + trunk
  for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) for (let dy = -1; dy <= 1; dy += 1) {
    if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) < 4 && seededNoise(worldSeed, x, y, z, dx, dy, dz, 22) > 0.12) {
      add(x + dx, top + dy, z + dz, 'leaves')
    }
  }
}

function seededNoise(worldSeed: number, ...values: number[]) {
  const legacySeed = values.reduce((seed, value) => seed * 31 + value, 17)
  return seededHash(legacySeed, worldSeed)
}

function seededHash(value: number, worldSeed: number) {
  return hashNoise(value + (worldSeed === 0 ? 0 : worldSeed * 0.61803398875))
}

function hashNoise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}
