import * as THREE from 'three'
import { PointLightBudgetController } from './lightBudget'

export function assertPointLightBudgetControllerSmoke() {
  const controller = new PointLightBudgetController<number>()
  const camera = new THREE.Vector3()
  const nearCrystal = createLight(2, 0, 0)
  const farCrystal = createLight(8, 0, 0)
  const priorityGlow = createLight(9, 0, 0)
  const outOfRange = createLight(20, 0, 0)
  controller.register(1, nearCrystal, 1)
  controller.register(2, farCrystal, 1)
  controller.register(3, priorityGlow, 2)
  controller.register(4, outOfRange, 3)

  if (controller.size !== 4 || controller.apply(camera, 2, 100) !== 2) {
    throw new Error('Point light budget smoke failed: registered lights should obey the active cap')
  }
  if (!priorityGlow.visible || !nearCrystal.visible || farCrystal.visible || outOfRange.visible) {
    throw new Error('Point light budget smoke failed: priority, distance and range ordering should be stable')
  }
  if (controller.apply(camera, 0, 100) !== 0 || [nearCrystal, farCrystal, priorityGlow].some((light) => light.visible)) {
    throw new Error('Point light budget smoke failed: a zero pressure budget should hide all candidates')
  }
  if (controller.unregister(2) !== farCrystal || controller.get(2) || Number(controller.size) !== 3) {
    throw new Error('Point light budget smoke failed: unregister should return and forget the owned light')
  }
  controller.clear()
  if (Number(controller.size) !== 0 || priorityGlow.visible) {
    throw new Error('Point light budget smoke failed: clear should release all persistent entries')
  }
  return true
}

function createLight(x: number, y: number, z: number) {
  const light = new THREE.PointLight(0xffffff, 1, 8)
  light.position.set(x, y, z)
  return light
}
