export const LEGACY_WORLD_SAVE_KEY = 'astra-voxel-ark-world-v1'
export const ACTIVE_WORLD_SLOT_KEY = 'astra-voxel-ark-active-world-slot-v1'
export const WORLD_SLOT_NAMES_KEY = 'astra-voxel-ark-world-slot-names-v1'
export const WORLD_SLOT_IDS = ['1', '2', '3'] as const
export const WORLD_SLOT_NAME_MAX_LENGTH = 32

export type WorldSlotId = typeof WORLD_SLOT_IDS[number]
export type WorldSlotNames = Record<WorldSlotId, string>
export type WorldSlotNameWriteResult =
  | { ok: true; names: WorldSlotNames }
  | { ok: false; error: unknown; names: WorldSlotNames }

export function sanitizeWorldSlotId(value: unknown): WorldSlotId {
  return typeof value === 'string' && WORLD_SLOT_IDS.includes(value as WorldSlotId)
    ? value as WorldSlotId
    : '1'
}

/** Slot 1 intentionally retains the original key so existing worlds migrate in place. */
export function getWorldSlotSaveKey(slot: WorldSlotId) {
  return slot === '1' ? LEGACY_WORLD_SAVE_KEY : `${LEGACY_WORLD_SAVE_KEY}-slot-${slot}`
}

export function getWorldSlotLabel(slot: WorldSlotId) {
  return `Expedition ${slot}`
}

export function getDefaultWorldSlotNames(): WorldSlotNames {
  return Object.fromEntries(WORLD_SLOT_IDS.map((slot) => [slot, getWorldSlotLabel(slot)])) as WorldSlotNames
}

export function sanitizeWorldSlotName(value: unknown, slot: WorldSlotId) {
  if (typeof value !== 'string') return getWorldSlotLabel(slot)
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return getWorldSlotLabel(slot)
  return Array.from(normalized).slice(0, WORLD_SLOT_NAME_MAX_LENGTH).join('')
}

export function getWorldExportSlug(name: string, slot: WorldSlotId) {
  const safeName = sanitizeWorldSlotName(name, slot)
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
  return Array.from(safeName).slice(0, 40).join('') || `expedition-${slot}`
}

export class WorldSlotNameStore {
  readonly key: string
  private readonly storage: Storage

  constructor({ key = WORLD_SLOT_NAMES_KEY, storage }: { key?: string; storage?: Storage } = {}) {
    this.key = key
    this.storage = storage ?? getDefaultStorage()
  }

  load(): WorldSlotNames {
    const defaults = getDefaultWorldSlotNames()
    try {
      const raw = this.storage.getItem(this.key)
      if (!raw) return defaults
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults
      return Object.fromEntries(WORLD_SLOT_IDS.map((slot) => [
        slot,
        sanitizeWorldSlotName((parsed as Record<string, unknown>)[slot], slot),
      ])) as WorldSlotNames
    } catch {
      return defaults
    }
  }

  saveName(slot: WorldSlotId, value: unknown): WorldSlotNameWriteResult {
    const names = this.load()
    names[slot] = sanitizeWorldSlotName(value, slot)
    try {
      this.storage.setItem(this.key, JSON.stringify(names))
      return { ok: true, names }
    } catch (error) {
      return { ok: false, error, names: this.load() }
    }
  }
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
