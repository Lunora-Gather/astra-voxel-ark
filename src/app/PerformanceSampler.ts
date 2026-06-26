export type PerformanceSample = {
  fps: number
  frameMs: number
  averageFps: number
  averageFrameMs: number
  minFps: number
  maxFrameMs: number
  sampleCount: number
}

export class PerformanceSampler {
  private readonly frameSamples: number[] = []
  private lastTimestamp = 0

  constructor(private readonly maxSamples = 90) {}

  begin(timestamp = now()) {
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp
      return this.snapshot(0)
    }

    const frameMs = Math.max(0, timestamp - this.lastTimestamp)
    this.lastTimestamp = timestamp
    this.frameSamples.push(frameMs)

    if (this.frameSamples.length > this.maxSamples) {
      this.frameSamples.shift()
    }

    return this.snapshot(frameMs)
  }

  reset(timestamp = now()) {
    this.frameSamples.length = 0
    this.lastTimestamp = timestamp
  }

  private snapshot(frameMs: number): PerformanceSample {
    const samples = this.frameSamples.length > 0 ? this.frameSamples : [frameMs]
    const averageFrameMs = average(samples)
    const maxFrameMs = Math.max(...samples)
    const fps = frameMs > 0 ? 1000 / frameMs : 0
    const averageFps = averageFrameMs > 0 ? 1000 / averageFrameMs : 0
    const minFps = maxFrameMs > 0 ? 1000 / maxFrameMs : 0

    return {
      fps,
      frameMs,
      averageFps,
      averageFrameMs,
      minFps,
      maxFrameMs,
      sampleCount: this.frameSamples.length,
    }
  }
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function now() {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}
