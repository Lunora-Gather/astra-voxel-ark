import { createMainRuntimeUniqueTaskQueue, runMainRuntimeTaskQueue } from './MainRuntimeWorkQueue'

export type MainRuntimeWorkQueueSmokeResult = {
  initialPending: number
  initialUniqueKeys: number
  processedFirstBatch: number
  remainingAfterFirstBatch: number
  requeuedAfterDrain: number
  processedItems: string[]
}

export function runMainRuntimeWorkQueueSmoke(): MainRuntimeWorkQueueSmokeResult {
  const queue = createMainRuntimeUniqueTaskQueue<string>((task) => task, ['chunk-a', 'chunk-a', 'chunk-b'])
  const processedItems: string[] = []

  const initialPending = queue.pending
  const initialUniqueKeys = queue.uniqueKeys
  const firstBatch = runMainRuntimeTaskQueue(queue, 1, (task) => processedItems.push(task))
  const requeuedAfterDrain = queue.enqueueUnique('chunk-a')
  runMainRuntimeTaskQueue(queue, 4, (task) => processedItems.push(task))

  return {
    initialPending,
    initialUniqueKeys,
    processedFirstBatch: firstBatch.processed,
    remainingAfterFirstBatch: firstBatch.remaining,
    requeuedAfterDrain,
    processedItems,
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

  return result
}
