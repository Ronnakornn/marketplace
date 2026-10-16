import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pushRequestDeadlineMs, sendWebPush } from './push.transport.ts'

const transport = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('node:https', () => ({ default: { request: transport.request } }))
vi.mock('web-push', () => ({ default: { generateRequestDetails: vi.fn(() => ({
  endpoint: 'https://push.example/device', method: 'POST', headers: { authorization: 'signed' }, body: Buffer.from('encrypted'),
})) } }))

const subscription = { endpoint: 'https://push.example/device', keys: { auth: 'auth', p256dh: 'public' } }

class Request extends EventEmitter {
  end = vi.fn()
  destroy = vi.fn((error: Error) => { this.emit('error', error); return this })
}

describe('push HTTPS transport resource lifecycle', () => {
  let request: Request
  let respond: (response: EventEmitter & { statusCode: number }) => void
  beforeEach(() => {
    vi.useFakeTimers()
    request = new Request()
    transport.request.mockReset().mockImplementation((_url, _options, callback) => { respond = callback; return request })
  })
  afterEach(() => { vi.useRealTimers() })

  it('destroys the actual request at an absolute deadline despite response activity and clears its timer', async () => {
    const result = sendWebPush(subscription, 'payload')
    const rejected = expect(result).rejects.toThrow('deadline')
    const response = Object.assign(new EventEmitter(), { statusCode: 201 })
    respond(response)
    for (let i = 0; i < 9; i++) {
      await vi.advanceTimersByTimeAsync(1000)
      response.emit('data', Buffer.from('activity'))
    }
    expect(request.destroy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(pushRequestDeadlineMs - 9000)
    await rejected
    expect(request.destroy).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    expect(request.end).toHaveBeenCalledWith(Buffer.from('encrypted'))
  })

  it.each([201, 404, 410])('clears the deadline for completed HTTP %i responses', async statusCode => {
    const result = sendWebPush(subscription, 'payload')
    const expectation = statusCode === 201 ? expect(result).resolves.toBeUndefined() : expect(result).rejects.toMatchObject({ statusCode })
    const response = Object.assign(new EventEmitter(), { statusCode })
    respond(response)
    response.emit('end')
    await expectation
    expect(vi.getTimerCount()).toBe(0)
    expect(request.destroy).not.toHaveBeenCalled()
  })

  it('clears deadline on request errors and aborts oversized provider responses', async () => {
    const failed = sendWebPush(subscription, 'payload')
    const failedExpectation = expect(failed).rejects.toThrow('connection failed')
    request.emit('error', new Error('connection failed'))
    await failedExpectation
    expect(vi.getTimerCount()).toBe(0)
    const oversized = sendWebPush(subscription, 'payload')
    const oversizedExpectation = expect(oversized).rejects.toThrow('response exceeds')
    const response = Object.assign(new EventEmitter(), { statusCode: 201 })
    respond(response)
    response.emit('data', Buffer.alloc(65 * 1024))
    await oversizedExpectation
    expect(request.destroy).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('handles response errors without leaving a deadline timer', async () => {
    const result = sendWebPush(subscription, 'payload')
    const expectation = expect(result).rejects.toThrow('response aborted')
    const response = Object.assign(new EventEmitter(), { statusCode: 201 })
    respond(response)
    response.emit('error', new Error('response aborted'))
    await expectation
    expect(request.destroy).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('releases a request closed without response and destroys an aborted response', async () => {
    const closed = sendWebPush(subscription, 'payload')
    const closedExpectation = expect(closed).rejects.toThrow('closed before completion')
    request.emit('close')
    await closedExpectation
    expect(vi.getTimerCount()).toBe(0)
    const aborted = sendWebPush(subscription, 'payload')
    const abortedExpectation = expect(aborted).rejects.toThrow('response aborted')
    const response = Object.assign(new EventEmitter(), { statusCode: 201 })
    respond(response)
    response.emit('aborted')
    await abortedExpectation
    expect(request.destroy).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})
