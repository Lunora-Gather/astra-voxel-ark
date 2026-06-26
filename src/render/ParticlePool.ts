import * as THREE from 'three'

export type ParticleState = {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  life: number
  maxLife: number
}

export type ParticleSpawnOptions = {
  position: THREE.Vector3
  velocity: THREE.Vector3
  life: number
  scale?: number
}

export class MeshParticlePool {
  private readonly available: ParticleState[] = []
  private readonly active: ParticleState[] = []

  constructor(
    private readonly scene: THREE.Scene,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    size: number,
  ) {
    for (let i = 0; i < size; i += 1) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.visible = false
      this.scene.add(mesh)
      this.available.push({ mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 1 })
    }
  }

  spawn(options: ParticleSpawnOptions): ParticleState | null {
    const particle = this.available.pop()
    if (!particle) return null

    particle.mesh.position.copy(options.position)
    particle.mesh.scale.setScalar(options.scale ?? 1)
    particle.mesh.visible = true
    setMeshOpacity(particle.mesh, 1)
    particle.velocity.copy(options.velocity)
    particle.life = options.life
    particle.maxLife = Math.max(options.life, 0.001)
    this.active.push(particle)
    return particle
  }

  update(deltaSeconds: number, gravity = -7.5) {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const particle = this.active[i]
      particle.life -= deltaSeconds

      if (particle.life <= 0) {
        this.releaseAt(i)
        continue
      }

      particle.velocity.y += gravity * deltaSeconds
      particle.mesh.position.addScaledVector(particle.velocity, deltaSeconds)
      particle.mesh.rotation.x += deltaSeconds * 3
      particle.mesh.rotation.y += deltaSeconds * 2.4
      setMeshOpacity(particle.mesh, Math.max(0, particle.life / particle.maxLife))
    }
  }

  dispose() {
    for (const particle of [...this.active, ...this.available]) {
      this.scene.remove(particle.mesh)
    }
    this.active.length = 0
    this.available.length = 0
  }

  get activeCount() {
    return this.active.length
  }

  private releaseAt(index: number) {
    const [particle] = this.active.splice(index, 1)
    particle.mesh.visible = false
    this.available.push(particle)
  }
}

function setMeshOpacity(mesh: THREE.Mesh, opacity: number) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const material of materials) {
    material.transparent = opacity < 1
    material.opacity = opacity
    material.needsUpdate = true
  }
}
