import { getBlockMiningDuration, MiningSession } from './MiningSystem'
import { InventorySystem } from './InventorySystem'
import { ProgressionSystem } from './ProgressionSystem'

export function assertMiningSystemSmoke() {
  const handStone = getBlockMiningDuration('stone', 0)
  const astralStone = getBlockMiningDuration('stone', 3)
  if (astralStone >= handStone || getBlockMiningDuration('obsidian', 0) <= handStone) {
    throw new Error('Mining system smoke failed: hardness and tool upgrades should affect duration')
  }

  const session = new MiningSession()
  if (!session.begin({ key: '1,2,3', id: 'stone', durationMs: 600 }, 1_000)) {
    throw new Error('Mining system smoke failed: valid targets should begin')
  }
  const first = session.update(1_300, '1,2,3')
  const reused = session.update(1_599, '1,2,3')
  if (first !== reused || reused.status !== 'active' || reused.progress < 0.99 || !session.active) {
    throw new Error('Mining system smoke failed: progress should be allocation-free and frame-time based')
  }
  const completed = session.update(1_600, '1,2,3')
  if (completed.status !== 'complete' || completed.key !== '1,2,3' || session.active) {
    throw new Error('Mining system smoke failed: matching targets should complete exactly once')
  }
  if (session.update(1_700, '1,2,3').status !== 'idle') {
    throw new Error('Mining system smoke failed: completed sessions should not repeat')
  }

  session.begin({ key: '4,5,6', id: 'wood', durationMs: 400 }, 2_000)
  const cancelled = session.update(2_100, 'different')
  if (cancelled.status !== 'cancelled' || session.active) {
    throw new Error('Mining system smoke failed: changing aim should cancel mining')
  }
  if (session.begin({ key: '', id: 'wood', durationMs: 0 }, Number.NaN)) {
    throw new Error('Mining system smoke failed: invalid targets should be rejected')
  }

  const inventory = new InventorySystem(['wood', 'stone', 'copper'], { wood: 4, stone: 8 })
  const progression = new ProgressionSystem()
  const beforeUpgrade = progression.getMiningDuration('stone')
  if (progression.canMine('copper') || !progression.craft('stone-kit', inventory)) {
    throw new Error('Mining system smoke failed: stone kit crafting should unlock copper')
  }
  if (!progression.canMine('copper') || progression.getMiningDuration('stone') >= beforeUpgrade) {
    throw new Error('Mining system smoke failed: crafted tool tiers should accelerate live mining rules')
  }

  return true
}
