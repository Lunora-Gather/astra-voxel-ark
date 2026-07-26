import type { QualityPreset } from '../game/performance'
import type { RuntimeLimits, RuntimeTier } from './DeviceProfile'

export type QualityRenderBounds = {
  min: number
  max: number
  start: number
}

export type QualityRuntimeProfile = {
  render: QualityRenderBounds
  antialias: boolean
  powerPreference: 'low-power' | 'high-performance'
  precision: 'mediump' | 'highp'
}

/**
 * Resolves the immutable WebGL startup options and the adaptive render-scale
 * band from the persisted quality choice before the first frame is allocated.
 */
export function resolveQualityRuntimeProfile(
  preset: QualityPreset,
  tier: RuntimeTier,
  limits: RuntimeLimits,
): QualityRuntimeProfile {
  const render = resolveRenderBounds(preset, limits)
  const constrainedTier = tier === 'ultra-low' || tier === 'low'
  const lowCostPreset = preset === 'eco' || preset === 'low'

  return {
    render,
    antialias: !lowCostPreset && (tier === 'standard' || tier === 'high'),
    powerPreference: preset === 'eco' || constrainedTier ? 'low-power' : 'high-performance',
    precision: preset === 'eco' || tier === 'ultra-low' ? 'mediump' : 'highp',
  }
}

function resolveRenderBounds(preset: QualityPreset, limits: RuntimeLimits): QualityRenderBounds {
  if (preset === 'eco') {
    const min = Math.min(0.5, limits.maxRenderScale)
    const max = Math.max(min, Math.min(0.6, limits.maxRenderScale))
    return { min, max, start: clamp(0.56, min, max) }
  }

  if (preset === 'low') {
    const min = Math.min(limits.minRenderScale, limits.maxRenderScale, 0.68)
    const max = Math.max(min, Math.min(limits.maxRenderScale, 0.72))
    return { min, max, start: clamp(Math.min(limits.initialRenderScale, 0.68), min, max) }
  }

  if (preset === 'high') {
    const max = limits.maxRenderScale
    const min = Math.min(max, Math.max(limits.minRenderScale, 0.76))
    return { min, max, start: max }
  }

  const min = Math.min(limits.minRenderScale, limits.maxRenderScale)
  const max = Math.max(min, limits.maxRenderScale)
  return { min, max, start: clamp(limits.initialRenderScale, min, max) }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
