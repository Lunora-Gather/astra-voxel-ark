import type { BlockId } from '../blocks'
import { bootstrapMainOptimizations } from './MainOptimizationBootstrap'
import { createHeadlessMainRuntimeAdapter } from './MainRuntimeAdapter'
import { runMainRuntimeFrame } from './MainRuntimeFrameScheduler'
import { runMainRuntimeWorkQueues } from './MainRuntimeWorkQueue'

export type MainBootstrapSmokeResult = {
  mirroredBlocks: number
  chunkCount: number
  diagnosticsEnabled: boolean
  setResult: boolean
  deleteResult: boolean
  resyncedBlocks: number
  frameSampleCount: number
  frameAverageMs: number
  qualityAction: string
  scheduledChunkRebuilds: number
  adapterFrameCount: number
  adapterSetCount: number
  adapterDeleteCount: number
  adapterResyncedBlocks: number
  adapterNominalBudget: number
  adapterHighPressureBudget: number
  adapterHighPressureFrames: number
  adapterNominalWorkTerrain: number
  adapterHighWorkTerrain: number
  adapterHighWorkDirtySummaries: number
  adapterHighWorkDiagnosticsLimit: number
  adapterQueueTerrainProcessed: number
  adapterQueueDirtyProcessed: number
  adapterQueueDirtyRemaining: number
  scheduledFrameTerrainProcessed: number
  scheduledFrameDirtyProcessed: number
  scheduledFrameDirtyRemaining: number
}

export function runMainBootstrapSmoke(): MainBootstrapSmokeResult {
  const blockData = new Map<string, BlockId>([
    [stringBlockKey(0, 0, 0), 'grass'],
    [stringBlockKey(1, 0, 0), 'stone'],
    [stringBlockKey(2, 0, 0), 'glow'],
  ])

  const bootstrap = bootstrapMainOptimizations({
    blockData,
    chunkSize: 16,
    logger: { info: () => undefined },
  })

  const setKey = stringBlockKey(3, 0, 0)
  blockData.set(setKey, 'dirt')
  const setResult = bootstrap.syncBlockSet(setKey, 'dirt')

  const deleteKey = stringBlockKey(1, 0, 0)
  blockData.delete(deleteKey)
  const deleteResult = bootstrap.syncBlockDelete(deleteKey)
  const resync = bootstrap.syncAllBlocks()

  bootstrap.recordFrame({ timestamp: 16 })
  const frame = bootstrap.recordFrame({ timestamp: 32 })

  const adapterBlockData = new Map<string, BlockId>([
    [stringBlockKey(0, 0, 0), 'grass'],
    [stringBlockKey(1, 0, 0), 'stone'],
  ])
  const adapter = createHeadlessMainRuntimeAdapter(adapterBlockData, 'balanced', { info: () => undefined })
  const adapterSetKey = stringBlockKey(2, 0, 0)
  adapterBlockData.set(adapterSetKey, 'dirt')
  adapter.onBlockSet(adapterSetKey, 'dirt')
  adapterBlockData.delete(stringBlockKey(1, 0, 0))
  adapter.onBlockDelete(stringBlockKey(1, 0, 0))
  const adapterResyncedBlocks = adapter.resync()
  adapter.onFrame({ timestamp: 16 })
  const nominalAdapterFrame = adapter.onFrame({ timestamp: 32 })
  const nominalWorkPlan = adapter.planWork({ pendingTerrainChunks: 4, pendingDirtyChunkSummaries: 8 })
  const highPressureAdapterFrame = adapter.onFrame({ timestamp: 132 })
  const highPressureWorkPlan = adapter.planWork({ pendingTerrainChunks: 4, pendingDirtyChunkSummaries: 8 })

  const terrainQueue = ['terrain-a', 'terrain-b', 'terrain-c']
  const dirtyQueue = ['dirty-a', 'dirty-b', 'dirty-c', 'dirty-d', 'dirty-e']
  const terrainProcessed: string[] = []
  const dirtyProcessed: string[] = []
  const queueResult = runMainRuntimeWorkQueues(highPressureWorkPlan, {
    terrainQueue,
    dirtyChunkSummaryQueue: dirtyQueue,
    runTerrainTask: (task) => terrainProcessed.push(task),
    runDirtyChunkSummaryTask: (task) => dirtyProcessed.push(task),
  })

  const scheduledAdapter = createHeadlessMainRuntimeAdapter(new Map<string, BlockId>(), 'balanced', { info: () => undefined })
  scheduledAdapter.onFrame({ timestamp: 16 })
  const scheduledTerrainQueue = ['terrain-scheduled-a', 'terrain-scheduled-b']
  const scheduledDirtyQueue = ['dirty-scheduled-a', 'dirty-scheduled-b', 'dirty-scheduled-c', 'dirty-scheduled-d']
  const scheduledFrame = runMainRuntimeFrame(scheduledAdapter, {
    frame: { timestamp: 132 },
    queues: {
      terrainQueue: scheduledTerrainQueue,
      dirtyChunkSummaryQueue: scheduledDirtyQueue,
      runTerrainTask: () => undefined,
      runDirtyChunkSummaryTask: () => undefined,
    },
  })

  const result: MainBootstrapSmokeResult = {
    mirroredBlocks: bootstrap.chunkMirror.lastSync?.mirroredBlocks ?? 0,
    chunkCount: bootstrap.chunkMirror.chunkCount,
    diagnosticsEnabled: bootstrap.optimization.flags.chunkMeshDiagnostics,
    setResult,
    deleteResult,
    resyncedBlocks: resync.mirroredBlocks,
    frameSampleCount: frame.sample.sampleCount,
    frameAverageMs: frame.sample.averageFrameMs,
    qualityAction: frame.qualityDecision.action,
    scheduledChunkRebuilds: frame.scheduledChunkRebuilds,
    adapterFrameCount: adapter.stats.frameCount,
    adapterSetCount: adapter.stats.blockSetCount,
    adapterDeleteCount: adapter.stats.blockDeleteCount,
    adapterResyncedBlocks,
    adapterNominalBudget: nominalAdapterFrame.budget.terrainChunksPerFrame,
    adapterHighPressureBudget: highPressureAdapterFrame.budget.terrainChunksPerFrame,
    adapterHighPressureFrames: adapter.stats.pressureFrames.high,
    adapterNominalWorkTerrain: nominalWorkPlan.terrainChunksToRun,
    adapterHighWorkTerrain: highPressureWorkPlan.terrainChunksToRun,
    adapterHighWorkDirtySummaries: highPressureWorkPlan.dirtyChunkSummariesToRun,
    adapterHighWorkDiagnosticsLimit: highPressureWorkPlan.dirtyChunkDiagnosticsLimit,
    adapterQueueTerrainProcessed: queueResult.terrain.processed,
    adapterQueueDirtyProcessed: queueResult.dirtyChunkSummaries.processed,
    adapterQueueDirtyRemaining: queueResult.dirtyChunkSummaries.remaining,
    scheduledFrameTerrainProcessed: scheduledFrame.queues.terrain.processed,
    scheduledFrameDirtyProcessed: scheduledFrame.queues.dirtyChunkSummaries.processed,
    scheduledFrameDirtyRemaining: scheduledFrame.queues.dirtyChunkSummaries.remaining,
  }

  scheduledAdapter.dispose()
  adapter.dispose()
  bootstrap.dispose()
  return result
}

export function assertMainBootstrapSmoke(result = runMainBootstrapSmoke()) {
  if (result.mirroredBlocks !== 3) {
    throw new Error(`Main bootstrap smoke failed: expected 3 mirrored blocks, got ${result.mirroredBlocks}`)
  }

  if (result.chunkCount <= 0) {
    throw new Error('Main bootstrap smoke failed: expected at least one chunk')
  }

  if (!result.setResult || !result.deleteResult) {
    throw new Error('Main bootstrap smoke failed: set/delete mirror operations should succeed')
  }

  if (result.resyncedBlocks !== 3) {
    throw new Error(`Main bootstrap smoke failed: expected 3 blocks after resync, got ${result.resyncedBlocks}`)
  }

  if (result.frameSampleCount <= 0 || result.frameAverageMs <= 0) {
    throw new Error('Main bootstrap smoke failed: frame-level optimization sampling should be active')
  }

  if (result.qualityAction !== 'hold') {
    throw new Error(`Main bootstrap smoke failed: expected stable quality hold decision, got ${result.qualityAction}`)
  }

  if (result.adapterFrameCount !== 3 || result.adapterSetCount !== 1 || result.adapterDeleteCount !== 1 || result.adapterResyncedBlocks !== 2) {
    throw new Error('Main bootstrap smoke failed: runtime adapter should track frame, set/delete, and resync operations')
  }

  if (result.adapterNominalBudget <= 0 || result.adapterHighPressureBudget !== 0 || result.adapterHighPressureFrames <= 0) {
    throw new Error('Main bootstrap smoke failed: runtime adapter should reduce terrain budget under high pressure')
  }

  if (result.adapterNominalWorkTerrain <= 0 || result.adapterHighWorkTerrain !== 0) {
    throw new Error('Main bootstrap smoke failed: runtime work plan should pause terrain queue under high pressure')
  }

  if (result.adapterHighWorkDirtySummaries !== 3 || result.adapterHighWorkDiagnosticsLimit !== 1) {
    throw new Error('Main bootstrap smoke failed: runtime work plan should clamp dirty summaries and diagnostics under high pressure')
  }

  if (result.adapterQueueTerrainProcessed !== 0 || result.adapterQueueDirtyProcessed !== 3 || result.adapterQueueDirtyRemaining !== 2) {
    throw new Error('Main bootstrap smoke failed: runtime queue runner should execute only budgeted work')
  }

  if (result.scheduledFrameTerrainProcessed !== 0 || result.scheduledFrameDirtyProcessed !== 3 || result.scheduledFrameDirtyRemaining !== 1) {
    throw new Error('Main bootstrap smoke failed: runtime frame scheduler should sample, plan, and run budgeted queues')
  }

  return result
}

function stringBlockKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`
}
