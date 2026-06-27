import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const worldMath = readFileSync(resolve(process.cwd(), 'src/worldMath.ts'), 'utf8')

const terrainNoiseBody = worldMath.match(/export function terrainNoise\(x: number, z: number\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
const clearBody = worldMath.match(/export function clearTerrainNoiseCache\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
const sizeBody = worldMath.match(/export function getTerrainNoiseCacheSize\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''

const errors = []

if (!worldMath.includes('const terrainNoiseCache = new Map<number, Map<number, number>>()')) {
  errors.push('terrainNoiseCache should use a numeric nested Map instead of string keys')
}

if (!worldMath.includes('let terrainNoiseCacheSize = 0')) {
  errors.push('terrainNoiseCacheSize should track nested cache entries')
}

if (terrainNoiseBody.includes("x + ',' + z")) {
  errors.push('terrainNoise should not allocate x,z string keys')
}

if (!terrainNoiseBody.includes('const cachedRow = terrainNoiseCache.get(x)') || !terrainNoiseBody.includes('const cached = cachedRow?.get(z)')) {
  errors.push('terrainNoise should read cached values through x and z numeric map lookups')
}

if (!terrainNoiseBody.includes('terrainNoiseCacheSize++')) {
  errors.push('terrainNoise should increment cache size when a new sample is stored')
}

if (!clearBody.includes('terrainNoiseCache.clear()') || !clearBody.includes('terrainNoiseCacheSize = 0')) {
  errors.push('clearTerrainNoiseCache should clear cache rows and reset the tracked size')
}

if (!sizeBody.includes('return terrainNoiseCacheSize')) {
  errors.push('getTerrainNoiseCacheSize should return the tracked cache size')
}

if (errors.length > 0) {
  console.error('Runtime cache smoke failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Runtime cache smoke passed')
