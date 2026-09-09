export class CheckoutService {
  async processCheckout(userId: string, cartItems: Array<{ id: string; price: number }>) {
    const total = cartItems.reduce((acc, item) => acc + item.price, 0);
    return {
      checkoutId: 'chk_' + Date.now(),
      userId,
      total,
      requiresPayment: true
    };
  }
}
