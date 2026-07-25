import type { BlockId } from '../blocks'

export type InventorySnapshot = Partial<Record<BlockId, number>>

/**
 * Deterministic inventory state with no renderer or storage dependencies.
 * The browser shell can persist snapshots while future session hosts can
 * validate the same add/remove operations at their own authority boundary.
 */
export class InventorySystem {
  private readonly counts = new Map<BlockId, number>()

  constructor(
    private readonly blockIds: readonly BlockId[],
    private readonly starter: InventorySnapshot = {},
  ) {
    this.reset()
  }

  count(id: BlockId) {
    return this.counts.get(id) ?? 0
  }

  add(id: BlockId, amount = 1) {
    const normalized = sanitizeAmount(amount)
    if (normalized <= 0) return this.count(id)
    const next = this.count(id) + normalized
    this.counts.set(id, next)
    return next
  }

  remove(id: BlockId, amount = 1) {
    const normalized = sanitizeAmount(amount)
    if (normalized <= 0) return true
    const current = this.count(id)
    if (current < normalized) return false
    this.counts.set(id, current - normalized)
    return true
  }

  reset() {
    this.counts.clear()
    this.blockIds.forEach((id) => this.counts.set(id, sanitizeAmount(this.starter[id])))
  }

  restore(snapshot: InventorySnapshot | undefined) {
    this.reset()
    if (!snapshot || typeof snapshot !== 'object') return
    this.blockIds.forEach((id) => {
      const value = snapshot[id]
      if (typeof value === 'number' && Number.isFinite(value)) this.counts.set(id, sanitizeAmount(value))
    })
  }

  snapshot(): InventorySnapshot {
    return Object.fromEntries(this.blockIds.map((id) => [id, this.count(id)])) as InventorySnapshot
  }
}

function sanitizeAmount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}
