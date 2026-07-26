import * as THREE from 'three'

export type ParticleState = {
  position: THREE.Vector3
  velocity: THREE.Vector3
  rotation: THREE.Euler
  color: THREE.Color
  life: number
  maxLife: number
  initialScale: number
}

export type ParticleSpawnOptions = {
  position: THREE.Vector3
  velocity: THREE.Vector3
  life: number
  scale?: number
  color?: THREE.ColorRepresentation
}

export class InstancedParticlePool {
  readonly mesh: THREE.InstancedMesh
  readonly capacity: number

  private readonly available: ParticleState[] = []
  private readonly active: ParticleState[] = []
  private readonly defaultColor: THREE.Color
  private readonly position = new THREE.Vector3()
  private readonly scale = new THREE.Vector3()
  private readonly quaternion = new THREE.Quaternion()
  private readonly matrix = new THREE.Matrix4()
  private colorsDirty = false

  constructor(
    private readonly scene: THREE.Scene,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    size: number,
    defaultColor: THREE.ColorRepresentation = 0xffffff,
  ) {
    this.capacity = boundedCapacity(size)
    this.defaultColor = new THREE.Color(defaultColor)
    this.mesh = new THREE.InstancedMesh(geometry, material, this.capacity)
    this.mesh.count = 0
    this.mesh.visible = false
    this.mesh.castShadow = false
    this.mesh.receiveShadow = false
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.scene.add(this.mesh)

    for (let index = 0; index < this.capacity; index += 1) {
      this.available.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        color: new THREE.Color(defaultColor),
        life: 0,
        maxLife: 1,
        initialScale: 1,
      })
    }
  }

  spawn(options: ParticleSpawnOptions): ParticleState | null {
    const particle = this.available.pop()
    if (!particle) return null

    particle.position.copy(options.position)
    particle.velocity.copy(options.velocity)
    particle.rotation.set(0, 0, 0)
    particle.color.copy(this.defaultColor)
    if (options.color !== undefined) particle.color.set(options.color)
    particle.life = finitePositive(options.life, 0.001)
    particle.maxLife = particle.life
    particle.initialScale = finitePositive(options.scale ?? 1, 1)
    this.active.push(particle)

    const index = this.active.length - 1
    this.writeMatrix(index, particle)
    this.mesh.setColorAt(index, particle.color)
    this.mesh.count = this.active.length
    this.mesh.visible = true
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
    return particle
  }

  update(deltaSeconds: number, gravity = -7.5) {
    const dt = finiteNonNegative(deltaSeconds)
    const acceleration = Number.isFinite(gravity) ? gravity : -7.5

    for (let index = this.active.length - 1; index >= 0; index -= 1) {
      const particle = this.active[index]
      particle.life -= dt
      if (particle.life <= 0) {
        this.releaseAt(index)
        continue
      }

      particle.velocity.y += acceleration * dt
      particle.position.addScaledVector(particle.velocity, dt)
      particle.rotation.x += dt * 3
      particle.rotation.y += dt * 2.4
    }

    for (let index = 0; index < this.active.length; index += 1) {
      this.writeMatrix(index, this.active[index])
      if (this.colorsDirty) this.mesh.setColorAt(index, this.active[index].color)
    }

    this.mesh.count = this.active.length
    this.mesh.visible = this.active.length > 0
    if (this.active.length > 0) this.mesh.instanceMatrix.needsUpdate = true
    if (this.colorsDirty && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
    this.colorsDirty = false
  }

  dispose() {
    this.scene.remove(this.mesh)
    this.active.length = 0
    this.available.length = 0
    this.mesh.count = 0
    this.mesh.visible = false
  }

  get activeCount() {
    return this.active.length
  }

  private writeMatrix(index: number, particle: ParticleState) {
    const lifeScale = particle.initialScale * Math.max(0.01, particle.life / particle.maxLife)
    this.position.copy(particle.position)
    this.scale.setScalar(lifeScale)
    this.quaternion.setFromEuler(particle.rotation)
    this.matrix.compose(this.position, this.quaternion, this.scale)
    this.mesh.setMatrixAt(index, this.matrix)
  }

  private releaseAt(index: number) {
    const lastIndex = this.active.length - 1
    const particle = this.active[index]
    if (index !== lastIndex) this.active[index] = this.active[lastIndex]
    this.active.pop()
    this.available.push(particle)
    this.colorsDirty = true
  }
}

function boundedCapacity(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(2048, Math.floor(value)))
}

function finitePositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}
