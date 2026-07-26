import { PlayerMotionController } from './PlayerMotionController'

export function assertPlayerMotionControllerSmoke() {
  const motion = new PlayerMotionController()
  motion.setGrounded(true)
  const firstStep = motion.update(0, 1, false, true, 1 / 60)
  const reusedStep = motion.update(0, 1, false, true, 1 / 60)
  if (firstStep !== reusedStep) throw new Error('Player motion smoke failed: hot-path step should be reused')
  if (reusedStep.forward <= 0 || reusedStep.right !== 0) {
    throw new Error('Player motion smoke failed: forward input direction is incorrect')
  }

  const touchMotion = new PlayerMotionController({ groundAcceleration: 1000 })
  touchMotion.setGrounded(true)
  const diagonal = touchMotion.update(0.8, -0.8, false, true, 0.05)
  const diagonalSpeed = Math.hypot(diagonal.right, diagonal.forward) / 0.05
  if (diagonal.right <= 0 || diagonal.forward >= 0 || diagonalSpeed > touchMotion.config.walkSpeed + 0.001) {
    throw new Error('Player motion smoke failed: diagonal touch input was not normalized')
  }

  const walkMotion = new PlayerMotionController({ groundAcceleration: 1000 })
  walkMotion.setGrounded(true)
  const walk = walkMotion.update(0, 1, false, true, 0.05).forward
  const sprintMotion = new PlayerMotionController({ groundAcceleration: 1000 })
  sprintMotion.setGrounded(true)
  const sprint = sprintMotion.update(0, 1, true, true, 0.05).forward
  if (sprint <= walk || Math.abs(sprint / walk - sprintMotion.config.sprintSpeed / sprintMotion.config.walkSpeed) > 0.01) {
    throw new Error('Player motion smoke failed: sprint speed ratio changed')
  }

  const jumpMotion = new PlayerMotionController()
  jumpMotion.land()
  if (!jumpMotion.jump() || jumpMotion.jump()) {
    throw new Error('Player motion smoke failed: jump should require a grounded state')
  }
  const rising = jumpMotion.update(0, 0, false, true, 0.05)
  if (rising.vertical <= 0 || jumpMotion.isGrounded) {
    throw new Error('Player motion smoke failed: jump did not enter a rising airborne state')
  }
  for (let i = 0; i < 12; i += 1) jumpMotion.update(0, 0, false, true, 0.05)
  if (jumpMotion.verticalSpeed >= 0) throw new Error('Player motion smoke failed: gravity did not reverse the jump')
  jumpMotion.land()
  if (!jumpMotion.isGrounded || jumpMotion.verticalSpeed !== 0) {
    throw new Error('Player motion smoke failed: landing did not reset vertical motion')
  }

  const lowRateDistance = simulateForwardDistance(20, 0.05)
  const highRateDistance = simulateForwardDistance(60, 1 / 60)
  if (Math.abs(lowRateDistance - highRateDistance) > 0.12) {
    throw new Error(`Player motion smoke failed: frame-rate drift ${lowRateDistance} vs ${highRateDistance}`)
  }

  const clampedMotion = new PlayerMotionController()
  clampedMotion.setGrounded(true)
  const clamped = { ...clampedMotion.update(0, 1, false, true, 1) }
  const referenceMotion = new PlayerMotionController()
  referenceMotion.setGrounded(true)
  const reference = referenceMotion.update(0, 1, false, true, 0.05)
  if (Math.abs(clamped.forward - reference.forward) > 0.000001 || Math.abs(clamped.vertical - reference.vertical) > 0.000001) {
    throw new Error('Player motion smoke failed: long-frame delta was not capped')
  }

  motion.update(1, 0, false, false, 1 / 60)
  const inactive = motion.update(0, 0, false, false, 1 / 60)
  if (inactive.right !== 0 || inactive.forward !== 0) {
    throw new Error('Player motion smoke failed: inactive controls retained horizontal drift')
  }

  return true
}

function simulateForwardDistance(frameCount: number, dt: number) {
  const motion = new PlayerMotionController()
  motion.setGrounded(true)
  let distance = 0
  for (let i = 0; i < frameCount; i += 1) {
    distance += motion.update(0, 1, false, true, dt).forward
  }
  return distance
}
