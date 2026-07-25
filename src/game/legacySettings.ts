import { loadSettings, saveSettings, sanitizeSettings, type GameSettings } from './settings'

/** @deprecated The live UI now uses GameSettings directly. */
export type LegacyGameSettings = Pick<GameSettings, 'sensitivity' | 'fov' | 'viewDistance' | 'quality' | 'showPerf'>

/** @deprecated Use SettingsStore.load(). */
export function loadLegacySettings(): LegacyGameSettings {
  return toLegacySettings(loadSettings())
}

/** @deprecated Use SettingsStore.save(). */
export function saveLegacySettings(settings: LegacyGameSettings) {
  return saveSettings({ ...loadSettings(), ...settings })
}

export function toLegacySettings(settings: GameSettings): LegacyGameSettings {
  const { sensitivity, fov, viewDistance, quality, showPerf } = settings
  return { sensitivity, fov, viewDistance, quality, showPerf }
}

export function fromLegacySettings(settings: LegacyGameSettings): GameSettings {
  return sanitizeSettings(settings)
}
