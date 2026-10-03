/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SellerFinancePage, SellerPromotionsPage } from './SellerManagePages'

const { createCoupon, createPayout } = vi.hoisted(() => ({ createCoupon: vi.fn(), createPayout: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('#/i18n/client', () => ({ useTranslations: () => (key: string) => key, useFormatters: () => ({ date: () => '', currency: () => '' }) }))
vi.mock('#/i18n/navigation', () => ({ useLocalePath: () => (path: string) => path }))
vi.mock('./SellerShell', () => ({ SellerPageHeader: () => <div /> }))
vi.mock('#/components/ui/data-table', () => ({ DataTable: () => <div /> }))
vi.mock('#/components/ui/select', () => ({
  Select: ({ name, value, defaultValue, onValueChange, children }: { name?: string; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; children: React.ReactNode }) =>
    <select name={name} value={value} defaultValue={defaultValue} onChange={event => onValueChange?.(event.target.value)}>{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}))
vi.mock('../hooks/useSellerManage', () => ({
  useSellerCoupons: () => ({ data: [], isLoading: false }),
  useCreateSellerCoupon: () => ({ mutate: createCoupon, isPending: false }),
  useUpdateSellerCoupon: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteSellerCoupon: () => ({ mutate: vi.fn(), isPending: false }),
  useSellerFlashSales: () => ({ data: [], isLoading: false }),
  useSellerProducts: () => ({ data: { data: [] } }),
  useEnrollSellerFlashSaleItem: () => ({ mutate: vi.fn() }),
  useUpdateSellerFlashSaleItem: () => ({ mutate: vi.fn() }),
  useDeleteSellerFlashSaleItem: () => ({ mutate: vi.fn() }),
  useSellerWallet: () => ({ data: null }),
  useSellerTransactions: () => ({ data: { items: [] } }),
  useSellerPayouts: () => ({ data: [] }),
  useCreateSellerPayout: () => ({ mutate: createPayout, isPending: false }),
}))

describe('seller coupon numeric form', () => {
  afterEach(() => { cleanup(); createCoupon.mockClear(); createPayout.mockClear() })
  it.each([['percent', '12.50', { discountPercentBps: 1250, discountValueCents: null }],
    ['fixed', '0.29', { discountValueCents: 29, discountPercentBps: null }],
    ['fixed', '1.15', { discountValueCents: 115, discountPercentBps: null }],
    ['fixed', '1.000', { discountValueCents: 100, discountPercentBps: null }],
    ['fixed', '1e3', { discountValueCents: 100000, discountPercentBps: null }],
    ['fixed', '90071992547409.90', { discountValueCents: 9007199254740990, discountPercentBps: null }],
    ['fixed', '90071992547409.91', { discountValueCents: 9007199254740991, discountPercentBps: null }]] as const)(
    'submits the entered %s value in the correct integer unit', (kind, amount, expected) => {
      const { container } = render(<SellerPromotionsPage />)
      fireEvent.change(screen.getByPlaceholderText('seller.manage.pages.promotions.code'), { target: { value: 'SAVE' } })
      fireEvent.change(container.querySelector('select[name="discountType"]')!, { target: { value: kind } })
      fireEvent.change(container.querySelector('input[name="amount"]')!, { target: { value: amount } })
      fireEvent.click(screen.getByRole('button', { name: 'seller.manage.pages.promotions.create' }))
      expect(createCoupon).toHaveBeenCalledWith(expect.objectContaining({ code: 'SAVE', discountType: kind, ...expected }))
    },
  )
  it.each([['0.29', 29], ['1.15', 115], ['1.000', 100], ['1e3', 100000], ['90071992547409.90', 9007199254740990], ['90071992547409.91', 9007199254740991], ['90071992547409.92', Number.NaN]] as const)(
    'submits payout decimal text %s as exact minor units', (amount, expected) => {
      const { container } = render(<SellerFinancePage />)
      fireEvent.change(container.querySelector('input[name="amount"]')!, { target: { value: amount } })
      fireEvent.submit(container.querySelector('form')!)
      expect(createPayout).toHaveBeenCalledWith(expected)
    },
  )
})
