import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

const checks = [
  ['src/app/MainRuntimeWorkQueue.ts', 'MainRuntimeTaskQueueOptions'],
  ['src/app/MainRuntimeWorkQueue.ts', 'MainRuntimeQueueEnqueueResult'],
  ['src/app/MainRuntimeWorkQueue.ts', 'readonly maxPending'],
  ['src/app/MainRuntimeWorkQueue.ts', 'readonly dropped'],
  ['src/app/MainRuntimeWorkQueue.ts', 'tryEnqueue: (item: T) => MainRuntimeQueueEnqueueResult'],
  ['src/app/MainRuntimeWorkQueue.ts', 'tryEnqueueUnique'],
  ['src/app/MainRuntimeWorkQueue.ts', 'normalizeMainRuntimeQueueCapacity'],
  ['src/app/MainRuntimeWorkQueue.ts', 'dropped++'],
  ['src/app/MainRuntimeWorkQueue.ts', 'return { accepted: false, pending, dropped }'],
  ['src/app/MainRuntimeWorkQueue.ts', 'if (result.accepted) queuedKeys.add(key)'],
  ['src/app/MainRuntimeWorkQueue.ts', 'createMainRuntimeUniqueTaskQueue<T>(\n  getKey: MainRuntimeQueueKeySelector<T>,\n  initialItems: T[] = [],\n  options: MainRuntimeTaskQueueOptions = {},'],
  ['src/app/MainRuntimeOrchestrator.ts', 'terrainQueueMaxPending'],
  ['src/app/MainRuntimeOrchestrator.ts', 'dirtyChunkSummaryQueueMaxPending'],
  ['src/app/MainRuntimeOrchestrator.ts', 'MainRuntimeQueueEnqueueResult'],
  ['src/app/MainRuntimeOrchestrator.ts', 'terrainDropped'],
  ['src/app/MainRuntimeOrchestrator.ts', 'dirtyChunkSummariesDropped'],
  ['src/app/MainRuntimeOrchestrator.ts', 'tryEnqueueTerrainTask'],
  ['src/app/MainRuntimeOrchestrator.ts', 'tryEnqueueDirtyChunkSummaryTask'],
  ['src/app/MainRuntimeOrchestrator.ts', 'syncDroppedStats'],
  ['src/app/MainRuntimeOrchestrator.ts', 'MainRuntimeTaskQueueOptions'],
  ['src/app/MainRuntimeOrchestrator.ts', '{ maxPending: terrainQueueMaxPending }'],
  ['src/app/MainRuntimeOrchestrator.ts', '{ maxPending: dirtyChunkSummaryQueueMaxPending }'],
  ['src/app/MainBootstrapSmoke.ts', 'orchestratorOverflowAccepted'],
  ['src/app/MainBootstrapSmoke.ts', 'orchestratorOverflowPending'],
  ['src/app/MainBootstrapSmoke.ts', 'orchestratorDirtyDropped'],
  ['src/app/MainBootstrapSmoke.ts', 'dirtyChunkSummaryQueueMaxPending: 4'],
  ['src/app/MainBootstrapSmoke.ts', "orchestrator.tryEnqueueDirtyChunkSummaryTask('dirty-orchestrated-e')"],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'cappedPending'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'cappedMaxPending'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'cappedDropped'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'cappedTryAccepted'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'cappedTryDropped'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'cappedUniquePending'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'cappedUniqueDropped'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'cappedUniqueTryAccepted'],
  ['src/app/MainRuntimeWorkQueueSmoke.ts', 'cappedUniqueTryDropped'],
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
