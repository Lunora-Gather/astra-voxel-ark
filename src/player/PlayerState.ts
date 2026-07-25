export type PlayerStateSnapshot = {
  position: [number, number, number]
  rotation: [number, number]
}

export type PlayerStateBounds = {
  maxHorizontal: number
  minY?: number
  maxY?: number
}

export function sanitizePlayerState(
  value: Partial<PlayerStateSnapshot> | undefined,
  fallback: PlayerStateSnapshot,
  bounds: PlayerStateBounds,
): PlayerStateSnapshot {
  const maxHorizontal = Math.max(1, Math.abs(bounds.maxHorizontal))
  const minY = bounds.minY ?? -64
  const maxY = bounds.maxY ?? 256
  const position = tuple(value?.position, 3)
  const rotation = tuple(value?.rotation, 2)

  const validPosition = position &&
    Math.abs(position[0]) <= maxHorizontal &&
    position[1] >= minY && position[1] <= maxY &&
    Math.abs(position[2]) <= maxHorizontal

  return {
    position: validPosition
      ? [position[0], position[1], position[2]]
      : [...fallback.position],
    rotation: rotation
      ? [clamp(rotation[0], -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01), wrapAngle(rotation[1])]
      : [...fallback.rotation],
  }
}

function tuple(value: unknown, length: number): number[] | null {
  if (!Array.isArray(value) || value.length !== length) return null
  return value.every((entry) => typeof entry === 'number' && Number.isFinite(entry)) ? value : null
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function wrapAngle(value: number) {
  return Math.atan2(Math.sin(value), Math.cos(value))
}
