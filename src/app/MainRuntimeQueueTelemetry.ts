import { getMainRuntimeQueuePending, isMainRuntimeTaskQueue, type MainRuntimeQueueLike } from './MainRuntimeWorkQueue'

export type MainRuntimeQueueTelemetry = {
  pending: number
  maxPending: number | null
  dropped: number
  saturation: number | null
  isFull: boolean
  hasDropped: boolean
}

export type MainRuntimeWorkQueueTelemetry = {
  terrain: MainRuntimeQueueTelemetry
  dirtyChunkSummaries: MainRuntimeQueueTelemetry
}

export type MainRuntimeWorkQueueTelemetryOptions<TerrainTask = unknown, DirtyTask = unknown> = {
  terrainQueue?: MainRuntimeQueueLike<TerrainTask>
  dirtyChunkSummaryQueue?: MainRuntimeQueueLike<DirtyTask>
}

export function getMainRuntimeQueueTelemetry<T>(queue?: MainRuntimeQueueLike<T>): MainRuntimeQueueTelemetry {
  const pending = getMainRuntimeQueuePending(queue)

  if (!queue || !isMainRuntimeTaskQueue(queue)) {
    return {
      pending,
      maxPending: null,
      dropped: 0,
      saturation: null,
      isFull: false,
      hasDropped: false,
    }
  }

  const saturation = getMainRuntimeQueueSaturation(pending, queue.maxPending)

  return {
    pending,
    maxPending: queue.maxPending,
    dropped: queue.dropped,
    saturation,
    isFull: queue.maxPending !== null && pending >= queue.maxPending,
    hasDropped: queue.dropped > 0,
  }
}

export function getMainRuntimeWorkQueueTelemetry<TerrainTask = unknown, DirtyTask = unknown>({
  terrainQueue,
  dirtyChunkSummaryQueue,
}: MainRuntimeWorkQueueTelemetryOptions<TerrainTask, DirtyTask> = {}): MainRuntimeWorkQueueTelemetry {
  return {
    terrain: getMainRuntimeQueueTelemetry(terrainQueue),
    dirtyChunkSummaries: getMainRuntimeQueueTelemetry(dirtyChunkSummaryQueue),
  }
}

export function formatMainRuntimeQueueTelemetry(name: string, telemetry: MainRuntimeQueueTelemetry) {
  const capacity = telemetry.maxPending === null ? `${telemetry.pending}/uncapped` : `${telemetry.pending}/${telemetry.maxPending}`
  const saturation = telemetry.saturation === null ? 'uncapped' : `${Math.round(telemetry.saturation * 100)}%`
  const fullness = telemetry.isFull ? 'full' : 'ok'
  const dropped = telemetry.hasDropped ? `dropped=${telemetry.dropped}` : 'dropped=0'
  return `${name}=${capacity} sat=${saturation} ${fullness} ${dropped}`
}

export function formatMainRuntimeWorkQueueTelemetry(telemetry: MainRuntimeWorkQueueTelemetry) {
  return [
    formatMainRuntimeQueueTelemetry('terrain', telemetry.terrain),
    formatMainRuntimeQueueTelemetry('dirty', telemetry.dirtyChunkSummaries),
  ].join(' | ')
}

export function getMainRuntimeQueueSaturation(pending: number, maxPending: number | null) {
  if (maxPending === null) return null
  if (maxPending <= 0) return pending > 0 ? 1 : 0
  return Math.min(1, Math.max(0, pending / maxPending))
}
