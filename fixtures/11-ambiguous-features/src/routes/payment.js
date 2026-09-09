import express from 'express';

const router = express.Router();

router.post('/api/payment/charge', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;
