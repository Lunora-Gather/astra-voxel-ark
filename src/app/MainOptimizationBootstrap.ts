import type * as THREE from 'three'
import type { BlockId } from '../blocks'
import type { QualityPreset } from '../game'
import type { ChunkRecord, TerrainGeneratorOptions } from '../world'
import { AdaptiveQualityController } from './AdaptiveQualityController'
import { ChunkRebuildScheduler } from './ChunkRebuildScheduler'
import { LegacyChunkMirrorController } from './LegacyChunkMirrorController'
import type { LegacyBlockMap } from './LegacyWorldBridge'
import { createOptimizationRuntime, type OptimizationRuntime } from './OptimizationRuntime'
import { PerformanceSampler } from './PerformanceSampler'
import { runMainDiagnosticsHook } from './MainDiagnosticsHook'

export type MainOptimizationBootstrapOptions = {
  blockData: LegacyBlockMap
  chunkSize: number
  terrainOptions?: TerrainGeneratorOptions
  scene?: THREE.Scene
  camera?: THREE.Camera
  particlePoolSize?: number
  maxActivePointLights?: number
  lowPowerMode?: boolean
  initialQuality?: QualityPreset
  logger?: Pick<Console, 'info'>
}

export type MainOptimizationBootstrap = {
  optimization: OptimizationRuntime
  chunkMirror: LegacyChunkMirrorController
  performance: PerformanceSampler
  quality: AdaptiveQualityController
  chunkRebuilds: ChunkRebuildScheduler<ChunkRecord>
  syncBlockSet: (key: string, id: BlockId) => boolean
  syncBlockDelete: (key: string) => boolean
  dispose: () => void
}

export function bootstrapMainOptimizations({
  blockData,
  chunkSize,
  terrainOptions = { chunkSize },
  scene,
  camera,
  particlePoolSize,
  maxActivePointLights,
  lowPowerMode,
  initialQuality = 'balanced',
  logger = console,
}: MainOptimizationBootstrapOptions): MainOptimizationBootstrap {
  const optimization = createOptimizationRuntime({
    terrainOptions,
    scene,
    camera,
    particlePoolSize,
    maxActivePointLights,
    lowPowerMode,
    logger,
  })

  const chunkMirror = new LegacyChunkMirrorController({ chunkSize })
  chunkMirror.syncFromLegacyMap(blockData)
  const performance = new PerformanceSampler()
  const quality = new AdaptiveQualityController({ initialPreset: initialQuality })
  const chunkRebuilds = new ChunkRebuildScheduler<ChunkRecord>()

  runMainDiagnosticsHook({
    flags: optimization.flags,
    blockData,
    chunkSize,
    logger,
  })

  return {
    optimization,
    chunkMirror,
    performance,
    quality,
    chunkRebuilds,
    syncBlockSet: (key, id) => chunkMirror.setBlock(key, id),
    syncBlockDelete: (key) => chunkMirror.deleteBlock(key),
    dispose: () => {
      chunkRebuilds.clear()
      optimization.dispose()
    },
  }
}
