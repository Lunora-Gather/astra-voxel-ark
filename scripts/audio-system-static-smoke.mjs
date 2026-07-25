import fs from 'node:fs'

const audio = fs.readFileSync(new URL('../src/systems/AudioSystem.ts', import.meta.url), 'utf8')
const effects = fs.readFileSync(new URL('../src/systems/soundEffects.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [audio.includes('setMasterVolume'), 'central master volume control'],
  [audio.includes('setEnabled'), 'central mute control'],
  [audio.includes("if (!AudioContextCtor) return null"), 'missing Web Audio fallback'],
  [audio.includes('if (!this.enabled || this.masterVolume <= 0) return'), 'muted lazy initialization'],
  [audio.includes('endFrequency'), 'frequency sweep support'],
  [effects.includes('playGameSound'), 'shared gameplay sound facade'],
  [effects.includes('playShardCollectSound'), 'shared shard sound facade'],
  [main.includes('audioSystem.setMasterVolume(soundVolume)'), 'settings volume integration'],
  [main.includes('audioSystem.setEnabled(soundEnabled)'), 'settings mute integration'],
  [main.includes('audioSystem.dispose()'), 'page lifecycle cleanup'],
]

const forbidden = [
  [main.includes('createOscillator('), 'oscillator creation in main.ts'],
  [main.includes('createGain('), 'gain creation in main.ts'],
  [main.includes('new (window.AudioContext'), 'AudioContext construction in main.ts'],
  [main.includes('function playSound('), 'duplicate playSound implementation in main.ts'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
const duplicates = forbidden.filter(([present]) => present).map(([, label]) => label)
if (missing.length > 0 || duplicates.length > 0) {
  console.error(`Audio system smoke failed: ${[...missing.map((item) => `missing ${item}`), ...duplicates.map((item) => `unexpected ${item}`)].join(', ')}`)
  process.exit(1)
}

console.log('Audio system static smoke passed')
