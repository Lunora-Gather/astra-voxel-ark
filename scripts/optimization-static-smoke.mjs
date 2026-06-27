import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

const requiredFiles = [
  'src/app/MainOptimizationBootstrap.ts',
  'src/app/MainBootstrapSmoke.ts',
  'src/app/MainRuntimeWorkQueueSmoke.ts',
  'src/app/OptimizationSmoke.ts',
  'src/app/PerformanceSampler.ts',
  'src/app/AdaptiveQualityController.ts',
  'src/app/ChunkRebuildScheduler.ts',
  'src/app/FrameOptimizationCoordinator.ts',
  'src/app/LegacyChunkMirrorController.ts',
  'src/app/LegacyWorldDiagnostics.ts',
  'src/app/MainRuntimeFrameHistory.ts',
  'src/app/MainRuntimeFrameReporter.ts',
  'src/app/MainRuntimeFrameScheduler.ts',
  'src/app/MainRuntimeFrameSummary.ts',
  'src/app/MainRuntimeOrchestrator.ts',
  'src/app/MainRuntimeWorkQueue.ts',
  'src/render/ChunkMeshBuilder.ts',
  'src/render/ChunkMeshDiagnostics.ts',
  'src/render/GreedyGeometry.ts',
  'src/render/GreedyMesher.ts',
  'src/render/RenderLayerSmoke.ts',
  'src/world/ChunkManager.ts',
  'src/worldMath.ts',
  'src/textures.ts',
  'src/blocks.ts',
  'docs/MAIN_BOOTSTRAP_EXAMPLE.md',
  'docs/APP_RUNTIME_INTEGRATION.md',
  'docs/RENDERING_OPTIMIZATION.md',
  'docs/OPTIMIZATION_REVIEW_CHECKLIST.md',
  'docs/OPTIMIZATION_RISK_REGISTER.md',
  'docs/OPTIMIZATION_PR_DESCRIPTION.md',
  'docs/OPTIMIZATION_ROLLOUT_PLAYBOOK.md',
]

const exportChecks = [
  ['src/app/index.ts', 'MainOptimizationBootstrap'],
  ['src/app/index.ts', 'MainBootstrapSmoke'],
  ['src/app/index.ts', 'AdaptiveQualityController'],
  ['src/app/index.ts', 'ChunkRebuildScheduler'],
  ['src/app/index.ts', 'PerformanceSampler'],
  ['src/app/index.ts', 'MainRuntimeFrameHistory'],
  ['src/app/index.ts', 'MainRuntimeFrameReporter'],
  ['src/app/index.ts', 'MainRuntimeFrameScheduler'],
  ['src/app/index.ts', 'MainRuntimeFrameSummary'],
  ['src/app/index.ts', 'MainRuntimeOrchestrator'],
  ['src/app/index.ts', 'MainRuntimeWorkQueue'],
  ['src/app/index.ts', 'MainRuntimeWorkQueueSmoke'],
  ['src/render/index.ts', 'ChunkMeshBuilder'],
  ['src/render/index.ts', 'GreedyGeometry'],
  ['src/render/index.ts', 'RenderLayerSmoke'],
  ['src/world/index.ts', 'ChunkManager'],
  ['src/world/index.ts', 'TerrainWorkerClient'],
]

const contentChecks = [
  ['src/app/MainOptimizationBootstrap.ts', 'bootstrapMainOptimizations'],
  ['src/app/MainOptimizationBootstrap.ts', 'PerformanceSampler'],
  ['src/app/MainOptimizationBootstrap.ts', 'MainOptimizationFrameResult'],
  ['src/app/MainOptimizationBootstrap.ts', 'recordFrame'],
  ['src/app/MainOptimizationBootstrap.ts', 'syncAllBlocks'],
  ['src/app/MainOptimizationBootstrap.ts', 'diagnoseDirtyChunks'],
  ['src/app/MainRuntimeAdapter.ts', 'MainRuntimeWorkRequest'],
  ['src/app/MainRuntimeAdapter.ts', 'MainRuntimeWorkPlan'],
  ['src/app/MainRuntimeAdapter.ts', 'planMainRuntimeWork'],
  ['src/app/MainRuntimeAdapter.ts', 'clampWorkBudget'],
  ['src/app/MainRuntimeAdapter.ts', 'lastWorkPlan'],
  ['src/app/MainRuntimeAdapter.ts', 'getMainRuntimeBudgetForPressure'],
  ['src/app/MainRuntimeFrameHistory.ts', 'createMainRuntimeFrameHistory'],
  ['src/app/MainRuntimeFrameHistory.ts', 'getMainRuntimeFrameHistorySnapshot'],
  ['src/app/MainRuntimeFrameHistory.ts', 'MainRuntimeFrameHistorySnapshot'],
  ['src/app/MainRuntimeFrameHistory.ts', 'clampFrameHistoryLimit'],
  ['src/app/MainRuntimeFrameHistory.ts', 'updateMainRuntimeFrameHistoryAccumulator'],
  ['src/app/MainRuntimeFrameHistory.ts', 'snapshotMainRuntimeFrameHistoryAccumulator'],
  ['src/app/MainRuntimeFrameReporter.ts', 'createMainRuntimeFrameReporter'],
  ['src/app/MainRuntimeFrameReporter.ts', 'shouldPublishMainRuntimeFrameSummary'],
  ['src/app/MainRuntimeFrameReporter.ts', 'clampMainRuntimeFrameReportInterval'],
  ['src/app/MainRuntimeFrameReporter.ts', 'DEFAULT_SUMMARY_REPORT_INTERVAL_MS'],
  ['src/app/MainRuntimeFrameReporter.ts', 'MILLISECONDS_PER_SECOND'],
  ['src/app/MainRuntimeFrameReporter.ts', 'MainRuntimeFrameTimestampUnit'],
  ['src/app/MainRuntimeFrameReporter.ts', 'timestampUnit'],
  ['src/app/MainRuntimeFrameReporter.ts', 'lastPublishedAt'],
  ['src/app/MainRuntimeFrameReporter.ts', 'lastSourceKey'],
  ['src/app/MainRuntimeFrameReporter.ts', 'getMainRuntimeFrameSummaryKey'],
  ['src/app/MainRuntimeFrameReporter.ts', 'normalizeMainRuntimeFrameTimestamp'],
  ['src/app/MainRuntimeFrameReporter.ts', "normalizeMainRuntimeFrameTimestamp(timestamp, timestampUnit)"],
  ['src/app/MainRuntimeFrameReporter.ts', "normalizeMainRuntimeFrameTimestamp(timestampMs, 'milliseconds')"],
  ['src/app/MainRuntimeFrameReporter.ts', 'timestamp * MILLISECONDS_PER_SECOND'],
  ['src/app/MainRuntimeFrameScheduler.ts', 'runMainRuntimeFrame'],
  ['src/app/MainRuntimeFrameScheduler.ts', 'createMainRuntimeWorkRequest'],
  ['src/app/MainRuntimeFrameScheduler.ts', 'MainRuntimeFrameScheduleResult'],
  ['src/app/MainRuntimeFrameScheduler.ts', 'runMainRuntimeWorkQueues'],
  ['src/app/MainRuntimeFrameSummary.ts', 'summarizeMainRuntimeFrame'],
  ['src/app/MainRuntimeFrameSummary.ts', 'isMainRuntimeFrameBacklogged'],
  ['src/app/MainRuntimeFrameSummary.ts', 'formatMainRuntimeFrameSummary'],
  ['src/app/MainRuntimeFrameSummary.ts', 'MainRuntimeFrameSummary'],
  ['src/app/MainRuntimeOrchestrator.ts', 'createMainRuntimeOrchestrator'],
  ['src/app/MainRuntimeOrchestrator.ts', 'MainRuntimeOrchestratorFrameResult'],
  ['src/app/MainRuntimeOrchestrator.ts', 'MainRuntimeFrameReporter'],
  ['src/app/MainRuntimeOrchestrator.ts', 'summaryReportIntervalMs'],
  ['src/app/MainRuntimeOrchestrator.ts', 'summaryReportTimestampUnit'],
  ['src/app/MainRuntimeOrchestrator.ts', 'timestampUnit: summaryReportTimestampUnit'],
  ['src/app/MainRuntimeOrchestrator.ts', 'reporter.report'],
  ['src/app/MainRuntimeOrchestrator.ts', 'lastReport'],
  ['src/app/MainRuntimeOrchestrator.ts', 'MainRuntimeTaskQueue'],
  ['src/app/MainRuntimeOrchestrator.ts', 'normalizeMainRuntimeTaskQueue'],
  ['src/app/MainRuntimeOrchestrator.ts', 'runMainRuntimeTaskQueue'],
  ['src/app/MainRuntimeOrchestrator.ts', 'terrainTaskQueue.pending'],
  ['src/app/MainRuntimeOrchestrator.ts', 'enqueueTerrainTask'],
  ['src/app/MainRuntimeOrchestrator.ts', 'getSummaryLabel'],
  ['src/app/MainRuntimeWorkQueue.ts', 'MainRuntimeQueueKey'],
  ['src/app/MainRuntimeWorkQueue.ts', 'MainRuntimeQueueKeySelector'],
  ['src/app/MainRuntimeWorkQueue.ts', 'createMainRuntimeTaskQueue'],
  ['src/app/MainRuntimeWorkQueue.ts', 'createMainRuntimeUniqueTaskQueue'],
  ['src/app/MainRuntimeWorkQueue.ts', 'MainRuntimeTaskQueue'],
  ['src/app/MainRuntimeWorkQueue.ts', 'MainRuntimeUniqueTaskQueue'],
  ['src/app/MainRuntimeWorkQueue.ts', 'enqueueUnique'],
  ['src/app/MainRuntimeWorkQueue.ts', 'queuedKeys'],
  ['src/app/MainRuntimeWorkQueue.ts', 'isQueued'],
  ['src/app/MainRuntimeWorkQueue.ts', 'runMainRuntimeTaskQueue'],
  ['src/app/MainRuntimeWorkQueue.ts', 'QUEUE_COMPACTION_THRESHOLD'],
  ['src/app/MainRuntimeWorkQueue.ts', 'cursor += count'],
  ['src/app/MainRuntimeWorkQueue.ts', 'runMainRuntimeQueue'],
  ['src/app/MainRuntimeWorkQueue.ts', 'runMainRuntimeWorkQueues'],
  ['src/app/MainRuntimeWorkQueue.ts', 'MainRuntimeWorkQueueResult'],
  ['src/app/MainRuntimeWorkQueue.ts', 'clampQueueLimit'],
  ['src/app/MainRuntimeWorkQueue.ts', 'drainMainRuntimeQueue'],
  ['src/app/MainRuntimeWorkQueue.ts', 'queue.splice(0, Math.min(requested, queue.length))'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'assertMainRuntimeWorkQueueSmoke'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'createMainRuntimeUniqueTaskQueue'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'requeuedAfterDrain'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'chunk-a,chunk-b,chunk-a'],
  ['src/app/OptimizationSmoke.ts', 'assertMainBootstrapSmoke'],
  ['src/app/OptimizationSmoke.ts', 'assertMainRuntimeWorkQueueSmoke'],
  ['src/app/OptimizationSmoke.ts', 'runtimeWorkQueue'],
  ['src/app/OptimizationSmoke.ts', 'runtimeQueueProcessed'],
  ['src/app/MainBootstrapSmoke.ts', 'stringBlockKey'],
  ['src/app/MainBootstrapSmoke.ts', 'frameSampleCount'],
  ['src/app/MainBootstrapSmoke.ts', 'bootstrap.recordFrame'],
  ['src/app/MainBootstrapSmoke.ts', 'bootstrap.syncAllBlocks'],
  ['src/app/MainBootstrapSmoke.ts', 'adapter.planWork'],
  ['src/app/MainBootstrapSmoke.ts', 'adapterHighWorkTerrain'],
  ['src/app/MainBootstrapSmoke.ts', 'adapterHighWorkDirtySummaries'],
  ['src/app/MainBootstrapSmoke.ts', 'runMainRuntimeWorkQueues'],
  ['src/app/MainBootstrapSmoke.ts', 'runMainRuntimeFrame'],
  ['src/app/MainBootstrapSmoke.ts', 'summarizeMainRuntimeFrame'],
  ['src/app/MainBootstrapSmoke.ts', 'createMainRuntimeFrameReporter'],
  ['src/app/MainBootstrapSmoke.ts', "timestampUnit: 'seconds'"],
  ['src/app/MainBootstrapSmoke.ts', 'runtimeReporterSecondSuppressed'],
  ['src/app/MainBootstrapSmoke.ts', 'runtimeReporterSecondTimestampMs'],
  ['src/app/MainBootstrapSmoke.ts', 'runtimeReporterMillisecondTimestampMs'],
  ['src/app/MainBootstrapSmoke.ts', 'runtimeReporterSummaryKeyStable'],
  ['src/app/MainBootstrapSmoke.ts', 'summaryReportTimestampUnit'],
  ['src/app/MainBootstrapSmoke.ts', 'createMainRuntimeOrchestrator'],
  ['src/app/MainBootstrapSmoke.ts', 'orchestratorReportPublished'],
  ['src/app/MainBootstrapSmoke.ts', 'orchestratorSummaryLabel'],
  ['src/app/MainBootstrapSmoke.ts', 'orchestratorHistoryFrames'],
  ['src/app/MainBootstrapSmoke.ts', 'scheduledFrameSummaryLabel'],
  ['src/app/MainBootstrapSmoke.ts', 'scheduledFrameDirtyProcessed'],
  ['src/app/MainBootstrapSmoke.ts', 'adapterQueueDirtyProcessed'],
  ['src/app/AdaptiveQualityController.ts', 'shouldDecreaseQuality(sample.averageFps, sample.averageFrameMs)'],
  ['src/app/AdaptiveQualityController.ts', 'shouldIncreaseQuality(sample.averageFps, sample.averageFrameMs)'],
  ['src/app/AdaptiveQualityController.ts', 'averageFrameMs: sample.averageFrameMs'],
  ['src/app/ChunkRebuildScheduler.ts', 'nextBatch'],
  ['src/worldMath.ts', 'terrainNoiseCache'],
  ['src/worldMath.ts', 'terrainNoiseCacheSize'],
  ['src/worldMath.ts', 'new Map<number, Map<number, number>>()'],
  ['src/worldMath.ts', 'TERRAIN_NOISE_CACHE_LIMIT'],
  ['src/worldMath.ts', 'getTerrainNoiseCacheSize'],
  ['src/textures.ts', 'generatedTextureCache'],
  ['src/textures.ts', 'clearGeneratedTextureCache'],
  ['src/textures.ts', 'getGeneratedTextureCacheSize'],
  ['src/textures.ts', 'generatedMaterialCache'],
  ['src/textures.ts', 'clearGeneratedMaterialCache'],
  ['src/textures.ts', 'getGeneratedMaterialCacheSize'],
  ['src/textures.ts', 'getBlockDef(blockId)'],
  ['src/textures.ts', 'MATERIAL_ANIMATION_FPS'],
  ['src/textures.ts', 'materialAnimationFrames'],
  ['src/textures.ts', 'resetMaterialAnimationThrottle'],
  ['src/textures.ts', 'Math.floor(elapsedTime * MATERIAL_ANIMATION_FPS)'],
  ['src/blocks.ts', 'BLOCK_BY_ID'],
  ['src/blocks.ts', 'getBlockDef'],
  ['docs/MAIN_BOOTSTRAP_EXAMPLE.md', 'chunkRebuilds.nextBatch'],
  ['docs/OPTIMIZATION_REVIEW_CHECKLIST.md', 'npm run smoke:optimization'],
  ['docs/OPTIMIZATION_RISK_REGISTER.md', '#chunk-mesh-renderer=1'],
  ['docs/OPTIMIZATION_PR_DESCRIPTION.md', 'Expected default behavior change: none.'],
  ['docs/OPTIMIZATION_ROLLOUT_PLAYBOOK.md', 'Do not enable more than one risky path at a time.'],
]

const absentChecks = [
  ['src/app/MainBootstrapSmoke.ts', "import { blockKey } from '../world'"],
  ['src/app/AdaptiveQualityController.ts', 'shouldDecreaseQuality(sample.averageFps)'],
  ['src/app/AdaptiveQualityController.ts', 'shouldIncreaseQuality(sample.averageFps)'],
  ['src/app/MainRuntimeFrameReporter.ts', 'SECONDS_TIMESTAMP_MAX'],
  ['src/app/MainRuntimeWorkQueue.ts', '.shift()'],
  ['src/textures.ts', 'BLOCKS.find'],
  ['src/worldMath.ts', "x + ',' + z"],
]

const errors = []

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) {
    errors.push(`Missing required optimization file: ${file}`)
  }
}

for (const [file, token] of [...exportChecks, ...contentChecks]) {
  const path = resolve(root, file)
  if (!existsSync(path)) {
    errors.push(`Cannot check ${token}; file is missing: ${file}`)
    continue
  }

  const content = readFileSync(path, 'utf8')
  if (!content.includes(token)) {
    errors.push(`Expected ${file} to include ${token}`)
  }
}

for (const [file, token] of absentChecks) {
  const path = resolve(root, file)
  if (!existsSync(path)) continue

  const content = readFileSync(path, 'utf8')
  if (content.includes(token)) {
    errors.push(`Unexpected token in ${file}: ${token}`)
  }
}

if (errors.length > 0) {
  console.error('Optimization static smoke failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Optimization static smoke passed')
