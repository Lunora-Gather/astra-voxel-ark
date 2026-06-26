export type DeviceProfile = 'low-power' | 'standard'
export type QualityPreset = 'low' | 'balanced' | 'high'

export type PerformanceLimits = {
  initialTerrainLoadRadius: number
  maxTerrainLoadRadius: number
  terrainChunksPerFrame: number
  terrainScanIntervalSeconds: number
  grassAnimationBudget: number
  glowPointLights: number
  maxPixelRatio: number
  particlePoolSize: number
}

export const STANDARD_PERFORMANCE_LIMITS: PerformanceLimits = {
  initialTerrainLoadRadius: 1,
  maxTerrainLoadRadius: 6,
  terrainChunksPerFrame: 1,
  terrainScanIntervalSeconds: 0.2,
  grassAnimationBudget: 320,
  glowPointLights: 24,
  maxPixelRatio: 1.5,
  particlePoolSize: 220,
}

export const LOW_POWER_PERFORMANCE_LIMITS: PerformanceLimits = {
  initialTerrainLoadRadius: 1,
  maxTerrainLoadRadius: 4,
  terrainChunksPerFrame: 1,
  terrainScanIntervalSeconds: 0.32,
  grassAnimationBudget: 90,
  glowPointLights: 0,
  maxPixelRatio: 1.1,
  particlePoolSize: 90,
}

export function getDeviceProfile(isLowPowerMode: boolean): DeviceProfile {
  return isLowPowerMode ? 'low-power' : 'standard'
}

export function getPerformanceLimits(isLowPowerMode: boolean): PerformanceLimits {
  return isLowPowerMode ? LOW_POWER_PERFORMANCE_LIMITS : STANDARD_PERFORMANCE_LIMITS
}

export function getQualityPixelRatioScale(preset: QualityPreset): number {
  if (preset === 'low') return 0.75
  if (preset === 'high') return 1
  return 0.9
}

export function shouldDecreaseQuality(fps: number, averageFrameMs: number): boolean {
  return fps < 38 || averageFrameMs > 28
}

export function shouldIncreaseQuality(fps: number, averageFrameMs: number): boolean {
  return fps >= 56 && averageFrameMs < 18
}
