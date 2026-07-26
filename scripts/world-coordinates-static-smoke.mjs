import fs from 'node:fs'

const coordinates = fs.readFileSync(new URL('../src/world/WorldCoordinates.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/world/WorldCoordinatesSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const electronSmoke = fs.readFileSync(new URL('./hud-smoke-electron.cjs', import.meta.url), 'utf8')

const expectations = [
  [coordinates.includes('Math.floor(value)'), 'block coordinate floor semantics'],
  [coordinates.includes('formatWorldCoordinatesForClipboard'), 'clipboard coordinate formatter'],
  [runtimeSmoke.includes('HUD coordinate format changed'), 'HUD formatter runtime coverage'],
  [runtimeSmoke.includes("[-0.001, -1]"), 'negative boundary runtime coverage'],
  [main.includes('class="world-coordinates"'), 'coordinate HUD markup'],
  [main.includes("import('./world/WorldCoordinatesSmoke')"), 'lazy Electron coordinate smoke'],
  [main.includes('elapsedTime - lastBiomeUiAt > 0.75'), 'budgeted location DOM updates'],
  [main.includes("showToast('Coordinates copied')"), 'coordinate copy feedback'],
  [css.includes('.world-coordinates'), 'responsive coordinate styling'],
  [electronSmoke.includes('worldCoordinatesText'), 'end-to-end coordinate coverage'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`World coordinates static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('World coordinates static smoke passed')
