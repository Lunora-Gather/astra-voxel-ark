import fs from 'node:fs'

const motion = fs.readFileSync(new URL('../src/player/PlayerMotionController.ts', import.meta.url), 'utf8')
const vitals = fs.readFileSync(new URL('../src/singleplayer/SurvivalVitals.ts', import.meta.url), 'utf8')
const vitalsSmoke = fs.readFileSync(new URL('../src/singleplayer/SurvivalVitalsSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [motion.includes('const impactSpeed = Math.max(0, -this.verticalVelocity)'), 'landing impact capture before reset'],
  [vitals.includes('export function getFallDamage'), 'renderer-independent fall damage rule'],
  [vitals.includes('applyDamage(amount: number)'), 'one-shot survival damage adapter'],
  [vitalsSmoke.includes('safe landing threshold'), 'safe landing runtime coverage'],
  [vitalsSmoke.includes('zero health should not count repeated deaths'), 'death idempotency coverage'],
  [main.includes('applyLandingImpact(playerMotion.land())'), 'collision-to-survival integration'],
  [main.includes("showToast(`Hard landing"), 'clear landing feedback'],
  [main.includes("import('./singleplayer/SurvivalVitalsSmoke')"), 'lazy Electron survival smoke'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Fall damage static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Fall damage static smoke passed')
