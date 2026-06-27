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

export type MainRuntimeFrameHistory = {
  readonly summaries: readonly MainRuntimeFrameSummary[]
  record: (summary: MainRuntimeFrameSummary) => MainRuntimeFrameHistorySnapshot
  snapshot: () => MainRuntimeFrameHistorySnapshot
  clear: () => void
}

export function createMainRuntimeFrameHistory(limit = 120): MainRuntimeFrameHistory {
  const summaries: MainRuntimeFrameSummary[] = []
  const capacity = clampFrameHistoryLimit(limit)

  return {
    summaries,
    record: (summary) => {
      summaries.push(summary)
      while (summaries.length > capacity) summaries.shift()
      return getMainRuntimeFrameHistorySnapshot(summaries)
    },
    snapshot: () => getMainRuntimeFrameHistorySnapshot(summaries),
    clear: () => {
      summaries.length = 0
    },
  }
}

export function getMainRuntimeFrameHistorySnapshot(
  summaries: readonly MainRuntimeFrameSummary[],
): MainRuntimeFrameHistorySnapshot {
  const pressureFrames: Record<MainRuntimePressure, number> = { nominal: 0, moderate: 0, high: 0 }
  let averageFps = 0
  let averageFrameMs = 0
  let backlogFrames = 0
  let terrainProcessed = 0
  let dirtyChunkSummariesProcessed = 0

  for (const summary of summaries) {
    pressureFrames[summary.pressure] += 1
    averageFps += summary.averageFps
    averageFrameMs += summary.averageFrameMs
    if (summary.terrainRemaining > 0 || summary.dirtyChunkSummariesRemaining > 0) backlogFrames += 1
    terrainProcessed += summary.terrainProcessed
    dirtyChunkSummariesProcessed += summary.dirtyChunkSummariesProcessed
  }

  const frameCount = summaries.length
  return {
    frameCount,
    averageFps: frameCount > 0 ? averageFps / frameCount : 0,
    averageFrameMs: frameCount > 0 ? averageFrameMs / frameCount : 0,
    pressureFrames,
    backlogFrames,
    terrainProcessed,
    dirtyChunkSummariesProcessed,
  }
}

export function clampFrameHistoryLimit(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.floor(value))
}
