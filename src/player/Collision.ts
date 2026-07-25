import * as THREE from 'three'

export type SolidBlockLookup = (x: number, y: number, z: number) => boolean

export type EyePlayerCollider = {
  radius: number
  bodyHeightBelowEye: number
  headClearance: number
  eyeHeight: number
  stepHeight: number
}

export type PlayerCollisionResolverOptions = {
  lookup: SolidBlockLookup
  collider?: Partial<EyePlayerCollider>
  floorMinY?: number
  floorMaxY?: number
}

export const DEFAULT_EYE_PLAYER_COLLIDER: EyePlayerCollider = {
  radius: 0.38,
  bodyHeightBelowEye: 1.35,
  headClearance: 0.12,
  eyeHeight: 1.85,
  stepHeight: 1.05,
}

/** Collision resolver for unit blocks centered on integer coordinates and an eye-point player position. */
export class PlayerCollisionResolver {
  readonly collider: EyePlayerCollider
  private readonly lookup: SolidBlockLookup
  private readonly floorMinY: number
  private readonly floorMaxY: number
  private readonly stepProbe = new THREE.Vector3()
  private readonly xProbe = new THREE.Vector3()
  private readonly zProbe = new THREE.Vector3()
  private readonly verticalProbe = new THREE.Vector3()
  private readonly horizontalResult = { movedX: false, movedZ: false, stepped: false }
  private readonly verticalResult = { moved: false, collided: false, grounded: false }

  constructor({
    lookup,
    collider = {},
    floorMinY = -2,
    floorMaxY = 18,
  }: PlayerCollisionResolverOptions) {
    this.lookup = lookup
    this.collider = { ...DEFAULT_EYE_PLAYER_COLLIDER, ...collider }
    this.floorMinY = Math.floor(Math.min(floorMinY, floorMaxY))
    this.floorMaxY = Math.ceil(Math.max(floorMinY, floorMaxY))
  }

  overlapsBlockAt(position: THREE.Vector3, x: number, y: number, z: number, clearance = 0) {
    const collider = this.collider
    const playerBottom = position.y - collider.bodyHeightBelowEye - clearance
    const playerTop = position.y + collider.headClearance + clearance
    const overlapsXZ =
      Math.abs(position.x - x) < collider.radius + 0.5 + clearance &&
      Math.abs(position.z - z) < collider.radius + 0.5 + clearance
    const overlapsY = playerBottom < y + 0.5 && playerTop > y - 0.5
    return overlapsXZ && overlapsY
  }

  collidesAt(position: THREE.Vector3, clearance = 0) {
    const collider = this.collider
    const minX = Math.floor(position.x - collider.radius - 0.5 - clearance)
    const maxX = Math.ceil(position.x + collider.radius + 0.5 + clearance)
    const minY = Math.floor(position.y - collider.bodyHeightBelowEye - 0.5 - clearance)
    const maxY = Math.ceil(position.y + collider.headClearance + 0.5 + clearance)
    const minZ = Math.floor(position.z - collider.radius - 0.5 - clearance)
    const maxZ = Math.ceil(position.z + collider.radius + 0.5 + clearance)

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          if (this.lookup(x, y, z) && this.overlapsBlockAt(position, x, y, z, clearance)) return true
        }
      }
    }
    return false
  }

  findFloorAt(x: number, z: number, maxEyeY = Number.POSITIVE_INFINITY) {
    const collider = this.collider
    const minX = Math.floor(x - collider.radius)
    const maxX = Math.ceil(x + collider.radius)
    const minZ = Math.floor(z - collider.radius)
    const maxZ = Math.ceil(z + collider.radius)
    const highestAllowedBlockY = Number.isFinite(maxEyeY)
      ? Math.floor(maxEyeY + 0.05 - collider.eyeHeight)
      : this.floorMaxY
    const startY = Math.min(this.floorMaxY, highestAllowedBlockY)

    for (let y = startY; y >= this.floorMinY; y -= 1) {
      for (let blockX = minX; blockX <= maxX; blockX += 1) {
        for (let blockZ = minZ; blockZ <= maxZ; blockZ += 1) {
          const overlapsFootprint =
            Math.abs(x - blockX) < collider.radius + 0.5 &&
            Math.abs(z - blockZ) < collider.radius + 0.5
          if (!overlapsFootprint) continue
          if (this.lookup(blockX, y, blockZ)) return y + collider.eyeHeight
        }
      }
    }
    return collider.eyeHeight
  }

  moveHorizontal(position: THREE.Vector3, delta: THREE.Vector3, canStep: boolean) {
    const result = this.horizontalResult
    result.movedX = false
    result.movedZ = false
    result.stepped = false
    if (delta.x === 0 && delta.z === 0) return result

    const xTarget = position.x + delta.x
    this.xProbe.set(xTarget, position.y, position.z)
    if (!this.collidesAt(this.xProbe)) {
      position.x = xTarget
      result.movedX = true
    } else if (canStep && this.tryStepTo(position, xTarget, position.z)) {
      result.movedX = true
      result.stepped = true
    }

    const zTarget = position.z + delta.z
    this.zProbe.set(position.x, position.y, zTarget)
    if (!this.collidesAt(this.zProbe)) {
      position.z = zTarget
      result.movedZ = true
    } else if (canStep && this.tryStepTo(position, position.x, zTarget)) {
      result.movedZ = true
      result.stepped = true
    }
    return result
  }

  moveVertical(position: THREE.Vector3, deltaY: number) {
    const result = this.verticalResult
    result.moved = false
    result.collided = false
    result.grounded = false
    if (deltaY === 0) return result

    const startY = position.y
    this.verticalProbe.set(position.x, startY + deltaY, position.z)
    if (!this.collidesAt(this.verticalProbe)) {
      position.y = startY + deltaY
      result.moved = true
      return result
    }

    let open = 0
    let blocked = 1
    for (let index = 0; index < 8; index += 1) {
      const mid = (open + blocked) / 2
      this.verticalProbe.set(position.x, startY + deltaY * mid, position.z)
      if (this.collidesAt(this.verticalProbe)) blocked = mid
      else open = mid
    }
    position.y = startY + deltaY * open
    result.moved = open > 0
    result.collided = true
    result.grounded = deltaY < 0
    return result
  }

  private tryStepTo(position: THREE.Vector3, x: number, z: number) {
    const stepHeight = this.collider.stepHeight
    this.stepProbe.set(x, position.y + stepHeight, z)
    if (this.collidesAt(this.stepProbe)) return false
    const steppedFloor = this.findFloorAt(x, z, position.y + stepHeight)
    if (steppedFloor <= position.y + stepHeight + 0.05 && steppedFloor > position.y + 0.05) {
      position.set(x, steppedFloor, z)
      return true
    }
    return false
  }
}
