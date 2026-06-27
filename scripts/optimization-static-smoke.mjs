import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

const requiredFiles = [
  'src/app/MainOptimizationBootstrap.ts',
  'src/app/MainBootstrapSmoke.ts',
  'src/app/OptimizationSmoke.ts',
  'src/app/PerformanceSampler.ts',
  'src/app/AdaptiveQualityController.ts',
  'src/app/ChunkRebuildScheduler.ts',
  'src/app/FrameOptimizationCoordinator.ts',
  'src/app/LegacyChunkMirrorController.ts',
  'src/app/LegacyWorldDiagnostics.ts',
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
  ['src/app/OptimizationSmoke.ts', 'assertMainBootstrapSmoke'],
  ['src/app/MainBootstrapSmoke.ts', 'stringBlockKey'],
  ['src/app/MainBootstrapSmoke.ts', 'frameSampleCount'],
  ['src/app/MainBootstrapSmoke.ts', 'bootstrap.recordFrame'],
  ['src/app/MainBootstrapSmoke.ts', 'bootstrap.syncAllBlocks'],
  ['src/app/AdaptiveQualityController.ts', 'shouldDecreaseQuality(sample.averageFps, sample.averageFrameMs)'],
  ['src/app/AdaptiveQualityController.ts', 'shouldIncreaseQuality(sample.averageFps, sample.averageFrameMs)'],
  ['src/app/AdaptiveQualityController.ts', 'averageFrameMs: sample.averageFrameMs'],
  ['src/app/ChunkRebuildScheduler.ts', 'nextBatch'],
  ['src/worldMath.ts', 'terrainNoiseCache'],
  ['src/worldMath.ts', 'TERRAIN_NOISE_CACHE_LIMIT'],
  ['src/worldMath.ts', 'getTerrainNoiseCacheSize'],
  ['src/textures.ts', 'generatedTextureCache'],
  ['src/textures.ts', 'clearGeneratedTextureCache'],
  ['src/textures.ts', 'getGeneratedTextureCacheSize'],
  ['src/textures.ts', 'generatedMaterialCache'],
  ['src/textures.ts', 'clearGeneratedMaterialCache'],
  ['src/textures.ts', 'getGeneratedMaterialCacheSize'],
  ['src/textures.ts', 'getBlockDef(blockId)'],
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
  ['src/textures.ts', 'BLOCKS.find'],
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
