import type { TerrainChunk, TerrainGeneratorOptions } from './TerrainGenerator'
import type { TerrainWorkerRequest, TerrainWorkerResponse } from '../workers/terrainWorker'

export class TerrainWorkerClient {
  private readonly worker: Worker
  private nextId = 1
  private readonly pending = new Map<number, (chunk: TerrainChunk) => void>()

  constructor() {
    this.worker = new Worker(new URL('../workers/terrainWorker.ts', import.meta.url), { type: 'module' })
    this.worker.addEventListener('message', (event: MessageEvent<TerrainWorkerResponse>) => {
      const message = event.data
      if (message.type !== 'terrain-chunk-generated') return
      const resolve = this.pending.get(message.id)
      if (!resolve) return
      this.pending.delete(message.id)
      resolve(message.chunk)
    })
  }

  generateChunk(cx: number, cz: number, options: TerrainGeneratorOptions) {
    const id = this.nextId++
    const request: TerrainWorkerRequest = {
      id,
      type: 'generate-terrain-chunk',
      cx,
      cz,
      options,
    }

    return new Promise<TerrainChunk>((resolve) => {
      this.pending.set(id, resolve)
      this.worker.postMessage(request)
    })
  }

  dispose() {
    this.pending.clear()
    this.worker.terminate()
  }
}
