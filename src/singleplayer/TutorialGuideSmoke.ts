import { TutorialGuide } from './TutorialGuide'

export function assertTutorialGuideSmoke() {
  const guide = new TutorialGuide()
  if (guide.current().id !== 'move' || guide.prompt(false) !== 'Use WASD to move') {
    throw new Error('Tutorial guide smoke failed: desktop onboarding should begin with movement')
  }
  if (!guide.prompt(true).includes('joystick')) {
    throw new Error('Tutorial guide smoke failed: touch onboarding should use touch language')
  }
  if (!guide.complete('move') || guide.complete('move') || guide.current().id !== 'mine') {
    throw new Error('Tutorial guide smoke failed: steps should advance once in order')
  }

  guide.restore({ completed: ['move', 'mine', 'invalid' as never, 'move'] })
  if (guide.current().id !== 'place') {
    throw new Error('Tutorial guide smoke failed: snapshots should filter invalid and duplicate steps')
  }
  const snapshot = guide.snapshot()
  if (snapshot.completed.join(',') !== 'move,mine') {
    throw new Error('Tutorial guide smoke failed: snapshots should remain compact and ordered')
  }

  guide.reset()
  guide.syncProgression({ mined: 4, placed: 2, crafted: 1, exploredChunks: 9, shards: 1 })
  if (guide.current().id !== 'move') {
    throw new Error('Tutorial guide smoke failed: movement should require real session input')
  }
  guide.complete('move')
  if (!guide.isComplete() || guide.current().id !== 'complete') {
    throw new Error('Tutorial guide smoke failed: existing progression should skip completed training')
  }
  const progress = guide.getProgress()
  if (progress.current !== 6 || progress.total !== 6) {
    throw new Error('Tutorial guide smoke failed: completion progress should be 6/6')
  }

  guide.restore({ completed: ['shard'] })
  if (guide.current().id !== 'move' || !guide.isComplete('shard')) {
    throw new Error('Tutorial guide smoke failed: out-of-order valid progress should be retained safely')
  }

  return true
}
