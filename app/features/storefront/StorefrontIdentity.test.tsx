/** @vitest-environment jsdom */
import { render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StorefrontIdentity } from './StorefrontIdentity'

const base = {
  id: 'shop-1', name: 'Demo Shop', slug: 'demo-shop', description: 'Description', logoUrl: null, coverUrl: null,
  ratingAverage: 4.5, ratingCount: 12, followerCount: 34, productCount: 56, chatEnabled: true,
  shippingPolicy: null, returnPolicy: null, updatedAt: new Date(), viewer: { isOwner: false },
}
const labels = { products: 'products', reviews: 'reviews', followers: 'followers', chat: 'Chat available', manage: 'Manage shop', logoAlt: 'Shop logo' }

describe('StorefrontIdentity', () => {
  it.each([
    ['cover and logo', '/cover.jpg', '/logo.jpg', 2],
    ['cover only', '/cover.jpg', null, 1],
    ['logo only', null, '/logo.jpg', 1],
    ['neither', null, null, 0],
  ])('renders the %s media state', (_name, coverUrl, logoUrl, imageCount) => {
    const { container } = render(<StorefrontIdentity shop={{ ...base, coverUrl, logoUrl }} locale="en" labels={labels} />)
    expect(container.querySelectorAll('img')).toHaveLength(imageCount)
    expect(within(container).getByText('56 products')).toBeTruthy()
  })

  it('shows management only to the owner and hides buyer chat', () => {
    const { container } = render(<StorefrontIdentity shop={{ ...base, viewer: { isOwner: true } }} locale="th" labels={labels} />)
    expect(within(container).getByRole('link', { name: 'Manage shop' }).getAttribute('href')).toBe('/th/seller?shopId=shop-1')
    expect(within(container).queryByText('Chat available')).toBeNull()
  })
})
