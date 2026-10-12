/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AdminProductModerationDetail } from './AdminProductModerationDetail'

const mocks = vi.hoisted(() => ({ review: vi.fn(), suspend: vi.fn(), restore: vi.fn(), permissions: ['catalog.read', 'catalog.write'] }))
const product = { id: 'product-1', title: 'Review product', slug: 'review-product', status: 'PENDING_REVIEW', description: 'Description', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-12T10:00:00.000Z', images: [], variants: [], attributes: [], options: [], category: null, shop: { id: 'shop-1', name: 'Shop', slug: 'shop', status: 'ACTIVE' }, moderationCase: null }
vi.mock('#/features/catalog', () => ({ useAdminCatalogProductDetail: () => ({ data: product, isLoading: false, error: null, refetch: vi.fn() }) }))
vi.mock('#/features/admin/access/useAdminAccess', () => ({ useAdminAccess: () => ({ data: { permissions: mocks.permissions } }) }))
vi.mock('#/features/admin/operations/useCatalogPublicationReview', () => ({ useCatalogPublicationReview: () => ({ mutate: mocks.review, isPending: false, error: null }) }))
vi.mock('../hooks/useAdminOperations', () => ({ useSuspendCatalogProduct: () => ({ mutate: mocks.suspend, isPending: false, error: null }), useRestoreCatalogProduct: () => ({ mutate: mocks.restore, isPending: false, error: null }) }))
vi.mock('#/i18n/client', () => ({ useTranslations: () => (key: string) => key, useFormatters: () => ({ currency: (amount: string) => amount, date: (date: string) => date }) }))
vi.mock('#/i18n/navigation', () => ({ useLocalePath: () => (path: string) => `/en${path}` }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }))

beforeEach(() => { vi.clearAllMocks(); mocks.permissions = ['catalog.read', 'catalog.write']; product.status = 'PENDING_REVIEW' })
afterEach(cleanup)
describe('catalog publication review controls', () => {
  it('requires a reason and sends the current saved revision exactly once', () => { render(<AdminProductModerationDetail productId="product-1" />); fireEvent.click(screen.getByRole('button', { name: 'admin.integration.approval.approve' })); const button = screen.getByRole('button', { name: 'admin.integration.approval.confirmApprove' }); expect(button.hasAttribute('disabled')).toBe(true); fireEvent.change(screen.getByLabelText('admin.integration.approval.reason'), { target: { value: 'Reviewed contents' } }); const form = button.closest('form'); if (!form) throw new Error('Review form missing'); fireEvent.submit(form); fireEvent.submit(form); expect(mocks.review).toHaveBeenCalledTimes(1); expect(mocks.review).toHaveBeenCalledWith({ productId: 'product-1', input: { decision: 'APPROVE', reason: 'Reviewed contents', expectedUpdatedAt: '2026-10-12T10:00:00.000Z' } }, expect.objectContaining({ onSuccess: expect.any(Function), onSettled: expect.any(Function) })) })
  it('uses the explicit rejection decision with the administrator reason', () => { render(<AdminProductModerationDetail productId="product-1" />); fireEvent.click(screen.getByRole('button', { name: 'admin.integration.approval.reject' })); fireEvent.change(screen.getByLabelText('admin.integration.approval.reason'), { target: { value: 'Missing accurate product description' } }); fireEvent.click(screen.getByRole('button', { name: 'admin.integration.approval.confirmReject' })); expect(mocks.review).toHaveBeenCalledWith(expect.objectContaining({ input: { decision: 'REJECT', reason: 'Missing accurate product description', expectedUpdatedAt: '2026-10-12T10:00:00.000Z' } }), expect.anything()) })
  it('hides approval and rejection for a read-only administrator and other product states', () => { mocks.permissions = ['catalog.read']; const view = render(<AdminProductModerationDetail productId="product-1" />); expect(screen.queryByRole('button', { name: 'admin.integration.approval.approve' })).toBeNull(); view.unmount(); mocks.permissions = ['catalog.write']; product.status = 'ACTIVE'; render(<AdminProductModerationDetail productId="product-1" />); expect(screen.queryByRole('button', { name: 'admin.integration.approval.approve' })).toBeNull(); expect(mocks.review).not.toHaveBeenCalled() })
})
