import { formatMainRuntimeFrameSummary, isMainRuntimeFrameBacklogged, type MainRuntimeFrameSummary } from './MainRuntimeFrameSummary'
import { formatMainRuntimeWorkQueueTelemetry, type MainRuntimeWorkQueueTelemetry } from './MainRuntimeQueueTelemetry'

export type MainRuntimeHealthLevel = 'nominal' | 'busy' | 'strained' | 'critical'

export type MainRuntimeHealthReport = {
  health: MainRuntimeHealthLevel
  isBacklogged: boolean
  frame: MainRuntimeFrameSummary
  queues: MainRuntimeWorkQueueTelemetry
  label: string
}

export type MainRuntimeHealthReportInput = {
  frame: MainRuntimeFrameSummary
  queues: MainRuntimeWorkQueueTelemetry
}

export function createMainRuntimeHealthReport({ frame, queues }: MainRuntimeHealthReportInput): MainRuntimeHealthReport {
  const isBacklogged = isMainRuntimeFrameBacklogged(frame)
  const health = getMainRuntimeHealthLevel(frame, queues)
  const label = formatMainRuntimeHealthReport({ health, isBacklogged, frame, queues, label: '' })

  return {
    health,
    isBacklogged,
    frame,
    queues,
    label,
  }
}

export function getMainRuntimeHealthLevel(
  frame: MainRuntimeFrameSummary,
  queues: MainRuntimeWorkQueueTelemetry,
): MainRuntimeHealthLevel {
  if (frame.pressure === 'high' || queues.pressure === 'dropping') return 'critical'
  if (frame.pressure === 'moderate' || queues.pressure === 'strained' || isMainRuntimeFrameBacklogged(frame)) return 'strained'
  if (queues.pressure === 'busy' || frame.didRunTerrain || frame.didRunDirtyChunkSummaries || frame.didRunDiagnostics) return 'busy'
  return 'nominal'
}

export function formatMainRuntimeHealthReport(report: Omit<MainRuntimeHealthReport, 'label'>) {
  return [
    `health=${report.health}`,
    `backlogged=${report.isBacklogged}`,
    formatMainRuntimeFrameSummary(report.frame),
    formatMainRuntimeWorkQueueTelemetry(report.queues),
  ].join(' | ')
}
