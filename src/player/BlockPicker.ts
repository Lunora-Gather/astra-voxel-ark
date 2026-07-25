import * as THREE from 'three'
import type { BlockId } from '../blocks'

export type PickedBlock = {
  x: number
  y: number
  z: number
  id: BlockId
  normal: THREE.Vector3
  distance: number
}

export type BlockLookup = (x: number, y: number, z: number) => BlockId | null

export type BlockPickerOptions = {
  maxDistance?: number
  minDistance?: number
}

const DEFAULT_MAX_DISTANCE = 8
const DEFAULT_MIN_DISTANCE = 0.05

/**
 * Exact voxel DDA picker for blocks centered on integer coordinates.
 * The returned object and normal are reused; consumers should copy them only when retaining a hit.
 */
export class VoxelBlockPicker {
  private readonly maxDistance: number
  private readonly minDistance: number
  private readonly origin = new THREE.Vector3()
  private readonly direction = new THREE.Vector3()
  private readonly hit: PickedBlock = {
    x: 0,
    y: 0,
    z: 0,
    id: 'grass',
    normal: new THREE.Vector3(),
    distance: 0,
  }

  constructor({ maxDistance = DEFAULT_MAX_DISTANCE, minDistance = DEFAULT_MIN_DISTANCE }: BlockPickerOptions = {}) {
    this.maxDistance = finiteNonNegative(maxDistance, DEFAULT_MAX_DISTANCE)
    this.minDistance = finiteNonNegative(minDistance, DEFAULT_MIN_DISTANCE)
  }

  pickFromCamera(camera: THREE.Camera, lookup: BlockLookup, origin?: THREE.Vector3) {
    if (origin) this.origin.copy(origin)
    else camera.getWorldPosition(this.origin)
    camera.getWorldDirection(this.direction)
    return this.pick(this.origin, this.direction, lookup)
  }

  pick(origin: THREE.Vector3, direction: THREE.Vector3, lookup: BlockLookup): PickedBlock | null {
    this.direction.copy(direction)
    if (this.direction.lengthSq() <= Number.EPSILON) return null
    this.direction.normalize()

    let x = Math.floor(origin.x + 0.5)
    let y = Math.floor(origin.y + 0.5)
    let z = Math.floor(origin.z + 0.5)
    const stepX = axisStep(this.direction.x)
    const stepY = axisStep(this.direction.y)
    const stepZ = axisStep(this.direction.z)
    const deltaX = axisDelta(this.direction.x)
    const deltaY = axisDelta(this.direction.y)
    const deltaZ = axisDelta(this.direction.z)
    let maxX = axisBoundaryDistance(origin.x, x, this.direction.x, stepX)
    let maxY = axisBoundaryDistance(origin.y, y, this.direction.y, stepY)
    let maxZ = axisBoundaryDistance(origin.z, z, this.direction.z, stepZ)
    let distance = 0
    let normalX = 0
    let normalY = 0
    let normalZ = 0

    while (distance <= this.maxDistance) {
      const id = lookup(x, y, z)
      if (id && distance > this.minDistance) {
        this.hit.x = x
        this.hit.y = y
        this.hit.z = z
        this.hit.id = id
        this.hit.distance = distance
        this.hit.normal.set(normalX, normalY, normalZ)
        return this.hit
      }

      if (maxX < maxY && maxX < maxZ) {
        x += stepX
        distance = maxX
        maxX += deltaX
        normalX = -stepX
        normalY = 0
        normalZ = 0
      } else if (maxY < maxZ) {
        y += stepY
        distance = maxY
        maxY += deltaY
        normalX = 0
        normalY = -stepY
        normalZ = 0
      } else {
        z += stepZ
        distance = maxZ
        maxZ += deltaZ
        normalX = 0
        normalY = 0
        normalZ = -stepZ
      }
    }

    return null
  }
}

export function pickBlockFromCamera(camera: THREE.Camera, lookup: BlockLookup, options: BlockPickerOptions = {}) {
  return new VoxelBlockPicker(options).pickFromCamera(camera, lookup)
}

export function pickBlock(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  lookup: BlockLookup,
  options: BlockPickerOptions = {},
) {
  return new VoxelBlockPicker(options).pick(origin, direction, lookup)
}

function axisStep(value: number) {
  return value > 0 ? 1 : value < 0 ? -1 : 0
}

function axisDelta(value: number) {
  return value === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / value)
}

function axisBoundaryDistance(origin: number, voxel: number, direction: number, step: number) {
  if (step === 0) return Number.POSITIVE_INFINITY
  const boundary = voxel + step * 0.5
  return (boundary - origin) / direction
}

function finiteNonNegative(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, value) : fallback
}
