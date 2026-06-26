import {
  assertChunkMeshSmoke,
  assertRenderLayerSmoke,
  formatChunkMeshDiagnostics,
  type ChunkMeshDiagnostics,
} from '../render'
import type { OptimizationFeatureFlags } from './FeatureFlags'

export type OptimizationDiagnosticsResult = {
  chunkMesh: ChunkMeshDiagnostics
  renderLayers: ReturnType<typeof assertRenderLayerSmoke>
  summary: string
}

export function runOptimizationDiagnostics(flags: OptimizationFeatureFlags): OptimizationDiagnosticsResult | null {
  if (!flags.diagnostics && !flags.chunkMeshDiagnostics) return null

  const chunkMesh = assertChunkMeshSmoke()
  const renderLayers = assertRenderLayerSmoke()
  const summary = [
    'Optimization diagnostics passed',
    formatChunkMeshDiagnostics(chunkMesh),
    `layers=${renderLayers.layerCount}`,
    `greedy=${renderLayers.greedyEligibleIds.join(',')}`,
    `skipped=${renderLayers.skippedIds.join(',')}`,
  ].join(' | ')

  return { chunkMesh, renderLayers, summary }
}

export function logOptimizationDiagnostics(result: OptimizationDiagnosticsResult | null, logger: Pick<Console, 'info'> = console) {
  if (!result) return
  logger.info(result.summary)
}
