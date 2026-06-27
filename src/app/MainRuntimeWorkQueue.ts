import type { MainRuntimeWorkPlan } from './MainRuntimeAdapter'

export type MainRuntimeQueueTask<T = unknown> = (item: T) => void
export type MainRuntimeQueueKey = string | number
export type MainRuntimeQueueKeySelector<T = unknown> = (item: T) => MainRuntimeQueueKey

export type MainRuntimeQueueRunOptions<T = unknown> = {
  queue: T[]
  limit: number
  run: MainRuntimeQueueTask<T>
}

export type MainRuntimeQueueRunResult = {
  requested: number
  processed: number
  remaining: number
}

export type MainRuntimeTaskQueue<T = unknown> = {
  readonly length: number
  readonly pending: number
  enqueue: (item: T) => number
  drain: (limit: number) => T[]
  clear: () => void
  compact: () => void
}

export type MainRuntimeQueueLike<T = unknown> = T[] | MainRuntimeTaskQueue<T>

export type MainRuntimeUniqueTaskQueue<T = unknown> = MainRuntimeTaskQueue<T> & {
  readonly uniqueKeys: number
  enqueueUnique: (item: T) => number
  isQueued: (key: MainRuntimeQueueKey) => boolean
}

export type MainRuntimeWorkQueues<TerrainTask = unknown, DirtyTask = unknown> = {
  terrainQueue?: MainRuntimeQueueLike<TerrainTask>
  dirtyChunkSummaryQueue?: MainRuntimeQueueLike<DirtyTask>
  runTerrainTask?: MainRuntimeQueueTask<TerrainTask>
  runDirtyChunkSummaryTask?: MainRuntimeQueueTask<DirtyTask>
}

export type MainRuntimeWorkQueueResult = {
  terrain: MainRuntimeQueueRunResult
  dirtyChunkSummaries: MainRuntimeQueueRunResult
  diagnosticsLimit: number
}

const QUEUE_COMPACTION_THRESHOLD = 256

export function createMainRuntimeTaskQueue<T>(initialItems: T[] = []): MainRuntimeTaskQueue<T> {
  let items = [...initialItems]
  let cursor = 0

  const compact = () => {
    if (cursor <= 0) return
    items = items.slice(cursor)
    cursor = 0
  }

  return {
    get length() {
      return items.length - cursor
    },
    get pending() {
      return items.length - cursor
    },
    enqueue: (item) => {
      items.push(item)
      return items.length - cursor
    },
    drain: (limit) => {
      const requested = clampQueueLimit(limit)
      const available = items.length - cursor
      if (requested <= 0 || available <= 0) return []
      const count = Math.min(requested, available)
      const drained = items.slice(cursor, cursor + count)
      cursor += count
      if (cursor >= items.length) {
        items.length = 0
        cursor = 0
      } else if (cursor >= QUEUE_COMPACTION_THRESHOLD && cursor > items.length / 2) {
        compact()
      }
      return drained
    },
    clear: () => {
      items.length = 0
      cursor = 0
    },
    compact,
  }
}

export function createMainRuntimeUniqueTaskQueue<T>(
  getKey: MainRuntimeQueueKeySelector<T>,
  initialItems: T[] = [],
): MainRuntimeUniqueTaskQueue<T> {
  const queue = createMainRuntimeTaskQueue<T>()
  const queuedKeys = new Set<MainRuntimeQueueKey>()

  const enqueueUnique = (item: T) => {
    const key = getKey(item)
    if (queuedKeys.has(key)) return queue.pending
    queuedKeys.add(key)
    return queue.enqueue(item)
  }

  for (const item of initialItems) enqueueUnique(item)

  return {
    get length() {
      return queue.length
    },
    get pending() {
      return queue.pending
    },
    get uniqueKeys() {
      return queuedKeys.size
    },
    enqueue: enqueueUnique,
    enqueueUnique,
    drain: (limit) => {
      const drained = queue.drain(limit)
      for (const item of drained) queuedKeys.delete(getKey(item))
      return drained
    },
    clear: () => {
      queue.clear()
      queuedKeys.clear()
    },
    compact: () => queue.compact(),
    isQueued: (key) => queuedKeys.has(key),
  }
}

export function runMainRuntimeQueue<T>({ queue, limit, run }: MainRuntimeQueueRunOptions<T>): MainRuntimeQueueRunResult {
  const requested = clampQueueLimit(limit)
  const items = drainMainRuntimeQueue(queue, requested)

  for (const item of items) run(item)

  return {
    requested,
    processed: items.length,
    remaining: queue.length,
  }
}

export function runMainRuntimeTaskQueue<T>(
  queue: MainRuntimeTaskQueue<T>,
  limit: number,
  run: MainRuntimeQueueTask<T>,
): MainRuntimeQueueRunResult {
  const requested = clampQueueLimit(limit)
  const items = queue.drain(requested)
  for (const item of items) run(item)
  return {
    requested,
    processed: items.length,
    remaining: queue.pending,
  }
}

export function runMainRuntimeQueueLike<T>(
  queue: MainRuntimeQueueLike<T>,
  limit: number,
  run: MainRuntimeQueueTask<T>,
): MainRuntimeQueueRunResult {
  return isMainRuntimeTaskQueue(queue)
    ? runMainRuntimeTaskQueue(queue, limit, run)
    : runMainRuntimeQueue({ queue, limit, run })
}

export function getMainRuntimeQueuePending<T>(queue?: MainRuntimeQueueLike<T>) {
  if (!queue) return 0
  return isMainRuntimeTaskQueue(queue) ? queue.pending : queue.length
}

export function isMainRuntimeTaskQueue<T>(queue: MainRuntimeQueueLike<T>): queue is MainRuntimeTaskQueue<T> {
  return !Array.isArray(queue) && 'drain' in queue && 'enqueue' in queue
}

export function drainMainRuntimeQueue<T>(queue: T[], limit: number) {
  const requested = clampQueueLimit(limit)
  if (requested <= 0 || queue.length === 0) return []
  return queue.splice(0, Math.min(requested, queue.length))
}

export function runMainRuntimeWorkQueues<TerrainTask, DirtyTask>(
  plan: MainRuntimeWorkPlan,
  queues: MainRuntimeWorkQueues<TerrainTask, DirtyTask>,
): MainRuntimeWorkQueueResult {
  const terrain = queues.terrainQueue && queues.runTerrainTask
    ? runMainRuntimeQueueLike(queues.terrainQueue, plan.terrainChunksToRun, queues.runTerrainTask)
    : emptyQueueRunResult(plan.terrainChunksToRun, getMainRuntimeQueuePending(queues.terrainQueue))

  const dirtyChunkSummaries = queues.dirtyChunkSummaryQueue && queues.runDirtyChunkSummaryTask
    ? runMainRuntimeQueueLike(queues.dirtyChunkSummaryQueue, plan.dirtyChunkSummariesToRun, queues.runDirtyChunkSummaryTask)
    : emptyQueueRunResult(plan.dirtyChunkSummariesToRun, getMainRuntimeQueuePending(queues.dirtyChunkSummaryQueue))

  return {
    terrain,
    dirtyChunkSummaries,
    diagnosticsLimit: plan.dirtyChunkDiagnosticsLimit,
  }
}

export function emptyQueueRunResult(limit: number, remaining = 0): MainRuntimeQueueRunResult {
  return {
    requested: clampQueueLimit(limit),
    processed: 0,
    remaining: clampQueueLimit(remaining),
  }
}

export function clampQueueLimit(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}
