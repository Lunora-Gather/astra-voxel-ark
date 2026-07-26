import {
  formatWorldCoordinates,
  formatWorldCoordinatesForClipboard,
  toWorldBlockCoordinate,
} from './WorldCoordinates'

export function assertWorldCoordinatesSmoke() {
  const cases: Array<[unknown, number]> = [
    [0, 0],
    [12.999, 12],
    [-0.001, -1],
    [-12.001, -13],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    ['8', 0],
  ]
  cases.forEach(([value, expected]) => {
    const actual = toWorldBlockCoordinate(value)
    if (actual !== expected) {
      throw new Error(`World coordinates smoke failed: ${String(value)} resolved to ${actual}, expected ${expected}`)
    }
  })

  if (formatWorldCoordinates(-0.1, 12.9, 18.2) !== 'X -1 · Y 12 · Z 18') {
    throw new Error('World coordinates smoke failed: HUD coordinate format changed')
  }
  if (formatWorldCoordinatesForClipboard(-0.1, 12.9, 18.2) !== '-1, 12, 18') {
    throw new Error('World coordinates smoke failed: clipboard coordinate format changed')
  }

  return true
}
