import type * as THREE from 'three'
import type { BlockId } from '../blocks'
import type { QualityPreset } from '../game'
import type { TerrainGeneratorOptions } from '../world'
import {
  bootstrapMainOptimizations,
  type MainOptimizationBootstrap,
  type MainOptimizationBootstrapOptions,
  type MainOptimizationFrameOptions,
  type MainOptimizationFrameResult,
} from './MainOptimizationBootstrap'
import type { LegacyBlockMap } from './LegacyWorldBridge'

export type MainRuntimeAdapterOptions = Omit<MainOptimizationBootstrapOptions, 'initialQuality'> & {
  initialQuality: QualityPreset
}

export type MainRuntimeAdapterStats = {
  frameCount: number
  blockSetCount: number
  blockDeleteCount: number
  resyncCount: number
  lastFrame: MainOptimizationFrameResult | null
}

export type MainRuntimeAdapter = {
  bootstrap: MainOptimizationBootstrap
  stats: MainRuntimeAdapterStats
  onBlockSet: (key: string, id: BlockId) => boolean
  onBlockDelete: (key: string) => boolean
  resync: () => number
  markAllChunksDirty: () => void
  onFrame: (options?: MainOptimizationFrameOptions) => MainOptimizationFrameResult
  dispose: () => void
}

export function createMainRuntimeAdapter({
  blockData,
  chunkSize,
  terrainOptions,
  scene,
  camera,
  particlePoolSize,
  maxActivePointLights,
  lowPowerMode,
  initialQuality,
  logger,
}: MainRuntimeAdapterOptions): MainRuntimeAdapter {
  const bootstrap = bootstrapMainOptimizations({
    blockData,
    chunkSize,
    terrainOptions,
    scene,
    camera,
    particlePoolSize,
    maxActivePointLights,
    lowPowerMode,
    initialQuality,
    logger,
  })

  const stats: MainRuntimeAdapterStats = {
    frameCount: 0,
    blockSetCount: 0,
    blockDeleteCount: 0,
    resyncCount: 0,
    lastFrame: null,
  }

  return {
    bootstrap,
    stats,
    onBlockSet: (key, id) => {
      const result = bootstrap.syncBlockSet(key, id)
      if (result) stats.blockSetCount += 1
      return result
    },
    onBlockDelete: (key) => {
      const result = bootstrap.syncBlockDelete(key)
      if (result) stats.blockDeleteCount += 1
      return result
    },
    resync: () => {
      stats.resyncCount += 1
      return bootstrap.syncAllBlocks().mirroredBlocks
    },
    markAllChunksDirty: () => bootstrap.markAllChunksDirty(),
    onFrame: (options) => {
      const frame = bootstrap.recordFrame(options)
      stats.frameCount += 1
      stats.lastFrame = frame
      return frame
    },
    dispose: () => bootstrap.dispose(),
  }
}

export function createHeadlessMainRuntimeAdapter(
  blockData: LegacyBlockMap,
  initialQuality: QualityPreset = 'balanced',
  logger: Pick<Console, 'info'> = console,
) {
  return createMainRuntimeAdapter({
    blockData,
    chunkSize: 16,
    terrainOptions: { chunkSize: 16 },
    initialQuality,
    logger,
  })
}
