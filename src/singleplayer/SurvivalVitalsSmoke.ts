import { getFallDamage, SurvivalVitals } from './SurvivalVitals'

export function assertSurvivalVitalsSmoke() {
  if (getFallDamage(11) !== 0 || getFallDamage(Number.NaN) !== 0 || getFallDamage(15) <= 0) {
    throw new Error('Survival vitals smoke failed: fall damage should have a safe landing threshold')
  }

  const vitals = new SurvivalVitals()
  const impact = vitals.applyDamage(25)
  if (impact.health !== 75 || impact.damageTaken !== 25 || impact.died) {
    throw new Error('Survival vitals smoke failed: direct damage should update health exactly')
  }
  const fatal = vitals.applyDamage(200)
  if (!fatal.died || fatal.health !== 0 || vitals.getDeaths() !== 1) {
    throw new Error('Survival vitals smoke failed: fatal damage should record one death')
  }
  if (vitals.applyDamage(5).died || vitals.getDeaths() !== 1) {
    throw new Error('Survival vitals smoke failed: zero health should not count repeated deaths')
  }
  vitals.respawn()
  if (vitals.getHealth() !== vitals.maxHealth || vitals.getDeaths() !== 1) {
    throw new Error('Survival vitals smoke failed: respawn should restore health and preserve deaths')
  }

  return true
}
