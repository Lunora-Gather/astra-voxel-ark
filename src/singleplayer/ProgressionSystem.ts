import type { BlockId } from '../blocks'
import { getBlockMiningDuration } from './MiningSystem'

export type ToolTier = 0 | 1 | 2 | 3

export type InventoryPort = {
  count(id: BlockId): number
  add(id: BlockId, amount: number): void
  remove(id: BlockId, amount: number): boolean
}

export type Ingredient = {
  id: BlockId
  amount: number
}

export type RecipeReward =
  | { kind: 'blocks'; id: BlockId; amount: number }
  | { kind: 'tool'; tier: ToolTier }

export type Recipe = {
  id: string
  name: string
  description: string
  ingredients: Ingredient[]
  reward: RecipeReward
  once?: boolean
}

export type RecipeIngredientAvailability = Ingredient & {
  available: number
  missing: number
}

export type RecipeAvailability = {
  completed: boolean
  craftable: boolean
  ingredients: RecipeIngredientAvailability[]
}

export type ProgressionStats = {
  mined: number
  placed: number
  crafted: number
  exploredChunks: number
  shards: number
}

export type ProgressionSnapshot = {
  toolTier: ToolTier
  crafted: Record<string, number>
  claimedObjectives: string[]
  stats: ProgressionStats
}

export type Objective = {
  id: string
  name: string
  description: string
  current: number
  target: number
  reward: Ingredient[]
  complete: boolean
  claimed: boolean
}

const EMPTY_STATS: ProgressionStats = {
  mined: 0,
  placed: 0,
  crafted: 0,
  exploredChunks: 0,
  shards: 0,
}

export const TOOL_TIER_NAMES = ['Hand Tools', 'Stone Kit', 'Copper Kit', 'Astral Kit'] as const

export const RECIPES: Recipe[] = [
  {
    id: 'stone-kit',
    name: 'Stone Tool Kit',
    description: 'Unlocks copper mining and faster field work.',
    ingredients: [{ id: 'wood', amount: 4 }, { id: 'stone', amount: 8 }],
    reward: { kind: 'tool', tier: 1 },
    once: true,
  },
  {
    id: 'copper-kit',
    name: 'Copper Tool Kit',
    description: 'Unlocks crystal, gold and obsidian mining.',
    ingredients: [{ id: 'wood', amount: 3 }, { id: 'stone', amount: 4 }, { id: 'copper', amount: 6 }],
    reward: { kind: 'tool', tier: 2 },
    once: true,
  },
  {
    id: 'astral-kit',
    name: 'Astral Tool Kit',
    description: 'The fastest tools available to an Ark wayfinder.',
    ingredients: [{ id: 'copper', amount: 4 }, { id: 'crystal', amount: 5 }, { id: 'gold', amount: 2 }, { id: 'glow', amount: 2 }],
    reward: { kind: 'tool', tier: 3 },
    once: true,
  },
  {
    id: 'brick-batch',
    name: 'Kiln-fired Bricks',
    description: 'Craft four durable building blocks.',
    ingredients: [{ id: 'clay', amount: 4 }, { id: 'stone', amount: 2 }],
    reward: { kind: 'blocks', id: 'brick', amount: 4 },
  },
  {
    id: 'moss-stone',
    name: 'Living Masonry',
    description: 'Craft four moss-covered stones.',
    ingredients: [{ id: 'stone', amount: 4 }, { id: 'grass', amount: 2 }],
    reward: { kind: 'blocks', id: 'moss', amount: 4 },
  },
  {
    id: 'glow-lantern',
    name: 'Glow Lantern',
    description: 'Craft two permanent light blocks.',
    ingredients: [{ id: 'crystal', amount: 1 }, { id: 'gold', amount: 1 }],
    reward: { kind: 'blocks', id: 'glow', amount: 2 },
  },
]

const MINING_TIER: Partial<Record<BlockId, ToolTier>> = {
  copper: 1,
  crystal: 2,
  gold: 2,
  obsidian: 2,
}

export class ProgressionSystem {
  private toolTier: ToolTier = 0
  private crafted: Record<string, number> = {}
  private claimedObjectives = new Set<string>()
  private stats: ProgressionStats = { ...EMPTY_STATS }

  getToolTier() {
    return this.toolTier
  }

  getToolName() {
    return TOOL_TIER_NAMES[this.toolTier]
  }

  canMine(id: BlockId) {
    return this.toolTier >= (MINING_TIER[id] ?? 0)
  }

  requiredToolName(id: BlockId) {
    return TOOL_TIER_NAMES[MINING_TIER[id] ?? 0]
  }

  getMiningDuration(id: BlockId) {
    return getBlockMiningDuration(id, this.toolTier)
  }

  canCraft(recipe: Recipe, inventory: InventoryPort) {
    return this.getRecipeAvailability(recipe, inventory).craftable
  }

  getRecipeAvailability(recipe: Recipe, inventory: InventoryPort): RecipeAvailability {
    const completed = Boolean(recipe.once && (this.crafted[recipe.id] ?? 0) > 0)
    const ingredients = recipe.ingredients.map(({ id, amount }) => {
      const available = inventory.count(id)
      return {
        id,
        amount,
        available,
        missing: Math.max(0, amount - available),
      }
    })
    return {
      completed,
      craftable: !completed && ingredients.every(({ missing }) => missing === 0),
      ingredients,
    }
  }

  craft(recipeId: string, inventory: InventoryPort) {
    const recipe = RECIPES.find(({ id }) => id === recipeId)
    if (!recipe || !this.canCraft(recipe, inventory)) return null

    for (const ingredient of recipe.ingredients) {
      if (!inventory.remove(ingredient.id, ingredient.amount)) return null
    }
    if (recipe.reward.kind === 'blocks') {
      inventory.add(recipe.reward.id, recipe.reward.amount)
    } else {
      this.toolTier = Math.max(this.toolTier, recipe.reward.tier) as ToolTier
    }
    this.crafted[recipe.id] = (this.crafted[recipe.id] ?? 0) + 1
    this.stats.crafted += 1
    return recipe
  }

  recordMine(amount = 1) {
    this.stats.mined += Math.max(0, Math.floor(amount))
  }

  recordPlacement(amount = 1) {
    this.stats.placed += Math.max(0, Math.floor(amount))
  }

  recordExploredChunk(amount = 1) {
    this.stats.exploredChunks += Math.max(0, Math.floor(amount))
  }

  setShardCount(value: number) {
    this.stats.shards = Math.max(this.stats.shards, Math.max(0, Math.floor(value)))
  }

  getObjectives(): Objective[] {
    const definitions = [
      { id: 'gatherer', name: 'Gatherer', description: 'Mine 24 blocks', key: 'mined', target: 24, reward: [{ id: 'wood', amount: 6 }, { id: 'stone', amount: 8 }] },
      { id: 'builder', name: 'Shelter Builder', description: 'Place 16 blocks', key: 'placed', target: 16, reward: [{ id: 'glow', amount: 2 }] },
      { id: 'wayfinder', name: 'Wayfinder', description: 'Explore 12 terrain chunks', key: 'exploredChunks', target: 12, reward: [{ id: 'copper', amount: 4 }] },
      { id: 'artisan', name: 'Ark Artisan', description: 'Craft 3 recipes', key: 'crafted', target: 3, reward: [{ id: 'gold', amount: 2 }] },
      { id: 'ark-restored', name: 'Ark Restored', description: 'Recover all 6 landmark shards', key: 'shards', target: 6, reward: [{ id: 'crystal', amount: 6 }, { id: 'glow', amount: 6 }] },
    ] as const

    return definitions.map((definition) => {
      const current = this.stats[definition.key]
      return {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        current,
        target: definition.target,
        reward: definition.reward.filter(({ amount }) => amount > 0),
        complete: current >= definition.target,
        claimed: this.claimedObjectives.has(definition.id),
      }
    })
  }

  claimObjective(id: string, inventory: InventoryPort) {
    const objective = this.getObjectives().find((candidate) => candidate.id === id)
    if (!objective?.complete || objective.claimed) return null
    objective.reward.forEach(({ id: blockId, amount }) => inventory.add(blockId, amount))
    this.claimedObjectives.add(id)
    return objective
  }

  claimCompletedObjectives(inventory: InventoryPort) {
    const claimed: Objective[] = []
    this.getObjectives().forEach((objective) => {
      if (!objective.complete || objective.claimed) return
      objective.reward.forEach(({ id, amount }) => inventory.add(id, amount))
      this.claimedObjectives.add(objective.id)
      claimed.push({ ...objective, claimed: true })
    })
    return claimed
  }

  snapshot(): ProgressionSnapshot {
    return {
      toolTier: this.toolTier,
      crafted: { ...this.crafted },
      claimedObjectives: [...this.claimedObjectives],
      stats: { ...this.stats },
    }
  }

  restore(value: Partial<ProgressionSnapshot> | undefined) {
    const tier = Number(value?.toolTier)
    this.toolTier = (Number.isInteger(tier) && tier >= 0 && tier <= 3 ? tier : 0) as ToolTier
    this.crafted = sanitizeCountRecord(value?.crafted)
    this.claimedObjectives = new Set(Array.isArray(value?.claimedObjectives) ? value.claimedObjectives.filter((id): id is string => typeof id === 'string') : [])
    this.stats = {
      mined: sanitizeCount(value?.stats?.mined),
      placed: sanitizeCount(value?.stats?.placed),
      crafted: sanitizeCount(value?.stats?.crafted),
      exploredChunks: sanitizeCount(value?.stats?.exploredChunks),
      shards: sanitizeCount(value?.stats?.shards),
    }
  }

  reset() {
    this.restore(undefined)
  }
}

function sanitizeCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function sanitizeCountRecord(value: unknown) {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).filter(([key, count]) => key.length > 0 && sanitizeCount(count) > 0).map(([key, count]) => [key, sanitizeCount(count)]),
  )
}
