export class OrderService {
  async createOrder(customerId, items) {
    const total = items.reduce((acc, item) => acc + item.price, 0);
    return {
      orderId: 'ord_' + Date.now(),
      customerId,
      total,
      status: 'PENDING'
    };
  }

  async cancelOrder(orderId) {
    return { orderId, status: 'CANCELLED' };
  }
}
