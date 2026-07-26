import fs from 'node:fs'

const system = fs.readFileSync(new URL('../src/render/SkyDecorationSystem.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/render/SkyDecorationSystemSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [(system.match(/new THREE\.InstancedMesh/g) ?? []).length === 2, 'exactly two instanced decoration meshes'],
  [system.includes('new Float32Array(this.cloudCount)'), 'packed reusable cloud state'],
  [system.includes('new Float32Array(this.sparkleCount)'), 'packed reusable sparkle state'],
  [system.includes('boundedCount(cloudBudget'), 'bounded cloud animation budget'],
  [system.includes('boundedCount(sparkleBudget'), 'bounded sparkle animation budget'],
  [runtimeSmoke.includes('two instanced draws'), 'runtime draw-object contract'],
  [main.includes('new SkyDecorationSystem({'), 'live sky decoration integration'],
  [main.includes("import('./render/SkyDecorationSystemSmoke')"), 'lazy Electron runtime smoke'],
  [main.includes('skyDecorations.dispose()'), 'page lifecycle disposal'],
  [!main.includes('const clouds = new THREE.Group()'), 'no legacy cloud group'],
  [!main.includes('const sparkles = new THREE.Group()'), 'no legacy sparkle group'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Sky decoration static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Sky decoration static smoke passed')
