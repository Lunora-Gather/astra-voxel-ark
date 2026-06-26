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
  'docs/MAIN_BOOTSTRAP_EXAMPLE.md',
  'docs/APP_RUNTIME_INTEGRATION.md',
  'docs/RENDERING_OPTIMIZATION.md',
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
  ['src/app/OptimizationSmoke.ts', 'assertMainBootstrapSmoke'],
  ['src/app/AdaptiveQualityController.ts', 'shouldDecreaseQuality(sample.averageFps, sample.averageFrameMs)'],
  ['src/app/AdaptiveQualityController.ts', 'shouldIncreaseQuality(sample.averageFps, sample.averageFrameMs)'],
  ['src/app/AdaptiveQualityController.ts', 'averageFrameMs: sample.averageFrameMs'],
  ['src/app/ChunkRebuildScheduler.ts', 'nextBatch'],
  ['docs/MAIN_BOOTSTRAP_EXAMPLE.md', 'chunkRebuilds.nextBatch'],
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

if (errors.length > 0) {
  console.error('Optimization static smoke failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Optimization static smoke passed')
