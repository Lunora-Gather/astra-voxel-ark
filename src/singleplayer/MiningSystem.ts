import type { BlockId } from '../blocks'
import type { PackedBlockKey } from '../world/blockKey'
import type { ToolTier } from './ProgressionSystem'

export type MiningTarget = {
  key: PackedBlockKey
  id: BlockId
  durationMs: number
}

export type MiningUpdate = {
  status: 'idle' | 'active' | 'cancelled' | 'complete'
  progress: number
  key: PackedBlockKey | null
  id: BlockId | null
}

const BLOCK_MINING_DURATION_MS: Record<BlockId, number> = {
  leaves: 160,
  water: 180,
  grass: 220,
  sand: 250,
  dirt: 280,
  gravel: 320,
  clay: 360,
  wood: 480,
  spruce: 500,
  birch: 500,
  stone: 640,
  moss: 680,
  crystal: 720,
  copper: 760,
  glow: 780,
  gold: 820,
  brick: 860,
  obsidian: 1_400,
}

const TOOL_DURATION_SCALE: Record<ToolTier, number> = {
  0: 1,
  1: 0.78,
  2: 0.58,
  3: 0.4,
}

export function getBlockMiningDuration(id: BlockId, toolTier: ToolTier) {
  return Math.max(80, Math.round(BLOCK_MINING_DURATION_MS[id] * TOOL_DURATION_SCALE[toolTier]))
}

export class MiningSession {
  private target: MiningTarget | null = null
  private startedAt = 0
  private readonly result: MiningUpdate = {
    status: 'idle',
    progress: 0,
    key: null,
    id: null,
  }

  begin(target: MiningTarget, nowMs: number) {
    if (!Number.isSafeInteger(target.key) || target.key < 0 || !Number.isFinite(target.durationMs) || target.durationMs <= 0) return false
    this.target = { ...target, durationMs: Math.max(1, target.durationMs) }
    this.startedAt = finiteTime(nowMs)
    this.writeResult('active', 0, this.target)
    return true
  }

  update(nowMs: number, currentTargetKey: PackedBlockKey | null) {
    if (!this.target) return this.writeResult('idle', 0, null)
    if (currentTargetKey !== this.target.key) {
      const cancelledTarget = this.target
      this.target = null
      return this.writeResult('cancelled', 0, cancelledTarget)
    }

    const progress = Math.max(0, Math.min(1, (finiteTime(nowMs) - this.startedAt) / this.target.durationMs))
    if (progress < 1) return this.writeResult('active', progress, this.target)

    const completedTarget = this.target
    this.target = null
    return this.writeResult('complete', 1, completedTarget)
  }

  cancel() {
    const cancelledTarget = this.target
    this.target = null
    return this.writeResult(cancelledTarget ? 'cancelled' : 'idle', 0, cancelledTarget)
  }

  get active() {
    return this.target !== null
  }

  get targetKey() {
    return this.target?.key ?? null
  }

  private writeResult(status: MiningUpdate['status'], progress: number, target: MiningTarget | null) {
    this.result.status = status
    this.result.progress = progress
    this.result.key = target?.key ?? null
    this.result.id = target?.id ?? null
    return this.result
  }
}

function finiteTime(value: number) {
  return Number.isFinite(value) ? value : 0
}
