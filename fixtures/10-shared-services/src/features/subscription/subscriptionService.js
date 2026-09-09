import { paymentService } from '../../services/paymentService.js';

export class SubscriptionManager {
  async renewSubscription(subId, monthlyFee, token) {
    const charge = paymentService.processCharge(monthlyFee, token);
    return { subId, charge, renewedUntil: Date.now() + 30 * 86400000 };
  }
}
