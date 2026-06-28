import { createMainRuntimeHealthReport, type MainRuntimeHealthLevel } from './MainRuntimeHealthReport'
import type { MainRuntimeFrameSummary } from './MainRuntimeFrameSummary'
import type { MainRuntimeWorkQueueTelemetry } from './MainRuntimeQueueTelemetry'

export type MainRuntimeHealthReportSmokeResult = {
  nominal: MainRuntimeHealthLevel
  busy: MainRuntimeHealthLevel
  strained: MainRuntimeHealthLevel
  critical: MainRuntimeHealthLevel
  criticalLabel: string
}

export function runMainRuntimeHealthReportSmoke(): MainRuntimeHealthReportSmokeResult {
  const nominal = createMainRuntimeHealthReport({ frame: createFrameSummary(), queues: createQueueTelemetry() })
  const busy = createMainRuntimeHealthReport({
    frame: createFrameSummary({ didRunDirtyChunkSummaries: true }),
    queues: createQueueTelemetry({ pressure: 'busy', dirtyPending: 1 }),
  })
  const strained = createMainRuntimeHealthReport({
    frame: createFrameSummary({ terrainRemaining: 1 }),
    queues: createQueueTelemetry({ pressure: 'strained', dirtySaturation: 0.75 }),
  })
  const critical = createMainRuntimeHealthReport({
    frame: createFrameSummary({ pressure: 'high', dirtyChunkSummariesRemaining: 1 }),
    queues: createQueueTelemetry({ pressure: 'dropping', dirtyPending: 4, dirtyDropped: 1, dirtySaturation: 1, dirtyIsFull: true }),
  })

  return {
    nominal: nominal.health,
    busy: busy.health,
    strained: strained.health,
    critical: critical.health,
    criticalLabel: critical.label,
  }
}

export function assertMainRuntimeHealthReportSmoke(result = runMainRuntimeHealthReportSmoke()) {
  if (result.nominal !== 'nominal' || result.busy !== 'busy' || result.strained !== 'strained' || result.critical !== 'critical') {
    throw new Error('Main runtime health report smoke failed: health levels should escalate from nominal to critical')
  }

  if (!result.criticalLabel.includes('health=critical') || !result.criticalLabel.includes('queues=dropping') || !result.criticalLabel.includes('pressure=high') || !result.criticalLabel.includes('dropped=1')) {
    throw new Error('Main runtime health report smoke failed: critical label should include health, frame pressure, queue pressure, and dropped work')
  }

  return result
}

function createFrameSummary(overrides: Partial<MainRuntimeFrameSummary> = {}): MainRuntimeFrameSummary {
  return {
    pressure: 'nominal',
    averageFps: 60,
    averageFrameMs: 16,
    terrainProcessed: 0,
    terrainRemaining: 0,
    dirtyChunkSummariesProcessed: 0,
    dirtyChunkSummariesRemaining: 0,
    diagnosticsLimit: 0,
    didRunTerrain: false,
    didRunDirtyChunkSummaries: false,
    didRunDiagnostics: false,
    ...overrides,
  }
}

function createQueueTelemetry({
  pressure = 'idle',
  dirtyPending = 0,
  dirtyDropped = 0,
  dirtySaturation = null,
  dirtyIsFull = false,
}: {
  pressure?: MainRuntimeWorkQueueTelemetry['pressure']
  dirtyPending?: number
  dirtyDropped?: number
  dirtySaturation?: number | null
  dirtyIsFull?: boolean
} = {}): MainRuntimeWorkQueueTelemetry {
  return {
    pressure,
    terrain: {
      pending: 0,
      maxPending: null,
      dropped: 0,
      saturation: null,
      isFull: false,
      hasDropped: false,
      pressure: 'idle',
    },
    dirtyChunkSummaries: {
      pending: dirtyPending,
      maxPending: 4,
      dropped: dirtyDropped,
      saturation: dirtySaturation,
      isFull: dirtyIsFull,
      hasDropped: dirtyDropped > 0,
      pressure,
    },
  }
}
