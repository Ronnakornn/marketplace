/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VoucherWalletPage } from './VoucherWalletPage'

const { fetchPage, claim } = vi.hoisted(() => ({ fetchPage: vi.fn(), claim: vi.fn() }))
vi.mock('#/features/buyer/api', () => ({ fetchCouponPage: fetchPage, claimCoupon: claim }))
vi.mock('#/components/BuyerShell', () => ({ BuyerTopBar: () => null }))
vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }))
vi.mock('#/i18n/client', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key, useFormatters: () => ({ currency: (value: string) => value, date: (value: string) => value }) }))
vi.mock('#/i18n/navigation', () => ({ useLocalePath: () => (path: string) => path }))
afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())
const coupon = (id: string) => ({ id, code: id, title: id + ' title', description: null, discountType: 'FREE_SHIPPING', discountValueCents: null, discountPercentBps: null, minOrderCents: null, maxDiscountCents: null, startsAt: null, endsAt: null, claimed: false })
function page(number: number, data: ReturnType<typeof coupon>[], total = 61) { return { data, meta: { page: number, limit: 20, totalCount: total, totalPages: 4, hasNextPage: number < 4, hasPreviousPage: number > 1 } } }
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><VoucherWalletPage /></QueryClientProvider>)
  return client
}
describe('voucher history pagination', () => {
  it('loads another remote page on demand while retaining loaded vouchers', async () => {
    fetchPage.mockResolvedValueOnce(page(1, [coupon('coupon-1')])).mockResolvedValueOnce(page(2, [coupon('coupon-21')]))
    renderPage()
    await screen.findByText('coupon-1 title')
    expect(fetchPage).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'common.next' }))
    await screen.findByText('coupon-21 title')
    expect(screen.getByText('coupon-1 title')).toBeTruthy()
    expect(fetchPage).toHaveBeenLastCalledWith({ locale: 'en', page: 2, limit: 20 })
  })
  it('retains loaded vouchers and offers retry after the next page fails', async () => {
    fetchPage.mockResolvedValueOnce(page(1, [coupon('coupon-1')])).mockRejectedValueOnce(new Error('Page failed'))
    renderPage()
    await screen.findByText('coupon-1 title')
    fireEvent.click(screen.getByRole('button', { name: 'common.next' }))
    await screen.findByText('Page failed')
    expect(screen.getByText('coupon-1 title')).toBeTruthy()
  })
  it('refreshes voucher queries after claiming instead of clipping the global list', async () => {
    fetchPage.mockResolvedValue(page(1, [coupon('coupon-1')]))
    claim.mockResolvedValue(coupon('coupon-1'))
    const client = renderPage()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await screen.findByText('coupon-1 title')
    fireEvent.click(screen.getByRole('button', { name: 'buyer.claimVoucher' }))
    await waitFor(() => expect(claim).toHaveBeenCalledWith('coupon-1', 'en'))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['buyer-coupons'] })
  })
})
