import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startProduction } from './start-production.ts'
import { localProductionEnv } from './local-production.ts'

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn }))

class Child extends EventEmitter {
  kill = vi.fn((_signal: NodeJS.Signals) => true)
}

describe('production process supervision', () => {
  let children: Child[]
  beforeEach(() => {
    children = [new Child(), new Child(), new Child()]
    spawn.mockReset()
    for (const child of children) spawn.mockReturnValueOnce(child)
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs() })

  it('binds the local production frontend to loopback', async () => {
    const env = localProductionEnv({
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/sming',
      BETTER_AUTH_SECRET: 'your-secret-here-change-in-production',
      PAYMENT_WEBHOOK_SECRET: 'local-webhook-secret-at-least-32-characters',
    })
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value)
    const running = startProduction()
    expect(spawn.mock.calls[0]?.[1]).toEqual(['run', 'start:frontend', '--hostname', '127.0.0.1'])
    for (const child of children) child.emit('exit', 0)
    await expect(running).resolves.toBe(1)
  })

  it('refuses local production with a public binding before starting children', async () => {
    vi.stubEnv('LOCAL_PRODUCTION', 'true')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('HOST', '0.0.0.0')
    await expect(startProduction()).rejects.toThrow(/HOST=127.0.0.1/)
    expect(spawn).not.toHaveBeenCalled()
  })

  it('waits for every child during requested shutdown and returns success', async () => {
    const running = startProduction()
    const terminate = process.listeners('SIGTERM').at(-1)!
    terminate('SIGTERM')
    let finished = false
    void running.then(() => { finished = true })
    children[0]!.emit('exit', 0)
    await Promise.resolve()
    await Promise.resolve()
    expect(finished).toBe(false)
    expect(children.every(child => child.kill.mock.calls[0]?.[0] === 'SIGTERM')).toBe(true)
    children[1]!.emit('exit', 0)
    children[2]!.emit('exit', 0)
    await expect(running).resolves.toBe(0)
    expect(process.listeners('SIGTERM')).not.toContain(terminate)
  })

  it('stops the other children and preserves an unexpected failure', async () => {
    const running = startProduction()
    children[2]!.emit('exit', 7)
    await Promise.resolve()
    await Promise.resolve()
    children[0]!.emit('exit', 0)
    children[1]!.emit('exit', 0)
    await expect(running).resolves.toBe(7)
    expect(children[0]!.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('bounds shutdown when a child never exits', async () => {
    vi.useFakeTimers()
    const running = startProduction(100)
    process.listeners('SIGTERM').at(-1)!('SIGTERM')
    children[0]!.emit('exit', 0)
    await vi.advanceTimersByTimeAsync(100)
    await expect(running).resolves.toBe(1)
    expect(children[1]!.kill).toHaveBeenCalledWith('SIGKILL')
  })

  it('also bounds shutdown when no child reports an exit', async () => {
    vi.useFakeTimers()
    const running = startProduction(100)
    process.listeners('SIGTERM').at(-1)!('SIGTERM')
    await vi.advanceTimersByTimeAsync(100)
    await expect(running).resolves.toBe(1)
    expect(children.every(child => child.kill.mock.calls.some(([signal]) => signal === 'SIGKILL'))).toBe(true)
  })
})
