import express from 'express';
import { SharedAuthUser } from '@monorepo/shared-types';

const app = express();

app.get('/api/auth/profile', (req, res) => {
  const user: SharedAuthUser = { id: 'usr_abc', role: 'admin' };
  res.json(user);
});

export default app;
