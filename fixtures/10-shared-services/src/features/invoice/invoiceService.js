import { paymentService } from '../../services/paymentService.js';

export class InvoiceManager {
  async payInvoice(invoiceId, totalAmount, token) {
    const charge = paymentService.processCharge(totalAmount, token);
    return { invoiceId, charge, paid: true };
  }
}
