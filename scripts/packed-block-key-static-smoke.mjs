import fs from 'node:fs'

const keyModule = fs.readFileSync(new URL('../src/world/blockKey.ts', import.meta.url), 'utf8')
const keySmoke = fs.readFileSync(new URL('../src/world/BlockKeySmoke.ts', import.meta.url), 'utf8')
const mining = fs.readFileSync(new URL('../src/singleplayer/MiningSystem.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [keyModule.includes('unpackBlockKeyInto'), 'allocation-free packed-key decoder'],
  [keySmoke.includes('save boundary should preserve legacy string keys'), 'legacy save round-trip coverage'],
  [main.includes('new Map<PackedBlockKey, BlockId>()'), 'numeric live block data'],
  [main.includes('new Map<PackedBlockKey, BlockVisual>()'), 'numeric live visual index'],
  [main.includes('new Set<PackedBlockKey>()'), 'numeric live block sets'],
  [main.includes('.map(stringifyBlockKey)'), 'string conversion at save boundary'],
  [main.includes('parseStringBlockKey(key)'), 'legacy string conversion at load boundary'],
  [main.includes("import('./world/BlockKeySmoke')"), 'lazy Electron packed-key smoke'],
  [mining.includes('key: PackedBlockKey'), 'numeric mining target identity'],
  [!main.includes("import { blockKey } from './worldMath'"), 'legacy string key removed from live runtime'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Packed block key static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Packed block key static smoke passed')
