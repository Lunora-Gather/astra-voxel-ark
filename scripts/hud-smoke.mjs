import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import electronPath from 'electron'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runnerPath = path.join(rootDir, 'scripts', 'hud-smoke-electron.cjs')
const smokeUrl = pathToFileURL(path.join(rootDir, 'dist', 'index.html')).href

function collectOutput(child, label) {
  let output = ''
  child.stdout?.on('data', (chunk) => {
    output += chunk.toString()
  })
  child.stderr?.on('data', (chunk) => {
    output += chunk.toString()
  })
  child.once('error', (error) => {
    output += `${label} failed to start: ${error.message}\n`
  })
  return () => output.trim()
}

function waitForExitWithTimeout(child, timeoutMs, label, getOutput) {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      stopProcess(child)
      reject(new Error(`${label} timed out after ${timeoutMs}ms\n${getOutput()}`))
    }, timeoutMs)
    child.once('exit', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code, signal })
    })
  })
}

function stopProcess(child) {
  if (!child || child.killed) return
  child.kill(process.platform === 'win32' ? 'SIGKILL' : 'SIGTERM')
}

const electronArgs = process.platform === 'linux' ? ['--no-sandbox', runnerPath] : [runnerPath]
const electron = spawn(electronPath, electronArgs, {
  cwd: rootDir,
  env: {
    ...process.env,
    ASTRA_SMOKE_URL: smokeUrl,
    ELECTRON_DISABLE_SANDBOX: '1',
    ELECTRON_ENABLE_LOGGING: '0',
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
const getElectronOutput = collectOutput(electron, 'electron smoke')
const result = await waitForExitWithTimeout(electron, 90000, 'electron HUD smoke', getElectronOutput)
const output = getElectronOutput()
if (output) console.log(output)
if (result.code !== 0) {
  throw new Error(`HUD smoke failed with code ${result.code ?? 'null'} signal ${result.signal ?? 'null'}`)
}
console.log('HUD smoke passed')
