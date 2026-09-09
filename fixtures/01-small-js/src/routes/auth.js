import express from 'express';
import { loginUser } from '../services/auth.js';

const router = express.Router();

router.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  try {
    const session = loginUser(email, password);
    res.json(session);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

export default router;
