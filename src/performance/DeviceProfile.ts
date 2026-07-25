export type RuntimeTier = 'ultra-low' | 'low' | 'standard' | 'high'

export type RuntimeDeviceProfile = {
  tier: RuntimeTier
  logicalCores: number
  deviceMemoryGb: number | null
  touchPrimary: boolean
  reducedMotion: boolean
  limits: RuntimeLimits
}

export type RuntimeLimits = {
  maxPixelRatio: number
  initialRenderScale: number
  minRenderScale: number
  maxRenderScale: number
  targetFps: number
  maxViewDistance: number
  terrainWorkerConcurrency: number
  residentChunkPadding: number
  evictionBatchSize: number
  meshBudgetMs: number
  meshBatchSize: number
  particlePoolSize: number
  activePointLights: number
  grassAnimationBudget: number
}

type NavigatorWithMemory = Navigator & { deviceMemory?: number }

const LIMITS: Record<RuntimeTier, RuntimeLimits> = {
  'ultra-low': {
    maxPixelRatio: 0.85,
    initialRenderScale: 0.72,
    minRenderScale: 0.5,
    maxRenderScale: 0.82,
    targetFps: 30,
    maxViewDistance: 1,
    terrainWorkerConcurrency: 1,
    residentChunkPadding: 1,
    evictionBatchSize: 2,
    meshBudgetMs: 1.2,
    meshBatchSize: 2,
    particlePoolSize: 36,
    activePointLights: 2,
    grassAnimationBudget: 24,
  },
  low: {
    maxPixelRatio: 1,
    initialRenderScale: 0.8,
    minRenderScale: 0.58,
    maxRenderScale: 0.92,
    targetFps: 30,
    maxViewDistance: 1,
    terrainWorkerConcurrency: 1,
    residentChunkPadding: 1,
    evictionBatchSize: 2,
    meshBudgetMs: 1.8,
    meshBatchSize: 4,
    particlePoolSize: 64,
    activePointLights: 4,
    grassAnimationBudget: 48,
  },
  standard: {
    maxPixelRatio: 1.35,
    initialRenderScale: 0.92,
    minRenderScale: 0.68,
    maxRenderScale: 1,
    targetFps: 60,
    maxViewDistance: 3,
    terrainWorkerConcurrency: 2,
    residentChunkPadding: 2,
    evictionBatchSize: 3,
    meshBudgetMs: 3,
    meshBatchSize: 8,
    particlePoolSize: 112,
    activePointLights: 16,
    grassAnimationBudget: 110,
  },
  high: {
    maxPixelRatio: 1.5,
    initialRenderScale: 1,
    minRenderScale: 0.76,
    maxRenderScale: 1,
    targetFps: 60,
    maxViewDistance: 3,
    terrainWorkerConcurrency: 3,
    residentChunkPadding: 2,
    evictionBatchSize: 4,
    meshBudgetMs: 4,
    meshBatchSize: 12,
    particlePoolSize: 160,
    activePointLights: 24,
    grassAnimationBudget: 160,
  },
}

export function detectRuntimeDeviceProfile({
  touchPrimary,
  reducedMotion,
  smallestViewport = Math.min(window.innerWidth, window.innerHeight),
  forcedTier,
}: {
  touchPrimary: boolean
  reducedMotion: boolean
  smallestViewport?: number
  forcedTier?: RuntimeTier | null
}): RuntimeDeviceProfile {
  const logicalCores = Math.max(1, navigator.hardwareConcurrency || 2)
  const memory = (navigator as NavigatorWithMemory).deviceMemory
  const deviceMemoryGb = typeof memory === 'number' && Number.isFinite(memory) ? memory : null
  const ultraLow = logicalCores <= 2 || (deviceMemoryGb !== null && deviceMemoryGb <= 2) || (touchPrimary && smallestViewport <= 480)
  const low = touchPrimary || reducedMotion || logicalCores <= 4 || (deviceMemoryGb !== null && deviceMemoryGb <= 4) || smallestViewport <= 760
  const high = !touchPrimary && logicalCores >= 8 && (deviceMemoryGb === null || deviceMemoryGb >= 8)
  const tier: RuntimeTier = forcedTier ?? (ultraLow ? 'ultra-low' : low ? 'low' : high ? 'high' : 'standard')

  return {
    tier,
    logicalCores,
    deviceMemoryGb,
    touchPrimary,
    reducedMotion,
    limits: { ...LIMITS[tier] },
  }
}

export function isConstrainedTier(tier: RuntimeTier) {
  return tier === 'ultra-low' || tier === 'low'
}
