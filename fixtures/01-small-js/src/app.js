import express from 'express';
import paymentRouter from './routes/payment.js';
import authRouter from './routes/auth.js';

const app = express();
app.use(express.json());

app.use(paymentRouter);
app.use(authRouter);

export default app;
