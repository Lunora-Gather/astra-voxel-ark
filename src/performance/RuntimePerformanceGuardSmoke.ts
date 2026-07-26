import { RuntimePerformanceGuard } from './RuntimePerformanceGuard'

export function assertRuntimePerformanceGuardSmoke() {
  const guard = new RuntimePerformanceGuard(60)
  if (guard.currentLevel !== 'normal' || guard.budget.terrainFrameCadence !== 1) {
    throw new Error('Runtime performance guard smoke failed: normal budget should be the default')
  }

  for (let index = 0; index < 4; index++) guard.sample({ fps: 39, averageFrameMs: 25 })
  if ((guard.currentLevel as string) !== 'strained' || guard.budget.cosmeticScale !== 0.5) {
    throw new Error('Runtime performance guard smoke failed: sustained pressure should enter strained mode')
  }

  for (let index = 0; index < 3; index++) guard.sample({ fps: 24, averageFrameMs: 45 })
  if ((guard.currentLevel as string) !== 'critical' || guard.budget.viewDistancePenalty !== 1) {
    throw new Error('Runtime performance guard smoke failed: severe pressure should enter critical mode')
  }

  for (let index = 0; index < 8; index++) guard.sample({ fps: 60, averageFrameMs: 16 })
  if ((guard.currentLevel as string) !== 'strained') {
    throw new Error('Runtime performance guard smoke failed: critical mode should recover one level at a time')
  }
  for (let index = 0; index < 10; index++) guard.sample({ fps: 60, averageFrameMs: 16 })
  if ((guard.currentLevel as string) !== 'normal') {
    throw new Error('Runtime performance guard smoke failed: sustained recovery should restore normal mode')
  }

  guard.sample({ fps: Number.NaN, averageFrameMs: 0 })
  if ((guard.currentLevel as string) !== 'normal') {
    throw new Error('Runtime performance guard smoke failed: invalid samples should not alter state')
  }

  guard.setTargetFps(30)
  for (let index = 0; index < 4; index++) guard.sample({ fps: 28, averageFrameMs: 34 })
  if ((guard.currentLevel as string) !== 'normal') {
    throw new Error('Runtime performance guard smoke failed: healthy capped 30 FPS should not trigger pressure')
  }

  return true
}
