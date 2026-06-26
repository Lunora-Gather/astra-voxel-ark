import type { LegacyBlockMap } from './LegacyWorldBridge'
import { diagnoseLegacyWorld, formatLegacyWorldDiagnostics, type LegacyWorldDiagnosticsResult } from './LegacyWorldDiagnostics'
import type { OptimizationFeatureFlags } from './FeatureFlags'

export type MainDiagnosticsHookOptions = {
  flags: OptimizationFeatureFlags
  blockData: LegacyBlockMap
  chunkSize: number
  limit?: number
  logger?: Pick<Console, 'info'>
}

export function runMainDiagnosticsHook({
  flags,
  blockData,
  chunkSize,
  limit = 4,
  logger = console,
}: MainDiagnosticsHookOptions): LegacyWorldDiagnosticsResult | null {
  if (!flags.chunkMeshDiagnostics) return null

  const diagnostics = diagnoseLegacyWorld(blockData, { chunkSize, limit })
  logger.info(formatLegacyWorldDiagnostics(diagnostics))
  return diagnostics
}
