import fs from 'node:fs'

const collision = fs.readFileSync(new URL('../src/player/Collision.ts', import.meta.url), 'utf8')
const collisionSmoke = fs.readFileSync(new URL('../src/player/CollisionSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [collision.includes('class PlayerCollisionResolver'), 'shared collision resolver'],
  [collision.includes('highestAllowedBlockY'), 'bounded floor scan'],
  [collision.includes('overlapsFootprint'), 'precise floor footprint'],
  [collision.includes('private readonly verticalProbe'), 'reused vertical probe'],
  [collision.includes('private readonly horizontalResult'), 'reused horizontal result'],
  [collisionSmoke.includes('horizontal wall should block movement'), 'wall runtime coverage'],
  [collisionSmoke.includes('one-block step should be climbed'), 'step runtime coverage'],
  [collisionSmoke.includes('falling player should resolve onto the floor'), 'landing runtime coverage'],
  [main.includes('new PlayerCollisionResolver'), 'live collision integration'],
  [main.includes("import('./player/CollisionSmoke')"), 'lazy Electron collision smoke'],
]

const forbidden = [
  [main.includes('function playerOverlapsBlockAt'), 'duplicate overlap rule in main.ts'],
  [main.includes('function playerCollidesAt'), 'duplicate collision scan in main.ts'],
  [main.includes('function findFloorAt'), 'duplicate floor scan in main.ts'],
  [main.includes('const verticalCollisionProbe'), 'duplicate collision probe in main.ts'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
const duplicates = forbidden.filter(([present]) => present).map(([, label]) => label)
if (missing.length > 0 || duplicates.length > 0) {
  console.error(`Collision smoke failed: ${[...missing.map((item) => `missing ${item}`), ...duplicates.map((item) => `unexpected ${item}`)].join(', ')}`)
  process.exit(1)
}

console.log('Collision static smoke passed')
