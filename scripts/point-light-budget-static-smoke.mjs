import fs from 'node:fs'

const budget = fs.readFileSync(new URL('../src/render/lightBudget.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/render/PointLightBudgetControllerSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [budget.includes('export class PointLightBudgetController'), 'persistent light budget boundary'],
  [budget.includes('private readonly candidates:'), 'reused candidate buffer'],
  [budget.includes('this.candidates.length = 0'), 'in-place candidate reset'],
  [budget.includes('entry.distanceSq = dx * dx + dy * dy + dz * dz'), 'single-pass distance cache'],
  [budget.includes('this.candidates.sort(compareRegisteredPointLights)'), 'in-place priority sorting'],
  [runtimeSmoke.includes('priority, distance and range ordering should be stable'), 'runtime ordering coverage'],
  [main.includes('new PointLightBudgetController<PackedBlockKey>()'), 'live controller integration'],
  [main.includes('glowLightBudget.register('), 'light lifecycle registration'],
  [main.includes('glowLightBudget.unregister('), 'light lifecycle removal'],
  [main.includes('glowLightBudget.apply(playerPos, guardedLightBudget, LIGHT_CULL_DISTANCE_SQ)'), 'allocation-free live budget pass'],
  [!main.includes('const candidates: Array<{ key: PackedBlockKey; light:'), 'no periodic candidate objects'],
  [main.includes("import('./render/PointLightBudgetControllerSmoke')"), 'lazy Electron light budget smoke'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Point light budget static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Point light budget static smoke passed')
