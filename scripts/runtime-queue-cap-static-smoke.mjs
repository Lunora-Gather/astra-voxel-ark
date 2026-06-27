import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

const checks = [
  ['src/app/MainRuntimeWorkQueue.ts', 'MainRuntimeTaskQueueOptions'],
  ['src/app/MainRuntimeWorkQueue.ts', 'readonly maxPending'],
  ['src/app/MainRuntimeWorkQueue.ts', 'normalizeMainRuntimeQueueCapacity'],
  ['src/app/MainRuntimeWorkQueue.ts', 'if (maxPending !== null && pending >= maxPending) return pending'],
  ['src/app/MainRuntimeWorkQueue.ts', 'createMainRuntimeUniqueTaskQueue<T>(\n  getKey: MainRuntimeQueueKeySelector<T>,\n  initialItems: T[] = [],\n  options: MainRuntimeTaskQueueOptions = {},'],
  ['src/app/MainRuntimeOrchestrator.ts', 'terrainQueueMaxPending'],
  ['src/app/MainRuntimeOrchestrator.ts', 'dirtyChunkSummaryQueueMaxPending'],
  ['src/app/MainRuntimeOrchestrator.ts', 'MainRuntimeTaskQueueOptions'],
  ['src/app/MainRuntimeOrchestrator.ts', '{ maxPending: terrainQueueMaxPending }'],
  ['src/app/MainRuntimeOrchestrator.ts', '{ maxPending: dirtyChunkSummaryQueueMaxPending }'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'cappedPending'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'cappedMaxPending'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'cappedUniquePending'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'maxPending: 2'],
]

const errors = []

for (const [file, token] of checks) {
  const content = readFileSync(resolve(root, file), 'utf8')
  if (!content.includes(token)) errors.push(`Expected ${file} to include ${token}`)
}

if (errors.length > 0) {
  console.error('Runtime queue capacity static smoke failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Runtime queue capacity static smoke passed')
