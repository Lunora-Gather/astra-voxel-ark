import type { BlockId } from '../blocks'

export type BuildChange = {
  x: number
  y: number
  z: number
  placed: BlockId
  previous: BlockId | null
}

export type BuildAction = {
  changes: readonly BuildChange[]
}

const DEFAULT_HISTORY_LIMIT = 32
const MAX_ACTION_CHANGES = 9

export class BuildHistorySystem {
  private readonly actions: BuildAction[] = []
  readonly limit: number

  constructor(limit = DEFAULT_HISTORY_LIMIT) {
    this.limit = Math.max(1, Math.min(128, Math.floor(Number.isFinite(limit) ? limit : DEFAULT_HISTORY_LIMIT)))
  }

  record(changes: readonly BuildChange[]) {
    if (changes.length === 0 || changes.length > MAX_ACTION_CHANGES) return false
    const snapshot = changes.map(({ x, y, z, placed, previous }) => ({
      x: Math.round(x),
      y: Math.round(y),
      z: Math.round(z),
      placed,
      previous,
    }))
    this.actions.push({ changes: snapshot })
    if (this.actions.length > this.limit) this.actions.shift()
    return true
  }

  undo() {
    return this.actions.pop() ?? null
  }

  clear() {
    this.actions.length = 0
  }

  get canUndo() {
    return this.actions.length > 0
  }

  get size() {
    return this.actions.length
  }
}
