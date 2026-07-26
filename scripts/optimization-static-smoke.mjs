import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const requiredFiles = [
  'src/main.ts',
  'src/performance/DeviceProfile.ts',
  'src/performance/QualityRuntimeProfile.ts',
  'src/performance/RuntimePerformanceGuard.ts',
  'src/world/ChunkManager.ts',
  'src/world/ProceduralTerrain.ts',
  'src/world/ProceduralTerrainWorkerClient.ts',
  'src/render/ChunkMeshBuilder.ts',
  'src/render/ChunkMeshRenderer.ts',
  'src/render/ParticlePool.ts',
  'src/app/ParticleEffectsPipeline.ts',
  'src/game/settings.ts',
  'src/world/SaveSystem.ts',
  'docs/OPTIMIZATION_PLAN.md',
  'docs/PERFORMANCE_ARCHITECTURE.md',
  'docs/SINGLEPLAYER_ARCHITECTURE.md',
]

const checks = [
  ['src/main.ts', 'new SettingsStore'],
  ['src/main.ts', 'resolveQualityRuntimeProfile'],
  ['src/main.ts', 'new RuntimePerformanceGuard'],
  ['src/main.ts', 'new ProceduralTerrainWorkerClient'],
  ['src/main.ts', 'new ChunkManager'],
  ['src/main.ts', 'buildChunkMeshData'],
  ['src/main.ts', 'new ParticleEffectsPipeline'],
  ['src/main.ts', 'new PageLifecycleSaveCoordinator'],
  ['src/performance/DeviceProfile.ts', "'ultra-low'"],
  ['src/performance/QualityRuntimeProfile.ts', 'antialias: !lowCostPreset'],
  ['src/world/ProceduralTerrain.ts', 'buildProceduralChunkPlan'],
  ['src/render/ChunkMeshBuilder.ts', 'buildChunkMeshData'],
  ['src/render/ParticlePool.ts', 'new THREE.InstancedMesh'],
  ['src/world/SaveSystem.ts', 'class SaveSystem'],
  ['docs/PERFORMANCE_ARCHITECTURE.md', 'proceduralTerrainWorker'],
  ['docs/SINGLEPLAYER_ARCHITECTURE.md', 'ReservedMultiplayerGateway'],
]

const forbiddenFiles = [
  'src/app/MainOptimizationBootstrap.ts',
  'src/app/OptimizationRuntime.ts',
  'src/app/FeatureFlags.ts',
  'src/ui/DebugStats.ts',
  'docs/OPTIMIZATION_PR_DESCRIPTION.md',
  'docs/MAIN_MIGRATION.md',
]

const errors = []
for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) errors.push(`Missing live release file: ${file}`)
}
for (const [file, token] of checks) {
  const path = resolve(root, file)
  if (!existsSync(path) || !readFileSync(path, 'utf8').includes(token)) {
    errors.push(`Expected ${file} to include ${token}`)
  }
}
for (const file of forbiddenFiles) {
  if (existsSync(resolve(root, file))) errors.push(`Obsolete migration scaffold should stay removed: ${file}`)
}

if (errors.length > 0) {
  console.error('Optimization static smoke failed:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('Optimization static smoke passed')
