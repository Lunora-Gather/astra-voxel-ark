import fs from 'node:fs'

const patterns = fs.readFileSync(new URL('../src/singleplayer/BuildPatternSystem.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/singleplayer/BuildPatternSystemSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const style = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const electronSmoke = fs.readFileSync(new URL('./hud-smoke-electron.cjs', import.meta.url), 'utf8')

const expectations = [
  [patterns.includes("export type BuildPatternId = 'single' | 'pillar' | 'wall' | 'platform'"), 'four constrained pattern ids'],
  [patterns.includes('Array.from({ length: MAX_PATTERN_BLOCKS }'), 'reused position buffer'],
  [runtimeSmoke.includes('planner should reuse results'), 'allocation-free planner coverage'],
  [runtimeSmoke.includes('walls should span the Z axis'), 'view-oriented wall coverage'],
  [main.includes('withBlockBatch(() =>'), 'batched blueprint placement'],
  [main.includes('consumeInventory(selectedBlock, plan.count)'), 'atomic blueprint inventory cost'],
  [main.includes('new THREE.InstancedMesh(previewGeometry, patternPreviewMaterial, 9)'), 'single-draw blueprint preview'],
  [main.includes("e.code === 'KeyB'"), 'desktop pattern cycling'],
  [style.includes('.build-pattern-options'), 'responsive pattern controls'],
  [main.includes("import('./singleplayer/BuildPatternSystemSmoke')"), 'lazy Electron blueprint smoke'],
  [electronSmoke.includes('buildPatternButtons'), 'end-to-end blueprint UI coverage'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Build pattern static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Build pattern static smoke passed')
