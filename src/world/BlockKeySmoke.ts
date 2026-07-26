import {
  isSafeBlockCoordinate,
  packBlockKey,
  parseStringBlockKey,
  stringifyBlockKey,
  unpackBlockKey,
  unpackBlockKeyInto,
} from './blockKey'

export function assertBlockKeySmoke() {
  const samples = [
    [0, 0, 0],
    [17, 128, -31],
    [-65_536, -65_536, -65_536],
    [65_535, 65_535, 65_535],
  ] as const
  const keys = new Set<number>()
  const target = { x: 99, y: 99, z: 99 }

  for (const [x, y, z] of samples) {
    const key = packBlockKey(x, y, z)
    keys.add(key)
    const decoded = unpackBlockKey(key)
    if (decoded.x !== x || decoded.y !== y || decoded.z !== z) {
      throw new Error('Block key smoke failed: packed coordinates should round-trip exactly')
    }
    if (unpackBlockKeyInto(key, target) !== target || target.x !== x || target.y !== y || target.z !== z) {
      throw new Error('Block key smoke failed: hot-path decoding should reuse its target')
    }
    const saved = stringifyBlockKey(key)
    if (saved !== `${x},${y},${z}` || parseStringBlockKey(saved) !== key) {
      throw new Error('Block key smoke failed: save boundary should preserve legacy string keys')
    }
  }

  if (keys.size !== samples.length || parseStringBlockKey('bad-key') !== null) {
    throw new Error('Block key smoke failed: valid positions must be unique and malformed saves rejected')
  }
  if (!isSafeBlockCoordinate(-65_536) || !isSafeBlockCoordinate(65_535) || isSafeBlockCoordinate(65_536)) {
    throw new Error('Block key smoke failed: coordinate range should match the 17-bit packing contract')
  }

  return true
}
