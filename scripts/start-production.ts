import { spawn, type ChildProcess } from 'node:child_process'

type ManagedProcess = {
  name: string
  process: ChildProcess
  exited: Promise<number>
}

const commands = [
  { name: 'frontend', script: 'start:frontend' },
  { name: 'backend', script: 'start:server' },
  { name: 'worker', script: 'jobs:worker' },
] as const

const children: ManagedProcess[] = commands.map((command) => {
  const child = spawn('bun', ['run', command.script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false,
  })
  const exited = new Promise<number>((resolve) => {
    child.once('exit', (code) => resolve(code ?? 1))
    child.once('error', () => resolve(1))
  })
  return { name: command.name, process: child, exited }
})

let shuttingDown = false

async function shutdown(signal: NodeJS.Signals, exitCode = 0): Promise<never> {
  if (!shuttingDown) {
    shuttingDown = true
    for (const child of children) child.process.kill(signal)
    await Promise.allSettled(children.map((child) => child.exited))
  }
  process.exit(exitCode)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

const exited = await Promise.race(children.map(async (child) => ({
  name: child.name,
  code: await child.exited,
})))

process.stderr.write(`${exited.name} exited with code ${exited.code}; shutting down production process group\n`)
await shutdown('SIGTERM', exited.code === 0 ? 1 : exited.code)
