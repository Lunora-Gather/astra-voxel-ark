import fs from 'node:fs'

const profile = fs.readFileSync(new URL('../src/performance/DeviceProfile.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const terrain = fs.readFileSync(new URL('../src/world/ProceduralTerrain.ts', import.meta.url), 'utf8')
const worker = fs.readFileSync(new URL('../src/workers/proceduralTerrainWorker.ts', import.meta.url), 'utf8')
const frameLimiter = fs.readFileSync(new URL('../src/performance/FrameRateLimiter.ts', import.meta.url), 'utf8')
const qualityRuntime = fs.readFileSync(new URL('../src/performance/QualityRuntimeProfile.ts', import.meta.url), 'utf8')
const qualityRuntimeSmoke = fs.readFileSync(new URL('../src/performance/QualityRuntimeProfileSmoke.ts', import.meta.url), 'utf8')

const expectations = [
  [profile.includes("'ultra-low'"), 'ultra-low device tier'],
  [profile.includes('targetFps: 30'), '30 FPS constrained target'],
  [profile.includes('maxPixelRatio: 0.85'), 'constrained pixel ratio'],
  [main.includes('new ProceduralTerrainWorkerClient()'), 'terrain worker integration'],
  [main.includes('discoveredTerrainChunks'), 'discovered/resident separation'],
  [main.includes('evictDistantTerrainChunks'), 'chunk eviction integration'],
  [main.includes('IdleTaskQueue'), 'idle autosave integration'],
  [terrain.includes('buildProceduralChunkPlan'), 'deterministic procedural plan'],
  [terrain.includes('worldSeed'), 'seeded procedural terrain'],
  [worker.includes('procedural-chunk-built'), 'worker response contract'],
  [worker.includes('request.worldSeed'), 'worker world seed propagation'],
  [main.includes('createWorldSeed'), 'world seed lifecycle'],
  [main.includes('gameplayFrameLimiter.shouldRun(now)'), 'active frame-rate limiter'],
  [main.includes('frameRateLimit'), 'adaptive target frame rate'],
  [frameLimiter.includes('1000 / this.targetFps'), 'timestamp frame interval'],
  [frameLimiter.includes('lastAcceptedAt'), 'frame acceptance state'],
  [qualityRuntime.includes('resolveQualityRuntimeProfile'), 'quality startup profile'],
  [qualityRuntime.includes("powerPreference: preset === 'eco'"), 'Eco GPU preference'],
  [qualityRuntimeSmoke.includes("resolveQualityRuntimeProfile('eco'"), 'quality profile runtime smoke'],
  [main.includes("import('./performance/QualityRuntimeProfileSmoke')"), 'lazy quality profile runtime smoke'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Low-end runtime smoke failed: ${missing.join(', ')}`)
  process.exit(1)
}

console.log('Low-end runtime static smoke passed')
