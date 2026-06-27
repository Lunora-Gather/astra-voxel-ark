import type { MainOptimizationFrameOptions } from './MainOptimizationBootstrap'
import type { MainRuntimeAdapter } from './MainRuntimeAdapter'
import { createMainRuntimeFrameHistory, type MainRuntimeFrameHistory, type MainRuntimeFrameHistorySnapshot } from './MainRuntimeFrameHistory'
import { formatMainRuntimeFrameSummary, isMainRuntimeFrameBacklogged, summarizeMainRuntimeFrame, type MainRuntimeFrameSummary } from './MainRuntimeFrameSummary'
import { runMainRuntimeFrame, type MainRuntimeFrameScheduleResult } from './MainRuntimeFrameScheduler'
import type { MainRuntimeQueueTask } from './MainRuntimeWorkQueue'

export type MainRuntimeOrchestratorOptions<TerrainTask = unknown, DirtyTask = unknown> = {
  adapter: MainRuntimeAdapter
  terrainQueue?: TerrainTask[]
  dirtyChunkSummaryQueue?: DirtyTask[]
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
  terrainQueue: TerrainTask[]
  dirtyChunkSummaryQueue: DirtyTask[]
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
  terrainQueue = [],
  dirtyChunkSummaryQueue = [],
  runTerrainTask,
  runDirtyChunkSummaryTask,
  diagnosticsEnabled,
  historyLimit,
}: MainRuntimeOrchestratorOptions<TerrainTask, DirtyTask>): MainRuntimeOrchestrator<TerrainTask, DirtyTask> {
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
    const scheduled = runMainRuntimeFrame(adapter, {
      frame,
      diagnosticsEnabled,
      queues: {
        terrainQueue,
        dirtyChunkSummaryQueue,
        runTerrainTask,
        runDirtyChunkSummaryTask,
      },
    })
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
    terrainQueue,
    dirtyChunkSummaryQueue,
    stats,
    history,
    enqueueTerrainTask: (task) => terrainQueue.push(task),
    enqueueDirtyChunkSummaryTask: (task) => dirtyChunkSummaryQueue.push(task),
    runFrame,
    getSummaryLabel: () => stats.lastSummary ? formatMainRuntimeFrameSummary(stats.lastSummary) : '',
    clearQueues: () => {
      terrainQueue.length = 0
      dirtyChunkSummaryQueue.length = 0
    },
    dispose: () => adapter.dispose(),
  }
}
