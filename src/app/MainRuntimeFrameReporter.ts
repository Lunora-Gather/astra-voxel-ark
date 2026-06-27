import { formatMainRuntimeFrameSummary, type MainRuntimeFrameSummary } from './MainRuntimeFrameSummary'

export type MainRuntimeFrameReporterOptions = {
  minIntervalMs?: number
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

export function createMainRuntimeFrameReporter({
  minIntervalMs = DEFAULT_SUMMARY_REPORT_INTERVAL_MS,
}: MainRuntimeFrameReporterOptions = {}): MainRuntimeFrameReporter {
  const interval = clampMainRuntimeFrameReportInterval(minIntervalMs)
  let lastLabel = ''
  let lastPublishedAt = -Infinity

  return {
    report: (summary, timestampMs = Date.now()) => {
      const label = formatMainRuntimeFrameSummary(summary)
      const shouldPublish = shouldPublishMainRuntimeFrameSummary({
        label,
        lastLabel,
        timestampMs,
        lastPublishedAt,
        minIntervalMs: interval,
      })

      if (shouldPublish) {
        lastLabel = label
        lastPublishedAt = timestampMs
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
  return timestampMs - lastPublishedAt >= clampMainRuntimeFrameReportInterval(minIntervalMs)
}

export function clampMainRuntimeFrameReportInterval(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SUMMARY_REPORT_INTERVAL_MS
  return Math.max(0, Math.floor(value))
}
