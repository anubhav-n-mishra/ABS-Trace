import express from 'express';
import { defaultPaymentService } from '../services/payment.js';

const router = express.Router();

router.post('/api/payment/upi', async (req, res) => {
  const { upiId, amount } = req.body;
  try {
    const result = await defaultPaymentService.processUPIPayment(upiId, amount);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/api/payment/status', async (req, res) => {
  const { txnId } = req.query;
  const verified = await defaultPaymentService.verifyUPIResponse(txnId);
  res.json({ verified });
});

export default router;
