// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDiscoveryTracking } from './tracking'
import { IMPRESSION_KEEPALIVE_BUDGET_BYTES, MAX_IMPRESSION_BATCH_BYTES, MAX_IMPRESSION_BATCH_EVENTS } from '#server/modules/tracking/tracking.limits'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-19T00:00:00.000Z'))
  window.localStorage.clear()
  Object.defineProperty(window.navigator, 'sendBeacon', { value: undefined, configurable: true })
  vi.spyOn(window, 'fetch').mockResolvedValue(new Response('{}'))
})

afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function requests() {
  return vi.mocked(window.fetch).mock.calls.map(([url, options]) => ({
    url,
    body: String(options?.body),
    events: JSON.parse(String(options?.body)).events as Array<{ productId: string; timestamp: string; sessionId: string; referrer: string; position: number }>,
    keepalive: options?.keepalive,
  }))
}

describe('impression batch delivery', () => {
  it('keeps the visibility observation timestamp and session until the ten second flush', () => {
    const hook = renderHook(() => useDiscoveryTracking('search_results'))
    window.localStorage.setItem('marketplace-anonymous-session-id', 'observation-session')
    act(() => hook.result.current.queueProductImpression({ productId: 'first', referrer: 'https://example.test/first', position: 0 }))
    window.localStorage.setItem('marketplace-anonymous-session-id', 'later-session')
    act(() => vi.advanceTimersByTime(9_999))
    expect(window.fetch).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(requests()).toMatchObject([{ url: '/api/discovery/impressions', events: [{
      productId: 'first', timestamp: '2026-10-19T00:00:00.000Z', sessionId: 'observation-session', referrer: 'https://example.test/first', position: 0,
    }] }])
  })

  it('chunks at the count limit and retains every distinct product', () => {
    const hook = renderHook(() => useDiscoveryTracking('search_results'))
    act(() => {
      for (let position = 0; position < MAX_IMPRESSION_BATCH_EVENTS + 1; position++) {
        hook.result.current.queueProductImpression({ productId: `product-${position}`, position })
      }
      vi.advanceTimersByTime(10_000)
    })
    expect(requests().map(request => request.events.length)).toEqual([50, 1])
    expect(requests().flatMap(request => request.events.map(event => event.position))).toEqual(Array.from({ length: 51 }, (_, position) => position))
  })

  it('counts UTF8 bytes including the envelope and shares a bounded keepalive budget', () => {
    const hook = renderHook(() => useDiscoveryTracking('search_results'))
    act(() => {
      for (let position = 0; position < 50; position++) {
        hook.result.current.queueProductImpression({ productId: `product-${position}`, position, filters: { label: 'ก'.repeat(450) } })
      }
      vi.advanceTimersByTime(10_000)
    })
    const sent = requests()
    expect(sent.length).toBeGreaterThan(2)
    expect(sent.flatMap(request => request.events)).toHaveLength(50)
    expect(sent.every(request => new TextEncoder().encode(request.body).byteLength <= MAX_IMPRESSION_BATCH_BYTES)).toBe(true)
    expect(sent.filter(request => request.keepalive).reduce((sum, request) => sum + new TextEncoder().encode(request.body).byteLength, 0)).toBeLessThanOrEqual(IMPRESSION_KEEPALIVE_BUDGET_BYTES)
    expect(sent.some(request => request.keepalive === false)).toBe(true)
  })

  it('falls back to keepalive fetch for a rejected beacon without losing any events', () => {
    const sendBeacon = vi.fn(() => false)
    Object.defineProperty(window.navigator, 'sendBeacon', { value: sendBeacon, configurable: true })
    const hook = renderHook(() => useDiscoveryTracking('search_results'))
    act(() => hook.result.current.queueProductImpression({ productId: 'first', position: 0 }))
    hook.unmount()
    expect(sendBeacon).toHaveBeenCalledExactlyOnceWith('/api/discovery/impressions', expect.any(Blob))
    expect(requests()).toMatchObject([{ keepalive: true, events: [{ productId: 'first', position: 0 }] }])
  })

  it('does not repeat a batch accepted by beacon', () => {
    const sendBeacon = vi.fn(() => true)
    Object.defineProperty(window.navigator, 'sendBeacon', { value: sendBeacon, configurable: true })
    const hook = renderHook(() => useDiscoveryTracking('search_results'))
    act(() => hook.result.current.queueProductImpression({ productId: 'first' }))
    hook.unmount()
    expect(sendBeacon).toHaveBeenCalledOnce()
    expect(window.fetch).not.toHaveBeenCalled()
  })

  it('rejects unbounded source, session and referrer before they can poison another queued impression', () => {
    const hook = renderHook(() => useDiscoveryTracking('x'.repeat(65)))
    act(() => hook.result.current.queueProductImpression({ productId: 'bad-source' }))
    hook.unmount()
    const valid = renderHook(() => useDiscoveryTracking('search_results'))
    window.localStorage.setItem('marketplace-anonymous-session-id', 'x'.repeat(129))
    act(() => valid.result.current.queueProductImpression({ productId: 'bad-session' }))
    window.localStorage.setItem('marketplace-anonymous-session-id', 'valid-session')
    act(() => {
      valid.result.current.queueProductImpression({ productId: 'bad-referrer', referrer: 'x'.repeat(257) })
      valid.result.current.queueProductImpression({ productId: 'valid' })
      vi.advanceTimersByTime(10_000)
    })
    expect(requests().flatMap(request => request.events.map(event => event.productId))).toEqual(['valid'])
  })

  it('keeps an exactly bounded single event and drops only an event exceeding the hard byte limit', () => {
    const hook = renderHook(() => useDiscoveryTracking('search_results'))
    const sessionId = 'fixed-session'
    window.localStorage.setItem('marketplace-anonymous-session-id', sessionId)
    const event = { eventType: 'product_impression', source: 'search_results', productId: 'fits', filters: { label: '' }, sessionId, timestamp: '2026-10-19T00:00:00.000Z' }
    const padding = MAX_IMPRESSION_BATCH_BYTES - new TextEncoder().encode(JSON.stringify({ events: [event] })).byteLength
    act(() => {
      hook.result.current.queueProductImpression({ productId: 'fits', filters: { label: 'x'.repeat(padding) } })
      hook.result.current.queueProductImpression({ productId: 'oversized', filters: { label: 'x'.repeat(MAX_IMPRESSION_BATCH_BYTES) } })
      vi.advanceTimersByTime(10_000)
    })
    expect(requests()).toHaveLength(1)
    expect(new TextEncoder().encode(requests()[0]!.body).byteLength).toBe(MAX_IMPRESSION_BATCH_BYTES)
    expect(requests()[0]!.events.map(event => event.productId)).toEqual(['fits'])
  })
})
