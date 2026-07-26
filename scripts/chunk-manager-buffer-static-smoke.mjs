import fs from 'node:fs'

const manager = fs.readFileSync(new URL('../src/world/ChunkManager.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/world/ChunkManagerSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [manager.includes('fillDirtyChunks(chunks: ChunkRecord[]'), 'caller-owned dirty chunk buffer'],
  [manager.includes('fillChunkBlocks('), 'caller-owned block buffer'],
  [manager.includes('blocks.length = 0'), 'in-place block buffer reset'],
  [manager.includes('chunks.length = 0'), 'in-place dirty buffer reset'],
  [manager.includes('get dirtyChunkCount()'), 'allocation-free dirty diagnostics'],
  [runtimeSmoke.includes('dirty batches should reuse caller storage'), 'dirty buffer runtime coverage'],
  [runtimeSmoke.includes('filtered block reads should reuse caller storage'), 'block buffer runtime coverage'],
  [main.includes('const dirtyOptimizedChunkBuffer: ChunkRecord[] = []'), 'persistent live dirty buffer'],
  [main.includes('const chunkMeshBlockBuffer: WorldBlock[] = []'), 'persistent live mesh block buffer'],
  [main.includes('optimizedChunks.fillDirtyChunks(dirtyOptimizedChunkBuffer, limit)'), 'bounded live dirty fill'],
  [main.includes('optimizedChunks.fillChunkBlocks(chunk.cx, chunk.cz, chunkMeshBlockBuffer'), 'filtered live block fill'],
  [main.includes('optimizedChunks.dirtyChunkCount'), 'allocation-free HUD counter'],
  [!main.includes('optimizedChunks.getDirtyChunks().slice'), 'no copied live dirty list'],
  [!main.includes('optimizedChunks.getChunkBlocks(chunk.cx, chunk.cz).filter'), 'no double live block arrays'],
  [main.includes("import('./world/ChunkManagerSmoke')"), 'lazy Electron chunk manager smoke'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Chunk manager buffer static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Chunk manager buffer static smoke passed')
