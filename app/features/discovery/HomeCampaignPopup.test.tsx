// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const fake = vi.hoisted(() => ({
  data: { sections: { popups: [] as Array<Record<string, unknown>> } },
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: fake.data }),
}))
vi.mock('#/features/marketplace/queries', () => ({
  marketplaceHomeQueryOptions: () => ({}),
}))
vi.mock('#/i18n/client', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))
vi.mock('#/i18n/navigation', () => ({
  useLocalePath: () => (path: string) => `/en${path}`,
}))
import { HomeCampaignPopup } from './HomeCampaignPopup'
const banner = {
  id: 'popup-1',
  title: 'Saved promotion',
  subtitle: 'Default body',
  titleTh: 'ข้อเสนอ',
  titleEn: 'English promotion',
  bodyTh: null,
  bodyEn: '<script>plain content</script>',
  startsAt: null,
  endsAt: null,
  popupFrequency: 'DAILY',
  targetUrl: '/deals',
  imageUrl: '/promotion.jpg',
}
describe('homepage popup consumer', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fake.data = { sections: { popups: [{ ...banner }] } }
  })
  afterEach(() => {
    cleanup()
  })
  it('renders localized plain text, keeps links local and dismisses the campaign', async () => {
    render(<HomeCampaignPopup />)
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.getByText('<script>plain content</script>')).toBeTruthy()
    expect(document.querySelector('script')).toBeNull()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/en/deals')
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
  it('suppresses a seen daily campaign and rejects unsafe target URLs', async () => {
    const first = render(<HomeCampaignPopup />)
    await screen.findByRole('dialog')
    first.unmount()
    render(<HomeCampaignPopup />)
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    fake.data = {
      sections: {
        popups: [
          {
            ...banner,
            id: 'unsafe',
            popupFrequency: 'ALWAYS',
            targetUrl: 'javascript:alert(1)',
          },
        ],
      },
    }
    render(<HomeCampaignPopup />)
    await screen.findByRole('dialog')
    expect(screen.queryByRole('link')).toBeNull()
  })
})
