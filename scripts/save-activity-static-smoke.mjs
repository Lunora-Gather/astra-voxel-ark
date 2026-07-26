import fs from 'node:fs'

const tracker = fs.readFileSync(new URL('../src/game/SaveActivityTracker.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/game/SaveActivityTrackerSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const electronSmoke = fs.readFileSync(new URL('./hud-smoke-electron.cjs', import.meta.url), 'utf8')

const expectations = [
  [tracker.includes("type SaveActivityState = 'unsaved' | 'saving' | 'saved' | 'error'"), 'save activity states'],
  [tracker.includes('class SaveActivityTracker'), 'save activity tracker'],
  [tracker.includes('elapsedMinutes'), 'relative save age'],
  [runtimeSmoke.includes('pending saves should be visible'), 'pending runtime coverage'],
  [runtimeSmoke.includes('invalid timestamps should recover safely'), 'timestamp recovery coverage'],
  [main.includes('class="save-status hud-save-status"'), 'persistent HUD save status'],
  [main.includes('class="pause-save-status"'), 'pause menu save status'],
  [main.includes('cancelPendingAutoSave()'), 'pending autosave cancellation'],
  [main.includes('autoSavePending = true'), 'single pending autosave guard'],
  [main.includes("import('./game/SaveActivityTrackerSmoke')"), 'lazy Electron save activity smoke'],
  [css.includes('[data-save-state="error"]'), 'save error styling'],
  [electronSmoke.includes('saveStatusState'), 'end-to-end save status coverage'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Save activity static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Save activity static smoke passed')
