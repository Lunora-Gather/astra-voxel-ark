export type SurvivalHudSnapshot = {
  health: number
  charge: number
  threatText: string
  threatColor: string
  protectionLabel: string
  coldIntensity: number
  elapsedTime: number
}

function requiredElement(root: ParentNode, selector: string) {
  const element = root.querySelector<HTMLElement>(selector)
  if (!element) throw new Error(`Missing survival HUD element: ${selector}`)
  return element
}

export class SurvivalHud {
  private readonly crystalBar: HTMLElement
  private readonly crystalValue: HTMLElement
  private readonly threatValue: HTMLElement
  private readonly badge: HTMLElement
  private readonly coldVignette: HTMLElement
  private readonly healthBar: HTMLElement
  private readonly healthValue: HTMLElement
  private lastUpdateAt = -Infinity
  private lastCharge = -1
  private lastThreat = ''
  private lastProtectionLabel = ''
  private lastStyleBand = ''

  constructor(root: ParentNode = document) {
    this.crystalBar = requiredElement(root, '.charge-bar')
    this.crystalValue = requiredElement(root, '.crystal-val')
    this.threatValue = requiredElement(root, '.threat-val')
    this.badge = requiredElement(root, '.survival-badge')
    this.coldVignette = requiredElement(root, '.cold-vignette')
    this.healthBar = requiredElement(root, '.health-bar')
    this.healthValue = requiredElement(root, '.health-val')
  }

  setHealth(value: number) {
    const health = Math.max(0, Math.min(100, Math.round(value)))
    this.healthBar.style.width = `${health}%`
    this.healthValue.textContent = `${health}%`
  }

  update(snapshot: SurvivalHudSnapshot) {
    const charge = Math.max(0, Math.min(100, Math.floor(snapshot.charge)))
    this.setHealth(snapshot.health)
    this.coldVignette.style.opacity = String(snapshot.coldIntensity)

    if (
      snapshot.elapsedTime - this.lastUpdateAt < 0.25 &&
      charge === this.lastCharge &&
      snapshot.threatText === this.lastThreat &&
      snapshot.protectionLabel === this.lastProtectionLabel
    ) {
      return
    }
    this.lastUpdateAt = snapshot.elapsedTime

    if (snapshot.threatText !== this.lastThreat) {
      this.threatValue.textContent = snapshot.threatText
      this.lastThreat = snapshot.threatText
    }
    if (this.threatValue.style.color !== snapshot.threatColor) {
      this.threatValue.style.color = snapshot.threatColor
    }
    if (charge !== this.lastCharge) {
      this.crystalBar.style.width = `${charge}%`
      this.lastCharge = charge
    }

    const chargeLabel = `${charge}%${snapshot.protectionLabel}`
    if (snapshot.protectionLabel !== this.lastProtectionLabel || this.crystalValue.textContent !== chargeLabel) {
      this.crystalValue.textContent = chargeLabel
      this.lastProtectionLabel = snapshot.protectionLabel
    }
    this.applyChargeStyle(charge)
  }

  private applyChargeStyle(charge: number) {
    const styleBand = charge < 25 ? 'low' : charge < 60 ? 'mid' : 'high'
    if (styleBand === this.lastStyleBand) return
    this.lastStyleBand = styleBand

    if (styleBand === 'low') {
      this.crystalBar.style.background = 'linear-gradient(90deg, #5fcfff, #ff8c8c)'
      this.crystalValue.style.color = '#8fd8ff'
      this.badge.style.borderColor = 'rgba(95, 207, 255, 0.55)'
      this.badge.style.boxShadow = '0 20px 50px rgba(95, 207, 255, 0.16)'
      return
    }
    if (styleBand === 'mid') {
      this.crystalBar.style.background = 'linear-gradient(90deg, #ffd754, #fff3a8)'
      this.crystalValue.style.color = '#fff3a8'
      this.badge.style.borderColor = 'rgba(255, 215, 84, 0.4)'
      this.badge.style.boxShadow = '0 20px 50px rgba(255, 215, 84, 0.1)'
      return
    }
    this.crystalBar.style.background = 'linear-gradient(90deg, #a78cff, #d999ff)'
    this.crystalValue.style.color = '#d999ff'
    this.badge.style.borderColor = 'rgba(141, 117, 255, 0.35)'
    this.badge.style.boxShadow = '0 20px 50px rgba(0,0,0,0.35)'
  }
}
