import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = process.cwd()
const androidDir = resolve(root, 'android')
const gradleCommand = process.platform === 'win32' ? 'cmd.exe' : './gradlew'
const gradleArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'gradlew.bat', 'assembleDebug']
  : ['assembleDebug']

const child = spawn(gradleCommand, gradleArgs, {
  cwd: androidDir,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})

child.on('error', (error) => {
  console.error(`Android build failed to start: ${error.message}`)
  process.exit(1)
})
