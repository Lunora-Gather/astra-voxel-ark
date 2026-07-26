import fs from 'node:fs'

const coordinator = fs.readFileSync(new URL('../src/game/PageLifecycleSaveCoordinator.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/game/PageLifecycleSaveCoordinatorSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [coordinator.includes('savedWhileHidden'), 'per-background-cycle save deduplication'],
  [coordinator.includes('if (saved) this.savedWhileHidden = true'), 'failed-write retry support'],
  [coordinator.includes('this.options.teardown()'), 'one-shot lifecycle teardown'],
  [runtimeSmoke.includes('back-forward cache should preserve live resources'), 'back-forward cache runtime smoke'],
  [runtimeSmoke.includes('terminal pagehide should save a new cycle and teardown once'), 'terminal teardown runtime smoke'],
  [runtimeSmoke.includes('pagehide should retry a failed background write'), 'failed-write runtime smoke'],
  [main.includes("document.addEventListener('visibilitychange'"), 'visibility lifecycle integration'],
  [main.includes("window.addEventListener('pagehide'"), 'pagehide lifecycle integration'],
  [main.includes('pageLifecycle.pageHidden(event.persisted)'), 'back-forward cache integration'],
  [main.includes('save: () => saveWorld(true)'), 'silent save integration'],
  [main.includes("import('./game/PageLifecycleSaveCoordinatorSmoke')"), 'lazy Electron runtime smoke'],
]

const missing = expectations.filter(([present]) => !present)
if (missing.length) {
  console.error(`Page lifecycle save static smoke failed: ${missing.map(([, label]) => `missing ${label}`).join(', ')}`)
  process.exit(1)
}

console.log('Page lifecycle save static smoke passed')
