export type PackedBlockKey = number

const COORDINATE_BITS = 20
const COORDINATE_MASK = (1 << COORDINATE_BITS) - 1
const COORDINATE_OFFSET = 1 << (COORDINATE_BITS - 1)
const MAX_COORDINATE = COORDINATE_OFFSET - 1
const MIN_COORDINATE = -COORDINATE_OFFSET

export function packBlockKey(x: number, y: number, z: number): PackedBlockKey {
  assertSafeCoordinate(x, 'x')
  assertSafeCoordinate(y, 'y')
  assertSafeCoordinate(z, 'z')

  const px = x + COORDINATE_OFFSET
  const py = y + COORDINATE_OFFSET
  const pz = z + COORDINATE_OFFSET

  return px * 2 ** (COORDINATE_BITS * 2) + py * 2 ** COORDINATE_BITS + pz
}

export function unpackBlockKey(key: PackedBlockKey) {
  const px = Math.floor(key / 2 ** (COORDINATE_BITS * 2)) & COORDINATE_MASK
  const py = Math.floor(key / 2 ** COORDINATE_BITS) & COORDINATE_MASK
  const pz = key & COORDINATE_MASK

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
