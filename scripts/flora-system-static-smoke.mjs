import fs from 'node:fs'

const flora = fs.readFileSync(new URL('../src/world/Flora.ts', import.meta.url), 'utf8')
const terrain = fs.readFileSync(new URL('../src/world/ProceduralTerrain.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/world/FloraSystemSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [flora.includes('FLORA_DEFINITIONS'), 'central flora definitions'],
  [flora.includes('selectFloraVariant'), 'biome flora selector'],
  [terrain.includes('selectFloraVariant(biome.id'), 'deterministic terrain flora integration'],
  [terrain.includes('FloraVariantId'), 'compact flora tuple contract'],
  [main.includes('const grassBladeMaterial = new THREE.MeshStandardMaterial({\n  color: 0xffffff'), 'neutral instance-color material'],
  [main.includes('grassBladeMesh.setColorAt'), 'single-batch instance coloring'],
  [main.includes('GRASS_ANIMATION_BUDGET * 3'), 'device-tier flora instance cap'],
  [main.includes('if (!cosmeticEffectsReduced) grassTimeUniform.value = elapsedTime'), 'pressure-safe flora animation'],
  [runtimeSmoke.includes('flora placement is not deterministic'), 'flora determinism runtime coverage'],
  [main.includes("import('./world/FloraSystemSmoke')"), 'lazy Electron flora smoke'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Flora system static smoke failed: ${missing.join(', ')}`)
  process.exit(1)
}

console.log('Flora system static smoke passed')
