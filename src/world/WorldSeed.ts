const UINT32_MAX = 0xffffffff

export function normalizeWorldSeed(value: unknown, fallback = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return normalizeSeedNumber(fallback)
  return normalizeSeedNumber(value)
}

export function createWorldSeed(random: () => number = Math.random) {
  const sample = random()
  if (!Number.isFinite(sample)) return 1
  return Math.max(1, Math.min(UINT32_MAX, Math.floor(Math.abs(sample % 1) * UINT32_MAX)))
}

export function formatWorldSeed(seed: number) {
  return normalizeWorldSeed(seed).toString(16).toUpperCase().padStart(8, '0')
}

export function getWorldSeedOffsets(seed: number): [number, number] {
  const normalized = normalizeWorldSeed(seed)
  if (normalized === 0) return [0, 0]
  return [signedOffset(mix32(normalized ^ 0x9e3779b9)), signedOffset(mix32(normalized ^ 0x85ebca6b))]
}

function normalizeSeedNumber(value: number) {
  return Math.abs(Math.floor(value)) >>> 0
}

function signedOffset(value: number) {
  return (value % 4096) - 2048
}

function mix32(value: number) {
  let mixed = value >>> 0
  mixed ^= mixed >>> 16
  mixed = Math.imul(mixed, 0x7feb352d)
  mixed ^= mixed >>> 15
  mixed = Math.imul(mixed, 0x846ca68b)
  mixed ^= mixed >>> 16
  return mixed >>> 0
}
