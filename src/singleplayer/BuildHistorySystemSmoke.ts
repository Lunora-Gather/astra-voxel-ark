import { BuildHistorySystem, type BuildChange } from './BuildHistorySystem'

export function assertBuildHistorySystemSmoke() {
  const history = new BuildHistorySystem(2)
  const waterChange: BuildChange[] = [{ x: 1.2, y: 3, z: -2, placed: 'stone', previous: 'water' }]
  if (!history.record(waterChange) || !history.canUndo || history.size !== 1) {
    throw new Error('Build history smoke failed: valid actions should become undoable')
  }
  waterChange[0].x = 99
  const restoredWater = history.undo()
  if (restoredWater?.changes[0].x !== 1 || restoredWater.changes[0].previous !== 'water' || history.canUndo) {
    throw new Error('Build history smoke failed: history should snapshot coordinates and previous water')
  }

  history.record([{ x: 1, y: 2, z: 3, placed: 'wood', previous: null }])
  history.record([{ x: 2, y: 2, z: 3, placed: 'wood', previous: null }])
  history.record([{ x: 3, y: 2, z: 3, placed: 'wood', previous: null }])
  if (Number(history.size) !== 2 || history.undo()?.changes[0].x !== 3 || history.undo()?.changes[0].x !== 2) {
    throw new Error('Build history smoke failed: bounded history should discard the oldest action')
  }
  if (history.record([]) || history.record(Array.from({ length: 10 }, (_, x) => ({ x, y: 1, z: 1, placed: 'stone' as const, previous: null })))) {
    throw new Error('Build history smoke failed: empty or oversized actions should be rejected')
  }
  history.record([{ x: 4, y: 2, z: 3, placed: 'stone', previous: null }])
  history.clear()
  if (history.canUndo || Number(history.size) !== 0) {
    throw new Error('Build history smoke failed: world changes should clear transient history')
  }

  return true
}
