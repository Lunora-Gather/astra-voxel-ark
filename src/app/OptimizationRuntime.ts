import type { TerrainGeneratorOptions } from '../world'
import { readOptimizationFeatureFlags, type OptimizationFeatureFlags } from './FeatureFlags'
import { logOptimizationDiagnostics, runOptimizationDiagnostics, type OptimizationDiagnosticsResult } from './OptimizationDiagnostics'
import { TerrainPipeline } from './TerrainPipeline'

export type OptimizationRuntimeOptions = {
  hash?: string
  terrainOptions: TerrainGeneratorOptions
  logger?: Pick<Console, 'info'>
}

export type OptimizationRuntime = {
  flags: OptimizationFeatureFlags
  diagnostics: OptimizationDiagnosticsResult | null
  terrain: TerrainPipeline
  dispose: () => void
}

export function createOptimizationRuntime({ hash, terrainOptions, logger = console }: OptimizationRuntimeOptions): OptimizationRuntime {
  const flags = readOptimizationFeatureFlags(hash)
  const diagnostics = runOptimizationDiagnostics(flags)
  logOptimizationDiagnostics(diagnostics, logger)

  const terrain = new TerrainPipeline({ flags, terrainOptions })

  return {
    flags,
    diagnostics,
    terrain,
    dispose: () => terrain.dispose(),
  }
}
