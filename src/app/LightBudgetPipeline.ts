import * as THREE from 'three'
import { applyPointLightBudget, type BudgetedPointLight, type LightBudgetResult } from '../render'
import type { OptimizationFeatureFlags } from './FeatureFlags'

export type LightBudgetPipelineOptions = {
  flags: OptimizationFeatureFlags
  camera: THREE.Camera
  maxActiveLights: number
}

export class LightBudgetPipeline {
  private readonly enabled: boolean
  private readonly camera: THREE.Camera
  private readonly maxActiveLights: number

  constructor({ flags, camera, maxActiveLights }: LightBudgetPipelineOptions) {
    this.enabled = flags.lightBudget
    this.camera = camera
    this.maxActiveLights = Math.max(0, maxActiveLights)
  }

  apply(lights: BudgetedPointLight[]): LightBudgetResult {
    if (!this.enabled) {
      for (const light of lights) {
        light.light.visible = true
      }
      return {
        active: lights,
        inactive: [],
      }
    }

    return applyPointLightBudget(this.camera.position, lights, this.maxActiveLights)
  }

  get isEnabled() {
    return this.enabled
  }
}
