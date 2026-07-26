export const PLAYER_SPAWN = { x: 0, y: 12, z: 18 } as const
export const PLAYER_SPAWN_ROTATION = { pitch: -0.16, yaw: 0 } as const
export const ARK_CORE_POSITION = { x: 0, y: 7.6, z: 10 } as const

const SAFE_PATH_MIN_Z = 7
const SAFE_PATH_MAX_Z = 22
const SAFE_PATH_RADIUS = 5

/**
 * Keeps the Ark, the initial view and the short route between them free from
 * generated structures. Padding accounts for wide decorations such as trees.
 */
export function isSpawnAreaProtected(x: number, z: number, padding = 0) {
  const closestZ = Math.max(SAFE_PATH_MIN_Z, Math.min(SAFE_PATH_MAX_Z, z))
  const radius = SAFE_PATH_RADIUS + Math.max(0, padding)
  const dx = x - PLAYER_SPAWN.x
  const dz = z - closestZ
  return dx * dx + dz * dz <= radius * radius
}
