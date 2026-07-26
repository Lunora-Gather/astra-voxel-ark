import * as THREE from 'three'

const PUFFS_PER_CLOUD = 4

export type SkyDecorationOptions = {
  scene: THREE.Scene
  cloudCount: number
  sparkleCount: number
}

export class SkyDecorationSystem {
  readonly cloudCount: number
  readonly sparkleCount: number
  readonly clouds: THREE.InstancedMesh
  readonly sparkles: THREE.InstancedMesh

  private readonly cloudGeometry = new THREE.SphereGeometry(1, 16, 8)
  private readonly cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 1 })
  private readonly sparkleGeometry = new THREE.IcosahedronGeometry(0.055, 0)
  private readonly sparkleMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.82 })
  private readonly cloudX: Float32Array
  private readonly cloudY: Float32Array
  private readonly cloudZ: Float32Array
  private readonly puffOffsetX: Float32Array
  private readonly puffOffsetY: Float32Array
  private readonly puffOffsetZ: Float32Array
  private readonly puffScaleX: Float32Array
  private readonly puffScaleY: Float32Array
  private readonly puffScaleZ: Float32Array
  private readonly sparkleX: Float32Array
  private readonly sparkleY: Float32Array
  private readonly sparkleZ: Float32Array
  private readonly sparkleSeed: Float32Array
  private readonly sparkleRotation: Float32Array
  private readonly position = new THREE.Vector3()
  private readonly scale = new THREE.Vector3()
  private readonly rotation = new THREE.Euler()
  private readonly quaternion = new THREE.Quaternion()
  private readonly matrix = new THREE.Matrix4()
  private cloudCursor = 0
  private sparkleCursor = 0

  constructor(private readonly options: SkyDecorationOptions) {
    this.cloudCount = boundedCount(options.cloudCount, 32)
    this.sparkleCount = boundedCount(options.sparkleCount, 256)
    const puffCount = this.cloudCount * PUFFS_PER_CLOUD
    this.clouds = new THREE.InstancedMesh(this.cloudGeometry, this.cloudMaterial, Math.max(1, puffCount))
    this.clouds.count = puffCount
    this.clouds.castShadow = false
    this.clouds.receiveShadow = false
    this.clouds.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.cloudX = new Float32Array(this.cloudCount)
    this.cloudY = new Float32Array(this.cloudCount)
    this.cloudZ = new Float32Array(this.cloudCount)
    this.puffOffsetX = new Float32Array(puffCount)
    this.puffOffsetY = new Float32Array(puffCount)
    this.puffOffsetZ = new Float32Array(puffCount)
    this.puffScaleX = new Float32Array(puffCount)
    this.puffScaleY = new Float32Array(puffCount)
    this.puffScaleZ = new Float32Array(puffCount)

    for (let cloud = 0; cloud < this.cloudCount; cloud++) {
      this.cloudX[cloud] = (Math.random() - 0.5) * 95
      this.cloudY[cloud] = 18 + Math.random() * 16
      this.cloudZ[cloud] = (Math.random() - 0.5) * 95
      for (let puff = 0; puff < PUFFS_PER_CLOUD; puff++) {
        const index = cloud * PUFFS_PER_CLOUD + puff
        this.puffOffsetX[index] = (puff - 1.5) * 1.3
        this.puffOffsetY[index] = Math.sin(puff) * 0.35
        this.puffOffsetZ[index] = (Math.random() - 0.5) * 1.2
        this.puffScaleX[index] = 2.5 + Math.random() * 2.2
        this.puffScaleY[index] = 0.42 + Math.random() * 0.25
        this.puffScaleZ[index] = 1 + Math.random() * 0.9
      }
      this.writeCloud(cloud)
    }
    this.clouds.instanceMatrix.needsUpdate = true
    if (puffCount > 0) {
      this.clouds.computeBoundingBox()
      this.clouds.computeBoundingSphere()
    }

    this.sparkles = new THREE.InstancedMesh(this.sparkleGeometry, this.sparkleMaterial, Math.max(1, this.sparkleCount))
    this.sparkles.count = this.sparkleCount
    this.sparkles.castShadow = false
    this.sparkles.receiveShadow = false
    this.sparkles.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.sparkleX = new Float32Array(this.sparkleCount)
    this.sparkleY = new Float32Array(this.sparkleCount)
    this.sparkleZ = new Float32Array(this.sparkleCount)
    this.sparkleSeed = new Float32Array(this.sparkleCount)
    this.sparkleRotation = new Float32Array(this.sparkleCount)
    for (let index = 0; index < this.sparkleCount; index++) {
      this.sparkleX[index] = (Math.random() - 0.5) * 62
      this.sparkleY[index] = 5 + Math.random() * 18
      this.sparkleZ[index] = (Math.random() - 0.5) * 62
      this.sparkleSeed[index] = Math.random() * Math.PI * 2
      this.writeSparkle(index)
    }
    this.sparkles.instanceMatrix.needsUpdate = true
    if (this.sparkleCount > 0) {
      this.sparkles.computeBoundingBox()
      this.sparkles.computeBoundingSphere()
    } else {
      this.sparkles.visible = false
    }

    options.scene.add(this.clouds, this.sparkles)
  }

  update(deltaSeconds: number, elapsedTime: number, cloudBudget: number, sparkleBudget: number, reduceCosmetics: boolean) {
    const dt = finiteNonNegative(deltaSeconds)
    if (!reduceCosmetics) this.clouds.rotation.y += dt * 0.006

    const cloudUpdates = Math.min(this.cloudCount, boundedCount(cloudBudget, this.cloudCount))
    for (let update = 0; update < cloudUpdates; update++) {
      const cloud = this.cloudCursor
      this.cloudX[cloud] += Math.sin(elapsedTime * 0.08 + cloud) * dt * 0.03
      this.writeCloud(cloud)
      this.cloudCursor = (cloud + 1) % Math.max(1, this.cloudCount)
    }
    if (cloudUpdates > 0) this.clouds.instanceMatrix.needsUpdate = true

    const sparkleUpdates = Math.min(this.sparkleCount, boundedCount(sparkleBudget, this.sparkleCount))
    for (let update = 0; update < sparkleUpdates; update++) {
      const sparkle = this.sparkleCursor
      this.sparkleY[sparkle] += Math.sin(elapsedTime * 1.4 + this.sparkleSeed[sparkle]) * dt * 0.08
      this.sparkleRotation[sparkle] += dt * 1.2
      this.writeSparkle(sparkle)
      this.sparkleCursor = (sparkle + 1) % Math.max(1, this.sparkleCount)
    }
    if (sparkleUpdates > 0) this.sparkles.instanceMatrix.needsUpdate = true
  }

  dispose() {
    this.options.scene.remove(this.clouds, this.sparkles)
    this.cloudGeometry.dispose()
    this.cloudMaterial.dispose()
    this.sparkleGeometry.dispose()
    this.sparkleMaterial.dispose()
  }

  private writeCloud(cloud: number) {
    for (let puff = 0; puff < PUFFS_PER_CLOUD; puff++) {
      const index = cloud * PUFFS_PER_CLOUD + puff
      this.position.set(
        this.cloudX[cloud] + this.puffOffsetX[index],
        this.cloudY[cloud] + this.puffOffsetY[index],
        this.cloudZ[cloud] + this.puffOffsetZ[index],
      )
      this.scale.set(this.puffScaleX[index], this.puffScaleY[index], this.puffScaleZ[index])
      this.matrix.compose(this.position, this.quaternion.identity(), this.scale)
      this.clouds.setMatrixAt(index, this.matrix)
    }
  }

  private writeSparkle(index: number) {
    this.position.set(this.sparkleX[index], this.sparkleY[index], this.sparkleZ[index])
    this.rotation.set(0, this.sparkleRotation[index], 0)
    this.quaternion.setFromEuler(this.rotation)
    this.scale.set(1, 1, 1)
    this.matrix.compose(this.position, this.quaternion, this.scale)
    this.sparkles.setMatrixAt(index, this.matrix)
  }
}

function boundedCount(value: number, max: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}
