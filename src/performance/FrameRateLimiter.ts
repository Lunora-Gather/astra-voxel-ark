export type SupportedFrameRate = 30 | 60

/** Timestamp gate for requestAnimationFrame loops without using blocking timers. */
export class FrameRateLimiter {
  private targetFps: SupportedFrameRate
  private lastAcceptedAt = -Infinity

  constructor(targetFps: SupportedFrameRate) {
    this.targetFps = targetFps
  }

  setTargetFps(targetFps: SupportedFrameRate) {
    this.targetFps = targetFps
    this.reset()
  }

  getTargetFps() {
    return this.targetFps
  }

  getMinimumInterval() {
    return 1000 / this.targetFps
  }

  shouldRun(timestamp: number) {
    if (!Number.isFinite(timestamp)) return false
    if (timestamp - this.lastAcceptedAt < this.getMinimumInterval() * 0.9) return false
    this.lastAcceptedAt = timestamp
    return true
  }

  reset() {
    this.lastAcceptedAt = -Infinity
  }
}
