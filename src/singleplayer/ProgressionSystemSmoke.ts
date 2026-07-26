import { InventorySystem } from './InventorySystem'
import { ProgressionSystem, RECIPES } from './ProgressionSystem'

export function assertProgressionSystemSmoke() {
  const inventory = new InventorySystem(['wood', 'stone', 'glow'], { wood: 2, stone: 8 })
  const progression = new ProgressionSystem()
  const stoneKit = RECIPES.find(({ id }) => id === 'stone-kit')
  if (!stoneKit) throw new Error('Progression system smoke failed: stone kit recipe should exist')

  const missing = progression.getRecipeAvailability(stoneKit, inventory)
  const wood = missing.ingredients.find(({ id }) => id === 'wood')
  if (missing.craftable || wood?.available !== 2 || wood.missing !== 2) {
    throw new Error('Progression system smoke failed: ingredient availability should expose exact deficits')
  }
  inventory.add('wood', 2)
  if (!progression.getRecipeAvailability(stoneKit, inventory).craftable) {
    throw new Error('Progression system smoke failed: complete ingredient sets should be craftable')
  }
  progression.craft(stoneKit.id, inventory)
  const completed = progression.getRecipeAvailability(stoneKit, inventory)
  if (!completed.completed || completed.craftable) {
    throw new Error('Progression system smoke failed: one-time recipes should become completed')
  }

  const bricks = RECIPES.find(({ id }) => id === 'brick-batch')
  if (!bricks) throw new Error('Progression system smoke failed: repeatable brick recipe should exist')
  const batchInventory = new InventorySystem(['clay', 'stone', 'brick'], { clay: 13, stone: 6 })
  const batchProgression = new ProgressionSystem()
  if (batchProgression.getMaxCraftableCount(bricks, batchInventory) !== 3) {
    throw new Error('Progression system smoke failed: max crafting should use the limiting ingredient')
  }
  const brickBatch = batchProgression.craftMany(bricks.id, batchInventory)
  if (brickBatch?.count !== 3 || batchInventory.count('brick') !== 12 || batchInventory.count('clay') !== 1) {
    throw new Error('Progression system smoke failed: batch crafting should consume and reward exact totals')
  }

  progression.recordMine(24)
  progression.recordPlacement(16)
  const claimed = progression.claimCompletedObjectives(inventory)
  if (claimed.length !== 2 || inventory.count('glow') !== 2) {
    throw new Error('Progression system smoke failed: claim all should grant every newly completed reward')
  }
  if (progression.claimCompletedObjectives(inventory).length !== 0) {
    throw new Error('Progression system smoke failed: claimed objectives should never pay twice')
  }

  return true
}
