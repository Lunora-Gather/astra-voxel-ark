import fs from 'node:fs'

const picker = fs.readFileSync(new URL('../src/player/BlockPicker.ts', import.meta.url), 'utf8')
const pickerSmoke = fs.readFileSync(new URL('../src/player/BlockPickerSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [picker.includes('class VoxelBlockPicker'), 'reusable voxel picker'],
  [picker.includes('axisBoundaryDistance'), 'exact DDA boundary traversal'],
  [picker.includes('this.hit.normal.set'), 'reused hit normal'],
  [picker.includes('distance > this.minDistance'), 'camera-cell exclusion'],
  [pickerSmoke.includes('positive X hit or normal'), 'axis and normal runtime coverage'],
  [pickerSmoke.includes('diagonal hit'), 'diagonal runtime coverage'],
  [pickerSmoke.includes('max distance was not enforced'), 'reach runtime coverage'],
  [pickerSmoke.includes('hot-path result should be reused'), 'allocation runtime coverage'],
  [main.includes('new VoxelBlockPicker({ maxDistance: RAYCAST_REACH })'), 'live picker integration'],
  [main.includes("import('./player/BlockPickerSmoke')"), 'lazy Electron runtime smoke integration'],
]

const forbidden = [
  [main.includes('pickNormal.clone()'), 'per-frame normal cloning in main.ts'],
  [main.includes('const tDeltaX ='), 'duplicate DDA traversal in main.ts'],
  [main.includes('function getBlockKeyFromHit'), 'unused renderer ray-hit adapter'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
const duplicates = forbidden.filter(([present]) => present).map(([, label]) => label)
if (missing.length > 0 || duplicates.length > 0) {
  console.error(`Block picker smoke failed: ${[...missing.map((item) => `missing ${item}`), ...duplicates.map((item) => `unexpected ${item}`)].join(', ')}`)
  process.exit(1)
}

console.log('Block picker static smoke passed')
