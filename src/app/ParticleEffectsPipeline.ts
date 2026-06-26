import * as THREE from 'three'
import { BLOCKS, type BlockId } from '../blocks'
import { MeshParticlePool } from '../render'
import type { OptimizationFeatureFlags } from './FeatureFlags'

export type ParticleEffectsPipelineOptions = {
  scene: THREE.Scene
  flags: OptimizationFeatureFlags
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
  private readonly blockPools = new Map<BlockId, MeshParticlePool>()
  private readonly shardPool: MeshParticlePool | null = null
  private readonly tempOffset = new THREE.Vector3()

  constructor({ scene, flags, poolSize, lowPowerMode = false }: ParticleEffectsPipelineOptions) {
    this.enabled = flags.particlePool
    this.lowPowerMode = lowPowerMode

    if (!this.enabled) return

    const geometry = new THREE.BoxGeometry(0.12, 0.12, 0.12)
    const shardGeometry = new THREE.IcosahedronGeometry(0.08, 0)
    this.geometry = geometry
    this.shardGeometry = shardGeometry
    this.shardPool = new MeshParticlePool(
      scene,
      shardGeometry,
      new THREE.MeshStandardMaterial({ color: 0xb9fff0, emissive: 0x4fffe1, emissiveIntensity: 0.6, roughness: 0.35 }),
      Math.max(8, Math.floor(poolSize / 3)),
    )

    for (const block of BLOCKS) {
      const material = new THREE.MeshStandardMaterial({ color: BLOCK_COLOR_MAP.get(block.id) ?? 0xffffff, roughness: 0.8 })
      this.blockPools.set(block.id, new MeshParticlePool(scene, geometry, material, poolSize))
    }
  }

  createBreakBurst({ position, blockId, count }: ParticleBurstOptions) {
    if (!this.enabled) return 0
    const pool = this.blockPools.get(blockId)
    if (!pool) return 0

    const particleCount = count ?? (this.lowPowerMode ? 3 : 6)
    let spawned = 0

    for (let i = 0; i < particleCount; i += 1) {
      this.tempOffset.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4)
      const particle = pool.spawn({
        position: position.clone().add(this.tempOffset),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 5.5, 1.5 + Math.random() * 3.5, (Math.random() - 0.5) * 5.5),
        life: this.lowPowerMode ? 0.5 : 0.8,
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
      const particle = this.shardPool.spawn({
        position: position.clone().add(this.tempOffset),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 7, 2.8 + Math.random() * 4.5, (Math.random() - 0.5) * 7),
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
    for (const pool of this.blockPools.values()) {
      pool.update(deltaSeconds)
    }
  }

  dispose() {
    this.shardPool?.dispose()
    for (const pool of this.blockPools.values()) {
      pool.dispose()
    }
    this.geometry?.dispose()
    this.shardGeometry?.dispose()
    this.blockPools.clear()
  }

  get activeCount() {
    let total = this.shardPool?.activeCount ?? 0
    for (const pool of this.blockPools.values()) {
      total += pool.activeCount
    }
    return total
  }
}
