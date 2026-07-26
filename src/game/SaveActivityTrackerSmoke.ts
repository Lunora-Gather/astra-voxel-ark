import { SaveActivityTracker, type SaveActivityState } from './SaveActivityTracker'

export function assertSaveActivityTrackerSmoke() {
  const tracker = new SaveActivityTracker()
  if (readState(tracker) !== 'unsaved' || tracker.label(1_000_000) !== 'Not saved') {
    throw new Error('Save activity smoke failed: new worlds should start unsaved')
  }

  tracker.begin()
  if (readState(tracker) !== 'saving' || tracker.label(1_000_000) !== 'Saving…') {
    throw new Error('Save activity smoke failed: pending saves should be visible')
  }

  tracker.complete(1_000_000)
  if (readState(tracker) !== 'saved' || tracker.label(1_030_000) !== 'Saved now') {
    throw new Error('Save activity smoke failed: recent save label is incorrect')
  }
  if (tracker.label(1_120_000) !== 'Saved 2m' || tracker.label(12_000_000) !== 'Saved 3h') {
    throw new Error('Save activity smoke failed: relative save age is incorrect')
  }

  tracker.fail()
  if (readState(tracker) !== 'error' || tracker.label(12_000_000) !== 'Save failed') {
    throw new Error('Save activity smoke failed: failed saves need persistent feedback')
  }

  tracker.hydrate(Number.NaN)
  if (readState(tracker) !== 'unsaved') {
    throw new Error('Save activity smoke failed: invalid timestamps should recover safely')
  }

  tracker.hydrate(2_000_000)
  if (readState(tracker) !== 'saved' || tracker.label(1_000_000) !== 'Saved now') {
    throw new Error('Save activity smoke failed: future timestamps should clamp to a recent label')
  }

  tracker.reset()
  if (readState(tracker) !== 'unsaved' || tracker.label() !== 'Not saved') {
    throw new Error('Save activity smoke failed: reset should clear prior save activity')
  }

  return true
}

function readState(tracker: SaveActivityTracker): SaveActivityState {
  return tracker.state
}
