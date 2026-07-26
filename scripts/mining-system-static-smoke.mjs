import fs from 'node:fs'

const mining = fs.readFileSync(new URL('../src/singleplayer/MiningSystem.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/singleplayer/MiningSystemSmoke.ts', import.meta.url), 'utf8')
const progression = fs.readFileSync(new URL('../src/singleplayer/ProgressionSystem.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [mining.includes('const BLOCK_MINING_DURATION_MS'), 'per-block hardness durations'],
  [mining.includes('const TOOL_DURATION_SCALE'), 'tool speed scaling'],
  [mining.includes("status: 'idle' | 'active' | 'cancelled' | 'complete'"), 'mining lifecycle states'],
  [runtimeSmoke.includes('changing aim should cancel mining'), 'target-change cancellation coverage'],
  [runtimeSmoke.includes('progress should be allocation-free'), 'hot-path result reuse coverage'],
  [runtimeSmoke.includes('crafted tool tiers should accelerate live mining rules'), 'crafting-to-mining loop coverage'],
  [progression.includes('return getBlockMiningDuration(id, this.toolTier)'), 'progression tool integration'],
  [main.includes("beginMining('desktop')"), 'desktop hold-to-mine integration'],
  [main.includes("beginMining('touch-button')"), 'touch button hold-to-mine integration'],
  [main.includes("beginMining('touch-canvas')"), 'touch canvas hold-to-mine integration'],
  [main.includes("import('./singleplayer/MiningSystemSmoke')"), 'lazy Electron mining smoke'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Mining system static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Mining system static smoke passed')
