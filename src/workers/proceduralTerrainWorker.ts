import { buildProceduralChunkPlan, type ProceduralChunkPlan } from '../world/ProceduralTerrain'

export type ProceduralTerrainRequest = {
  id: number
  type: 'build-procedural-chunk'
  cx: number
  cz: number
  chunkSize: number
  worldSeed: number
}

export type ProceduralTerrainResponse = {
  id: number
  type: 'procedural-chunk-built'
  plan: ProceduralChunkPlan
}

self.onmessage = (event: MessageEvent<ProceduralTerrainRequest>) => {
  const request = event.data
  if (request.type !== 'build-procedural-chunk') return
  const response: ProceduralTerrainResponse = {
    id: request.id,
    type: 'procedural-chunk-built',
    plan: buildProceduralChunkPlan(request.cx, request.cz, request.chunkSize, request.worldSeed),
  }
  self.postMessage(response)
}
