import fs from 'node:fs'

const guide = fs.readFileSync(new URL('../src/singleplayer/TutorialGuide.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/singleplayer/TutorialGuideSmoke.ts', import.meta.url), 'utf8')
const saveSystem = fs.readFileSync(new URL('../src/world/SaveSystem.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const electronSmoke = fs.readFileSync(new URL('./hud-smoke-electron.cjs', import.meta.url), 'utf8')

const expectations = [
  [guide.includes("type TutorialStepId = 'move' | 'mine' | 'place' | 'backpack' | 'craft' | 'shard'"), 'contextual tutorial steps'],
  [guide.includes('syncProgression'), 'legacy progression synchronization'],
  [guide.includes('snapshot(): TutorialSnapshot'), 'compact tutorial persistence'],
  [runtimeSmoke.includes('touch onboarding should use touch language'), 'touch prompt runtime coverage'],
  [runtimeSmoke.includes('snapshots should filter invalid and duplicate steps'), 'snapshot sanitization coverage'],
  [saveSystem.includes('value.tutorial?.completed'), 'tutorial import size validation'],
  [main.includes('controls.object.position.distanceToSquared(previousPosition)'), 'actual movement integration'],
  [main.includes("advanceTutorial('backpack')"), 'backpack integration'],
  [main.includes("advanceTutorial('craft', false)"), 'craft integration'],
  [main.includes('helpGuidePrompt.textContent = tutorialGuide.prompt(isTouchDevice)'), 'compact help guide mirror'],
  [main.includes("import('./singleplayer/TutorialGuideSmoke')"), 'lazy Electron tutorial smoke'],
  [electronSmoke.includes('tutorialStep'), 'end-to-end tutorial coverage'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Tutorial guide static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Tutorial guide static smoke passed')
