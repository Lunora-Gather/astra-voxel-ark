import type { MainOptimizationFrameOptions } from './MainOptimizationBootstrap'
import type { MainRuntimeAdapter } from './MainRuntimeAdapter'
import { createMainRuntimeFrameHistory, type MainRuntimeFrameHistory, type MainRuntimeFrameHistorySnapshot } from './MainRuntimeFrameHistory'
import { formatMainRuntimeFrameSummary, isMainRuntimeFrameBacklogged, summarizeMainRuntimeFrame, type MainRuntimeFrameSummary } from './MainRuntimeFrameSummary'
import type { MainRuntimeFrameScheduleResult } from './MainRuntimeFrameScheduler'
import { createMainRuntimeTaskQueue, runMainRuntimeTaskQueue, type MainRuntimeQueueTask, type MainRuntimeTaskQueue, type MainRuntimeWorkQueueResult } from './MainRuntimeWorkQueue'

export type MainRuntimeOrchestratorOptions<TerrainTask = unknown, DirtyTask = unknown> = {
  adapter: MainRuntimeAdapter
  terrainQueue?: TerrainTask[] | MainRuntimeTaskQueue<TerrainTask>
  dirtyChunkSummaryQueue?: DirtyTask[] | MainRuntimeTaskQueue<DirtyTask>
  runTerrainTask: MainRuntimeQueueTask<TerrainTask>
  runDirtyChunkSummaryTask: MainRuntimeQueueTask<DirtyTask>
  diagnosticsEnabled?: boolean
  historyLimit?: number
}

export type MainRuntimeOrchestratorStats = {
  frames: number
  terrainProcessed: number
  dirtyChunkSummariesProcessed: number
  backlogFrames: number
  pressureFrames: MainRuntimeFrameHistorySnapshot['pressureFrames']
  lastSummary: MainRuntimeFrameSummary | null
}

export type MainRuntimeOrchestratorFrameResult = MainRuntimeFrameScheduleResult & {
  summary: MainRuntimeFrameSummary
  summaryLabel: string
  history: MainRuntimeFrameHistorySnapshot
}

export type MainRuntimeOrchestrator<TerrainTask = unknown, DirtyTask = unknown> = {
  adapter: MainRuntimeAdapter
  terrainQueue: MainRuntimeTaskQueue<TerrainTask>
  dirtyChunkSummaryQueue: MainRuntimeTaskQueue<DirtyTask>
  stats: MainRuntimeOrchestratorStats
  history: MainRuntimeFrameHistory
  enqueueTerrainTask: (task: TerrainTask) => number
  enqueueDirtyChunkSummaryTask: (task: DirtyTask) => number
  runFrame: (frame?: MainOptimizationFrameOptions) => MainRuntimeOrchestratorFrameResult
  getSummaryLabel: () => string
  clearQueues: () => void
  dispose: () => void
}

export function createMainRuntimeOrchestrator<TerrainTask = unknown, DirtyTask = unknown>({
  adapter,
  terrainQueue,
  dirtyChunkSummaryQueue,
  runTerrainTask,
  runDirtyChunkSummaryTask,
  diagnosticsEnabled,
  historyLimit,
}: MainRuntimeOrchestratorOptions<TerrainTask, DirtyTask>): MainRuntimeOrchestrator<TerrainTask, DirtyTask> {
  const terrainTaskQueue = normalizeMainRuntimeTaskQueue(terrainQueue)
  const dirtyTaskQueue = normalizeMainRuntimeTaskQueue(dirtyChunkSummaryQueue)
  const history = createMainRuntimeFrameHistory(historyLimit)
  const stats: MainRuntimeOrchestratorStats = {
    frames: 0,
    terrainProcessed: 0,
    dirtyChunkSummariesProcessed: 0,
    backlogFrames: 0,
    pressureFrames: { nominal: 0, moderate: 0, high: 0 },
    lastSummary: null,
  }

  const runFrame = (frame?: MainOptimizationFrameOptions): MainRuntimeOrchestratorFrameResult => {
    const adapterFrame = adapter.onFrame(frame)
    const plan = adapter.planWork({
      pendingTerrainChunks: terrainTaskQueue.pending,
      pendingDirtyChunkSummaries: dirtyTaskQueue.pending,
      diagnosticsEnabled,
    })
    const queues: MainRuntimeWorkQueueResult = {
      terrain: runMainRuntimeTaskQueue(terrainTaskQueue, plan.terrainChunksToRun, runTerrainTask),
      dirtyChunkSummaries: runMainRuntimeTaskQueue(dirtyTaskQueue, plan.dirtyChunkSummariesToRun, runDirtyChunkSummaryTask),
      diagnosticsLimit: plan.dirtyChunkDiagnosticsLimit,
    }
    const scheduled = { frame: adapterFrame, plan, queues }
    const summary = summarizeMainRuntimeFrame(scheduled)
    const historySnapshot = history.record(summary)
    stats.frames += 1
    stats.terrainProcessed += summary.terrainProcessed
    stats.dirtyChunkSummariesProcessed += summary.dirtyChunkSummariesProcessed
    stats.pressureFrames[summary.pressure] += 1
    if (isMainRuntimeFrameBacklogged(summary)) stats.backlogFrames += 1
    stats.lastSummary = summary

    return {
      ...scheduled,
      summary,
      summaryLabel: formatMainRuntimeFrameSummary(summary),
      history: historySnapshot,
    }
  }

  return {
    adapter,
    terrainQueue: terrainTaskQueue,
    dirtyChunkSummaryQueue: dirtyTaskQueue,
    stats,
    history,
    enqueueTerrainTask: (task) => terrainTaskQueue.enqueue(task),
    enqueueDirtyChunkSummaryTask: (task) => dirtyTaskQueue.enqueue(task),
    runFrame,
    getSummaryLabel: () => stats.lastSummary ? formatMainRuntimeFrameSummary(stats.lastSummary) : '',
    clearQueues: () => {
      terrainTaskQueue.clear()
      dirtyTaskQueue.clear()
    },
    dispose: () => adapter.dispose(),
  }
}

function normalizeMainRuntimeTaskQueue<T>(queue?: T[] | MainRuntimeTaskQueue<T>): MainRuntimeTaskQueue<T> {
  if (queue && 'drain' in queue && 'enqueue' in queue) return queue
  return createMainRuntimeTaskQueue(queue ?? [])
}
