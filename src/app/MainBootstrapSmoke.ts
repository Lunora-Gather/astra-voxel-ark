import type { BlockId } from '../blocks'
import { bootstrapMainOptimizations } from './MainOptimizationBootstrap'
import { createHeadlessMainRuntimeAdapter } from './MainRuntimeAdapter'

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
  adapter.onFrame({ timestamp: 32 })

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
  }

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

  if (result.adapterFrameCount !== 2 || result.adapterSetCount !== 1 || result.adapterDeleteCount !== 1 || result.adapterResyncedBlocks !== 2) {
    throw new Error('Main bootstrap smoke failed: runtime adapter should track frame, set/delete, and resync operations')
  }

  return result
}

function stringBlockKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`
}
