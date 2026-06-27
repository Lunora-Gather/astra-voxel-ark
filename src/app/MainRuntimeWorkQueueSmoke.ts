import { planMainRuntimeWork } from './MainRuntimeAdapter'
import { createMainRuntimeUniqueTaskQueue, runMainRuntimeTaskQueue, runMainRuntimeWorkQueues } from './MainRuntimeWorkQueue'

export type MainRuntimeWorkQueueSmokeResult = {
  initialPending: number
  initialUniqueKeys: number
  processedFirstBatch: number
  remainingAfterFirstBatch: number
  requeuedAfterDrain: number
  queueLikeDirtyProcessed: number
  queueLikeDirtyRemaining: number
  processedItems: string[]
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
    queueLikeDirtyProcessed: queueLikeResult.dirtyChunkSummaries.processed,
    queueLikeDirtyRemaining: queueLikeResult.dirtyChunkSummaries.remaining,
    processedItems,
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

  if (result.queueLikeDirtyProcessed !== 2 || result.queueLikeDirtyRemaining !== 1 || result.queueLikeProcessedItems.join(',') !== 'dirty-a,dirty-b') {
    throw new Error('Main runtime work queue smoke failed: work queue runner should accept queue-like dirty queues')
  }

  return result
}
