import { detectRuntimeDeviceProfile } from './DeviceProfile'
import { resolveQualityRuntimeProfile } from './QualityRuntimeProfile'

export function assertQualityRuntimeProfileSmoke() {
  const highLimits = detectRuntimeDeviceProfile({
    touchPrimary: false,
    reducedMotion: false,
    forcedTier: 'high',
  }).limits
  const eco = resolveQualityRuntimeProfile('eco', 'high', highLimits)
  if (eco.antialias || eco.powerPreference !== 'low-power' || eco.precision !== 'mediump') {
    throw new Error('Quality runtime profile smoke failed: Eco should request the cheapest immutable WebGL options')
  }
  if (eco.render.min !== 0.5 || eco.render.max !== 0.6 || eco.render.start !== 0.56) {
    throw new Error('Quality runtime profile smoke failed: Eco render bounds should be deterministic')
  }

  const low = resolveQualityRuntimeProfile('low', 'high', highLimits)
  if (low.antialias || low.render.min > low.render.start || low.render.start > low.render.max) {
    throw new Error('Quality runtime profile smoke failed: Low should disable MSAA and keep valid render bounds')
  }
  if (low.render.start !== 0.68 || low.render.max !== 0.72) {
    throw new Error('Quality runtime profile smoke failed: Low should remain meaningfully cheaper on high-tier devices')
  }

  const high = resolveQualityRuntimeProfile('high', 'high', highLimits)
  if (!high.antialias || high.powerPreference !== 'high-performance' || high.precision !== 'highp') {
    throw new Error('Quality runtime profile smoke failed: High should preserve the full renderer path')
  }

  const ultraLimits = detectRuntimeDeviceProfile({
    touchPrimary: true,
    reducedMotion: true,
    forcedTier: 'ultra-low',
  }).limits
  const balancedUltra = resolveQualityRuntimeProfile('balanced', 'ultra-low', ultraLimits)
  if (balancedUltra.antialias || balancedUltra.powerPreference !== 'low-power' || balancedUltra.precision !== 'mediump') {
    throw new Error('Quality runtime profile smoke failed: constrained tiers should retain safe renderer options')
  }

  if (eco.terrainStyle !== 'merged-flat' || eco.allowShadows) {
    throw new Error('Quality runtime profile smoke failed: Eco should keep the merged flat terrain path everywhere')
  }
  if (high.terrainStyle !== 'textured-standard' || !high.allowShadows || high.shadowMapSize !== 1024) {
    throw new Error('Quality runtime profile smoke failed: High on high-tier devices should keep the full terrain path')
  }
  if (balancedUltra.terrainStyle !== 'merged-flat' || balancedUltra.allowShadows) {
    throw new Error('Quality runtime profile smoke failed: ultra-low balanced should stay on the merged flat path')
  }

  const lowLimits = detectRuntimeDeviceProfile({
    touchPrimary: false,
    reducedMotion: false,
    forcedTier: 'low',
  }).limits
  const balancedLow = resolveQualityRuntimeProfile('balanced', 'low', lowLimits)
  if (balancedLow.terrainStyle !== 'textured-lambert' || balancedLow.allowShadows) {
    throw new Error('Quality runtime profile smoke failed: low-tier balanced should unlock textured Lambert terrain without shadows')
  }
  const highLow = resolveQualityRuntimeProfile('high', 'low', lowLimits)
  if (highLow.terrainStyle !== 'textured-lambert' || !highLow.allowShadows || highLow.shadowMapSize !== 512) {
    throw new Error('Quality runtime profile smoke failed: low-tier High should unlock compact shadows')
  }
  if (lowLimits.maxViewDistance < 3) {
    throw new Error('Quality runtime profile smoke failed: low tier should allow the full view-distance choice')
  }
  const highUltra = resolveQualityRuntimeProfile('high', 'ultra-low', ultraLimits)
  if (highUltra.terrainStyle !== 'textured-lambert' || highUltra.allowShadows) {
    throw new Error('Quality runtime profile smoke failed: ultra-low High should unlock textures but never shadows')
  }
}
