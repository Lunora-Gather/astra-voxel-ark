export type PageLifecycleSaveCoordinatorOptions = {
  hasStarted: () => boolean
  save: () => boolean
  teardown: () => void
}

/**
 * Coordinates mobile/background lifecycle events without binding save logic to
 * the DOM. A hidden page is saved at most once until it becomes visible again,
 * and a following pagehide event reuses that result instead of writing twice.
 */
export class PageLifecycleSaveCoordinator {
  private savedWhileHidden = false
  private tornDown = false

  constructor(private readonly options: PageLifecycleSaveCoordinatorOptions) {}

  visibilityChanged(hidden: boolean) {
    if (!hidden) {
      this.savedWhileHidden = false
      return false
    }
    return this.saveOnce()
  }

  pageHidden(persisted = false) {
    const saved = this.saveOnce()
    if (!persisted && !this.tornDown) {
      this.tornDown = true
      this.options.teardown()
    }
    return saved
  }

  private saveOnce() {
    if (this.savedWhileHidden || !this.options.hasStarted()) return false
    const saved = this.options.save()
    if (saved) this.savedWhileHidden = true
    return saved
  }
}
