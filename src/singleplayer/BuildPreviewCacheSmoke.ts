import { BuildPreviewCache, createBuildPreviewSignature } from './BuildPreviewCache'

export function assertBuildPreviewCacheSmoke() {
  const cache = new BuildPreviewCache()
  const signature = createBuildPreviewSignature()
  signature.hitX = 4
  signature.hitY = 3
  signature.hitZ = -2
  signature.normalY = 1
  signature.hitBlock = 'stone'
  signature.selectedBlock = 'wood'
  signature.pattern = 'wall'
  signature.facingAxis = 1
  signature.worldVersion = 12
  signature.inventoryCount = 8
  signature.playerX = 4.5
  signature.playerY = 5
  signature.playerZ = 1.5

  if (!cache.shouldRefresh(signature) || cache.shouldRefresh(signature)) {
    throw new Error('Build preview cache smoke failed: unchanged previews should reuse their GPU state')
  }
  signature.inventoryCount--
  if (!cache.shouldRefresh(signature) || cache.shouldRefresh(signature)) {
    throw new Error('Build preview cache smoke failed: inventory changes should invalidate placement state')
  }
  signature.playerX += 0.1
  if (!cache.shouldRefresh(signature)) {
    throw new Error('Build preview cache smoke failed: player movement should recheck placement collision')
  }
  signature.facingAxis = -1
  if (!cache.shouldRefresh(signature)) {
    throw new Error('Build preview cache smoke failed: wall orientation changes should rebuild transforms')
  }
  signature.worldVersion++
  if (!cache.shouldRefresh(signature)) {
    throw new Error('Build preview cache smoke failed: world mutations should revalidate occupied cells')
  }
  cache.clear()
  if (!cache.shouldRefresh(signature)) {
    throw new Error('Build preview cache smoke failed: hidden previews should refresh when reacquired')
  }
  return true
}
