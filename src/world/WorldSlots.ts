export const LEGACY_WORLD_SAVE_KEY = 'astra-voxel-ark-world-v1'
export const ACTIVE_WORLD_SLOT_KEY = 'astra-voxel-ark-active-world-slot-v1'
export const WORLD_SLOT_IDS = ['1', '2', '3'] as const

export type WorldSlotId = typeof WORLD_SLOT_IDS[number]

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
