import type { BlockId } from '../blocks'
import { terrainNoise } from '../worldMath'

export type TerrainBlock = {
  x: number
  y: number
  z: number
  id: BlockId
}

export type TerrainChunk = {
  cx: number
  cz: number
  blocks: TerrainBlock[]
}

export type TerrainGeneratorOptions = {
  chunkSize: number
  waterLevel?: number
  islandFalloff?: number
  heightOffset?: number
}

export const DEFAULT_TERRAIN_OPTIONS: TerrainGeneratorOptions = {
  chunkSize: 16,
  waterLevel: 2,
  islandFalloff: 0.012,
  heightOffset: 5.2,
}

export function terrainHeightAt(x: number, z: number, options: TerrainGeneratorOptions = DEFAULT_TERRAIN_OPTIONS) {
  const distance = Math.sqrt(x * x + z * z)
  const falloff = options.islandFalloff ?? DEFAULT_TERRAIN_OPTIONS.islandFalloff!
  const heightOffset = options.heightOffset ?? DEFAULT_TERRAIN_OPTIONS.heightOffset!
  return Math.max(1, Math.floor(terrainNoise(x, z) + heightOffset - distance * falloff))
}

export function generateTerrainChunk(cx: number, cz: number, options: TerrainGeneratorOptions): TerrainChunk {
  const blocks: TerrainBlock[] = []
  const chunkSize = options.chunkSize
  const waterLevel = options.waterLevel ?? DEFAULT_TERRAIN_OPTIONS.waterLevel!
  const startX = cx * chunkSize
  const startZ = cz * chunkSize

  for (let dx = 0; dx < chunkSize; dx += 1) {
    for (let dz = 0; dz < chunkSize; dz += 1) {
      const x = startX + dx
      const z = startZ + dz
      const height = terrainHeightAt(x, z, options)

      for (let y = 0; y <= height; y += 1) {
        blocks.push({ x, y, z, id: terrainBlockIdAt(y, height) })
      }

      for (let y = height + 1; y <= waterLevel; y += 1) {
        blocks.push({ x, y, z, id: 'water' })
      }
    }
  }

  return { cx, cz, blocks }
}

export function terrainBlockIdAt(y: number, surfaceHeight: number): BlockId {
  if (y === surfaceHeight) return 'grass'
  if (y >= surfaceHeight - 2) return 'dirt'
  return 'stone'
}

export function hashNoise(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function isTerrainChunkInBounds(cx: number, cz: number, maxRadius: number) {
  return Math.hypot(cx, cz) <= maxRadius
}
