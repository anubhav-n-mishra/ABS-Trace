import { CheckoutService } from '../src/services/checkoutService.js';

describe('Checkout Flow', () => {
  it('calculates checkout totals correctly', async () => {
    const service = new CheckoutService();
    const res = await service.processCheckout('usr_1', [{ id: 'item_1', price: 50 }]);
    expect(res.total).toBe(50);
  });
});
