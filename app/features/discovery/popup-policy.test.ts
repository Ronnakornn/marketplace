import { describe, it, expect, vi } from 'vitest'
import {
  markPopupSeen,
  popupIsActive,
  popupSeen,
  safePopupUrl,
} from './popup-policy'
describe('homepage popup policy', () => {
  it('uses exact start-inclusive and end-exclusive UTC instants', () => {
    const banner = {
      startsAt: '2026-10-13T17:00:00.000Z',
      endsAt: '2026-10-14T17:00:00.000Z',
    }
    expect(popupIsActive(banner, new Date('2026-10-13T16:59:59.999Z'))).toBe(
      false,
    )
    expect(popupIsActive(banner, new Date(banner.startsAt))).toBe(true)
    expect(popupIsActive(banner, new Date(banner.endsAt))).toBe(false)
    expect(
      popupIsActive({ startsAt: 'invalid', endsAt: null }, new Date()),
    ).toBe(false)
  })
  it('suppresses daily views until the next Bangkok calendar date', () => {
    const entries = new Map<string, string>(),
      storage = {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
      }
    markPopupSeen(
      storage,
      'campaign',
      'DAILY',
      new Date('2026-10-13T16:59:00Z'),
    )
    expect(
      popupSeen(storage, 'campaign', 'DAILY', new Date('2026-10-13T16:59:59Z')),
    ).toBe(true)
    expect(
      popupSeen(storage, 'campaign', 'DAILY', new Date('2026-10-13T17:00:00Z')),
    ).toBe(false)
    markPopupSeen(storage, 'session', 'SESSION', new Date())
    expect(
      popupSeen(storage, 'session', 'SESSION', new Date('2030-01-01')),
    ).toBe(true)
    expect(
      popupSeen({ getItem: () => null }, 'session', 'SESSION', new Date()),
    ).toBe(false)
    expect(popupSeen(storage, 'campaign', 'ALWAYS', new Date())).toBe(false)
  })
  it('ignores restricted storage and never persists ALWAYS suppression', () => {
    const blocked = {
      getItem() {
        throw new Error('restricted')
      },
      setItem() {
        throw new Error('restricted')
      },
    }
    expect(popupSeen(blocked, 'campaign', 'DAILY', new Date())).toBe(false)
    expect(() =>
      markPopupSeen(blocked, 'campaign', 'DAILY', new Date()),
    ).not.toThrow()
    const setItem = vi.fn()
    markPopupSeen({ setItem }, 'campaign', 'ALWAYS', new Date())
    expect(setItem).not.toHaveBeenCalled()
  })
  it('permits HTTPS and local links while rejecting scripts and disguised external paths', () => {
    expect(safePopupUrl('/deals')).toBe('/deals')
    expect(safePopupUrl('https://example.test/deals')).toBe(
      'https://example.test/deals',
    )
    for (const value of [
      'javascript:alert(1)',
      'data:text/html,x',
      '//evil.test',
      '/\\evil.test',
      'https://user:password@example.test',
      'http://example.test',
    ])
      expect(safePopupUrl(value)).toBeNull()
  })
})
