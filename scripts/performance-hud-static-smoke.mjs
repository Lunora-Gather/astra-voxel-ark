import fs from 'node:fs'

const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const style = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const hudSmoke = fs.readFileSync(new URL('./hud-smoke-electron.cjs', import.meta.url), 'utf8')
const performanceHud = fs.readFileSync(new URL('../src/ui/PerformanceHud.ts', import.meta.url), 'utf8')

const expectations = [
  [main.includes('perf-render-row'), 'dedicated render metrics row'],
  [main.includes('renderer.info.render.calls'), 'draw call metric'],
  [main.includes('renderer.info.render.triangles'), 'triangle metric'],
  [main.includes('renderer.info.memory.geometries'), 'geometry metric'],
  [main.includes('renderer.info.memory.textures'), 'texture metric'],
  [performanceHud.includes('formatPerformanceNumber'), 'compact metric formatter'],
  [main.includes('new PerformanceHud(app)'), 'typed performance HUD integration'],
  [main.includes('if (!showPerformanceHud) return'), 'hidden HUD DOM update guard'],
  [style.includes('.perf-row + .perf-row'), 'three-row visual hierarchy'],
  [style.includes('body.menu-open .menu-toggle-btn { display: none; }'), 'menu overlap prevention'],
  [hudSmoke.includes('perfFullyVisible'), 'viewport fit regression'],
  [hudSmoke.includes('latest FPS sample immediately'), 'instant sample regression'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Performance HUD smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Performance HUD static smoke passed')
