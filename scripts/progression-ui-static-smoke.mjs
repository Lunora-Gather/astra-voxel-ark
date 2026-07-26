import fs from 'node:fs'

const progression = fs.readFileSync(new URL('../src/singleplayer/ProgressionSystem.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/singleplayer/ProgressionSystemSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const style = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const electronSmoke = fs.readFileSync(new URL('./hud-smoke-electron.cjs', import.meta.url), 'utf8')

const expectations = [
  [progression.includes('getRecipeAvailability'), 'ingredient availability model'],
  [progression.includes('getMaxCraftableCount'), 'bounded batch availability model'],
  [progression.includes('craftMany'), 'atomic batch crafting'],
  [progression.includes('claimCompletedObjectives'), 'bulk objective claiming'],
  [runtimeSmoke.includes('ingredient availability should expose exact deficits'), 'deficit runtime coverage'],
  [runtimeSmoke.includes('claimed objectives should never pay twice'), 'reward idempotency coverage'],
  [runtimeSmoke.includes('batch crafting should consume and reward exact totals'), 'batch crafting runtime coverage'],
  [main.includes('class="recipe-ingredient ${missing > 0'), 'ingredient availability rendering'],
  [main.includes('claimAllObjectivesButton.addEventListener'), 'claim-all UI integration'],
  [main.includes('data-craft-max'), 'craft-max UI integration'],
  [main.includes('data-expedition-view="journey"'), 'segmented expedition navigation'],
  [style.includes('.recipe-ingredient.missing'), 'missing ingredient styling'],
  [main.includes("import('./singleplayer/ProgressionSystemSmoke')"), 'lazy Electron progression smoke'],
  [electronSmoke.includes('recipeIngredientTokens'), 'end-to-end progression UI coverage'],
  [electronSmoke.includes('activeExpeditionView'), 'end-to-end expedition navigation coverage'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Progression UI static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Progression UI static smoke passed')
