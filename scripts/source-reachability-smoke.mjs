import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('src')
const files = []

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (entry.name.endsWith('.ts')) files.push(path.resolve(file))
  }
}

walk(root)
const knownFiles = new Map(files.map((file) => [path.normalize(file), file]))

function resolveImport(from, specifier) {
  if (!specifier.startsWith('.')) return null
  const base = path.resolve(path.dirname(from), specifier)
  for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) {
    const resolved = knownFiles.get(path.normalize(candidate))
    if (resolved) return resolved
  }
  return null
}

const imports = new Map()
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  const dependencies = []
  const pattern = /(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    const dependency = resolveImport(file, match[1])
    if (dependency) dependencies.push(dependency)
  }
  imports.set(file, dependencies)
}

const entries = [
  path.resolve(root, 'main.ts'),
  path.resolve(root, 'workers', 'proceduralTerrainWorker.ts'),
]
const reachable = new Set()
const pending = [...entries]
while (pending.length > 0) {
  const file = pending.pop()
  if (!file || reachable.has(file)) continue
  reachable.add(file)
  pending.push(...(imports.get(file) ?? []))
}

const unreachable = files
  .filter((file) => !reachable.has(file))
  .map((file) => path.relative(process.cwd(), file))
  .sort()

if (unreachable.length > 0) {
  console.error(`Source reachability smoke failed: ${unreachable.join(', ')}`)
  process.exit(1)
}

console.log(`Source reachability smoke passed (${reachable.size}/${files.length})`)
