import { BLOCKS, type BlockId } from '../blocks'
import type { PlayerStateSnapshot } from '../player'
import type { InventorySnapshot, ProgressionSnapshot, SurvivalVitalsSnapshot, TutorialSnapshot } from '../singleplayer'

const BLOCK_ID_SET = new Set<BlockId>(BLOCKS.map((block) => block.id))
const MAX_SAVE_TEXT_LENGTH = 16 * 1024 * 1024
const MAX_SAVE_ARRAY_LENGTH = 250_000

export type SavedBlock = [number, number, number, BlockId]

export type SavedWorldState = {
  version: number
  savedAt: number
  format?: 'snapshot' | 'delta'
  blocks: SavedBlock[]
  terrainChunks?: string[]
  removedBlocks?: string[]
  playerPlacedBlocks?: string[]
  inventory?: InventorySnapshot
  selectedBlock?: BlockId
  worldSeed?: number
  player?: Partial<PlayerStateSnapshot>
  worldTime?: number
  survival?: {
    crystalPower?: number
    carriedCrystal?: number
  }
  exploration?: {
    glowShards?: number
    collectedShardBlocks?: string[]
  }
  progression?: Partial<ProgressionSnapshot>
  vitals?: Partial<SurvivalVitalsSnapshot>
  tutorial?: Partial<TutorialSnapshot>
}

export type SaveSystemOptions = {
  key: string
  backupKey?: string
  storage?: Storage
}

export type SaveWriteResult = { ok: true } | { ok: false; error: unknown }

export class SaveSystem {
  readonly key: string
  readonly backupKey: string
  private readonly storage: Storage

  constructor({ key, backupKey = `${key}-backup-v1`, storage = window.localStorage }: SaveSystemOptions) {
    this.key = key
    this.backupKey = backupKey
    this.storage = storage
  }

  hasSave() {
    return this.storage.getItem(this.key) !== null
  }

  hasBackup() {
    return this.loadBackup() !== null
  }

  load() {
    return parseSavedWorld(this.storage.getItem(this.key))
  }

  loadBackup() {
    return parseSavedWorld(this.storage.getItem(this.backupKey))
  }

  save(state: SavedWorldState): SaveWriteResult {
    try {
      const encoded = stringifySavedWorld(state)
      const previous = this.storage.getItem(this.key)
      if (previous && parseSavedWorld(previous)) this.storage.setItem(this.backupKey, previous)
      this.storage.setItem(this.key, encoded)
      return { ok: true }
    } catch (error) {
      return { ok: false, error }
    }
  }

  recover() {
    const backup = this.loadBackup()
    if (!backup) return null
    try {
      this.storage.setItem(this.key, stringifySavedWorld(backup))
      return backup
    } catch {
      return null
    }
  }

  exportText(state: SavedWorldState) {
    return stringifySavedWorld(state, true)
  }

  importText(text: string) {
    return parseSavedWorld(text)
  }

  clear() {
    try {
      this.storage.removeItem(this.key)
      this.storage.removeItem(this.backupKey)
      return { ok: true } as const
    } catch (error) {
      return { ok: false, error } as const
    }
  }
}

export function stringifySavedWorld(state: SavedWorldState, pretty = false) {
  return JSON.stringify(state, null, pretty ? 2 : undefined)
}

export function parseSavedWorld(text: string | null): SavedWorldState | null {
  if (!text || text.length > MAX_SAVE_TEXT_LENGTH) return null
  try {
    const parsed = JSON.parse(text) as Partial<SavedWorldState>
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.blocks)) return null
    if (!arraysWithinLimit(parsed)) return null
    return {
      ...parsed,
      version: typeof parsed.version === 'number' && Number.isFinite(parsed.version) ? parsed.version : 1,
      savedAt: typeof parsed.savedAt === 'number' && Number.isFinite(parsed.savedAt) ? parsed.savedAt : 0,
      blocks: parsed.blocks,
    }
  } catch {
    return null
  }
}

export function isBlockId(value: unknown): value is BlockId {
  return typeof value === 'string' && BLOCK_ID_SET.has(value as BlockId)
}

export function isSavedBlock(value: unknown): value is SavedBlock {
  if (!Array.isArray(value) || value.length !== 4) return false
  const [x, y, z, id] = value
  return isCoordinate(x) && isCoordinate(y) && isCoordinate(z) && isBlockId(id)
}

export function isSavedBlockKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parts = value.split(',')
  return parts.length === 3 && parts.map(Number).every(isCoordinate)
}

export function isSavedTerrainChunkKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parts = value.split(',')
  return parts.length === 2 && parts.map(Number).every(isCoordinate)
}

function arraysWithinLimit(value: Partial<SavedWorldState>) {
  const arrays = [value.blocks, value.terrainChunks, value.removedBlocks, value.playerPlacedBlocks, value.exploration?.collectedShardBlocks, value.tutorial?.completed]
  return arrays.every((entry) => !Array.isArray(entry) || entry.length <= MAX_SAVE_ARRAY_LENGTH)
}

function isCoordinate(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= 1_000_000
}
