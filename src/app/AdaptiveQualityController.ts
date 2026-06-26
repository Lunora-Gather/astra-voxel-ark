import { shouldDecreaseQuality, shouldIncreaseQuality, type QualityPreset } from '../game'
import type { PerformanceSample } from './PerformanceSampler'

export type AdaptiveQualityDecision = {
  action: 'hold' | 'decrease' | 'increase'
  currentPreset: QualityPreset
  nextPreset: QualityPreset
  averageFps: number
  averageFrameMs: number
  minFps: number
  reason: string
}

export type AdaptiveQualityControllerOptions = {
  initialPreset: QualityPreset
  cooldownFrames?: number
}

const PRESET_ORDER: QualityPreset[] = ['low', 'balanced', 'high']

export class AdaptiveQualityController {
  private preset: QualityPreset
  private cooldownRemaining = 0
  private readonly cooldownFrames: number

  constructor({ initialPreset, cooldownFrames = 120 }: AdaptiveQualityControllerOptions) {
    this.preset = initialPreset
    this.cooldownFrames = cooldownFrames
  }

  evaluate(sample: PerformanceSample): AdaptiveQualityDecision {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining -= 1
      return this.decision('hold', this.preset, sample, 'cooldown')
    }

    if (shouldDecreaseQuality(sample.averageFps, sample.averageFrameMs)) {
      const next = stepPreset(this.preset, -1)
      if (next !== this.preset) {
        const previous = this.preset
        this.preset = next
        this.cooldownRemaining = this.cooldownFrames
        return this.decision('decrease', previous, sample, 'average FPS/frame time below target')
      }
    }

    if (shouldIncreaseQuality(sample.averageFps, sample.averageFrameMs)) {
      const next = stepPreset(this.preset, 1)
      if (next !== this.preset) {
        const previous = this.preset
        this.preset = next
        this.cooldownRemaining = this.cooldownFrames
        return this.decision('increase', previous, sample, 'average FPS/frame time above recovery target')
      }
    }

    return this.decision('hold', this.preset, sample, 'within target range')
  }

  setPreset(preset: QualityPreset) {
    this.preset = preset
    this.cooldownRemaining = this.cooldownFrames
  }

  get currentPreset() {
    return this.preset
  }

  private decision(action: AdaptiveQualityDecision['action'], previousPreset: QualityPreset, sample: PerformanceSample, reason: string): AdaptiveQualityDecision {
    return {
      action,
      currentPreset: previousPreset,
      nextPreset: this.preset,
      averageFps: sample.averageFps,
      averageFrameMs: sample.averageFrameMs,
      minFps: sample.minFps,
      reason,
    }
  }
}

function stepPreset(preset: QualityPreset, direction: -1 | 1) {
  const currentIndex = PRESET_ORDER.indexOf(preset)
  const nextIndex = Math.max(0, Math.min(PRESET_ORDER.length - 1, currentIndex + direction))
  return PRESET_ORDER[nextIndex]
}
