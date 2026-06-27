const TERRAIN_NOISE_CACHE_LIMIT = 32768
const terrainNoiseCache = new Map<string, number>()

export function blockKey(x: number, y: number, z: number) {
  return x + ',' + y + ',' + z
}

export function terrainNoise(x: number, z: number) {
  const key = x + ',' + z
  const cached = terrainNoiseCache.get(key)
  if (cached !== undefined) return cached

  const value = Math.sin(x * 0.26) * 1.8 + Math.cos(z * 0.22) * 1.5 + Math.sin((x + z) * 0.12) * 1.25
  if (terrainNoiseCache.size >= TERRAIN_NOISE_CACHE_LIMIT) terrainNoiseCache.clear()
  terrainNoiseCache.set(key, value)
  return value
}

export function clearTerrainNoiseCache() {
  terrainNoiseCache.clear()
}

export function getTerrainNoiseCacheSize() {
  return terrainNoiseCache.size
}
