import { PaymentService } from '../src/services/payment.js';

describe('Payments', () => {
  it('processes valid UPI payments', async () => {
    const service = new PaymentService();
    const res = await service.processUPIPayment('test@upi', 500);
    expect(res.status).toBe('SUCCESS');
  });

  it('verifies UPI transaction response', async () => {
    const service = new PaymentService();
    const verified = await service.verifyUPIResponse('txn_12345');
    expect(verified).toBe(true);
  });
});
