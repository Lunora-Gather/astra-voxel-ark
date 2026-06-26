import { BLOCKS, type BlockId } from '../blocks'

const BLOCK_ID_SET = new Set<BlockId>(BLOCKS.map((block) => block.id))

export type SavedBlock = {
  x: number
  y: number
  z: number
  id: BlockId
}

export type SavedPlayerState = {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

export type SavedSurvivalState = {
  crystalPower?: number
  threatLevel?: number
  dayTime?: number
  survivedNights?: number
}

export type SavedExplorationState = {
  collectedShardIds?: string[]
  discoveredLandmarkIds?: string[]
  arkCoreRepaired?: boolean
}

export type SavedWorldState = {
  version: number
  savedAt: string
  blocks: SavedBlock[]
  terrainChunks: string[]
  removedBlocks: string[]
  playerPlacedBlocks: string[]
  inventory: Partial<Record<BlockId, number>>
  player?: SavedPlayerState
  survival?: SavedSurvivalState
  exploration?: SavedExplorationState
}

export type SaveSystemOptions = {
  key?: string
  storage?: Storage
}

export const DEFAULT_SAVE_KEY = 'astra-voxel-ark-save-v1'

export class SaveSystem {
  private readonly key: string
  private readonly storage: Storage

  constructor({ key = DEFAULT_SAVE_KEY, storage = window.localStorage }: SaveSystemOptions = {}) {
    this.key = key
    this.storage = storage
  }

  hasSave() {
    return this.storage.getItem(this.key) !== null
  }

  load(): SavedWorldState | null {
    const raw = this.storage.getItem(this.key)
    if (!raw) return null
    return parseSavedWorld(raw)
  }

  save(state: SavedWorldState) {
    this.storage.setItem(this.key, JSON.stringify(normalizeSavedWorld(state)))
  }

  exportText(state: SavedWorldState) {
    return JSON.stringify(normalizeSavedWorld(state), null, 2)
  }

  importText(text: string) {
    return parseSavedWorld(text)
  }

  clear() {
    this.storage.removeItem(this.key)
  }
}

export function normalizeSavedWorld(state: SavedWorldState): SavedWorldState {
  return {
    version: Number.isFinite(state.version) ? state.version : 1,
    savedAt: state.savedAt || new Date().toISOString(),
    blocks: state.blocks.filter(isSavedBlock),
    terrainChunks: filterStrings(state.terrainChunks),
    removedBlocks: filterStrings(state.removedBlocks),
    playerPlacedBlocks: filterStrings(state.playerPlacedBlocks),
    inventory: normalizeInventory(state.inventory),
    player: state.player,
    survival: state.survival,
    exploration: normalizeExploration(state.exploration),
  }
}

export function parseSavedWorld(text: string): SavedWorldState | null {
  try {
    const parsed = JSON.parse(text) as Partial<SavedWorldState>
    if (!parsed || typeof parsed !== 'object') return null
    return normalizeSavedWorld({
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
      terrainChunks: Array.isArray(parsed.terrainChunks) ? parsed.terrainChunks : [],
      removedBlocks: Array.isArray(parsed.removedBlocks) ? parsed.removedBlocks : [],
      playerPlacedBlocks: Array.isArray(parsed.playerPlacedBlocks) ? parsed.playerPlacedBlocks : [],
      inventory: parsed.inventory && typeof parsed.inventory === 'object' ? parsed.inventory : {},
      player: parsed.player,
      survival: parsed.survival,
      exploration: parsed.exploration,
    })
  } catch {
    return null
  }
}

export function isBlockId(value: unknown): value is BlockId {
  return typeof value === 'string' && BLOCK_ID_SET.has(value as BlockId)
}

function isSavedBlock(value: unknown): value is SavedBlock {
  if (!value || typeof value !== 'object') return false
  const block = value as Partial<SavedBlock>
  return Number.isInteger(block.x) && Number.isInteger(block.y) && Number.isInteger(block.z) && isBlockId(block.id)
}

function filterStrings(values: unknown): string[] {
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []
}

function normalizeInventory(inventory: Partial<Record<BlockId, number>> = {}) {
  const normalized: Partial<Record<BlockId, number>> = {}
  for (const [id, count] of Object.entries(inventory) as [BlockId, number][]) {
    if (isBlockId(id) && Number.isFinite(count) && count > 0) {
      normalized[id] = Math.floor(count)
    }
  }
  return normalized
}

function normalizeExploration(exploration: SavedExplorationState | undefined): SavedExplorationState | undefined {
  if (!exploration) return undefined
  return {
    collectedShardIds: filterStrings(exploration.collectedShardIds),
    discoveredLandmarkIds: filterStrings(exploration.discoveredLandmarkIds),
    arkCoreRepaired: Boolean(exploration.arkCoreRepaired),
  }
}
