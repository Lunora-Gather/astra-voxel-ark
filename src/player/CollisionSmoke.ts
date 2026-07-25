import * as THREE from 'three'
import { PlayerCollisionResolver } from './Collision'

export function assertCollisionSmoke() {
  const solids = new Set<string>()
  for (let x = -2; x <= 3; x += 1) {
    for (let z = -2; z <= 2; z += 1) solids.add(`${x},0,${z}`)
  }
  solids.add('1,1,0')
  const collision = new PlayerCollisionResolver({ lookup: (x, y, z) => solids.has(`${x},${y},${z}`) })

  const floor = collision.findFloorAt(0, 0, 12)
  if (floor !== 1.85) throw new Error(`Collision smoke failed: expected floor 1.85, got ${floor}`)

  const standing = new THREE.Vector3(0, floor, 0)
  if (collision.collidesAt(standing)) throw new Error('Collision smoke failed: standing player should not intersect the floor')
  if (!collision.overlapsBlockAt(new THREE.Vector3(0, 1, 0), 0, 0, 0)) {
    throw new Error('Collision smoke failed: centered block overlap was not detected')
  }

  const blocked = standing.clone()
  const blockedMove = collision.moveHorizontal(blocked, new THREE.Vector3(0.2, 0, 0), false)
  if (blockedMove.movedX || blocked.x !== 0) throw new Error('Collision smoke failed: horizontal wall should block movement')

  const stepped = standing.clone()
  const stepMove = collision.moveHorizontal(stepped, new THREE.Vector3(0.2, 0, 0), true)
  if (!stepMove.stepped || stepped.y !== 2.85) throw new Error('Collision smoke failed: one-block step should be climbed')

  const falling = new THREE.Vector3(-1, 3.2, 0)
  const vertical = collision.moveVertical(falling, -2)
  if (!vertical.collided || !vertical.grounded || Math.abs(falling.y - floor) > 0.01) {
    throw new Error('Collision smoke failed: falling player should resolve onto the floor')
  }

  return true
}
