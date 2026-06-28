import { assertChunkMeshSmoke, assertRenderLayerSmoke } from '../render'
import { readOptimizationFeatureFlags } from './FeatureFlags'
import { assertMainBootstrapSmoke } from './MainBootstrapSmoke'
import { assertMainRuntimeHealthReportSmoke } from './MainRuntimeHealthReportSmoke'
import { assertMainRuntimeWorkQueueSmoke } from './MainRuntimeWorkQueueSmoke'

export type OptimizationSmokeResult = {
  flags: ReturnType<typeof readOptimizationFeatureFlags>
  chunkMesh: ReturnType<typeof assertChunkMeshSmoke>
  renderLayers: ReturnType<typeof assertRenderLayerSmoke>
  mainBootstrap: ReturnType<typeof assertMainBootstrapSmoke>
  runtimeHealthReport: ReturnType<typeof assertMainRuntimeHealthReportSmoke>
  runtimeWorkQueue: ReturnType<typeof assertMainRuntimeWorkQueueSmoke>
}

export function runOptimizationSmoke(hash = '#opt-diagnostics=1'): OptimizationSmokeResult {
  return {
    flags: readOptimizationFeatureFlags(hash),
    chunkMesh: assertChunkMeshSmoke(),
    renderLayers: assertRenderLayerSmoke(),
    mainBootstrap: assertMainBootstrapSmoke(),
    runtimeHealthReport: assertMainRuntimeHealthReportSmoke(),
    runtimeWorkQueue: assertMainRuntimeWorkQueueSmoke(),
  }
}

export function formatOptimizationSmokeResult(result: OptimizationSmokeResult) {
  return [
    'Optimization smoke passed',
    `diagnostics=${result.flags.diagnostics}`,
    `chunkMeshFaces=${result.chunkMesh.visibleFaceCount}`,
    `chunkMeshQuads=${result.chunkMesh.greedyQuadCount}`,
    `renderLayers=${result.renderLayers.layerCount}`,
    `bootstrapMirrored=${result.mainBootstrap.mirroredBlocks}`,
    `bootstrapChunks=${result.mainBootstrap.chunkCount}`,
    `runtimeHealth=${result.runtimeHealthReport.critical}`,
    `runtimeQueueProcessed=${result.runtimeWorkQueue.processedItems.length}`,
  ].join(' | ')
}
