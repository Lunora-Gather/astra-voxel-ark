export type SurvivalVitalsSnapshot = {
  health: number
  deaths: number
}

export type SurvivalUpdate = {
  health: number
  damageTaken: number
  recovered: number
  died: boolean
}

export class SurvivalVitals {
  readonly maxHealth = 100
  private health = this.maxHealth
  private deaths = 0

  getHealth() {
    return this.health
  }

  getDeaths() {
    return this.deaths
  }

  update(deltaSeconds: number, coldExposure: number, canRecover: boolean): SurvivalUpdate {
    const before = this.health
    const damage = Math.max(0, coldExposure) * 5 * Math.max(0, deltaSeconds)
    const recovery = canRecover && damage === 0 ? 1.25 * Math.max(0, deltaSeconds) : 0
    this.health = clamp(this.health - damage + recovery, 0, this.maxHealth)
    const died = this.health <= 0
    if (died) this.deaths += 1
    return {
      health: this.health,
      damageTaken: Math.max(0, before - this.health),
      recovered: Math.max(0, this.health - before),
      died,
    }
  }

  respawn() {
    this.health = this.maxHealth
  }

  snapshot(): SurvivalVitalsSnapshot {
    return { health: this.health, deaths: this.deaths }
  }

  restore(value: Partial<SurvivalVitalsSnapshot> | undefined) {
    this.health = finiteClamp(value?.health, 1, this.maxHealth, this.maxHealth)
    this.deaths = Math.floor(finiteClamp(value?.deaths, 0, Number.MAX_SAFE_INTEGER, 0))
  }

  reset() {
    this.health = this.maxHealth
    this.deaths = 0
  }
}

function finiteClamp(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
