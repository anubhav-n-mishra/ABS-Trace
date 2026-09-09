import { Router, Request, Response } from 'express';
import { CheckoutService } from '../services/checkoutService.js';

const router = Router();
const checkoutService = new CheckoutService();

router.post('/api/checkout/process', async (req: Request, res: Response) => {
  const { userId, items } = req.body;
  const result = await checkoutService.processCheckout(userId, items);
  res.json(result);
});

export default router;
