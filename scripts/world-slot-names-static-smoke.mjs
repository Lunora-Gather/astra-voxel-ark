import fs from 'node:fs'

const slots = fs.readFileSync(new URL('../src/world/WorldSlots.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const electronSmoke = fs.readFileSync(new URL('./hud-smoke-electron.cjs', import.meta.url), 'utf8')

const checks = [
  [slots, 'WORLD_SLOT_NAMES_KEY', 'world name metadata key'],
  [slots, 'class WorldSlotNameStore', 'resilient world name store'],
  [slots, 'sanitizeWorldSlotName', 'world name sanitization'],
  [slots, 'WORLD_SLOT_NAME_MAX_LENGTH = 32', 'world name length cap'],
  [slots, 'getWorldExportSlug', 'safe export filename helper'],
  [main, 'class="world-name-editor"', 'world name editor markup'],
  [main, 'worldSlotNameStore.saveName', 'world name persistence wiring'],
  [main, 'getWorldExportSlug(worldSlotNames[activeWorldSlot]', 'named export wiring'],
  [css, '.world-name-editor', 'world name editor layout'],
  [electronSmoke, 'smokeWorldNames', 'runtime world name coverage'],
]

for (const [source, token, label] of checks) {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`)
}

console.log('World slot name static smoke passed')
