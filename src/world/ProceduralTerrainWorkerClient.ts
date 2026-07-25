import type { ProceduralTerrainRequest, ProceduralTerrainResponse } from '../workers/proceduralTerrainWorker'
import type { ProceduralChunkPlan } from './ProceduralTerrain'

export class ProceduralTerrainWorkerClient {
  private readonly worker: Worker
  private nextId = 1
  private readonly pending = new Map<number, { resolve: (plan: ProceduralChunkPlan) => void; reject: (error: Error) => void }>()

  constructor() {
    this.worker = new Worker(new URL('../workers/proceduralTerrainWorker.ts', import.meta.url), { type: 'module' })
    this.worker.addEventListener('message', (event: MessageEvent<ProceduralTerrainResponse>) => {
      const message = event.data
      if (message.type !== 'procedural-chunk-built') return
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      pending.resolve(message.plan)
    })
    this.worker.addEventListener('error', () => {
      const error = new Error('Terrain worker failed')
      this.pending.forEach(({ reject }) => reject(error))
      this.pending.clear()
    })
  }

  build(cx: number, cz: number, chunkSize: number, worldSeed = 0) {
    const id = this.nextId++
    const request: ProceduralTerrainRequest = { id, type: 'build-procedural-chunk', cx, cz, chunkSize, worldSeed }
    return new Promise<ProceduralChunkPlan>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage(request)
    })
  }

  dispose() {
    this.pending.forEach(({ reject }) => reject(new Error('Terrain worker disposed')))
    this.pending.clear()
    this.worker.terminate()
  }
}
