import type { MainRuntimeWorkPlan } from './MainRuntimeAdapter'

export type MainRuntimeQueueTask<T = unknown> = (item: T) => void

export type MainRuntimeQueueRunOptions<T = unknown> = {
  queue: T[]
  limit: number
  run: MainRuntimeQueueTask<T>
}

export type MainRuntimeQueueRunResult = {
  requested: number
  processed: number
  remaining: number
}

export type MainRuntimeWorkQueues<TerrainTask = unknown, DirtyTask = unknown> = {
  terrainQueue?: TerrainTask[]
  dirtyChunkSummaryQueue?: DirtyTask[]
  runTerrainTask?: MainRuntimeQueueTask<TerrainTask>
  runDirtyChunkSummaryTask?: MainRuntimeQueueTask<DirtyTask>
}

export type MainRuntimeWorkQueueResult = {
  terrain: MainRuntimeQueueRunResult
  dirtyChunkSummaries: MainRuntimeQueueRunResult
  diagnosticsLimit: number
}

export function runMainRuntimeQueue<T>({ queue, limit, run }: MainRuntimeQueueRunOptions<T>): MainRuntimeQueueRunResult {
  const requested = clampQueueLimit(limit)
  const items = drainMainRuntimeQueue(queue, requested)

  for (const item of items) run(item)

  return {
    requested,
    processed: items.length,
    remaining: queue.length,
  }
}

export function drainMainRuntimeQueue<T>(queue: T[], limit: number) {
  const requested = clampQueueLimit(limit)
  if (requested <= 0 || queue.length === 0) return []
  return queue.splice(0, Math.min(requested, queue.length))
}

export function runMainRuntimeWorkQueues<TerrainTask, DirtyTask>(
  plan: MainRuntimeWorkPlan,
  queues: MainRuntimeWorkQueues<TerrainTask, DirtyTask>,
): MainRuntimeWorkQueueResult {
  const terrain = queues.terrainQueue && queues.runTerrainTask
    ? runMainRuntimeQueue({
        queue: queues.terrainQueue,
        limit: plan.terrainChunksToRun,
        run: queues.runTerrainTask,
      })
    : emptyQueueRunResult(plan.terrainChunksToRun, queues.terrainQueue?.length ?? 0)

  const dirtyChunkSummaries = queues.dirtyChunkSummaryQueue && queues.runDirtyChunkSummaryTask
    ? runMainRuntimeQueue({
        queue: queues.dirtyChunkSummaryQueue,
        limit: plan.dirtyChunkSummariesToRun,
        run: queues.runDirtyChunkSummaryTask,
      })
    : emptyQueueRunResult(plan.dirtyChunkSummariesToRun, queues.dirtyChunkSummaryQueue?.length ?? 0)

  return {
    terrain,
    dirtyChunkSummaries,
    diagnosticsLimit: plan.dirtyChunkDiagnosticsLimit,
  }
}

export function emptyQueueRunResult(limit: number, remaining = 0): MainRuntimeQueueRunResult {
  return {
    requested: clampQueueLimit(limit),
    processed: 0,
    remaining: clampQueueLimit(remaining),
  }
}

export function clampQueueLimit(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}
