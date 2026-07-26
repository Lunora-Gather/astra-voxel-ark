import fs from 'node:fs'
import path from 'node:path'

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'))
const main = fs.readFileSync('src/main.ts', 'utf8')
const android = fs.readFileSync('android/app/build.gradle', 'utf8')
const readme = fs.readFileSync('README.md', 'utf8')
const version = packageJson.version
const majorMinor = version.split('.').slice(0, 2).join('.')
const errors = []

if (!/^\d+\.\d+\.\d+$/.test(version)) errors.push(`package version is not semantic: ${version}`)
if (packageLock.version !== version || packageLock.packages?.['']?.version !== version) {
  errors.push('package-lock root version does not match package.json')
}
if (!main.includes(`const GAME_VERSION_LABEL = 'v${version}`)) errors.push('runtime version label is out of sync')
if (!main.includes(`<h2>星野方舟 v${majorMinor}</h2>`)) errors.push('start panel version is out of sync')
if (!android.includes(`versionName "${version}"`)) errors.push('Android versionName is out of sync')
if (!readme.includes(`正式版本：v${version}`)) errors.push('README release version is out of sync')

const relativeLinks = [...readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
  .map((match) => match[1])
  .filter((target) => !/^(?:https?:|#)/.test(target))
  .map((target) => target.split('#')[0])
  .filter(Boolean)
for (const target of relativeLinks) {
  if (!fs.existsSync(path.resolve(target))) errors.push(`README link target is missing: ${target}`)
}

if (errors.length > 0) {
  console.error(`Release metadata smoke failed: ${errors.join(', ')}`)
  process.exit(1)
}

console.log(`Release metadata smoke passed (v${version})`)
