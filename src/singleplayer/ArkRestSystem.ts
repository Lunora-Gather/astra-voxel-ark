const DAY_PHASE_RATE = 0.055
const FULL_CYCLE = Math.PI * 2
const REST_DAYLIGHT_THRESHOLD = 0.42
const DAWN_PHASE_OFFSET = 0.06

export type ArkRestReason = 'ready' | 'daylight' | 'far'

export type ArkRestPlan = {
  available: boolean
  reason: ArkRestReason
  daylight: number
  nextWorldTime: number
}

export function getDaylight(worldTime: number) {
  const safeTime = finiteNonNegative(worldTime)
  return (Math.sin(safeTime * DAY_PHASE_RATE) + 1) / 2
}

export function planArkRest(worldTime: number, distanceToArk: number, restRadius = 12): ArkRestPlan {
  const safeTime = finiteNonNegative(worldTime)
  const daylight = getDaylight(safeTime)
  const nearArk = finiteNonNegative(distanceToArk) <= Math.max(1, finiteNonNegative(restRadius))
  const reason: ArkRestReason = !nearArk ? 'far' : daylight >= REST_DAYLIGHT_THRESHOLD ? 'daylight' : 'ready'
  const currentPhase = safeTime * DAY_PHASE_RATE
  const nextDawnPhase = (Math.floor(currentPhase / FULL_CYCLE) + 1) * FULL_CYCLE + DAWN_PHASE_OFFSET
  return {
    available: reason === 'ready',
    reason,
    daylight,
    nextWorldTime: nextDawnPhase / DAY_PHASE_RATE,
  }
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}
