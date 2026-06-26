import { generateTerrainChunk, TerrainWorkerClient, type TerrainChunk, type TerrainGeneratorOptions } from '../world'
import type { OptimizationFeatureFlags } from './FeatureFlags'

export type TerrainPipelineOptions = {
  flags: OptimizationFeatureFlags
  terrainOptions: TerrainGeneratorOptions
}

export class TerrainPipeline {
  private readonly terrainOptions: TerrainGeneratorOptions
  private readonly workerClient: TerrainWorkerClient | null

  constructor({ flags, terrainOptions }: TerrainPipelineOptions) {
    this.terrainOptions = terrainOptions
    this.workerClient = flags.terrainWorker && typeof Worker !== 'undefined' ? new TerrainWorkerClient() : null
  }

  async generateChunk(cx: number, cz: number): Promise<TerrainChunk> {
    if (this.workerClient) {
      return this.workerClient.generateChunk(cx, cz, this.terrainOptions)
    }

    return generateTerrainChunk(cx, cz, this.terrainOptions)
  }

  dispose() {
    this.workerClient?.dispose()
  }

  get usesWorker() {
    return this.workerClient !== null
  }
}
