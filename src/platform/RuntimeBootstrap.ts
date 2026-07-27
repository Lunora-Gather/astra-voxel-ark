import { SettingsStore } from '../game/settings'
import { detectRuntimeDeviceProfile, isConstrainedTier, type RuntimeTier } from '../performance/DeviceProfile'
import { resolveQualityRuntimeProfile } from '../performance/QualityRuntimeProfile'

export type ClientCapabilities = {
  isSmokeTest: boolean
  isTouchDevice: boolean
  hasTouchCapability: boolean
  prefersReducedMotion: boolean
  forcedRuntimeTier: RuntimeTier | null
}

export type ClientCapabilityInput = {
  hash: string
  width: number
  height: number
  coarsePointer: boolean
  maxTouchPoints: number
  userAgent: string
  reducedMotion: boolean
}

export function resolveClientCapabilities(input: ClientCapabilityInput): ClientCapabilities {
  const smokeParams = new URLSearchParams(input.hash.replace(/^#/, ''))
  const isSmokeTest = smokeParams.has('smoke')
  const smokeTouchParam = isSmokeTest ? smokeParams.get('touch') : null
  const smokeTouchMode = smokeTouchParam === '1'
  const smokeDesktopMode = smokeTouchParam === '0'
  const isSmallScreen = Math.min(input.width, input.height) <= 760
  const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(input.userAgent)
  const hasTouchCapability = input.coarsePointer || input.maxTouchPoints > 0
  const isTouchPrimaryDevice = input.coarsePointer && (isSmallScreen || isMobileUserAgent)
  const isTouchDevice = smokeTouchMode || (!smokeDesktopMode && isTouchPrimaryDevice)
  const requestedRuntimeTier = smokeParams.get('device-tier')
  const forcedRuntimeTier: RuntimeTier | null = isSmokeTest && (
    requestedRuntimeTier === 'ultra-low' || requestedRuntimeTier === 'low' ||
    requestedRuntimeTier === 'standard' || requestedRuntimeTier === 'high'
  ) ? requestedRuntimeTier : null

  return {
    isSmokeTest,
    isTouchDevice,
    hasTouchCapability,
    prefersReducedMotion: input.reducedMotion,
    forcedRuntimeTier,
  }
}

export function createRuntimeBootstrap(browserWindow: Window = window, browserNavigator: Navigator = navigator) {
  const capabilities = resolveClientCapabilities({
    hash: browserWindow.location.hash,
    width: browserWindow.innerWidth,
    height: browserWindow.innerHeight,
    coarsePointer: browserWindow.matchMedia('(pointer: coarse)').matches,
    maxTouchPoints: browserNavigator.maxTouchPoints,
    userAgent: browserNavigator.userAgent,
    reducedMotion: browserWindow.matchMedia('(prefers-reduced-motion: reduce)').matches,
  })
  const runtimeProfile = detectRuntimeDeviceProfile({
    touchPrimary: capabilities.isTouchDevice || capabilities.hasTouchCapability,
    reducedMotion: capabilities.prefersReducedMotion,
    forcedTier: capabilities.forcedRuntimeTier,
  })
  const runtimeLimits = runtimeProfile.limits
  const lowPowerMode = isConstrainedTier(runtimeProfile.tier)
  const settingsStore = new SettingsStore({
    maxViewDistance: runtimeLimits.maxViewDistance,
    defaults: {
      sensitivity: 72,
      fov: 72,
      viewDistance: 1,
      quality: 'balanced',
      showPerf: false,
      frameRate: runtimeLimits.targetFps === 30 ? 30 : 60,
      volume: 70,
      soundEnabled: true,
    },
  })
  const startupSettings = settingsStore.load()
  const startupGraphics = resolveQualityRuntimeProfile(startupSettings.quality, runtimeProfile.tier, runtimeLimits)

  return {
    ...capabilities,
    runtimeProfile,
    runtimeLimits,
    lowPowerMode,
    settingsStore,
    startupSettings,
    startupGraphics,
  }
}
