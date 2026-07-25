import * as THREE from 'three'
import type { BlockId } from '../blocks'
import { VoxelBlockPicker } from './BlockPicker'

export function assertBlockPickerSmoke() {
  const blocks = new Map<string, BlockId>([
    ['3,0,0', 'stone'],
    ['0,2,0', 'crystal'],
    ['-2,0,-2', 'wood'],
    ['9,0,0', 'gold'],
  ])
  const lookup = (x: number, y: number, z: number) => blocks.get(`${x},${y},${z}`) ?? null
  const picker = new VoxelBlockPicker({ maxDistance: 8 })
  const origin = new THREE.Vector3()

  const positiveX = picker.pick(origin, new THREE.Vector3(1, 0, 0), lookup)
  if (!positiveX || positiveX.id !== 'stone' || positiveX.x !== 3 || positiveX.distance !== 2.5 || !positiveX.normal.equals(new THREE.Vector3(-1, 0, 0))) {
    throw new Error('Block picker smoke failed: positive X hit or normal is incorrect')
  }

  const positiveY = picker.pick(origin, new THREE.Vector3(0, 1, 0), lookup)
  if (!positiveY || positiveY.id !== 'crystal' || positiveY.y !== 2 || positiveY.distance !== 1.5 || !positiveY.normal.equals(new THREE.Vector3(0, -1, 0))) {
    throw new Error('Block picker smoke failed: positive Y hit or normal is incorrect')
  }

  const diagonal = picker.pick(origin, new THREE.Vector3(-1, 0, -1), lookup)
  if (!diagonal || diagonal.id !== 'wood' || diagonal.x !== -2 || diagonal.z !== -2 || diagonal.distance > 3) {
    throw new Error('Block picker smoke failed: diagonal hit is incorrect')
  }

  const outOfRange = picker.pick(origin, new THREE.Vector3(1, 0, 0), (x, y, z) => (
    x === 9 && y === 0 && z === 0 ? 'gold' : null
  ))
  if (outOfRange) throw new Error('Block picker smoke failed: max distance was not enforced')

  const reusedHit = picker.pick(origin, new THREE.Vector3(1, 0, 0), lookup)
  const reusedAgain = picker.pick(origin, new THREE.Vector3(0, 1, 0), lookup)
  if (!reusedHit || reusedHit !== reusedAgain) throw new Error('Block picker smoke failed: hot-path result should be reused')

  return true
}
