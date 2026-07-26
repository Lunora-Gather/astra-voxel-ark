import { getDaylight, planArkRest } from './ArkRestSystem'

export function assertArkRestSystemSmoke() {
  const nightTime = 85
  const ready = planArkRest(nightTime, 4)
  if (!ready.available || ready.reason !== 'ready' || ready.nextWorldTime <= nightTime || getDaylight(ready.nextWorldTime) <= 0.5) {
    throw new Error('Ark rest smoke failed: nearby night rest should advance to rising daylight')
  }
  const far = planArkRest(nightTime, 13)
  if (far.available || far.reason !== 'far') {
    throw new Error('Ark rest smoke failed: distant players should return to the Ark')
  }
  const day = planArkRest(0, 0)
  if (day.available || day.reason !== 'daylight') {
    throw new Error('Ark rest smoke failed: daylight should not be skippable')
  }
  const malformed = planArkRest(Number.NaN, Number.NaN)
  if (malformed.available || !Number.isFinite(malformed.nextWorldTime)) {
    throw new Error('Ark rest smoke failed: malformed inputs should remain safe')
  }
  return true
}
