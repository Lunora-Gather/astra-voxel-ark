import type { BudgetedPointLight, ChunkMeshDiagnostics } from '../render'
import { formatRuntimeDebugStats, type RuntimeDebugStats } from '../ui'
import type { OptimizationRuntime } from './OptimizationRuntime'

export type FrameOptimizationState = {
  fps: number
  frameMs: number
  chunkCount: number
  dirtyChunkCount: number
  blockCount: number
  renderedChunkMeshCount: number
  chunkMesh?: ChunkMeshDiagnostics
  pointLights?: BudgetedPointLight[]
}

export type FrameOptimizationResult = {
  debugText: string
  activeParticleCount: number
  activeLightCount: number | null
  inactiveLightCount: number | null
}

export function updateFrameOptimizations(
  optimization: OptimizationRuntime,
  deltaSeconds: number,
  state: FrameOptimizationState,
): FrameOptimizationResult {
  optimization.particles?.update(deltaSeconds)
  const lightResult = state.pointLights && optimization.lights ? optimization.lights.apply(state.pointLights) : null
  const debugStats: RuntimeDebugStats = {
    fps: state.fps,
    frameMs: state.frameMs,
    chunkCount: state.chunkCount,
    dirtyChunkCount: state.dirtyChunkCount,
    blockCount: state.blockCount,
    renderedChunkMeshCount: state.renderedChunkMeshCount,
    chunkMesh: state.chunkMesh,
  }

  return {
    debugText: formatRuntimeDebugStats(debugStats),
    activeParticleCount: optimization.particles?.activeCount ?? 0,
    activeLightCount: lightResult ? lightResult.active.length : null,
    inactiveLightCount: lightResult ? lightResult.inactive.length : null,
  }
}
