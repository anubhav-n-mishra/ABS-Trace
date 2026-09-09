import { paymentService } from '../../services/paymentService.js';

export class CheckoutManager {
  async completeCheckout(orderId, amount, token) {
    const charge = paymentService.processCharge(amount, token);
    return { orderId, charge, completed: true };
  }
}
