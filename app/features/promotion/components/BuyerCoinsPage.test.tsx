// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import enMessages from '../../../../messages/en.json'
import { I18nProvider } from '#/i18n/client'
import { BuyerCoinsPage } from './BuyerCoinsPage'
import { useBuyerCoinHistory } from '../hooks/useBuyerCoins'

vi.mock('../hooks/useBuyerCoins', () => ({ useBuyerCoinHistory: vi.fn() }))
vi.mock('#/components/BuyerShell', () => ({ BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header> }))

describe('BuyerCoinsPage', () => {
  afterEach(cleanup)

  it('explains outstanding cashback debt to the buyer', () => {
    vi.mocked(useBuyerCoinHistory).mockReturnValue({
      data: { pages: [{ balance: 0, pendingBalance: 0, debtBalance: 3, lifetimeEarned: 5, lifetimeSpent: 0, entries: [], nextCursor: null }] },
      isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false,
      refetch: vi.fn(), fetchNextPage: vi.fn(),
    } as never)

    render(<I18nProvider locale="en" messages={enMessages} fallbackMessages={enMessages}><BuyerCoinsPage /></I18nProvider>)

    expect(screen.getByText(/Outstanding coin debt: 3/)).toBeTruthy()
    expect(screen.getByText('Future cashback will repay this balance before becoming available.')).toBeTruthy()
  })
})
