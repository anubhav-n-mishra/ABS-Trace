export class SharedPaymentService {
  processCharge(amount, token) {
    return { chargeId: 'ch_' + Date.now(), amount, status: 'PAID' };
  }

  processRefund(chargeId, amount) {
    return { refundId: 'rf_' + Date.now(), chargeId, amount, status: 'REFUNDED' };
  }
}

export const paymentService = new SharedPaymentService();
