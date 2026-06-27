import type { MainOptimizationFrameOptions } from './MainOptimizationBootstrap'
import type {
  MainRuntimeAdapter,
  MainRuntimeAdapterFrameResult,
  MainRuntimeWorkPlan,
  MainRuntimeWorkRequest,
} from './MainRuntimeAdapter'
import {
  runMainRuntimeWorkQueues,
  type MainRuntimeWorkQueues,
  type MainRuntimeWorkQueueResult,
} from './MainRuntimeWorkQueue'

export type MainRuntimeFrameScheduleOptions<TerrainTask = unknown, DirtyTask = unknown> = {
  frame?: MainOptimizationFrameOptions
  pendingTerrainChunks?: number
  pendingDirtyChunkSummaries?: number
  diagnosticsEnabled?: boolean
  queues?: MainRuntimeWorkQueues<TerrainTask, DirtyTask>
}

export type MainRuntimeFrameScheduleResult = {
  frame: MainRuntimeAdapterFrameResult
  plan: MainRuntimeWorkPlan
  queues: MainRuntimeWorkQueueResult
}

export function runMainRuntimeFrame<TerrainTask = unknown, DirtyTask = unknown>(
  adapter: MainRuntimeAdapter,
  options: MainRuntimeFrameScheduleOptions<TerrainTask, DirtyTask> = {},
): MainRuntimeFrameScheduleResult {
  const frame = adapter.onFrame(options.frame)
  const request = createMainRuntimeWorkRequest(options)
  const plan = adapter.planWork(request)
  const queues = runMainRuntimeWorkQueues(plan, options.queues ?? {})

  return {
    frame,
    plan,
    queues,
  }
}

export function createMainRuntimeWorkRequest<TerrainTask = unknown, DirtyTask = unknown>({
  pendingTerrainChunks,
  pendingDirtyChunkSummaries,
  diagnosticsEnabled,
  queues,
}: MainRuntimeFrameScheduleOptions<TerrainTask, DirtyTask>): MainRuntimeWorkRequest {
  return {
    pendingTerrainChunks: pendingTerrainChunks ?? queues?.terrainQueue?.length ?? 0,
    pendingDirtyChunkSummaries: pendingDirtyChunkSummaries ?? queues?.dirtyChunkSummaryQueue?.length ?? 0,
    diagnosticsEnabled,
  }
}
