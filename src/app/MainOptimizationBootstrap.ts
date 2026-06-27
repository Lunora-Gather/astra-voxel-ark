import type * as THREE from 'three'
import type { BlockId } from '../blocks'
import type { QualityPreset } from '../game'
import type { ChunkRecord, TerrainGeneratorOptions } from '../world'
import { AdaptiveQualityController, type AdaptiveQualityDecision } from './AdaptiveQualityController'
import type { DirtyChunkMeshUpdate } from './ChunkMeshIntegration'
import { ChunkRebuildScheduler } from './ChunkRebuildScheduler'
import { LegacyChunkMirrorController } from './LegacyChunkMirrorController'
import type { LegacyBlockMap, LegacyWorldMirrorResult } from './LegacyWorldBridge'
import { createOptimizationRuntime, type OptimizationRuntime } from './OptimizationRuntime'
import { PerformanceSampler, type PerformanceSample } from './PerformanceSampler'
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

export type MainOptimizationFrameOptions = {
  timestamp?: number
  dirtyChunkLimit?: number
  clearDirtyDiagnostics?: boolean
}

export type MainOptimizationFrameResult = {
  sample: PerformanceSample
  qualityDecision: AdaptiveQualityDecision
  dirtyChunkDiagnostics: DirtyChunkMeshUpdate[]
  mirroredBlocks: number
  mirroredChunks: number
  scheduledChunkRebuilds: number
}

export type MainOptimizationBootstrap = {
  optimization: OptimizationRuntime
  chunkMirror: LegacyChunkMirrorController
  performance: PerformanceSampler
  quality: AdaptiveQualityController
  chunkRebuilds: ChunkRebuildScheduler<ChunkRecord>
  syncBlockSet: (key: string, id: BlockId) => boolean
  syncBlockDelete: (key: string) => boolean
  syncAllBlocks: () => LegacyWorldMirrorResult
  markAllChunksDirty: () => void
  diagnoseDirtyChunks: (options?: MainOptimizationFrameOptions) => DirtyChunkMeshUpdate[]
  recordFrame: (options?: MainOptimizationFrameOptions) => MainOptimizationFrameResult
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

  const diagnoseDirtyChunks = ({ dirtyChunkLimit = 4, clearDirtyDiagnostics = false }: MainOptimizationFrameOptions = {}) => {
    if (!optimization.flags.chunkMeshDiagnostics) return []
    return chunkMirror.diagnoseDirtyChunks({ limit: dirtyChunkLimit, clearDirty: clearDirtyDiagnostics })
  }

  const recordFrame = (options: MainOptimizationFrameOptions = {}): MainOptimizationFrameResult => {
    const sample = performance.begin(options.timestamp)
    const qualityDecision = quality.evaluate(sample)
    const dirtyChunkDiagnostics = diagnoseDirtyChunks(options)

    return {
      sample,
      qualityDecision,
      dirtyChunkDiagnostics,
      mirroredBlocks: chunkMirror.blockCount,
      mirroredChunks: chunkMirror.chunkCount,
      scheduledChunkRebuilds: chunkRebuilds.size,
    }
  }

  return {
    optimization,
    chunkMirror,
    performance,
    quality,
    chunkRebuilds,
    syncBlockSet: (key, id) => chunkMirror.setBlock(key, id),
    syncBlockDelete: (key) => chunkMirror.deleteBlock(key),
    syncAllBlocks: () => chunkMirror.syncFromLegacyMap(blockData),
    markAllChunksDirty: () => chunkMirror.markAllDirty(),
    diagnoseDirtyChunks,
    recordFrame,
    dispose: () => {
      chunkRebuilds.clear()
      optimization.dispose()
    },
  }
}
