// Payment business logic service
export class PaymentService {
  async processUPIPayment(upiId, amount) {
    if (!upiId || !upiId.includes('@')) {
      throw new Error('Invalid UPI identifier');
    }
    console.log(`Processing payment of ${amount} to ${upiId}`);
    return {
      transactionId: 'txn_' + Date.now(),
      status: 'SUCCESS'
    };
  }

  async verifyUPIResponse(transactionId) {
    return transactionId.startsWith('txn_');
  }

  async refundUPIPayment(transactionId, amount) {
    console.log(`Refunding ${amount} for ${transactionId}`);
    return { refundId: 'ref_' + Date.now(), status: 'REFUNDED' };
  }
}

export const defaultPaymentService = new PaymentService();

export function calculateConvenienceFee(amount) {
  return amount * 0.025;
}
