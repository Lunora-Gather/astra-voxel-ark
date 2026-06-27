import type { MainRuntimePressure } from './MainRuntimeAdapter'
import type { MainRuntimeFrameSummary } from './MainRuntimeFrameSummary'

export type MainRuntimeFrameHistorySnapshot = {
  frameCount: number
  averageFps: number
  averageFrameMs: number
  pressureFrames: Record<MainRuntimePressure, number>
  backlogFrames: number
  terrainProcessed: number
  dirtyChunkSummariesProcessed: number
}

type MainRuntimeFrameHistoryAccumulator = {
  frameCount: number
  fpsTotal: number
  frameMsTotal: number
  pressureFrames: Record<MainRuntimePressure, number>
  backlogFrames: number
  terrainProcessed: number
  dirtyChunkSummariesProcessed: number
}

export type MainRuntimeFrameHistory = {
  readonly summaries: readonly MainRuntimeFrameSummary[]
  record: (summary: MainRuntimeFrameSummary) => MainRuntimeFrameHistorySnapshot
  snapshot: () => MainRuntimeFrameHistorySnapshot
  clear: () => void
}

export function createMainRuntimeFrameHistory(limit = 120): MainRuntimeFrameHistory {
  const summaries: MainRuntimeFrameSummary[] = []
  const capacity = clampFrameHistoryLimit(limit)
  const accumulator = createMainRuntimeFrameHistoryAccumulator()

  return {
    summaries,
    record: (summary) => {
      summaries.push(summary)
      updateMainRuntimeFrameHistoryAccumulator(accumulator, summary, 1)
      while (summaries.length > capacity) {
        const removed = summaries.shift()
        if (removed) updateMainRuntimeFrameHistoryAccumulator(accumulator, removed, -1)
      }
      return snapshotMainRuntimeFrameHistoryAccumulator(accumulator)
    },
    snapshot: () => snapshotMainRuntimeFrameHistoryAccumulator(accumulator),
    clear: () => {
      summaries.length = 0
      resetMainRuntimeFrameHistoryAccumulator(accumulator)
    },
  }
}

export function getMainRuntimeFrameHistorySnapshot(
  summaries: readonly MainRuntimeFrameSummary[],
): MainRuntimeFrameHistorySnapshot {
  const accumulator = createMainRuntimeFrameHistoryAccumulator()
  for (const summary of summaries) updateMainRuntimeFrameHistoryAccumulator(accumulator, summary, 1)
  return snapshotMainRuntimeFrameHistoryAccumulator(accumulator)
}

function createMainRuntimeFrameHistoryAccumulator(): MainRuntimeFrameHistoryAccumulator {
  return {
    frameCount: 0,
    fpsTotal: 0,
    frameMsTotal: 0,
    pressureFrames: { nominal: 0, moderate: 0, high: 0 },
    backlogFrames: 0,
    terrainProcessed: 0,
    dirtyChunkSummariesProcessed: 0,
  }
}

function resetMainRuntimeFrameHistoryAccumulator(accumulator: MainRuntimeFrameHistoryAccumulator) {
  accumulator.frameCount = 0
  accumulator.fpsTotal = 0
  accumulator.frameMsTotal = 0
  accumulator.pressureFrames.nominal = 0
  accumulator.pressureFrames.moderate = 0
  accumulator.pressureFrames.high = 0
  accumulator.backlogFrames = 0
  accumulator.terrainProcessed = 0
  accumulator.dirtyChunkSummariesProcessed = 0
}

function updateMainRuntimeFrameHistoryAccumulator(
  accumulator: MainRuntimeFrameHistoryAccumulator,
  summary: MainRuntimeFrameSummary,
  direction: 1 | -1,
) {
  accumulator.frameCount += direction
  accumulator.fpsTotal += summary.averageFps * direction
  accumulator.frameMsTotal += summary.averageFrameMs * direction
  accumulator.pressureFrames[summary.pressure] += direction
  if (summary.terrainRemaining > 0 || summary.dirtyChunkSummariesRemaining > 0) accumulator.backlogFrames += direction
  accumulator.terrainProcessed += summary.terrainProcessed * direction
  accumulator.dirtyChunkSummariesProcessed += summary.dirtyChunkSummariesProcessed * direction
}

function snapshotMainRuntimeFrameHistoryAccumulator(
  accumulator: MainRuntimeFrameHistoryAccumulator,
): MainRuntimeFrameHistorySnapshot {
  const frameCount = Math.max(0, accumulator.frameCount)
  return {
    frameCount,
    averageFps: frameCount > 0 ? accumulator.fpsTotal / frameCount : 0,
    averageFrameMs: frameCount > 0 ? accumulator.frameMsTotal / frameCount : 0,
    pressureFrames: { ...accumulator.pressureFrames },
    backlogFrames: Math.max(0, accumulator.backlogFrames),
    terrainProcessed: Math.max(0, accumulator.terrainProcessed),
    dirtyChunkSummariesProcessed: Math.max(0, accumulator.dirtyChunkSummariesProcessed),
  }
}

export function clampFrameHistoryLimit(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.floor(value))
}
