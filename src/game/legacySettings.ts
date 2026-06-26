import { loadSettings, saveSettings, sanitizeSettings, type GameSettings } from './settings'

export type LegacyGameSettings = {
  sensitivity: number
  fov: number
  viewDistance: number
  quality: GameSettings['qualityPreset']
  showPerf: boolean
}

export function loadLegacySettings(): LegacyGameSettings {
  return toLegacySettings(loadSettings())
}

export function saveLegacySettings(settings: LegacyGameSettings) {
  saveSettings(fromLegacySettings(settings))
}

export function toLegacySettings(settings: GameSettings): LegacyGameSettings {
  return {
    sensitivity: Math.round(settings.mouseLookSpeed * 100),
    fov: settings.fov,
    viewDistance: settings.viewDistance,
    quality: settings.qualityPreset,
    showPerf: settings.showPerformanceHud,
  }
}

export function fromLegacySettings(settings: LegacyGameSettings): GameSettings {
  return sanitizeSettings({
    mouseLookSpeed: settings.sensitivity / 100,
    touchLookSpeed: (settings.sensitivity / 100) * 0.0034,
    fov: settings.fov,
    viewDistance: settings.viewDistance,
    qualityPreset: settings.quality,
    showPerformanceHud: settings.showPerf,
  })
}
