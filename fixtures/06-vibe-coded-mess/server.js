// vibe-coded all in one spaghetti
import express from 'express';

const app = express();
app.use(express.json());

let users_db = [];
let payments_db = [];
let current_session = null;

// inline messy auth function
export function do_login_thing(u, p) {
  if (u === 'admin' && p === 'pass') {
    current_session = { user: u, time: Date.now() };
    return { ok: true, session: current_session };
  }
  return { ok: false };
}

// messy inline payment processor
export async function pay_now_fast(amt, upi) {
  const p_val = Number(amt);
  if (p_val <= 0 || !upi) {
    throw new Error('bad payment args');
  }
  const rec = { id: Math.random().toString(), amt: p_val, upi_id: upi, done: true };
  payments_db.push(rec);
  return rec;
}

// routes attached directly with inline logic
app.post('/api/auth/login_quick', (req, res) => {
  const res_data = do_login_thing(req.body.u, req.body.p);
  res.json(res_data);
});

app.post('/api/payment/pay_instant', async (req, res) => {
  try {
    const out = await pay_now_fast(req.body.amt, req.body.upi);
    res.json(out);
  } catch (e) {
    res.status(500).json({ err: e.message });
  }
});

app.get('/api/payment/list_all', (req, res) => {
  res.json(payments_db);
});

export default app;
