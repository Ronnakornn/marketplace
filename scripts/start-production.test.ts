import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startProduction } from './start-production.ts'

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
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

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
