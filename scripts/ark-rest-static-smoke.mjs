import fs from 'node:fs'

const rest = fs.readFileSync(new URL('../src/singleplayer/ArkRestSystem.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/singleplayer/ArkRestSystemSmoke.ts', import.meta.url), 'utf8')
const vitals = fs.readFileSync(new URL('../src/singleplayer/SurvivalVitals.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const style = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const electronSmoke = fs.readFileSync(new URL('./hud-smoke-electron.cjs', import.meta.url), 'utf8')

const expectations = [
  [rest.includes('const DAY_PHASE_RATE = 0.055'), 'shared live day-cycle rate'],
  [rest.includes("export type ArkRestReason = 'ready' | 'daylight' | 'far'"), 'explicit rest eligibility'],
  [runtimeSmoke.includes('advance to rising daylight'), 'dawn runtime coverage'],
  [runtimeSmoke.includes('distant players should return to the Ark'), 'distance runtime coverage'],
  [vitals.includes('heal(amount: number)'), 'bounded survival recovery'],
  [main.includes('simulationElapsedTime = rest.nextWorldTime'), 'live dawn advancement'],
  [main.includes('crystalPower = Math.max(65, crystalPower)'), 'minimum Ark power recovery'],
  [main.includes("e.code === 'KeyR'"), 'desktop rest shortcut'],
  [style.includes('.ark-rest-card'), 'responsive Journey rest control'],
  [main.includes("import('./singleplayer/ArkRestSystemSmoke')"), 'lazy Electron rest smoke'],
  [electronSmoke.includes('arkRestDisabled'), 'end-to-end rest layout coverage'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Ark rest static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Ark rest static smoke passed')
