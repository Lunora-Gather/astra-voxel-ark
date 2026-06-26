export type OptimizationFeatureFlags = {
  diagnostics: boolean
  chunkMeshDiagnostics: boolean
  chunkMeshRenderer: boolean
  terrainWorker: boolean
  particlePool: boolean
  lightBudget: boolean
}

export const DEFAULT_OPTIMIZATION_FLAGS: OptimizationFeatureFlags = {
  diagnostics: false,
  chunkMeshDiagnostics: false,
  chunkMeshRenderer: false,
  terrainWorker: false,
  particlePool: false,
  lightBudget: false,
}

export function readOptimizationFeatureFlags(hash?: string): OptimizationFeatureFlags {
  const resolvedHash = hash ?? resolveCurrentHash()
  const params = new URLSearchParams(resolvedHash.startsWith('#') ? resolvedHash.slice(1) : resolvedHash)
  const diagnostics = hasFlag(params, 'opt-diagnostics')

  return {
    diagnostics,
    chunkMeshDiagnostics: diagnostics || hasFlag(params, 'chunk-mesh-diagnostics'),
    chunkMeshRenderer: hasFlag(params, 'chunk-mesh-renderer'),
    terrainWorker: hasFlag(params, 'terrain-worker'),
    particlePool: hasFlag(params, 'particle-pool'),
    lightBudget: hasFlag(params, 'light-budget'),
  }
}

export function hasAnyExperimentalRenderFlag(flags: OptimizationFeatureFlags) {
  return flags.chunkMeshDiagnostics || flags.chunkMeshRenderer || flags.lightBudget
}

function hasFlag(params: URLSearchParams, key: string) {
  const value = params.get(key)
  return params.has(key) && value !== '0' && value !== 'false'
}

function resolveCurrentHash() {
  if (!globalThis.location) return ''
  return globalThis.location.hash
}
