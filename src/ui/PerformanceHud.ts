export type PerformanceHudSnapshot = {
  fps: number
  averageFrameMs: number
  renderQuality: number
  targetFps: number
  blocks: number
  chunks: number
  residentTerrainChunks: number
  discoveredTerrainChunks: number
  queuedTerrainChunks: number
  dirtyChunks: number
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
}

function requiredElement(root: ParentNode, selector: string) {
  const element = root.querySelector<HTMLElement>(selector)
  if (!element) throw new Error(`Missing performance HUD element: ${selector}`)
  return element
}

export class PerformanceHud {
  private readonly fps: HTMLElement
  private readonly frameTime: HTMLElement
  private readonly mode: HTMLElement
  private readonly blocks: HTMLElement
  private readonly chunks: HTMLElement
  private readonly terrainChunks: HTMLElement
  private readonly dirty: HTMLElement
  private readonly calls: HTMLElement
  private readonly triangles: HTMLElement
  private readonly geometries: HTMLElement
  private readonly textures: HTMLElement

  constructor(root: ParentNode = document) {
    this.fps = requiredElement(root, '.perf-fps')
    this.frameTime = requiredElement(root, '.perf-ms')
    this.mode = requiredElement(root, '.perf-mode')
    this.blocks = requiredElement(root, '.perf-blocks')
    this.chunks = requiredElement(root, '.perf-chunks')
    this.terrainChunks = requiredElement(root, '.perf-terrain-chunks')
    this.dirty = requiredElement(root, '.perf-dirty')
    this.calls = requiredElement(root, '.perf-calls')
    this.triangles = requiredElement(root, '.perf-triangles')
    this.geometries = requiredElement(root, '.perf-geometries')
    this.textures = requiredElement(root, '.perf-textures')
  }

  setMode(label: string) {
    this.mode.textContent = label
  }

  update(snapshot: PerformanceHudSnapshot) {
    this.fps.textContent = String(snapshot.fps)
    this.frameTime.textContent = `${snapshot.averageFrameMs} · Q${Math.round(snapshot.renderQuality * 100)}%`
    this.fps.style.color = snapshot.fps >= snapshot.targetFps * 0.92
      ? '#a8ffb9'
      : snapshot.fps >= snapshot.targetFps * 0.65
        ? '#fff3a8'
        : '#ffd7fa'
    this.blocks.textContent = String(snapshot.blocks)
    this.chunks.textContent = String(snapshot.chunks)
    this.terrainChunks.textContent = `${snapshot.residentTerrainChunks}/${snapshot.discoveredTerrainChunks}`
    this.dirty.textContent = `${snapshot.queuedTerrainChunks}/${snapshot.dirtyChunks}`
    this.calls.textContent = formatPerformanceNumber(snapshot.drawCalls)
    this.triangles.textContent = formatPerformanceNumber(snapshot.triangles)
    this.geometries.textContent = formatPerformanceNumber(snapshot.geometries)
    this.textures.textContent = formatPerformanceNumber(snapshot.textures)
  }
}

export function formatPerformanceNumber(value: number) {
  const safeValue = Math.max(0, Math.round(Number.isFinite(value) ? value : 0))
  if (safeValue < 1000) return String(safeValue)
  if (safeValue < 1_000_000) return `${(safeValue / 1000).toFixed(safeValue < 10_000 ? 1 : 0)}k`
  return `${(safeValue / 1_000_000).toFixed(safeValue < 10_000_000 ? 1 : 0)}m`
}
