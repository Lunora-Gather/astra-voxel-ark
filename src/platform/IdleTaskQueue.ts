type IdleDeadlineLike = { timeRemaining: () => number; didTimeout: boolean }
type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: (deadline: IdleDeadlineLike) => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

export class IdleTaskQueue {
  private handle: number | null = null

  schedule(task: () => void, timeout = 1200) {
    this.cancel()
    const idleWindow = window as WindowWithIdleCallback
    if (idleWindow.requestIdleCallback) {
      this.handle = idleWindow.requestIdleCallback(() => {
        this.handle = null
        task()
      }, { timeout })
      return
    }
    this.handle = window.setTimeout(() => {
      this.handle = null
      task()
    }, Math.min(timeout, 250))
  }

  cancel() {
    if (this.handle === null) return
    const idleWindow = window as WindowWithIdleCallback
    if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(this.handle)
    else window.clearTimeout(this.handle)
    this.handle = null
  }
}
