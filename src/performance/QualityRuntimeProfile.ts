import type { QualityPreset } from '../game/performance'
import type { RuntimeLimits, RuntimeTier } from './DeviceProfile'

export type QualityRenderBounds = {
  min: number
  max: number
  start: number
}

/**
 * How chunk terrain is materialized:
 * - 'merged-flat': one vertex-colored Lambert mesh per chunk (cheapest, no textures)
 * - 'textured-lambert': per-material textured meshes with per-vertex lighting
 * - 'textured-standard': full PBR materials
 */
export type TerrainRenderStyle = 'merged-flat' | 'textured-lambert' | 'textured-standard'

export type QualityRuntimeProfile = {
  render: QualityRenderBounds
  antialias: boolean
  powerPreference: 'low-power' | 'high-performance'
  precision: 'mediump' | 'highp'
  terrainStyle: TerrainRenderStyle
  allowShadows: boolean
  shadowMapSize: number
}

/**
 * Resolves the immutable WebGL startup options and the adaptive render-scale
 * band from the persisted quality choice before the first frame is allocated.
 * The device tier picks safe defaults and rails; the preset decides the look,
 * so constrained hardware can still opt into richer terrain.
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
    terrainStyle: resolveTerrainStyle(preset, tier),
    allowShadows: resolveShadowPolicy(preset, tier),
    shadowMapSize: constrainedTier ? 512 : 1024,
  }
}

function resolveTerrainStyle(preset: QualityPreset, tier: RuntimeTier): TerrainRenderStyle {
  if (preset === 'eco') return 'merged-flat'
  if (tier === 'ultra-low') return preset === 'high' ? 'textured-lambert' : 'merged-flat'
  if (tier === 'low') return preset === 'low' ? 'merged-flat' : 'textured-lambert'
  return preset === 'low' ? 'textured-lambert' : 'textured-standard'
}

function resolveShadowPolicy(preset: QualityPreset, tier: RuntimeTier) {
  if (preset === 'eco' || preset === 'low' || tier === 'ultra-low') return false
  if (tier === 'low') return preset === 'high'
  return true
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
