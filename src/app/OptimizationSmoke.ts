import { assertChunkMeshSmoke, assertRenderLayerSmoke } from '../render'
import { readOptimizationFeatureFlags } from './FeatureFlags'
import { assertMainBootstrapSmoke } from './MainBootstrapSmoke'

export type OptimizationSmokeResult = {
  flags: ReturnType<typeof readOptimizationFeatureFlags>
  chunkMesh: ReturnType<typeof assertChunkMeshSmoke>
  renderLayers: ReturnType<typeof assertRenderLayerSmoke>
  mainBootstrap: ReturnType<typeof assertMainBootstrapSmoke>
}

export function runOptimizationSmoke(hash = '#opt-diagnostics=1'): OptimizationSmokeResult {
  return {
    flags: readOptimizationFeatureFlags(hash),
    chunkMesh: assertChunkMeshSmoke(),
    renderLayers: assertRenderLayerSmoke(),
    mainBootstrap: assertMainBootstrapSmoke(),
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
  ].join(' | ')
}
