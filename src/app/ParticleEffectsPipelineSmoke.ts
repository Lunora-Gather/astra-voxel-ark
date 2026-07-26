import * as THREE from 'three'
import { ParticleEffectsPipeline } from './ParticleEffectsPipeline'

export function assertParticleEffectsPipelineSmoke() {
  const scene = new THREE.Scene()
  const particles = new ParticleEffectsPipeline({
    scene,
    poolSize: 36,
  })

  if (
    scene.children.length !== 2 ||
    !scene.children.every((child) => child instanceof THREE.InstancedMesh)
  ) {
    throw new Error('Particle pipeline smoke failed: all effects should use two instanced draw objects')
  }

  const origin = new THREE.Vector3(1, 2, 3)
  const breakCount = particles.createBreakBurst({ position: origin, blockId: 'stone', count: 6 })
  const shardCount = particles.createShardBurst(origin, 16)
  if (breakCount !== 6 || shardCount !== 8 || particles.activeCount !== 14) {
    throw new Error('Particle pipeline smoke failed: bursts should respect their shared bounded capacities')
  }

  particles.update(2)
  if (Number(particles.activeCount) !== 0 || scene.children.some((child) => child.visible)) {
    throw new Error('Particle pipeline smoke failed: expired instances should stop drawing')
  }

  particles.dispose()
  if (scene.children.some((child) => child instanceof THREE.InstancedMesh)) {
    throw new Error('Particle pipeline smoke failed: disposal should remove both draw objects')
  }
  return true
}
