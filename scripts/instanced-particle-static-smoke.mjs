import fs from 'node:fs'

const pool = fs.readFileSync(new URL('../src/render/ParticlePool.ts', import.meta.url), 'utf8')
const pipeline = fs.readFileSync(new URL('../src/app/ParticleEffectsPipeline.ts', import.meta.url), 'utf8')
const runtimeSmoke = fs.readFileSync(new URL('../src/app/ParticleEffectsPipelineSmoke.ts', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')

const expectations = [
  [pool.includes('export class InstancedParticlePool'), 'instanced particle pool boundary'],
  [(pool.match(/new THREE\.InstancedMesh/g) ?? []).length === 1, 'one draw object per pool'],
  [!pool.includes('new THREE.Mesh('), 'no mesh-per-particle allocation'],
  [pool.includes('THREE.DynamicDrawUsage'), 'dynamic instance buffer usage'],
  [pool.includes('this.mesh.count = this.active.length'), 'active instance compaction'],
  [(pipeline.match(/new InstancedParticlePool/g) ?? []).length === 2, 'two shared effect batches'],
  [!pipeline.includes('position.clone()'), 'allocation-free burst positions'],
  [!pipeline.includes('blockPools'), 'no material pool per block'],
  [runtimeSmoke.includes('two instanced draw objects'), 'runtime draw-object contract'],
  [main.includes("import('./app/ParticleEffectsPipelineSmoke')"), 'lazy Electron particle smoke'],
]

const missing = expectations.filter(([present]) => !present).map(([, label]) => label)
if (missing.length > 0) {
  console.error(`Instanced particle static smoke failed: ${missing.map((item) => `missing ${item}`).join(', ')}`)
  process.exit(1)
}

console.log('Instanced particle static smoke passed')
