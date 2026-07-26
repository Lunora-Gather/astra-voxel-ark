import * as THREE from 'three'

export type BudgetedPointLight = {
  key: string | number
  light: THREE.PointLight
  priority?: number
}

export type LightBudgetResult = {
  active: BudgetedPointLight[]
  inactive: BudgetedPointLight[]
}

type RegisteredPointLight = {
  light: THREE.PointLight
  priority: number
  distanceSq: number
}

export class PointLightBudgetController<Key extends string | number = string | number> {
  private readonly entries = new Map<Key, RegisteredPointLight>()
  private readonly candidates: RegisteredPointLight[] = []

  register(key: Key, light: THREE.PointLight, priority = 0) {
    const existing = this.entries.get(key)
    if (existing) existing.light.visible = false
    this.entries.set(key, {
      light,
      priority: finitePriority(priority),
      distanceSq: Infinity,
    })
  }

  unregister(key: Key) {
    const entry = this.entries.get(key)
    if (!entry) return null
    entry.light.visible = false
    this.entries.delete(key)
    return entry.light
  }

  get(key: Key) {
    return this.entries.get(key)?.light
  }

  has(key: Key) {
    return this.entries.has(key)
  }

  apply(cameraPosition: Readonly<THREE.Vector3>, maxActiveLights: number, maxDistanceSq = Infinity) {
    const rangeSq = Number.isFinite(maxDistanceSq) ? Math.max(0, maxDistanceSq) : Infinity
    this.candidates.length = 0
    for (const entry of this.entries.values()) {
      const dx = entry.light.position.x - cameraPosition.x
      const dy = entry.light.position.y - cameraPosition.y
      const dz = entry.light.position.z - cameraPosition.z
      entry.distanceSq = dx * dx + dy * dy + dz * dz
      if (entry.distanceSq <= rangeSq) {
        this.candidates.push(entry)
      } else {
        entry.light.visible = false
      }
    }
    this.candidates.sort(compareRegisteredPointLights)

    const budget = Number.isFinite(maxActiveLights)
      ? Math.max(0, Math.min(this.candidates.length, Math.floor(maxActiveLights)))
      : 0
    for (let index = 0; index < this.candidates.length; index += 1) {
      this.candidates[index].light.visible = index < budget
    }
    return budget
  }

  clear() {
    for (const entry of this.entries.values()) entry.light.visible = false
    this.entries.clear()
    this.candidates.length = 0
  }

  get size() {
    return this.entries.size
  }
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

function compareRegisteredPointLights(a: RegisteredPointLight, b: RegisteredPointLight) {
  return b.priority - a.priority || a.distanceSq - b.distanceSq
}

function finitePriority(value: number) {
  return Number.isFinite(value) ? value : 0
}
