import fs from 'node:fs'

const history = fs.readFileSync(new URL('../src/singleplayer/BuildHistorySystem.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/singleplayer/BuildHistorySystemSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const style = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const electronSmoke = fs.readFileSync(new URL('./hud-smoke-electron.cjs', import.meta.url), 'utf8')

const expectations = [
  [history.includes('const DEFAULT_HISTORY_LIMIT = 32'), 'bounded default history'],
  [history.includes('const MAX_ACTION_CHANGES = 9'), 'blueprint-sized action cap'],
  [runtimeSmoke.includes('snapshot coordinates and previous water'), 'water restoration runtime coverage'],
  [runtimeSmoke.includes('discard the oldest action'), 'history bound runtime coverage'],
  [main.includes('previous: blockData.get(packBlockKey'), 'pre-placement block capture'],
  [main.includes("removeBlockAtKey(key, 'player')"), 'player delta reversal'],
  [main.includes("addBlock(change.x, change.y, change.z, change.previous, 'save')"), 'previous block restoration'],
  [main.includes('refunds.forEach((amount, id) => addToInventory(id, amount))'), 'inventory refund integration'],
  [main.includes("e.code === 'KeyZ'"), 'desktop undo shortcut'],
  [style.includes('.undo-build-btn'), 'touch-accessible undo control'],
  [main.includes("import('./singleplayer/BuildHistorySystemSmoke')"), 'lazy Electron history smoke'],
  [electronSmoke.includes('undoBuildDisabled'), 'end-to-end undo layout coverage'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Build history static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Build history static smoke passed')
