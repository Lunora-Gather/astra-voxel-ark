import fs from 'node:fs'

const settings = fs.readFileSync(new URL('../src/game/settings.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const style = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const adaptiveQuality = fs.readFileSync(new URL('../src/app/AdaptiveQualityController.ts', import.meta.url), 'utf8')

const expectations = [
  [settings.includes('class SettingsStore'), 'typed settings store'],
  [settings.includes("quality === 'eco'"), 'Eco quality migration'],
  [settings.includes('SettingsWriteResult'), 'safe write result'],
  [settings.includes('mouseLookSpeed'), 'legacy sensitivity migration'],
  [settings.includes('qualityPreset'), 'legacy quality migration'],
  [settings.includes('maxViewDistance'), 'device view-distance bound'],
  [settings.includes('frameRate: 30 | 60'), 'frame-rate persistence'],
  [settings.includes("sanitizedQuality === 'eco' ? 30"), 'Eco frame-rate cap'],
  [settings.includes("sanitizedQuality === 'eco' ? 1"), 'Eco view-distance cap'],
  [settings.includes('soundEnabled: boolean'), 'audio persistence'],
  [main.includes('new SettingsStore'), 'live settings store integration'],
  [main.includes('settingsStore.load()'), 'central settings loading'],
  [main.includes('settingsStore.save(nextSettings)'), 'central settings saving'],
  [main.includes('showSettingsPersistenceWarning'), 'write failure feedback'],
  [main.includes('data-quality="eco"'), 'Eco settings control'],
  [main.includes('return { min: 0.5, max: 0.6, start: 0.56 }'), 'Eco render-scale band'],
  [main.includes("qualityPreset === 'eco'"), 'Eco runtime integration'],
  [adaptiveQuality.includes("if (preset === 'eco') return preset"), 'Eco adaptive-quality pin'],
  [
    /@media \(max-height: 520px\) and \(orientation: landscape\)[\s\S]*?\.quality-options\s*\{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/.test(style),
    'four-column short-landscape quality controls',
  ],
]

const forbidden = [
  [main.includes("const SETTINGS_KEY = 'astra-voxel-ark-settings-v1'"), 'settings key duplicated in main.ts'],
  [main.includes('function readStoredSettings'), 'settings parser duplicated in main.ts'],
  [main.includes('function writeStoredSettings'), 'settings writer duplicated in main.ts'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
const duplicates = forbidden.filter(([present]) => present).map(([, label]) => label)
if (missing.length > 0 || duplicates.length > 0) {
  console.error(`Settings store smoke failed: ${[...missing.map((item) => `missing ${item}`), ...duplicates.map((item) => `unexpected ${item}`)].join(', ')}`)
  process.exit(1)
}

console.log('Settings store static smoke passed')
