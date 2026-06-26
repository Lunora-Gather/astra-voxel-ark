export type PackedBlockKey = number

// 17 bits per axis keeps the packed value within Number.MAX_SAFE_INTEGER.
// Range per axis: -65,536 through 65,535, which is far beyond the current island scale.
const COORDINATE_BITS = 17
const COORDINATE_BASE = 2 ** COORDINATE_BITS
const COORDINATE_OFFSET = 2 ** (COORDINATE_BITS - 1)
const MAX_COORDINATE = COORDINATE_OFFSET - 1
const MIN_COORDINATE = -COORDINATE_OFFSET

export function packBlockKey(x: number, y: number, z: number): PackedBlockKey {
  assertSafeCoordinate(x, 'x')
  assertSafeCoordinate(y, 'y')
  assertSafeCoordinate(z, 'z')

  const px = x + COORDINATE_OFFSET
  const py = y + COORDINATE_OFFSET
  const pz = z + COORDINATE_OFFSET

  return px * COORDINATE_BASE ** 2 + py * COORDINATE_BASE + pz
}

export function unpackBlockKey(key: PackedBlockKey) {
  if (!Number.isSafeInteger(key) || key < 0) {
    throw new RangeError('Packed block key must be a non-negative safe integer')
  }

  const px = Math.floor(key / COORDINATE_BASE ** 2)
  const py = Math.floor(key / COORDINATE_BASE) % COORDINATE_BASE
  const pz = key % COORDINATE_BASE

  return {
    x: px - COORDINATE_OFFSET,
    y: py - COORDINATE_OFFSET,
    z: pz - COORDINATE_OFFSET,
  }
}

export function stringifyBlockKey(key: PackedBlockKey) {
  const { x, y, z } = unpackBlockKey(key)
  return `${x},${y},${z}`
}

export function parseStringBlockKey(key: string): PackedBlockKey | null {
  const parts = key.split(',').map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null
  const [x, y, z] = parts
  try {
    return packBlockKey(x, y, z)
  } catch {
    return null
  }
}

export function coordinatesFromStringBlockKey(key: string) {
  const packed = parseStringBlockKey(key)
  return packed === null ? null : unpackBlockKey(packed)
}

export function isSafeBlockCoordinate(value: number) {
  return Number.isInteger(value) && value >= MIN_COORDINATE && value <= MAX_COORDINATE
}

function assertSafeCoordinate(value: number, axis: 'x' | 'y' | 'z') {
  if (!isSafeBlockCoordinate(value)) {
    throw new RangeError(`Block ${axis} coordinate is outside the supported range`)
  }
}
