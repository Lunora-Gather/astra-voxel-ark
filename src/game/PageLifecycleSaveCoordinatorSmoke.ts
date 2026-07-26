import { PageLifecycleSaveCoordinator } from './PageLifecycleSaveCoordinator'

export function assertPageLifecycleSaveCoordinatorSmoke() {
  let started = false
  let saves = 0
  let teardowns = 0
  const coordinator = new PageLifecycleSaveCoordinator({
    hasStarted: () => started,
    save: () => {
      saves += 1
      return true
    },
    teardown: () => {
      teardowns += 1
    },
  })

  coordinator.visibilityChanged(true)
  if (Number(saves) !== 0) throw new Error('Page lifecycle save smoke failed: unopened worlds must not be saved')

  started = true
  coordinator.visibilityChanged(false)
  coordinator.visibilityChanged(true)
  coordinator.visibilityChanged(true)
  if (Number(saves) !== 1) throw new Error('Page lifecycle save smoke failed: one background cycle should write once')

  coordinator.pageHidden(true)
  if (Number(saves) !== 1 || Number(teardowns) !== 0) {
    throw new Error('Page lifecycle save smoke failed: back-forward cache should preserve live resources')
  }
  coordinator.visibilityChanged(false)
  coordinator.pageHidden()
  coordinator.pageHidden()
  if (Number(saves) !== 2 || Number(teardowns) !== 1) {
    throw new Error('Page lifecycle save smoke failed: terminal pagehide should save a new cycle and teardown once')
  }

  let retries = 0
  const retrying = new PageLifecycleSaveCoordinator({
    hasStarted: () => true,
    save: () => {
      retries += 1
      return retries > 1
    },
    teardown: () => {},
  })
  retrying.visibilityChanged(true)
  retrying.pageHidden()
  if (Number(retries) !== 2) throw new Error('Page lifecycle save smoke failed: pagehide should retry a failed background write')
}
