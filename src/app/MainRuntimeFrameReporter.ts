import { formatMainRuntimeFrameSummary, type MainRuntimeFrameSummary } from './MainRuntimeFrameSummary'

export type MainRuntimeFrameTimestampUnit = 'milliseconds' | 'seconds'

export type MainRuntimeFrameReporterOptions = {
  minIntervalMs?: number
  timestampUnit?: MainRuntimeFrameTimestampUnit
}

export type MainRuntimeFrameReport = {
  label: string
  shouldPublish: boolean
  lastPublishedAt: number
}

export type MainRuntimeFrameReporter = {
  report: (summary: MainRuntimeFrameSummary, timestampMs?: number) => MainRuntimeFrameReport
  peek: () => string
  reset: () => void
}

const DEFAULT_SUMMARY_REPORT_INTERVAL_MS = 250
const MILLISECONDS_PER_SECOND = 1000

export function createMainRuntimeFrameReporter({
  minIntervalMs = DEFAULT_SUMMARY_REPORT_INTERVAL_MS,
  timestampUnit = 'milliseconds',
}: MainRuntimeFrameReporterOptions = {}): MainRuntimeFrameReporter {
  const interval = clampMainRuntimeFrameReportInterval(minIntervalMs)
  let lastLabel = ''
  let lastSourceKey = ''
  let lastPublishedAt = -Infinity

  return {
    report: (summary, timestamp = Date.now()) => {
      const sourceKey = getMainRuntimeFrameSummaryKey(summary)
      const label = sourceKey === lastSourceKey && lastLabel ? lastLabel : formatMainRuntimeFrameSummary(summary)
      const normalizedTimestampMs = normalizeMainRuntimeFrameTimestamp(timestamp, timestampUnit)
      const shouldPublish = shouldPublishMainRuntimeFrameSummary({
        label,
        lastLabel,
        timestampMs: normalizedTimestampMs,
        lastPublishedAt,
        minIntervalMs: interval,
      })

      if (shouldPublish) {
        lastLabel = label
        lastSourceKey = sourceKey
        lastPublishedAt = normalizedTimestampMs
      }

      return {
        label: lastLabel || label,
        shouldPublish,
        lastPublishedAt,
      }
    },
    peek: () => lastLabel,
    reset: () => {
      lastLabel = ''
      lastSourceKey = ''
      lastPublishedAt = -Infinity
    },
  }
}

export function shouldPublishMainRuntimeFrameSummary({
  label,
  lastLabel,
  timestampMs,
  lastPublishedAt,
  minIntervalMs,
}: {
  label: string
  lastLabel: string
  timestampMs: number
  lastPublishedAt: number
  minIntervalMs: number
}) {
  if (!label) return false
  if (label === lastLabel) return false
  return normalizeMainRuntimeFrameTimestamp(timestampMs, 'milliseconds') - lastPublishedAt >= clampMainRuntimeFrameReportInterval(minIntervalMs)
}

export function getMainRuntimeFrameSummaryKey(summary: MainRuntimeFrameSummary) {
  return [
    summary.pressure,
    Math.round(summary.averageFps),
    summary.averageFrameMs.toFixed(1),
    summary.terrainProcessed,
    summary.terrainRemaining,
    summary.dirtyChunkSummariesProcessed,
    summary.dirtyChunkSummariesRemaining,
    summary.diagnosticsLimit,
  ].join('|')
}

export function normalizeMainRuntimeFrameTimestamp(
  timestamp: number,
  unit: MainRuntimeFrameTimestampUnit = 'milliseconds',
) {
  if (!Number.isFinite(timestamp)) return Date.now()
  return unit === 'seconds' ? Math.floor(timestamp * MILLISECONDS_PER_SECOND) : Math.floor(timestamp)
}

export function clampMainRuntimeFrameReportInterval(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SUMMARY_REPORT_INTERVAL_MS
  return Math.max(0, Math.floor(value))
}
