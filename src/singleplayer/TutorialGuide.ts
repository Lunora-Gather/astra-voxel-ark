import type { ProgressionStats } from './ProgressionSystem'

export type TutorialStepId = 'move' | 'mine' | 'place' | 'backpack' | 'craft' | 'shard'
export type TutorialSnapshot = { completed: TutorialStepId[] }
export type TutorialStep = {
  id: TutorialStepId | 'complete'
  title: string
  desktopPrompt: string
  touchPrompt: string
}

const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'move', title: 'First Steps', desktopPrompt: 'Use WASD to move', touchPrompt: 'Use the left joystick to move' },
  { id: 'mine', title: 'Gather', desktopPrompt: 'Hold left mouse to mine a surface block', touchPrompt: 'Hold Break on any surface block' },
  { id: 'place', title: 'Build', desktopPrompt: 'Select a block and place it', touchPrompt: 'Select a block, then tap Place' },
  { id: 'backpack', title: 'Backpack', desktopPrompt: 'Press E to open your backpack', touchPrompt: 'Open Menu → Expedition' },
  { id: 'craft', title: 'Craft', desktopPrompt: 'Craft your first tool or material', touchPrompt: 'Craft your first tool or material' },
  { id: 'shard', title: 'Explore', desktopPrompt: 'Follow the compass to a landmark shard', touchPrompt: 'Follow the compass to a landmark shard' },
]

const COMPLETE_STEP: TutorialStep = {
  id: 'complete',
  title: 'Field Ready',
  desktopPrompt: 'Training complete · Restore the Ark Core',
  touchPrompt: 'Training complete · Restore the Ark Core',
}

const VALID_STEP_IDS = new Set<TutorialStepId>(TUTORIAL_STEPS.map(({ id }) => id as TutorialStepId))

export class TutorialGuide {
  private readonly completed = new Set<TutorialStepId>()

  current(): TutorialStep {
    return TUTORIAL_STEPS.find(({ id }) => !this.completed.has(id as TutorialStepId)) ?? COMPLETE_STEP
  }

  prompt(touch: boolean) {
    const step = this.current()
    return touch ? step.touchPrompt : step.desktopPrompt
  }

  complete(id: TutorialStepId) {
    if (!VALID_STEP_IDS.has(id) || this.completed.has(id)) return false
    this.completed.add(id)
    return true
  }

  isComplete(id?: TutorialStepId) {
    return id ? this.completed.has(id) : this.completed.size === TUTORIAL_STEPS.length
  }

  getProgress() {
    const step = this.current()
    const index = TUTORIAL_STEPS.findIndex(({ id }) => id === step.id)
    return {
      current: index < 0 ? TUTORIAL_STEPS.length : index + 1,
      total: TUTORIAL_STEPS.length,
    }
  }

  syncProgression(stats: Partial<ProgressionStats> | undefined) {
    if ((stats?.mined ?? 0) > 0) this.completed.add('mine')
    if ((stats?.placed ?? 0) > 0) this.completed.add('place')
    if ((stats?.crafted ?? 0) > 0) {
      this.completed.add('backpack')
      this.completed.add('craft')
    }
    if ((stats?.shards ?? 0) > 0) this.completed.add('shard')
  }

  snapshot(): TutorialSnapshot {
    return { completed: TUTORIAL_STEPS.map(({ id }) => id as TutorialStepId).filter((id) => this.completed.has(id)) }
  }

  restore(value: Partial<TutorialSnapshot> | undefined) {
    this.completed.clear()
    if (!Array.isArray(value?.completed)) return
    value.completed.slice(0, TUTORIAL_STEPS.length).forEach((id) => {
      if (typeof id === 'string' && VALID_STEP_IDS.has(id as TutorialStepId)) {
        this.completed.add(id as TutorialStepId)
      }
    })
  }

  reset() {
    this.completed.clear()
  }
}
