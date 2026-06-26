import type * as THREE from 'three'
import type { BlockId } from '../blocks'
import type { TerrainGeneratorOptions } from '../world'
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
  logger?: Pick<Console, 'info'>
}

export type MainOptimizationBootstrap = {
  optimization: OptimizationRuntime
  chunkMirror: LegacyChunkMirrorController
  performance: PerformanceSampler
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
    syncBlockSet: (key, id) => chunkMirror.setBlock(key, id),
    syncBlockDelete: (key) => chunkMirror.deleteBlock(key),
    dispose: () => optimization.dispose(),
  }
}
