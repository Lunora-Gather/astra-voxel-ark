import type { BudgetedPointLight, ChunkMeshDiagnostics } from '../render'
import { formatRuntimeDebugStats, type RuntimeDebugStats } from '../ui'
import type { OptimizationRuntime } from './OptimizationRuntime'
import type { PerformanceSample } from './PerformanceSampler'

export type FrameOptimizationState = {
  fps?: number
  frameMs?: number
  performance?: PerformanceSample
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
  averageFps: number | null
  minFps: number | null
}

export function updateFrameOptimizations(
  optimization: OptimizationRuntime,
  deltaSeconds: number,
  state: FrameOptimizationState,
): FrameOptimizationResult {
  optimization.particles?.update(deltaSeconds)
  const lightResult = state.pointLights && optimization.lights ? optimization.lights.apply(state.pointLights) : null
  const fps = state.performance?.fps ?? state.fps ?? 0
  const frameMs = state.performance?.frameMs ?? state.frameMs ?? deltaSeconds * 1000
  const debugStats: RuntimeDebugStats = {
    fps,
    frameMs,
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
    averageFps: state.performance?.averageFps ?? null,
    minFps: state.performance?.minFps ?? null,
  }
}
