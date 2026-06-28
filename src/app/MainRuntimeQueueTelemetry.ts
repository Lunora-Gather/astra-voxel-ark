import { getMainRuntimeQueuePending, isMainRuntimeTaskQueue, type MainRuntimeQueueLike } from './MainRuntimeWorkQueue'

export type MainRuntimeQueuePressure = 'idle' | 'busy' | 'strained' | 'dropping'

export type MainRuntimeQueueTelemetry = {
  pending: number
  maxPending: number | null
  dropped: number
  saturation: number | null
  isFull: boolean
  hasDropped: boolean
  pressure: MainRuntimeQueuePressure
}

export type MainRuntimeWorkQueueTelemetry = {
  terrain: MainRuntimeQueueTelemetry
  dirtyChunkSummaries: MainRuntimeQueueTelemetry
  pressure: MainRuntimeQueuePressure
}

export type MainRuntimeWorkQueueTelemetryOptions<TerrainTask = unknown, DirtyTask = unknown> = {
  terrainQueue?: MainRuntimeQueueLike<TerrainTask>
  dirtyChunkSummaryQueue?: MainRuntimeQueueLike<DirtyTask>
}

export function getMainRuntimeQueueTelemetry<T>(queue?: MainRuntimeQueueLike<T>): MainRuntimeQueueTelemetry {
  const pending = getMainRuntimeQueuePending(queue)

  if (!queue || !isMainRuntimeTaskQueue(queue)) {
    const pressure = getMainRuntimeQueuePressure({ pending, maxPending: null, dropped: 0, saturation: null, isFull: false, hasDropped: false })
    return {
      pending,
      maxPending: null,
      dropped: 0,
      saturation: null,
      isFull: false,
      hasDropped: false,
      pressure,
    }
  }

  const saturation = getMainRuntimeQueueSaturation(pending, queue.maxPending)
  const hasDropped = queue.dropped > 0
  const isFull = queue.maxPending !== null && pending >= queue.maxPending
  const pressure = getMainRuntimeQueuePressure({ pending, maxPending: queue.maxPending, dropped: queue.dropped, saturation, isFull, hasDropped })

  return {
    pending,
    maxPending: queue.maxPending,
    dropped: queue.dropped,
    saturation,
    isFull,
    hasDropped,
    pressure,
  }
}

export function getMainRuntimeWorkQueueTelemetry<TerrainTask = unknown, DirtyTask = unknown>({
  terrainQueue,
  dirtyChunkSummaryQueue,
}: MainRuntimeWorkQueueTelemetryOptions<TerrainTask, DirtyTask> = {}): MainRuntimeWorkQueueTelemetry {
  const terrain = getMainRuntimeQueueTelemetry(terrainQueue)
  const dirtyChunkSummaries = getMainRuntimeQueueTelemetry(dirtyChunkSummaryQueue)

  return {
    terrain,
    dirtyChunkSummaries,
    pressure: getMainRuntimeWorkQueuePressure(terrain, dirtyChunkSummaries),
  }
}

export function formatMainRuntimeQueueTelemetry(name: string, telemetry: MainRuntimeQueueTelemetry) {
  const capacity = telemetry.maxPending === null ? `${telemetry.pending}/uncapped` : `${telemetry.pending}/${telemetry.maxPending}`
  const saturation = telemetry.saturation === null ? 'uncapped' : `${Math.round(telemetry.saturation * 100)}%`
  const fullness = telemetry.isFull ? 'full' : 'ok'
  const dropped = telemetry.hasDropped ? `dropped=${telemetry.dropped}` : 'dropped=0'
  return `${name}=${capacity} sat=${saturation} ${fullness} ${dropped} pressure=${telemetry.pressure}`
}

export function formatMainRuntimeWorkQueueTelemetry(telemetry: MainRuntimeWorkQueueTelemetry) {
  return [
    `queues=${telemetry.pressure}`,
    formatMainRuntimeQueueTelemetry('terrain', telemetry.terrain),
    formatMainRuntimeQueueTelemetry('dirty', telemetry.dirtyChunkSummaries),
  ].join(' | ')
}

export function getMainRuntimeQueuePressure(telemetry: Omit<MainRuntimeQueueTelemetry, 'pressure'>): MainRuntimeQueuePressure {
  if (telemetry.hasDropped || telemetry.isFull) return 'dropping'
  if ((telemetry.saturation ?? 0) >= 0.75) return 'strained'
  if (telemetry.pending > 0) return 'busy'
  return 'idle'
}

export function getMainRuntimeWorkQueuePressure(
  terrain: MainRuntimeQueueTelemetry,
  dirtyChunkSummaries: MainRuntimeQueueTelemetry,
): MainRuntimeQueuePressure {
  if (terrain.pressure === 'dropping' || dirtyChunkSummaries.pressure === 'dropping') return 'dropping'
  if (terrain.pressure === 'strained' || dirtyChunkSummaries.pressure === 'strained') return 'strained'
  if (terrain.pressure === 'busy' || dirtyChunkSummaries.pressure === 'busy') return 'busy'
  return 'idle'
}

export function getMainRuntimeQueueSaturation(pending: number, maxPending: number | null) {
  if (maxPending === null) return null
  if (maxPending <= 0) return pending > 0 ? 1 : 0
  return Math.min(1, Math.max(0, pending / maxPending))
}
