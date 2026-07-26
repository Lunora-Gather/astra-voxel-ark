export type PlayerMotionConfig = {
  walkSpeed: number
  sprintSpeed: number
  groundAcceleration: number
  groundStopping: number
  airAcceleration: number
  airStopping: number
  jumpVelocity: number
  gravity: number
  maxDeltaSeconds: number
}

export type PlayerMotionStep = {
  right: number
  forward: number
  vertical: number
}

export const DEFAULT_PLAYER_MOTION_CONFIG: PlayerMotionConfig = {
  walkSpeed: 7.6,
  sprintSpeed: 12.2,
  groundAcceleration: 14,
  groundStopping: 12,
  airAcceleration: 6,
  airStopping: 2.5,
  jumpVelocity: 8.2,
  gravity: 21.5,
  maxDeltaSeconds: 0.05,
}

/**
 * Allocation-free local-space player kinetics.
 * Rendering controls and collision resolution remain adapters owned by the game shell.
 */
export class PlayerMotionController {
  readonly config: PlayerMotionConfig
  private rightVelocity = 0
  private forwardVelocity = 0
  private verticalVelocity = 0
  private grounded = false
  private readonly step: PlayerMotionStep = { right: 0, forward: 0, vertical: 0 }

  constructor(config: Partial<PlayerMotionConfig> = {}) {
    this.config = sanitizeConfig({ ...DEFAULT_PLAYER_MOTION_CONFIG, ...config })
  }

  get isGrounded() {
    return this.grounded
  }

  get verticalSpeed() {
    return this.verticalVelocity
  }

  update(rightInput: number, forwardInput: number, sprinting: boolean, active: boolean, deltaSeconds: number) {
    const dt = clampFinite(deltaSeconds, 0, this.config.maxDeltaSeconds, 0)
    let right = finiteOrZero(rightInput)
    let forward = finiteOrZero(forwardInput)
    const inputLengthSq = right * right + forward * forward
    if (inputLengthSq > 1) {
      const inverseLength = 1 / Math.sqrt(inputLengthSq)
      right *= inverseLength
      forward *= inverseLength
    }

    if (!active) {
      this.stopHorizontal()
    } else {
      const speed = sprinting ? this.config.sprintSpeed : this.config.walkSpeed
      const hasInput = right * right + forward * forward > 0
      const response = hasInput
        ? this.grounded ? this.config.groundAcceleration : this.config.airAcceleration
        : this.grounded ? this.config.groundStopping : this.config.airStopping
      const blend = 1 - Math.exp(-response * dt)
      this.rightVelocity += (right * speed - this.rightVelocity) * blend
      this.forwardVelocity += (forward * speed - this.forwardVelocity) * blend
      if (this.rightVelocity * this.rightVelocity + this.forwardVelocity * this.forwardVelocity < 0.0004) {
        this.stopHorizontal()
      }
    }

    this.verticalVelocity -= this.config.gravity * dt
    this.step.right = this.rightVelocity * dt
    this.step.forward = this.forwardVelocity * dt
    this.step.vertical = this.verticalVelocity * dt
    return this.step
  }

  jump() {
    if (!this.grounded) return false
    this.verticalVelocity = this.config.jumpVelocity
    this.grounded = false
    return true
  }

  setGrounded(grounded: boolean) {
    this.grounded = grounded
  }

  land() {
    const impactSpeed = Math.max(0, -this.verticalVelocity)
    this.grounded = true
    this.verticalVelocity = 0
    return impactSpeed
  }

  cancelVertical() {
    this.verticalVelocity = 0
  }

  stopHorizontal() {
    this.rightVelocity = 0
    this.forwardVelocity = 0
  }

  reset(grounded = false) {
    this.stopHorizontal()
    this.verticalVelocity = 0
    this.grounded = grounded
    this.step.right = 0
    this.step.forward = 0
    this.step.vertical = 0
  }
}

function sanitizeConfig(config: PlayerMotionConfig): PlayerMotionConfig {
  return {
    walkSpeed: positiveFinite(config.walkSpeed, DEFAULT_PLAYER_MOTION_CONFIG.walkSpeed),
    sprintSpeed: positiveFinite(config.sprintSpeed, DEFAULT_PLAYER_MOTION_CONFIG.sprintSpeed),
    groundAcceleration: positiveFinite(config.groundAcceleration, DEFAULT_PLAYER_MOTION_CONFIG.groundAcceleration),
    groundStopping: positiveFinite(config.groundStopping, DEFAULT_PLAYER_MOTION_CONFIG.groundStopping),
    airAcceleration: positiveFinite(config.airAcceleration, DEFAULT_PLAYER_MOTION_CONFIG.airAcceleration),
    airStopping: positiveFinite(config.airStopping, DEFAULT_PLAYER_MOTION_CONFIG.airStopping),
    jumpVelocity: positiveFinite(config.jumpVelocity, DEFAULT_PLAYER_MOTION_CONFIG.jumpVelocity),
    gravity: positiveFinite(config.gravity, DEFAULT_PLAYER_MOTION_CONFIG.gravity),
    maxDeltaSeconds: positiveFinite(config.maxDeltaSeconds, DEFAULT_PLAYER_MOTION_CONFIG.maxDeltaSeconds),
  }
}

function finiteOrZero(value: number) {
  return Number.isFinite(value) ? value : 0
}

function positiveFinite(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function clampFinite(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}
