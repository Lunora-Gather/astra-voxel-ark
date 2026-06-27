const TERRAIN_NOISE_CACHE_LIMIT = 32768
const terrainNoiseCache = new Map<number, Map<number, number>>()
let terrainNoiseCacheSize = 0

export function blockKey(x: number, y: number, z: number) {
  return x + ',' + y + ',' + z
}

export function terrainNoise(x: number, z: number) {
  const cachedRow = terrainNoiseCache.get(x)
  const cached = cachedRow?.get(z)
  if (cached !== undefined) return cached

  const value = Math.sin(x * 0.26) * 1.8 + Math.cos(z * 0.22) * 1.5 + Math.sin((x + z) * 0.12) * 1.25
  if (terrainNoiseCacheSize >= TERRAIN_NOISE_CACHE_LIMIT) clearTerrainNoiseCache()
  let row = terrainNoiseCache.get(x)
  if (!row) {
    row = new Map<number, number>()
    terrainNoiseCache.set(x, row)
  }
  row.set(z, value)
  terrainNoiseCacheSize++
  return value
}

export function clearTerrainNoiseCache() {
  terrainNoiseCache.clear()
  terrainNoiseCacheSize = 0
}

export function getTerrainNoiseCacheSize() {
  return terrainNoiseCacheSize
}
