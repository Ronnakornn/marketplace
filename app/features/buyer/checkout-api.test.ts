import { describe, expect, it, vi } from 'vitest';

const requests = vi.hoisted(() => ({ checkout: vi.fn(), quote: vi.fn() }));
vi.mock('#/lib/eden', () => ({ api: { api: { checkout: { post: requests.checkout, quote: { post: requests.quote } } } } }));
import { createCheckout, quoteCheckout } from './api';

describe('checkout API errors', () => {
  it('preserves the readable stock failure, status and code from the server', async () => {
    requests.checkout.mockResolvedValue({ data: null, error: { status: 409, value: { error: { message: 'Requested quantity exceeds available stock', code: 'INSUFFICIENT_STOCK', details: { availableQuantity: 0 } } } } });
    await expect(createCheckout({ cartId: 'cart', cartItemIds: ['item'], addressId: 'address', paymentMethod: 'card' })).rejects.toMatchObject({ message: 'Requested quantity exceeds available stock', status: 409, code: 'INSUFFICIENT_STOCK', details: { availableQuantity: 0 } });
  });

  it('preserves unauthorized quote status for error handling', async () => {
    requests.quote.mockResolvedValue({ data: null, error: { status: 401, value: { error: { message: 'Authentication required', code: 'UNAUTHORIZED' } } } });
    await expect(quoteCheckout({ cartId: 'cart', cartItemIds: ['item'] })).rejects.toMatchObject({ message: 'Authentication required', status: 401, code: 'UNAUTHORIZED' });
  });
});
