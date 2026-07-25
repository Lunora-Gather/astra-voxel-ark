import type { BlockId } from '../blocks'
import { getBiomeAt } from './Biomes'
import { terrainNoise } from '../worldMath'
import { getWorldSeedOffsets, normalizeWorldSeed } from './WorldSeed'

export type ProceduralBlock = { x: number; y: number; z: number; id: BlockId }
export type ProceduralChunkPlan = {
  cx: number
  cz: number
  blocks: ProceduralBlock[]
  grassTufts: Array<[number, number, number]>
  landmarkShardKeys: string[]
}

export function buildProceduralChunkPlan(cx: number, cz: number, chunkSize: number, worldSeed = 0): ProceduralChunkPlan {
  const normalizedSeed = normalizeWorldSeed(worldSeed)
  const blockMap = new Map<string, ProceduralBlock>()
  const grassTufts: Array<[number, number, number]> = []
  const landmarkShardKeys: string[] = []
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
      if (height > 3 && seededNoise(normalizedSeed, x, height, z, 11) < 0.065) grassTufts.push([x, height, z])
      if (height > 4 && seededNoise(normalizedSeed, x, height, z, 12) < biome.treeChance) {
        addTree(add, x, height + 1, z, biome.treeTrunk, normalizedSeed)
      }
      if (height > 2 && seededNoise(normalizedSeed, x, height, z, 13) < 0.016) {
        add(x, height + 1, z, seededNoise(normalizedSeed, x, height, z, 14) > 0.5 ? 'crystal' : 'glow')
      }
    }
  }

  addLandmark(add, landmarkShardKeys, cx, cz, chunkSize, normalizedSeed)
  return { cx, cz, blocks: [...blockMap.values()], grassTufts, landmarkShardKeys }
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

function addLandmark(
  add: (x: number, y: number, z: number, id: BlockId) => void,
  shardKeys: string[],
  cx: number,
  cz: number,
  chunkSize: number,
  worldSeed: number,
) {
  if (cx === 0 && cz === 0) return
  const roll = seededHash(cx * 92821 + cz * 68917 + 17, worldSeed)
  if (roll > 0.28) return
  const originX = cx * chunkSize + 2 + Math.floor(seededHash(cx * 317 + cz * 911 + 3, worldSeed) * 4)
  const originZ = cz * chunkSize + 2 + Math.floor(seededHash(cx * 613 + cz * 271 + 5, worldSeed) * 4)
  const originY = proceduralTerrainHeightAt(originX, originZ, worldSeed) + 1
  if (originY <= 4) return
  const landmark = (dx: number, dy: number, dz: number, id: BlockId) => {
    const x = originX + dx
    const y = originY + dy
    const z = originZ + dz
    add(x, y, z, id)
    if (id === 'glow' || id === 'crystal') shardKeys.push(`${x},${y},${z}`)
  }

  if (roll < 0.11) {
    const blocks: Array<[number, number, number, BlockId]> = [
      [0, 0, 0, 'moss'], [1, 0, 0, 'stone'], [-1, 0, 0, 'moss'], [0, 0, 1, 'stone'],
      [0, 1, 0, 'brick'], [1, 1, 0, 'moss'], [0, 1, 1, 'brick'], [0, 2, 0, 'glow'],
      [-1, 0, 1, 'gravel'], [1, 0, 1, 'gravel'],
    ]
    blocks.forEach(([dx, dy, dz, id]) => landmark(dx, dy, dz, id))
    return
  }
  if (roll < 0.2) {
    const clusterSize = 4 + Math.floor(seededHash(cx * 149 + cz * 463 + 29, worldSeed) * 4)
    for (let i = 0; i < clusterSize; i += 1) {
      const dx = Math.floor(seededHash(cx * 101 + cz * 103 + i * 37, worldSeed) * 3) - 1
      const dz = Math.floor(seededHash(cx * 107 + cz * 109 + i * 41, worldSeed) * 3) - 1
      landmark(dx, i > 3 ? 1 : 0, dz, i === 0 ? 'glow' : 'crystal')
    }
    return
  }
  landmark(0, 0, 0, 'obsidian')
  landmark(0, 1, 0, 'stone')
  landmark(0, 2, 0, 'crystal')
  landmark(1, 0, 0, 'gravel')
  landmark(-1, 0, 0, 'gravel')
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
