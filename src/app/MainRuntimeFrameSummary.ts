import type { MainRuntimePressure } from './MainRuntimeAdapter'
import type { MainRuntimeFrameScheduleResult } from './MainRuntimeFrameScheduler'

export type MainRuntimeFrameSummary = {
  pressure: MainRuntimePressure
  averageFps: number
  averageFrameMs: number
  terrainProcessed: number
  terrainRemaining: number
  dirtyChunkSummariesProcessed: number
  dirtyChunkSummariesRemaining: number
  diagnosticsLimit: number
  didRunTerrain: boolean
  didRunDirtyChunkSummaries: boolean
  didRunDiagnostics: boolean
}

export function summarizeMainRuntimeFrame(result: MainRuntimeFrameScheduleResult): MainRuntimeFrameSummary {
  return {
    pressure: result.frame.budget.pressure,
    averageFps: result.frame.sample.averageFps,
    averageFrameMs: result.frame.sample.averageFrameMs,
    terrainProcessed: result.queues.terrain.processed,
    terrainRemaining: result.queues.terrain.remaining,
    dirtyChunkSummariesProcessed: result.queues.dirtyChunkSummaries.processed,
    dirtyChunkSummariesRemaining: result.queues.dirtyChunkSummaries.remaining,
    diagnosticsLimit: result.queues.diagnosticsLimit,
    didRunTerrain: result.queues.terrain.processed > 0,
    didRunDirtyChunkSummaries: result.queues.dirtyChunkSummaries.processed > 0,
    didRunDiagnostics: result.queues.diagnosticsLimit > 0,
  }
}

export function isMainRuntimeFrameBacklogged(summary: MainRuntimeFrameSummary) {
  return summary.terrainRemaining > 0 || summary.dirtyChunkSummariesRemaining > 0
}

export function formatMainRuntimeFrameSummary(summary: MainRuntimeFrameSummary) {
  return [
    `pressure=${summary.pressure}`,
    `fps=${Math.round(summary.averageFps)}`,
    `frameMs=${summary.averageFrameMs.toFixed(1)}`,
    `terrain=${summary.terrainProcessed}/${summary.terrainProcessed + summary.terrainRemaining}`,
    `dirty=${summary.dirtyChunkSummariesProcessed}/${summary.dirtyChunkSummariesProcessed + summary.dirtyChunkSummariesRemaining}`,
    `diagnostics=${summary.diagnosticsLimit}`,
  ].join(' ')
}
