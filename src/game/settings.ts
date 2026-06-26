import type { QualityPreset } from './performance'

export type GameSettings = {
  mouseLookSpeed: number
  touchLookSpeed: number
  fov: number
  viewDistance: number
  qualityPreset: QualityPreset
  showPerformanceHud: boolean
}

export const SETTINGS_KEY = 'astra-voxel-ark-settings-v1'

export const DEFAULT_SETTINGS: GameSettings = {
  mouseLookSpeed: 0.72,
  touchLookSpeed: 0.00245,
  fov: 72,
  viewDistance: 2,
  qualityPreset: 'balanced',
  showPerformanceHud: false,
}

export function loadSettings(storage: Storage = window.localStorage): GameSettings {
  try {
    const raw = storage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<GameSettings>
    return sanitizeSettings(parsed)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: GameSettings, storage: Storage = window.localStorage) {
  storage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings)))
}

export function sanitizeSettings(settings: Partial<GameSettings>): GameSettings {
  return {
    mouseLookSpeed: clampNumber(settings.mouseLookSpeed, 0.35, 1.5, DEFAULT_SETTINGS.mouseLookSpeed),
    touchLookSpeed: clampNumber(settings.touchLookSpeed, 0.0015, 0.006, DEFAULT_SETTINGS.touchLookSpeed),
    fov: clampNumber(settings.fov, 60, 90, DEFAULT_SETTINGS.fov),
    viewDistance: clampInteger(settings.viewDistance, 1, 3, DEFAULT_SETTINGS.viewDistance),
    qualityPreset: sanitizeQualityPreset(settings.qualityPreset),
    showPerformanceHud: Boolean(settings.showPerformanceHud),
  }
}

function sanitizeQualityPreset(value: unknown): QualityPreset {
  return value === 'low' || value === 'balanced' || value === 'high' ? value : DEFAULT_SETTINGS.qualityPreset
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = clampNumber(value, min, max, fallback)
  return Math.round(numberValue)
}
