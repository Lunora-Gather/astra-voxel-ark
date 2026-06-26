import * as THREE from 'three'

export type BudgetedPointLight = {
  key: string
  light: THREE.PointLight
  priority?: number
}

export type LightBudgetResult = {
  active: BudgetedPointLight[]
  inactive: BudgetedPointLight[]
}

export function applyPointLightBudget(
  cameraPosition: THREE.Vector3,
  lights: Iterable<BudgetedPointLight>,
  maxActiveLights: number,
): LightBudgetResult {
  const sorted = [...lights].sort((a, b) => {
    const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0)
    if (priorityDelta !== 0) return priorityDelta
    return cameraPosition.distanceToSquared(a.light.position) - cameraPosition.distanceToSquared(b.light.position)
  })

  const active = maxActiveLights <= 0 ? [] : sorted.slice(0, maxActiveLights)
  const inactive = maxActiveLights <= 0 ? sorted : sorted.slice(maxActiveLights)

  for (const entry of active) {
    entry.light.visible = true
  }

  for (const entry of inactive) {
    entry.light.visible = false
  }

  return { active, inactive }
}

export function disposePointLights(scene: THREE.Scene, lights: Iterable<BudgetedPointLight>) {
  for (const entry of lights) {
    scene.remove(entry.light)
  }
}
