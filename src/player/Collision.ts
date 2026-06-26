import * as THREE from 'three'

export type SolidBlockLookup = (x: number, y: number, z: number) => boolean

export type PlayerCollider = {
  radius: number
  height: number
}

export const DEFAULT_PLAYER_COLLIDER: PlayerCollider = {
  radius: 0.34,
  height: 1.72,
}

export function playerOverlapsBlockAt(position: THREE.Vector3, blockX: number, blockY: number, blockZ: number, collider = DEFAULT_PLAYER_COLLIDER) {
  const dx = Math.max(blockX - position.x, 0, position.x - (blockX + 1))
  const dz = Math.max(blockZ - position.z, 0, position.z - (blockZ + 1))
  const horizontalOverlap = dx * dx + dz * dz < collider.radius * collider.radius
  const verticalOverlap = position.y < blockY + 1 && position.y + collider.height > blockY
  return horizontalOverlap && verticalOverlap
}

export function playerCollidesAt(position: THREE.Vector3, lookup: SolidBlockLookup, collider = DEFAULT_PLAYER_COLLIDER) {
  const minX = Math.floor(position.x - collider.radius)
  const maxX = Math.floor(position.x + collider.radius)
  const minY = Math.floor(position.y)
  const maxY = Math.floor(position.y + collider.height)
  const minZ = Math.floor(position.z - collider.radius)
  const maxZ = Math.floor(position.z + collider.radius)

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        if (lookup(x, y, z) && playerOverlapsBlockAt(position, x, y, z, collider)) {
          return true
        }
      }
    }
  }

  return false
}

export function findFloorAt(position: THREE.Vector3, lookup: SolidBlockLookup, maxDrop = 8, collider = DEFAULT_PLAYER_COLLIDER) {
  const probe = position.clone()
  const startY = Math.floor(position.y)
  const minY = Math.floor(position.y - maxDrop)

  for (let y = startY; y >= minY; y -= 1) {
    probe.y = y + 1
    if (playerCollidesAt(probe, lookup, collider)) {
      continue
    }

    const belowY = y - 1
    if (hasSolidSupport(position.x, belowY, position.z, lookup, collider)) {
      return y
    }
  }

  return null
}

export function hasSolidSupport(x: number, y: number, z: number, lookup: SolidBlockLookup, collider = DEFAULT_PLAYER_COLLIDER) {
  const minX = Math.floor(x - collider.radius)
  const maxX = Math.floor(x + collider.radius)
  const minZ = Math.floor(z - collider.radius)
  const maxZ = Math.floor(z + collider.radius)

  for (let blockX = minX; blockX <= maxX; blockX += 1) {
    for (let blockZ = minZ; blockZ <= maxZ; blockZ += 1) {
      if (lookup(blockX, y, blockZ)) return true
    }
  }

  return false
}

export function moveWithAxisCollision(
  position: THREE.Vector3,
  delta: THREE.Vector3,
  lookup: SolidBlockLookup,
  collider = DEFAULT_PLAYER_COLLIDER,
) {
  const next = position.clone()

  next.x += delta.x
  if (playerCollidesAt(next, lookup, collider)) next.x = position.x

  next.y += delta.y
  if (playerCollidesAt(next, lookup, collider)) next.y = position.y

  next.z += delta.z
  if (playerCollidesAt(next, lookup, collider)) next.z = position.z

  return next
}
