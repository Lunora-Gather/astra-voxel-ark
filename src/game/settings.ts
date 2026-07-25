import type { QualityPreset } from './performance'

export type GameSettings = {
  sensitivity: number
  fov: number
  viewDistance: number
  quality: QualityPreset
  showPerf: boolean
  frameRate: 30 | 60
  volume: number
  soundEnabled: boolean
}

type LegacyStoredSettings = Partial<GameSettings> & {
  mouseLookSpeed?: number
  qualityPreset?: QualityPreset
  showPerformanceHud?: boolean
}

export type SettingsStoreOptions = {
  key?: string
  storage?: Storage
  defaults?: Partial<GameSettings>
  maxViewDistance?: number
}

export type SettingsWriteResult = { ok: true } | { ok: false; error: unknown }

export const SETTINGS_KEY = 'astra-voxel-ark-settings-v1'

export const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 72,
  fov: 72,
  viewDistance: 2,
  quality: 'balanced',
  showPerf: false,
  frameRate: 60,
  volume: 70,
  soundEnabled: true,
}

export class SettingsStore {
  readonly key: string
  private readonly storage: Storage
  private readonly defaults: GameSettings
  private readonly maxViewDistance: number

  constructor({
    key = SETTINGS_KEY,
    storage,
    defaults = DEFAULT_SETTINGS,
    maxViewDistance = 3,
  }: SettingsStoreOptions = {}) {
    this.key = key
    this.storage = storage ?? getDefaultStorage()
    this.maxViewDistance = clampInteger(maxViewDistance, 1, 12, 3)
    this.defaults = sanitizeSettings(defaults, { defaults: DEFAULT_SETTINGS, maxViewDistance: this.maxViewDistance })
  }

  load() {
    try {
      const raw = this.storage.getItem(this.key)
      if (!raw) return { ...this.defaults }
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...this.defaults }
      return this.sanitize(parsed as LegacyStoredSettings)
    } catch {
      return { ...this.defaults }
    }
  }

  save(settings: Partial<GameSettings>): SettingsWriteResult {
    try {
      this.storage.setItem(this.key, JSON.stringify(this.sanitize(settings)))
      return { ok: true }
    } catch (error) {
      return { ok: false, error }
    }
  }

  sanitize(settings: LegacyStoredSettings) {
    return sanitizeSettings(settings, { defaults: this.defaults, maxViewDistance: this.maxViewDistance })
  }
}

export function loadSettings(storage?: Storage) {
  return new SettingsStore({ storage }).load()
}

export function saveSettings(settings: Partial<GameSettings>, storage?: Storage) {
  return new SettingsStore({ storage }).save(settings)
}

export function sanitizeSettings(
  settings: LegacyStoredSettings,
  {
    defaults = DEFAULT_SETTINGS,
    maxViewDistance = 3,
  }: { defaults?: GameSettings; maxViewDistance?: number } = {},
): GameSettings {
  const legacyMouseLookSpeed = finiteNumber(settings.mouseLookSpeed)
  const legacySensitivity = legacyMouseLookSpeed !== null
    ? legacyMouseLookSpeed * 100
    : undefined
  const quality = settings.quality ?? settings.qualityPreset
  const showPerf = typeof settings.showPerf === 'boolean'
    ? settings.showPerf
    : settings.showPerformanceHud

  return {
    sensitivity: clampNumber(settings.sensitivity ?? legacySensitivity, 35, 150, defaults.sensitivity),
    fov: clampNumber(settings.fov, 60, 90, defaults.fov),
    viewDistance: clampInteger(settings.viewDistance, 1, maxViewDistance, defaults.viewDistance),
    quality: quality === 'low' || quality === 'balanced' || quality === 'high' ? quality : defaults.quality,
    showPerf: typeof showPerf === 'boolean' ? showPerf : defaults.showPerf,
    frameRate: settings.frameRate === 30 || settings.frameRate === 60 ? settings.frameRate : defaults.frameRate,
    volume: clampNumber(settings.volume, 0, 100, defaults.volume),
    soundEnabled: typeof settings.soundEnabled === 'boolean' ? settings.soundEnabled : defaults.soundEnabled,
  }
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = finiteNumber(value)
  return numberValue === null ? fallback : Math.min(max, Math.max(min, numberValue))
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  return Math.round(clampNumber(value, min, max, fallback))
}

function getDefaultStorage(): Storage {
  try {
    return window.localStorage
  } catch {
    return UNAVAILABLE_STORAGE
  }
}

const UNAVAILABLE_STORAGE: Storage = {
  get length() { return 0 },
  clear() { throw new Error('Local storage unavailable') },
  getItem() { throw new Error('Local storage unavailable') },
  key() { return null },
  removeItem() { throw new Error('Local storage unavailable') },
  setItem() { throw new Error('Local storage unavailable') },
}
