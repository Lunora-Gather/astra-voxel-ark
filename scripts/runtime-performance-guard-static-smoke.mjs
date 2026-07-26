import fs from 'node:fs'

const guard = fs.readFileSync(new URL('../src/performance/RuntimePerformanceGuard.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/performance/RuntimePerformanceGuardSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const style = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const electronSmoke = fs.readFileSync(new URL('./hud-smoke-electron.cjs', import.meta.url), 'utf8')

const expectations = [
  [guard.includes("export type RuntimePressureLevel = 'normal' | 'strained' | 'critical'"), 'three pressure levels'],
  [guard.includes('viewDistancePenalty: 1'), 'temporary critical view-distance protection'],
  [guard.includes('shadows: false'), 'temporary critical shadow protection'],
  [guard.includes('this.recoverySamples >= 10'), 'recovery hysteresis'],
  [runtimeSmoke.includes('critical mode should recover one level at a time'), 'staged recovery coverage'],
  [main.includes('effectiveTerrainLoadRadius()'), 'temporary terrain radius integration'],
  [main.includes('isTerrainChunkWithinActiveRadius(plan.cx, plan.cz)'), 'stale completed terrain rejection'],
  [main.includes('performanceGuard.budget.pointLightScale'), 'point-light budget integration'],
  [main.includes('workBudget.meshBatchScale') && main.includes('workBudget.meshTimeScale'), 'mesh rebuild budget integration'],
  [main.includes('performanceGuard.budget.shadows'), 'dynamic shadow budget integration'],
  [style.includes('body[data-runtime-pressure="critical"] .hud::after'), 'critical full-screen composite protection'],
  [style.includes('body[data-runtime-pressure="strained"] .survival-badge'), 'strained HUD animation protection'],
  [main.includes("import('./performance/RuntimePerformanceGuardSmoke')"), 'lazy Electron runtime smoke'],
  [electronSmoke.includes('runtimePressure'), 'end-to-end pressure state coverage'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Runtime performance guard static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Runtime performance guard static smoke passed')
