export class LegacyPaymentProcessor {
  processOldTransaction(amount) {
    console.log(`Processing legacy payment: ${amount}`);
    return { success: true, ref: 'leg_' + Math.random() };
  }
}
