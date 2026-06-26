import { assertChunkMeshSmoke, assertRenderLayerSmoke } from '../render'
import { readOptimizationFeatureFlags } from './FeatureFlags'

export type OptimizationSmokeResult = {
  flags: ReturnType<typeof readOptimizationFeatureFlags>
  chunkMesh: ReturnType<typeof assertChunkMeshSmoke>
  renderLayers: ReturnType<typeof assertRenderLayerSmoke>
}

export function runOptimizationSmoke(hash = '#opt-diagnostics=1'): OptimizationSmokeResult {
  return {
    flags: readOptimizationFeatureFlags(hash),
    chunkMesh: assertChunkMeshSmoke(),
    renderLayers: assertRenderLayerSmoke(),
  }
}

export function formatOptimizationSmokeResult(result: OptimizationSmokeResult) {
  return [
    'Optimization smoke passed',
    `diagnostics=${result.flags.diagnostics}`,
    `chunkMeshFaces=${result.chunkMesh.visibleFaceCount}`,
    `chunkMeshQuads=${result.chunkMesh.greedyQuadCount}`,
    `renderLayers=${result.renderLayers.layerCount}`,
  ].join(' | ')
}
