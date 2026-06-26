import type * as THREE from 'three'
import type { TerrainGeneratorOptions } from '../world'
import { readOptimizationFeatureFlags, type OptimizationFeatureFlags } from './FeatureFlags'
import { LightBudgetPipeline } from './LightBudgetPipeline'
import { logOptimizationDiagnostics, runOptimizationDiagnostics, type OptimizationDiagnosticsResult } from './OptimizationDiagnostics'
import { ParticleEffectsPipeline } from './ParticleEffectsPipeline'
import { TerrainPipeline } from './TerrainPipeline'

export type OptimizationRuntimeOptions = {
  hash?: string
  terrainOptions: TerrainGeneratorOptions
  logger?: Pick<Console, 'info'>
  scene?: THREE.Scene
  camera?: THREE.Camera
  particlePoolSize?: number
  maxActivePointLights?: number
  lowPowerMode?: boolean
}

export type OptimizationRuntime = {
  flags: OptimizationFeatureFlags
  diagnostics: OptimizationDiagnosticsResult | null
  terrain: TerrainPipeline
  particles: ParticleEffectsPipeline | null
  lights: LightBudgetPipeline | null
  dispose: () => void
}

export function createOptimizationRuntime({
  hash,
  terrainOptions,
  logger = console,
  scene,
  camera,
  particlePoolSize = 120,
  maxActivePointLights = 24,
  lowPowerMode = false,
}: OptimizationRuntimeOptions): OptimizationRuntime {
  const flags = readOptimizationFeatureFlags(hash)
  const diagnostics = runOptimizationDiagnostics(flags)
  logOptimizationDiagnostics(diagnostics, logger)

  const terrain = new TerrainPipeline({ flags, terrainOptions })
  const particles = scene
    ? new ParticleEffectsPipeline({ scene, flags, poolSize: particlePoolSize, lowPowerMode })
    : null
  const lights = camera
    ? new LightBudgetPipeline({ flags, camera, maxActiveLights: maxActivePointLights })
    : null

  return {
    flags,
    diagnostics,
    terrain,
    particles,
    lights,
    dispose: () => {
      terrain.dispose()
      particles?.dispose()
    },
  }
}
