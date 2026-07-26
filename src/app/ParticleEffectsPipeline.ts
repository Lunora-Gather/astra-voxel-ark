import * as THREE from 'three'
import { BLOCKS, type BlockId } from '../blocks'
import { InstancedParticlePool } from '../render/ParticlePool'

export type ParticleEffectsPipelineOptions = {
  scene: THREE.Scene
  enabled?: boolean
  poolSize: number
  lowPowerMode?: boolean
}

export type ParticleBurstOptions = {
  position: THREE.Vector3
  blockId: BlockId
  count?: number
}

const BLOCK_COLOR_MAP = new Map<BlockId, number>(BLOCKS.map((block) => [block.id, block.color]))

export class ParticleEffectsPipeline {
  private readonly enabled: boolean
  private readonly lowPowerMode: boolean
  private readonly geometry: THREE.BoxGeometry | null = null
  private readonly shardGeometry: THREE.IcosahedronGeometry | null = null
  private readonly blockMaterial: THREE.MeshStandardMaterial | null = null
  private readonly shardMaterial: THREE.MeshStandardMaterial | null = null
  private readonly blockPool: InstancedParticlePool | null = null
  private readonly shardPool: InstancedParticlePool | null = null
  private readonly tempOffset = new THREE.Vector3()
  private readonly tempPosition = new THREE.Vector3()
  private readonly tempVelocity = new THREE.Vector3()

  constructor({ scene, enabled = true, poolSize, lowPowerMode = false }: ParticleEffectsPipelineOptions) {
    this.enabled = enabled
    this.lowPowerMode = lowPowerMode

    if (!this.enabled) return

    const geometry = new THREE.BoxGeometry(0.12, 0.12, 0.12)
    const shardGeometry = new THREE.IcosahedronGeometry(0.08, 0)
    this.geometry = geometry
    this.shardGeometry = shardGeometry
    this.blockMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
    this.shardMaterial = new THREE.MeshStandardMaterial({
      color: 0xb9fff0,
      emissive: 0x4fffe1,
      emissiveIntensity: 0.6,
      roughness: 0.35,
    })
    const shardPoolSize = Math.max(8, Math.min(24, Math.floor(poolSize / 6)))
    const perBlockPoolSize = Math.max(2, Math.floor(poolSize / BLOCKS.length))
    this.blockPool = new InstancedParticlePool(
      scene,
      geometry,
      this.blockMaterial,
      perBlockPoolSize * BLOCKS.length,
    )
    this.shardPool = new InstancedParticlePool(
      scene,
      shardGeometry,
      this.shardMaterial,
      shardPoolSize,
    )
  }

  createBreakBurst({ position, blockId, count }: ParticleBurstOptions) {
    if (!this.enabled) return 0
    const pool = this.blockPool
    if (!pool) return 0

    const particleCount = count ?? (this.lowPowerMode ? 3 : 6)
    let spawned = 0

    for (let i = 0; i < particleCount; i += 1) {
      this.tempOffset.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4)
      this.tempPosition.copy(position).add(this.tempOffset)
      this.tempVelocity.set((Math.random() - 0.5) * 5.5, 1.5 + Math.random() * 3.5, (Math.random() - 0.5) * 5.5)
      const particle = pool.spawn({
        position: this.tempPosition,
        velocity: this.tempVelocity,
        life: this.lowPowerMode ? 0.5 : 0.8,
        color: BLOCK_COLOR_MAP.get(blockId) ?? 0xffffff,
      })
      if (particle) spawned += 1
    }

    return spawned
  }

  createShardBurst(position: THREE.Vector3, count = this.lowPowerMode ? 8 : 16) {
    if (!this.enabled || !this.shardPool) return 0
    let spawned = 0

    for (let i = 0; i < count; i += 1) {
      this.tempOffset.set((Math.random() - 0.5) * 0.7, (Math.random() - 0.2) * 0.7, (Math.random() - 0.5) * 0.7)
      this.tempPosition.copy(position).add(this.tempOffset)
      this.tempVelocity.set((Math.random() - 0.5) * 7, 2.8 + Math.random() * 4.5, (Math.random() - 0.5) * 7)
      const particle = this.shardPool.spawn({
        position: this.tempPosition,
        velocity: this.tempVelocity,
        life: this.lowPowerMode ? 0.55 : 0.9,
        scale: 1.4 + Math.random() * 1.8,
      })
      if (particle) spawned += 1
    }

    return spawned
  }

  update(deltaSeconds: number) {
    if (!this.enabled) return
    this.shardPool?.update(deltaSeconds)
    this.blockPool?.update(deltaSeconds)
  }

  dispose() {
    this.shardPool?.dispose()
    this.blockPool?.dispose()
    this.geometry?.dispose()
    this.shardGeometry?.dispose()
    this.blockMaterial?.dispose()
    this.shardMaterial?.dispose()
  }

  get activeCount() {
    let total = this.shardPool?.activeCount ?? 0
    total += this.blockPool?.activeCount ?? 0
    return total
  }
}
