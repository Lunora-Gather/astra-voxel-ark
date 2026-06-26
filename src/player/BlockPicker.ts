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
  step?: number
}

const DEFAULT_MAX_DISTANCE = 8
const DEFAULT_STEP = 0.08

export function pickBlockFromCamera(camera: THREE.Camera, lookup: BlockLookup, options: BlockPickerOptions = {}): PickedBlock | null {
  const origin = new THREE.Vector3()
  const direction = new THREE.Vector3()
  camera.getWorldPosition(origin)
  camera.getWorldDirection(direction).normalize()
  return pickBlock(origin, direction, lookup, options)
}

export function pickBlock(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  lookup: BlockLookup,
  { maxDistance = DEFAULT_MAX_DISTANCE, step = DEFAULT_STEP }: BlockPickerOptions = {},
): PickedBlock | null {
  const normalizedDirection = direction.clone().normalize()
  const probe = new THREE.Vector3()
  const previous = new THREE.Vector3(Math.floor(origin.x), Math.floor(origin.y), Math.floor(origin.z))

  for (let distance = 0; distance <= maxDistance; distance += step) {
    probe.copy(origin).addScaledVector(normalizedDirection, distance)
    const x = Math.floor(probe.x)
    const y = Math.floor(probe.y)
    const z = Math.floor(probe.z)
    const id = lookup(x, y, z)

    if (id) {
      return {
        x,
        y,
        z,
        id,
        normal: resolveNormal(x, y, z, previous),
        distance,
      }
    }

    previous.set(x, y, z)
  }

  return null
}

function resolveNormal(x: number, y: number, z: number, previous: THREE.Vector3) {
  const normal = new THREE.Vector3()
  if (previous.x < x) normal.set(-1, 0, 0)
  else if (previous.x > x) normal.set(1, 0, 0)
  else if (previous.y < y) normal.set(0, -1, 0)
  else if (previous.y > y) normal.set(0, 1, 0)
  else if (previous.z < z) normal.set(0, 0, -1)
  else if (previous.z > z) normal.set(0, 0, 1)
  else normal.set(0, 1, 0)
  return normal
}
