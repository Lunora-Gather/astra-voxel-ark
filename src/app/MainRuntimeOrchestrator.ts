import type { MainOptimizationFrameOptions } from './MainOptimizationBootstrap'
import type { MainRuntimeAdapter } from './MainRuntimeAdapter'
import { createMainRuntimeFrameHistory, type MainRuntimeFrameHistory, type MainRuntimeFrameHistorySnapshot } from './MainRuntimeFrameHistory'
import { createMainRuntimeFrameReporter, type MainRuntimeFrameReport, type MainRuntimeFrameReporter, type MainRuntimeFrameTimestampUnit } from './MainRuntimeFrameReporter'
import { isMainRuntimeFrameBacklogged, summarizeMainRuntimeFrame, type MainRuntimeFrameSummary } from './MainRuntimeFrameSummary'
import type { MainRuntimeFrameScheduleResult } from './MainRuntimeFrameScheduler'
import { createMainRuntimeTaskQueue, createMainRuntimeUniqueTaskQueue, runMainRuntimeTaskQueue, type MainRuntimeQueueKeySelector, type MainRuntimeQueueTask, type MainRuntimeTaskQueue, type MainRuntimeTaskQueueOptions, type MainRuntimeWorkQueueResult } from './MainRuntimeWorkQueue'

export type MainRuntimeOrchestratorOptions<TerrainTask = unknown, DirtyTask = unknown> = {
  adapter: MainRuntimeAdapter
  terrainQueue?: TerrainTask[] | MainRuntimeTaskQueue<TerrainTask>
  dirtyChunkSummaryQueue?: DirtyTask[] | MainRuntimeTaskQueue<DirtyTask>
  terrainTaskKey?: MainRuntimeQueueKeySelector<TerrainTask>
  dirtyChunkSummaryTaskKey?: MainRuntimeQueueKeySelector<DirtyTask>
  terrainQueueMaxPending?: number
  dirtyChunkSummaryQueueMaxPending?: number
  runTerrainTask: MainRuntimeQueueTask<TerrainTask>
  runDirtyChunkSummaryTask: MainRuntimeQueueTask<DirtyTask>
  diagnosticsEnabled?: boolean
  historyLimit?: number
  summaryReportIntervalMs?: number
  summaryReportTimestampUnit?: MainRuntimeFrameTimestampUnit
}

export type MainRuntimeOrchestratorStats = {
  frames: number
  terrainProcessed: number
  dirtyChunkSummariesProcessed: number
  backlogFrames: number
  pressureFrames: MainRuntimeFrameHistorySnapshot['pressureFrames']
  lastSummary: MainRuntimeFrameSummary | null
  lastReport: MainRuntimeFrameReport | null
}

export type MainRuntimeOrchestratorFrameResult = MainRuntimeFrameScheduleResult & {
  summary: MainRuntimeFrameSummary
  summaryLabel: string
  report: MainRuntimeFrameReport
  history: MainRuntimeFrameHistorySnapshot
}

export type MainRuntimeOrchestrator<TerrainTask = unknown, DirtyTask = unknown> = {
  adapter: MainRuntimeAdapter
  terrainQueue: MainRuntimeTaskQueue<TerrainTask>
  dirtyChunkSummaryQueue: MainRuntimeTaskQueue<DirtyTask>
  stats: MainRuntimeOrchestratorStats
  history: MainRuntimeFrameHistory
  reporter: MainRuntimeFrameReporter
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
  terrainTaskKey,
  dirtyChunkSummaryTaskKey,
  terrainQueueMaxPending,
  dirtyChunkSummaryQueueMaxPending,
  runTerrainTask,
  runDirtyChunkSummaryTask,
  diagnosticsEnabled,
  historyLimit,
  summaryReportIntervalMs,
  summaryReportTimestampUnit = 'milliseconds',
}: MainRuntimeOrchestratorOptions<TerrainTask, DirtyTask>): MainRuntimeOrchestrator<TerrainTask, DirtyTask> {
  const terrainTaskQueue = normalizeMainRuntimeTaskQueue(terrainQueue, terrainTaskKey, { maxPending: terrainQueueMaxPending })
  const dirtyTaskQueue = normalizeMainRuntimeTaskQueue(dirtyChunkSummaryQueue, dirtyChunkSummaryTaskKey, { maxPending: dirtyChunkSummaryQueueMaxPending })
  const history = createMainRuntimeFrameHistory(historyLimit)
  const reporter = createMainRuntimeFrameReporter({ minIntervalMs: summaryReportIntervalMs, timestampUnit: summaryReportTimestampUnit })
  const stats: MainRuntimeOrchestratorStats = {
    frames: 0,
    terrainProcessed: 0,
    dirtyChunkSummariesProcessed: 0,
    backlogFrames: 0,
    pressureFrames: { nominal: 0, moderate: 0, high: 0 },
    lastSummary: null,
    lastReport: null,
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
    const report = reporter.report(summary, frame?.timestamp)
    const historySnapshot = history.record(summary)
    stats.frames += 1
    stats.terrainProcessed += summary.terrainProcessed
    stats.dirtyChunkSummariesProcessed += summary.dirtyChunkSummariesProcessed
    stats.pressureFrames[summary.pressure] += 1
    if (isMainRuntimeFrameBacklogged(summary)) stats.backlogFrames += 1
    stats.lastSummary = summary
    stats.lastReport = report

    return {
      ...scheduled,
      summary,
      summaryLabel: report.label,
      report,
      history: historySnapshot,
    }
  }

  return {
    adapter,
    terrainQueue: terrainTaskQueue,
    dirtyChunkSummaryQueue: dirtyTaskQueue,
    stats,
    history,
    reporter,
    enqueueTerrainTask: (task) => terrainTaskQueue.enqueue(task),
    enqueueDirtyChunkSummaryTask: (task) => dirtyTaskQueue.enqueue(task),
    runFrame,
    getSummaryLabel: () => reporter.peek(),
    clearQueues: () => {
      terrainTaskQueue.clear()
      dirtyTaskQueue.clear()
    },
    dispose: () => adapter.dispose(),
  }
}

function normalizeMainRuntimeTaskQueue<T>(
  queue?: T[] | MainRuntimeTaskQueue<T>,
  getKey?: MainRuntimeQueueKeySelector<T>,
  options?: MainRuntimeTaskQueueOptions,
): MainRuntimeTaskQueue<T> {
  if (queue && 'drain' in queue && 'enqueue' in queue) return queue
  return getKey ? createMainRuntimeUniqueTaskQueue(getKey, queue ?? [], options) : createMainRuntimeTaskQueue(queue ?? [], options)
}
