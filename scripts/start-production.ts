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

export async function startProduction(shutdownTimeoutMs = 30_000): Promise<number> {
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

  let shutdownPromise: Promise<number> | undefined
  let announceShutdown: () => void
  const shutdownStarted = new Promise<null>((resolve) => {
    announceShutdown = () => resolve(null)
  })

  function shutdown(signal: NodeJS.Signals, exitCode = 0): Promise<number> {
    if (!shutdownPromise) {
      shutdownPromise = (async () => {
        for (const child of children) child.process.kill(signal)
        let timer: ReturnType<typeof setTimeout> | undefined
        const drained = await Promise.race([
          Promise.allSettled(children.map((child) => child.exited)).then(() => true),
          new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), shutdownTimeoutMs) }),
        ])
        clearTimeout(timer)
        if (!drained) {
          for (const child of children) child.process.kill('SIGKILL')
          process.stderr.write('Production shutdown timed out; stopped remaining children\n')
          return 1
        }
        return exitCode
      })()
      announceShutdown()
    }
    return shutdownPromise
  }

  const onInterrupt = () => { void shutdown('SIGINT') }
  const onTerminate = () => { void shutdown('SIGTERM') }
  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onTerminate)

  try {
    const exited = await Promise.race([...children.map(async (child) => ({
      name: child.name,
      code: await child.exited,
    })), shutdownStarted])

    if (!exited || shutdownPromise) return await shutdown('SIGTERM')
    process.stderr.write(`${exited.name} exited with code ${exited.code}; shutting down production process group\n`)
    return await shutdown('SIGTERM', exited.code === 0 ? 1 : exited.code)
  } finally {
    process.removeListener('SIGINT', onInterrupt)
    process.removeListener('SIGTERM', onTerminate)
  }
}

if (import.meta.main) process.exit(await startProduction())
