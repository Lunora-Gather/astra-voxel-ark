import { planMainRuntimeWork } from './MainRuntimeAdapter'
import { createMainRuntimeTaskQueue, createMainRuntimeUniqueTaskQueue, runMainRuntimeTaskQueue, runMainRuntimeWorkQueues } from './MainRuntimeWorkQueue'

export type MainRuntimeWorkQueueSmokeResult = {
  initialPending: number
  initialUniqueKeys: number
  processedFirstBatch: number
  remainingAfterFirstBatch: number
  requeuedAfterDrain: number
  consumeProcessed: number
  consumeRemaining: number
  cappedPending: number
  cappedMaxPending: number | null
  cappedDropped: number
  cappedTryAccepted: boolean
  cappedTryDropped: number
  cappedUniquePending: number
  cappedUniqueKeys: number
  cappedUniqueDropped: number
  cappedUniqueTryAccepted: boolean
  cappedUniqueTryDropped: number
  queueLikeDirtyProcessed: number
  queueLikeDirtyRemaining: number
  processedItems: string[]
  consumeProcessedItems: string[]
  queueLikeProcessedItems: string[]
}

export function runMainRuntimeWorkQueueSmoke(): MainRuntimeWorkQueueSmokeResult {
  const queue = createMainRuntimeUniqueTaskQueue<string>((task) => task, ['chunk-a', 'chunk-a', 'chunk-b'])
  const processedItems: string[] = []

  const initialPending = queue.pending
  const initialUniqueKeys = queue.uniqueKeys
  const firstBatch = runMainRuntimeTaskQueue(queue, 1, (task) => processedItems.push(task))
  const requeuedAfterDrain = queue.enqueueUnique('chunk-a')
  runMainRuntimeTaskQueue(queue, 4, (task) => processedItems.push(task))

  const consumeQueue = createMainRuntimeTaskQueue(['consume-a', 'consume-b', 'consume-c'])
  const consumeProcessedItems: string[] = []
  const consumeResult = consumeQueue.consume?.(2, (task) => consumeProcessedItems.push(task)) ?? {
    requested: 0,
    processed: 0,
    remaining: consumeQueue.pending,
  }

  const cappedQueue = createMainRuntimeTaskQueue(['cap-a', 'cap-b', 'cap-c'], { maxPending: 2 })
  const cappedPending = cappedQueue.enqueue('cap-d')
  const cappedTry = cappedQueue.tryEnqueue('cap-e')
  const cappedUniqueQueue = createMainRuntimeUniqueTaskQueue<string>((task) => task, ['unique-a', 'unique-b', 'unique-c'], { maxPending: 2 })
  const cappedUniquePending = cappedUniqueQueue.enqueueUnique('unique-d')
  const cappedUniqueTry = cappedUniqueQueue.tryEnqueueUnique('unique-e')

  const queueLikeDirtyQueue = createMainRuntimeUniqueTaskQueue<string>((task) => task, ['dirty-a', 'dirty-a', 'dirty-b', 'dirty-c'])
  const queueLikeProcessedItems: string[] = []
  const queueLikePlan = planMainRuntimeWork(
    { pressure: 'high', terrainChunksPerFrame: 0, dirtyChunkSummariesPerFrame: 2, dirtyChunkDiagnosticsLimit: 1 },
    { pendingTerrainChunks: 0, pendingDirtyChunkSummaries: queueLikeDirtyQueue.pending },
  )
  const queueLikeResult = runMainRuntimeWorkQueues(queueLikePlan, {
    dirtyChunkSummaryQueue: queueLikeDirtyQueue,
    runDirtyChunkSummaryTask: (task) => queueLikeProcessedItems.push(task),
  })

  return {
    initialPending,
    initialUniqueKeys,
    processedFirstBatch: firstBatch.processed,
    remainingAfterFirstBatch: firstBatch.remaining,
    requeuedAfterDrain,
    consumeProcessed: consumeResult.processed,
    consumeRemaining: consumeResult.remaining,
    cappedPending,
    cappedMaxPending: cappedQueue.maxPending,
    cappedDropped: cappedQueue.dropped,
    cappedTryAccepted: cappedTry.accepted,
    cappedTryDropped: cappedTry.dropped,
    cappedUniquePending,
    cappedUniqueKeys: cappedUniqueQueue.uniqueKeys,
    cappedUniqueDropped: cappedUniqueQueue.dropped,
    cappedUniqueTryAccepted: cappedUniqueTry.accepted,
    cappedUniqueTryDropped: cappedUniqueTry.dropped,
    queueLikeDirtyProcessed: queueLikeResult.dirtyChunkSummaries.processed,
    queueLikeDirtyRemaining: queueLikeResult.dirtyChunkSummaries.remaining,
    processedItems,
    consumeProcessedItems,
    queueLikeProcessedItems,
  }
}

export function assertMainRuntimeWorkQueueSmoke(result = runMainRuntimeWorkQueueSmoke()) {
  if (result.initialPending !== 2 || result.initialUniqueKeys !== 2) {
    throw new Error('Main runtime work queue smoke failed: duplicate initial tasks should be coalesced')
  }

  if (result.processedFirstBatch !== 1 || result.remainingAfterFirstBatch !== 1) {
    throw new Error('Main runtime work queue smoke failed: first batch should drain only the requested unique item')
  }

  if (result.requeuedAfterDrain !== 2) {
    throw new Error('Main runtime work queue smoke failed: drained keys should be allowed to re-enter the queue')
  }

  if (result.processedItems.join(',') !== 'chunk-a,chunk-b,chunk-a') {
    throw new Error(`Main runtime work queue smoke failed: unexpected processing order ${result.processedItems.join(',')}`)
  }

  if (result.consumeProcessed !== 2 || result.consumeRemaining !== 1 || result.consumeProcessedItems.join(',') !== 'consume-a,consume-b') {
    throw new Error('Main runtime work queue smoke failed: task queues should consume items without materializing drain arrays')
  }

  if (result.cappedPending !== 2 || result.cappedMaxPending !== 2 || result.cappedDropped !== 2 || result.cappedTryAccepted || result.cappedTryDropped !== 2) {
    throw new Error('Main runtime work queue smoke failed: capped queues should reject and count excess pending work')
  }

  if (result.cappedUniquePending !== 2 || result.cappedUniqueKeys !== 2 || result.cappedUniqueDropped !== 2 || result.cappedUniqueTryAccepted || result.cappedUniqueTryDropped !== 2) {
    throw new Error('Main runtime work queue smoke failed: capped unique queues should reject and count excess unique work')
  }

  if (result.queueLikeDirtyProcessed !== 2 || result.queueLikeDirtyRemaining !== 1 || result.queueLikeProcessedItems.join(',') !== 'dirty-a,dirty-b') {
    throw new Error('Main runtime work queue smoke failed: work queue runner should accept queue-like dirty queues')
  }

  return result
}
