import fs from 'node:fs'

const controller = fs.readFileSync(new URL('../src/player/PlayerMotionController.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/player/PlayerMotionControllerSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [controller.includes('class PlayerMotionController'), 'shared motion controller'],
  [controller.includes('private readonly step'), 'reused motion step'],
  [controller.includes('1 - Math.exp(-response * dt)'), 'frame-rate-aware acceleration'],
  [controller.includes('maxDeltaSeconds: 0.05'), 'long-frame delta cap'],
  [controller.includes('jump()'), 'grounded jump rule'],
  [runtimeSmoke.includes('diagonal touch input was not normalized'), 'touch normalization runtime coverage'],
  [runtimeSmoke.includes('sprint speed ratio changed'), 'sprint runtime coverage'],
  [runtimeSmoke.includes('frame-rate drift'), 'low-frame-rate runtime coverage'],
  [runtimeSmoke.includes('hot-path step should be reused'), 'allocation runtime coverage'],
  [main.includes('new PlayerMotionController()'), 'live motion integration'],
  [main.includes("import('./player/PlayerMotionControllerSmoke')"), 'lazy Electron motion smoke'],
  [main.includes('playerMotion.stopHorizontal()'), 'input reset integration'],
]

const forbidden = [
  [main.includes('let velocityY'), 'duplicate vertical velocity in main.ts'],
  [main.includes('let canJump'), 'duplicate grounded state in main.ts'],
  [main.includes('smoothedMoveVelocity'), 'duplicate horizontal smoothing in main.ts'],
  [main.includes('GROUND_ACCEL_RESPONSE'), 'duplicate acceleration constants in main.ts'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
const duplicates = forbidden.filter(([present]) => present).map(([, label]) => label)
if (missing.length > 0 || duplicates.length > 0) {
  console.error(`Player motion static smoke failed: ${[
    ...missing.map((item) => `missing ${item}`),
    ...duplicates.map((item) => `unexpected ${item}`),
  ].join(', ')}`)
  process.exit(1)
}

console.log('Player motion static smoke passed')
