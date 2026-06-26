import { generateTerrainChunk, type TerrainChunk, type TerrainGeneratorOptions } from '../world/TerrainGenerator'

export type TerrainWorkerRequest = {
  id: number
  type: 'generate-terrain-chunk'
  cx: number
  cz: number
  options: TerrainGeneratorOptions
}

export type TerrainWorkerResponse = {
  id: number
  type: 'terrain-chunk-generated'
  chunk: TerrainChunk
}

type TerrainWorkerScope = {
  onmessage: ((event: MessageEvent<TerrainWorkerRequest>) => void) | null
  postMessage: (message: TerrainWorkerResponse) => void
}

const workerScope = self as unknown as TerrainWorkerScope

workerScope.onmessage = (event: MessageEvent<TerrainWorkerRequest>) => {
  const message = event.data

  if (message.type === 'generate-terrain-chunk') {
    const chunk = generateTerrainChunk(message.cx, message.cz, message.options)
    const response: TerrainWorkerResponse = {
      id: message.id,
      type: 'terrain-chunk-generated',
      chunk,
    }
    workerScope.postMessage(response)
  }
}
