export type RuntimePressureLevel = 'normal' | 'strained' | 'critical'

export type RuntimePerformanceSample = {
  fps: number
  averageFrameMs: number
}

export type RuntimeWorkBudget = {
  meshBatchScale: number
  meshTimeScale: number
  terrainFrameCadence: number
  cosmeticScale: number
  pointLightScale: number
  viewDistancePenalty: number
  shadows: boolean
}

export type RuntimePerformanceTransition = {
  changed: boolean
  previous: RuntimePressureLevel
  current: RuntimePressureLevel
}

const BUDGETS: Record<RuntimePressureLevel, RuntimeWorkBudget> = {
  normal: {
    meshBatchScale: 1,
    meshTimeScale: 1,
    terrainFrameCadence: 1,
    cosmeticScale: 1,
    pointLightScale: 1,
    viewDistancePenalty: 0,
    shadows: true,
  },
  strained: {
    meshBatchScale: 0.6,
    meshTimeScale: 0.7,
    terrainFrameCadence: 2,
    cosmeticScale: 0.5,
    pointLightScale: 0.6,
    viewDistancePenalty: 0,
    shadows: true,
  },
  critical: {
    meshBatchScale: 0.25,
    meshTimeScale: 0.35,
    terrainFrameCadence: 4,
    cosmeticScale: 0,
    pointLightScale: 0.25,
    viewDistancePenalty: 1,
    shadows: false,
  },
}

export class RuntimePerformanceGuard {
  private level: RuntimePressureLevel = 'normal'
  private pressureSamples = 0
  private severeSamples = 0
  private recoverySamples = 0
  private targetFps: number

  constructor(targetFps: number) {
    this.targetFps = normalizeTargetFps(targetFps)
  }

  sample({ fps, averageFrameMs }: RuntimePerformanceSample): RuntimePerformanceTransition {
    const previous = this.level
    if (!Number.isFinite(fps) || fps <= 0 || !Number.isFinite(averageFrameMs) || averageFrameMs <= 0) {
      return { changed: false, previous, current: this.level }
    }

    const targetFrameMs = 1000 / this.targetFps
    const severe = fps < this.targetFps * 0.5 || averageFrameMs > targetFrameMs * 2
    const pressured = severe || fps < this.targetFps * 0.72 || averageFrameMs > targetFrameMs * 1.42
    const healthy = fps >= this.targetFps * 0.9 && averageFrameMs <= targetFrameMs * 1.12

    this.pressureSamples = pressured ? this.pressureSamples + 1 : Math.max(0, this.pressureSamples - 1)
    this.severeSamples = severe ? this.severeSamples + 1 : Math.max(0, this.severeSamples - 1)
    this.recoverySamples = healthy ? this.recoverySamples + 1 : 0

    if (this.level === 'normal' && (this.severeSamples >= 3 || this.pressureSamples >= 4)) {
      this.level = this.severeSamples >= 3 ? 'critical' : 'strained'
      this.recoverySamples = 0
    } else if (this.level === 'strained') {
      if (this.severeSamples >= 3 || this.pressureSamples >= 8) {
        this.level = 'critical'
        this.recoverySamples = 0
      } else if (this.recoverySamples >= 10) {
        this.level = 'normal'
        this.resetCounters()
      }
    } else if (this.level === 'critical' && this.recoverySamples >= 8) {
      this.level = 'strained'
      this.pressureSamples = 0
      this.severeSamples = 0
      this.recoverySamples = 0
    }

    return { changed: previous !== this.level, previous, current: this.level }
  }

  setTargetFps(targetFps: number) {
    const normalized = normalizeTargetFps(targetFps)
    if (normalized === this.targetFps) return
    this.targetFps = normalized
    this.level = 'normal'
    this.resetCounters()
  }

  reset() {
    this.level = 'normal'
    this.resetCounters()
  }

  get currentLevel() {
    return this.level
  }

  get budget() {
    return BUDGETS[this.level]
  }

  private resetCounters() {
    this.pressureSamples = 0
    this.severeSamples = 0
    this.recoverySamples = 0
  }
}

function normalizeTargetFps(value: number) {
  return Number.isFinite(value) ? Math.max(15, Math.min(120, value)) : 60
}
