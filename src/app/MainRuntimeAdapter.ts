import type { BlockId } from '../blocks'
import type { QualityPreset } from '../game'
import {
  bootstrapMainOptimizations,
  type MainOptimizationBootstrap,
  type MainOptimizationBootstrapOptions,
  type MainOptimizationFrameOptions,
  type MainOptimizationFrameResult,
} from './MainOptimizationBootstrap'
import type { LegacyBlockMap } from './LegacyWorldBridge'

export type MainRuntimeAdapterOptions = Omit<MainOptimizationBootstrapOptions, 'initialQuality'> & {
  initialQuality: QualityPreset
  budget?: Partial<MainRuntimeBudgetConfig>
}

export type MainRuntimePressure = 'nominal' | 'moderate' | 'high'

export type MainRuntimeBudgetConfig = {
  nominalTerrainChunksPerFrame: number
  moderateTerrainChunksPerFrame: number
  highTerrainChunksPerFrame: number
  nominalDirtyChunkSummariesPerFrame: number
  moderateDirtyChunkSummariesPerFrame: number
  highDirtyChunkSummariesPerFrame: number
  nominalDiagnosticsLimit: number
  moderateDiagnosticsLimit: number
  highDiagnosticsLimit: number
}

export type MainRuntimeBudgetDecision = {
  pressure: MainRuntimePressure
  terrainChunksPerFrame: number
  dirtyChunkSummariesPerFrame: number
  dirtyChunkDiagnosticsLimit: number
  shouldRunTerrainQueue: boolean
  shouldRunDirtyChunkSummaries: boolean
  shouldRunDiagnostics: boolean
}

export type MainRuntimeWorkRequest = {
  pendingTerrainChunks: number
  pendingDirtyChunkSummaries: number
  diagnosticsEnabled?: boolean
}

export type MainRuntimeWorkPlan = {
  terrainChunksToRun: number
  dirtyChunkSummariesToRun: number
  dirtyChunkDiagnosticsLimit: number
  runTerrainQueue: boolean
  runDirtyChunkSummaries: boolean
  runDiagnostics: boolean
}

export type MainRuntimeAdapterFrameResult = MainOptimizationFrameResult & {
  budget: MainRuntimeBudgetDecision
}

export type MainRuntimeAdapterStats = {
  frameCount: number
  blockSetCount: number
  blockDeleteCount: number
  resyncCount: number
  pressureFrames: Record<MainRuntimePressure, number>
  lastFrame: MainRuntimeAdapterFrameResult | null
  lastBudget: MainRuntimeBudgetDecision | null
  lastWorkPlan: MainRuntimeWorkPlan | null
}

export type MainRuntimeAdapter = {
  bootstrap: MainOptimizationBootstrap
  stats: MainRuntimeAdapterStats
  onBlockSet: (key: string, id: BlockId) => boolean
  onBlockDelete: (key: string) => boolean
  resync: () => number
  markAllChunksDirty: () => void
  onFrame: (options?: MainOptimizationFrameOptions) => MainRuntimeAdapterFrameResult
  getBudgetForFrame: (frame: MainOptimizationFrameResult) => MainRuntimeBudgetDecision
  planWork: (request: MainRuntimeWorkRequest) => MainRuntimeWorkPlan
  dispose: () => void
}

const DEFAULT_RUNTIME_BUDGET: MainRuntimeBudgetConfig = {
  nominalTerrainChunksPerFrame: 1,
  moderateTerrainChunksPerFrame: 1,
  highTerrainChunksPerFrame: 0,
  nominalDirtyChunkSummariesPerFrame: 12,
  moderateDirtyChunkSummariesPerFrame: 6,
  highDirtyChunkSummariesPerFrame: 3,
  nominalDiagnosticsLimit: 4,
  moderateDiagnosticsLimit: 2,
  highDiagnosticsLimit: 1,
}

export function createMainRuntimeAdapter({
  blockData,
  chunkSize,
  terrainOptions,
  scene,
  camera,
  particlePoolSize,
  maxActivePointLights,
  lowPowerMode,
  initialQuality,
  logger,
  budget,
}: MainRuntimeAdapterOptions): MainRuntimeAdapter {
  const bootstrap = bootstrapMainOptimizations({
    blockData,
    chunkSize,
    terrainOptions,
    scene,
    camera,
    particlePoolSize,
    maxActivePointLights,
    lowPowerMode,
    initialQuality,
    logger,
  })
  const budgetConfig = { ...DEFAULT_RUNTIME_BUDGET, ...budget }

  const stats: MainRuntimeAdapterStats = {
    frameCount: 0,
    blockSetCount: 0,
    blockDeleteCount: 0,
    resyncCount: 0,
    pressureFrames: { nominal: 0, moderate: 0, high: 0 },
    lastFrame: null,
    lastBudget: null,
    lastWorkPlan: null,
  }

  const getBudgetForFrame = (frame: MainOptimizationFrameResult) => deriveMainRuntimeBudget(frame, budgetConfig)
  const getCurrentBudget = () => stats.lastBudget ?? getMainRuntimeBudgetForPressure('nominal', budgetConfig)

  return {
    bootstrap,
    stats,
    onBlockSet: (key, id) => {
      const result = bootstrap.syncBlockSet(key, id)
      if (result) stats.blockSetCount += 1
      return result
    },
    onBlockDelete: (key) => {
      const result = bootstrap.syncBlockDelete(key)
      if (result) stats.blockDeleteCount += 1
      return result
    },
    resync: () => {
      stats.resyncCount += 1
      return bootstrap.syncAllBlocks().mirroredBlocks
    },
    markAllChunksDirty: () => bootstrap.markAllChunksDirty(),
    onFrame: (options) => {
      const frame = bootstrap.recordFrame(options)
      const budget = getBudgetForFrame(frame)
      const adapterFrame = { ...frame, budget }
      stats.frameCount += 1
      stats.pressureFrames[budget.pressure] += 1
      stats.lastFrame = adapterFrame
      stats.lastBudget = budget
      return adapterFrame
    },
    getBudgetForFrame,
    planWork: (request) => {
      const plan = planMainRuntimeWork(getCurrentBudget(), request)
      stats.lastWorkPlan = plan
      return plan
    },
    dispose: () => bootstrap.dispose(),
  }
}

export function deriveMainRuntimeBudget(
  frame: MainOptimizationFrameResult,
  config: MainRuntimeBudgetConfig = DEFAULT_RUNTIME_BUDGET,
): MainRuntimeBudgetDecision {
  const averageFps = frame.sample.averageFps
  const averageFrameMs = frame.sample.averageFrameMs
  return getMainRuntimeBudgetForPressure(getMainRuntimePressure(averageFps, averageFrameMs), config)
}

export function getMainRuntimeBudgetForPressure(
  pressure: MainRuntimePressure,
  config: MainRuntimeBudgetConfig = DEFAULT_RUNTIME_BUDGET,
): MainRuntimeBudgetDecision {
  if (pressure === 'high') {
    return buildBudgetDecision(pressure, {
      terrainChunksPerFrame: config.highTerrainChunksPerFrame,
      dirtyChunkSummariesPerFrame: config.highDirtyChunkSummariesPerFrame,
      dirtyChunkDiagnosticsLimit: config.highDiagnosticsLimit,
    })
  }

  if (pressure === 'moderate') {
    return buildBudgetDecision(pressure, {
      terrainChunksPerFrame: config.moderateTerrainChunksPerFrame,
      dirtyChunkSummariesPerFrame: config.moderateDirtyChunkSummariesPerFrame,
      dirtyChunkDiagnosticsLimit: config.moderateDiagnosticsLimit,
    })
  }

  return buildBudgetDecision(pressure, {
    terrainChunksPerFrame: config.nominalTerrainChunksPerFrame,
    dirtyChunkSummariesPerFrame: config.nominalDirtyChunkSummariesPerFrame,
    dirtyChunkDiagnosticsLimit: config.nominalDiagnosticsLimit,
  })
}

export function planMainRuntimeWork(
  budget: MainRuntimeBudgetDecision,
  request: MainRuntimeWorkRequest,
): MainRuntimeWorkPlan {
  const terrainChunksToRun = Math.min(clampWorkBudget(request.pendingTerrainChunks), clampWorkBudget(budget.terrainChunksPerFrame))
  const dirtyChunkSummariesToRun = Math.min(clampWorkBudget(request.pendingDirtyChunkSummaries), clampWorkBudget(budget.dirtyChunkSummariesPerFrame))
  const dirtyChunkDiagnosticsLimit = request.diagnosticsEnabled === false ? 0 : clampWorkBudget(budget.dirtyChunkDiagnosticsLimit)

  return {
    terrainChunksToRun,
    dirtyChunkSummariesToRun,
    dirtyChunkDiagnosticsLimit,
    runTerrainQueue: terrainChunksToRun > 0,
    runDirtyChunkSummaries: dirtyChunkSummariesToRun > 0,
    runDiagnostics: dirtyChunkDiagnosticsLimit > 0,
  }
}

export function clampWorkBudget(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

export function getMainRuntimePressure(averageFps: number, averageFrameMs: number): MainRuntimePressure {
  if ((averageFps > 0 && averageFps < 30) || averageFrameMs > 32) return 'high'
  if ((averageFps > 0 && averageFps < 45) || averageFrameMs > 24) return 'moderate'
  return 'nominal'
}

function buildBudgetDecision(
  pressure: MainRuntimePressure,
  budget: Pick<MainRuntimeBudgetDecision, 'terrainChunksPerFrame' | 'dirtyChunkSummariesPerFrame' | 'dirtyChunkDiagnosticsLimit'>,
): MainRuntimeBudgetDecision {
  return {
    pressure,
    ...budget,
    shouldRunTerrainQueue: budget.terrainChunksPerFrame > 0,
    shouldRunDirtyChunkSummaries: budget.dirtyChunkSummariesPerFrame > 0,
    shouldRunDiagnostics: budget.dirtyChunkDiagnosticsLimit > 0,
  }
}

export function createHeadlessMainRuntimeAdapter(
  blockData: LegacyBlockMap,
  initialQuality: QualityPreset = 'balanced',
  logger: Pick<Console, 'info'> = console,
) {
  return createMainRuntimeAdapter({
    blockData,
    chunkSize: 16,
    terrainOptions: { chunkSize: 16 },
    initialQuality,
    logger,
  })
}
