/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { SupportCompensation } from './SupportDetailPage'

const mocks = vi.hoisted(() => ({ list: vi.fn(), link: vi.fn(), permissions: ['support.read', 'support.write'] }))
vi.mock('../api', () => ({ listCompensationRefunds: mocks.list, linkSupportCompensation: mocks.link, getSupport: vi.fn(), decideSupport: vi.fn(), replySupport: vi.fn(), updateSupportStatus: vi.fn() }))
vi.mock('#/features/admin/access/useAdminAccess', () => ({ useAdminAccess: () => ({ data: { permissions: mocks.permissions } }) }))
vi.mock('#/i18n/client', () => ({ useTranslations: () => (key: string) => key, useFormatters: () => ({ currency: (amount: string, currency: string) => `${currency} ${amount}`, number: (amount: string) => amount }) }))
vi.mock('#/i18n/navigation', () => ({ useLocalePath: () => (path: string) => `/en${path}` }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }))

const processingId = '11111111-1111-4111-8111-111111111111'
const successfulId = '22222222-2222-4222-8222-222222222222'
const refunds = [{ id: processingId, status: 'PROCESSING', amount: '9007199254740993', currency: 'THB' }, { id: successfulId, status: 'SUCCESS', amount: '1500', currency: 'THB' }, { id: 'failed', status: 'FAILED', amount: '1', currency: 'THB' }]
function ticket(status: 'RESOLVED_BUYER' | 'COMPENSATED' = 'RESOLVED_BUYER', refundId: string | null = null): Parameters<typeof SupportCompensation>[0]['ticket'] { return { id: 'ticket', userId: 'buyer', orderId: 'order', shopId: 'shop', subject: 'Appeal', status: 'RESOLVED', shop: { id: 'shop', name: 'Shop' }, createdAt: new Date(), updatedAt: new Date(), closedAt: null, priority: 'NORMAL', category: null, disputes: [{ id: 'dispute', returnRequestId: 'return', status, reason: 'Appealed items', decision: 'Buyer wins', resolvedAt: new Date(), createdAt: new Date(), refundId, compensation: refundId ? '9007199254740993' : null }] } }
function view(value = ticket()) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><SupportCompensation ticket={value} /></QueryClientProvider>) }
beforeEach(() => { vi.clearAllMocks(); mocks.permissions = ['support.read', 'support.write']; mocks.list.mockResolvedValue(refunds); mocks.link.mockResolvedValue(ticket()) })
afterEach(cleanup)

describe('support frozen compensation plans', () => {
  it('shows exact server amounts and links only a selected processing plan once', async () => {
    let finish = () => {}; mocks.link.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    view(); const select = await screen.findByLabelText('support.integration.selectPlan'); await waitFor(() => expect(screen.queryByRole('option', { name: /9007199254740993/ })).not.toBeNull())
    expect(screen.queryByRole('option', { name: /failed/ })).toBeNull(); expect(screen.getByRole('button', { name: 'support.integration.linkPlan' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(select, { target: { value: processingId } }); expect(screen.getByText(/support.integration.processingPlan/)).toBeTruthy()
    const form = screen.getByRole('button', { name: 'support.integration.linkPlan' }).closest('form'); if (!form) throw new Error('Compensation form missing')
    fireEvent.submit(form); fireEvent.submit(form); await waitFor(() => expect(mocks.link).toHaveBeenCalledTimes(1)); expect(mocks.link).toHaveBeenCalledWith('ticket', processingId); finish()
  })
  it('distinguishes a linked pending refund from completed compensation', async () => { const rendered = view(ticket('RESOLVED_BUYER', processingId)); await screen.findByText('support.integration.compensationPending'); expect(screen.queryByLabelText('support.integration.selectPlan')).toBeNull(); rendered.unmount(); view(ticket('COMPENSATED', successfulId)); await screen.findByText('support.integration.compensated'); expect(screen.getByRole('link', { name: 'support.integration.managePlans' }).getAttribute('href')).toBe('/en/admin/refunds') })
  it('keeps the financial writer hidden for read-only support administrators', async () => { mocks.permissions = ['support.read']; view(); await waitFor(() => expect(mocks.list).toHaveBeenCalled()); expect(screen.queryByRole('button', { name: 'support.integration.linkPlan' })).toBeNull(); expect(mocks.link).not.toHaveBeenCalled() })
  it('retains the selected frozen plan after a failed link', async () => { mocks.link.mockRejectedValue(new Error('Scope mismatch')); view(); const select = await screen.findByLabelText('support.integration.selectPlan'); await waitFor(() => expect(screen.queryByRole('option', { name: /9007199254740993/ })).not.toBeNull()); fireEvent.change(select, { target: { value: processingId } }); fireEvent.click(screen.getByRole('button', { name: 'support.integration.linkPlan' })); await waitFor(() => expect(mocks.link).toHaveBeenCalled()); await screen.findByText('support.error'); if (!(select instanceof HTMLSelectElement)) throw new Error('Refund select missing'); expect(select.value).toBe(processingId) })
})
