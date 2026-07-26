import * as THREE from 'three'
import { SkyDecorationSystem } from './SkyDecorationSystem'

export function assertSkyDecorationSystemSmoke() {
  const scene = new THREE.Scene()
  const decorations = new SkyDecorationSystem({ scene, cloudCount: 3, sparkleCount: 7 })
  if (
    scene.children.length !== 2 ||
    !(decorations.clouds instanceof THREE.InstancedMesh) ||
    !(decorations.sparkles instanceof THREE.InstancedMesh) ||
    decorations.clouds.count !== 12 ||
    decorations.sparkles.count !== 7
  ) {
    throw new Error('Sky decoration smoke failed: clouds and sparkles should use two instanced draws')
  }
  const cloudBuffer = decorations.clouds.instanceMatrix
  const sparkleBuffer = decorations.sparkles.instanceMatrix
  const cloudVersion = cloudBuffer.version
  const sparkleVersion = sparkleBuffer.version
  decorations.update(1 / 60, 10, 2, 4, false)
  if (cloudBuffer.version <= cloudVersion || sparkleBuffer.version <= sparkleVersion) {
    throw new Error('Sky decoration smoke failed: budgeted animation should update instance buffers')
  }
  decorations.dispose()
  if (scene.children.some((child) => child === decorations.clouds || child === decorations.sparkles)) {
    throw new Error('Sky decoration smoke failed: disposal should remove both draw objects')
  }
  return true
}
