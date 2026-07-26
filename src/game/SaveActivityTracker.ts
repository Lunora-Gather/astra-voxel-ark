export type SaveActivityState = 'unsaved' | 'saving' | 'saved' | 'error'

export class SaveActivityTracker {
  private currentState: SaveActivityState = 'unsaved'
  private savedAt = 0

  get state() {
    return this.currentState
  }

  begin() {
    this.currentState = 'saving'
  }

  complete(savedAt = Date.now()) {
    this.savedAt = finiteTimestamp(savedAt)
    this.currentState = 'saved'
  }

  fail() {
    this.currentState = 'error'
  }

  hydrate(savedAt: unknown) {
    const timestamp = finiteTimestamp(savedAt)
    if (timestamp <= 0) {
      this.reset()
      return
    }
    this.savedAt = timestamp
    this.currentState = 'saved'
  }

  reset() {
    this.savedAt = 0
    this.currentState = 'unsaved'
  }

  label(now = Date.now()) {
    if (this.currentState === 'unsaved') return 'Not saved'
    if (this.currentState === 'saving') return 'Saving…'
    if (this.currentState === 'error') return 'Save failed'
    const elapsedSeconds = Math.max(0, Math.floor((finiteTimestamp(now) - this.savedAt) / 1000))
    if (elapsedSeconds < 60) return 'Saved now'
    const elapsedMinutes = Math.floor(elapsedSeconds / 60)
    if (elapsedMinutes < 60) return `Saved ${elapsedMinutes}m`
    const elapsedHours = Math.min(99, Math.floor(elapsedMinutes / 60))
    return `Saved ${elapsedHours}h`
  }
}

function finiteTimestamp(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}
