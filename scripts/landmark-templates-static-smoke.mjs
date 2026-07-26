import fs from 'node:fs'

const templates = fs.readFileSync(new URL('../src/world/LandmarkTemplates.ts', import.meta.url), 'utf8')
const terrain = fs.readFileSync(new URL('../src/world/ProceduralTerrain.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/world/LandmarkTemplatesSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [templates.includes("type LandmarkTemplateId = 'moss-shrine' | 'crystal-bloom' | 'waystone'"), 'three data-driven landmark templates'],
  [templates.includes('LANDMARK_NAMES'), 'biome-aware landmark names'],
  [templates.includes('buildLandmarkPlan'), 'shared deterministic landmark planner'],
  [terrain.includes('landmark: LandmarkPlan | null'), 'terrain landmark metadata'],
  [terrain.includes('landmark?.blocks.forEach'), 'terrain template integration'],
  [runtimeSmoke.includes('legacy origin moved'), 'legacy coordinate regression coverage'],
  [runtimeSmoke.includes('is not deterministic'), 'determinism runtime coverage'],
  [main.includes("import('./world/LandmarkTemplatesSmoke')"), 'lazy Electron landmark smoke'],
  [main.includes('landmarkShardNames.delete(blockKeyValue)'), 'resident landmark eviction cleanup'],
  [main.includes('nearest.landmarkName'), 'named navigation integration'],
]

const forbidden = [
  [main.includes('function getLandmarkShardKeysForChunk'), 'duplicate landmark generator in main.ts'],
  [terrain.includes('function addLandmark('), 'duplicate landmark generator in terrain adapter'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
const duplicates = forbidden.filter(([present]) => present).map(([, label]) => label)
if (missing.length > 0 || duplicates.length > 0) {
  console.error(`Landmark template smoke failed: ${[
    ...missing.map((item) => `missing ${item}`),
    ...duplicates.map((item) => `unexpected ${item}`),
  ].join(', ')}`)
  process.exit(1)
}

console.log('Landmark template static smoke passed')
