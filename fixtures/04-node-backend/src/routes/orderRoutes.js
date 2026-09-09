import express from 'express';
import { OrderService } from '../services/orderService.js';

const router = express.Router();
const orderService = new OrderService();

router.post('/api/order/create', async (req, res) => {
  const { customerId, items } = req.body;
  const order = await orderService.createOrder(customerId, items);
  res.json(order);
});

router.post('/api/order/cancel', async (req, res) => {
  const { orderId } = req.body;
  const result = await orderService.cancelOrder(orderId);
  res.json(result);
});

export default router;
