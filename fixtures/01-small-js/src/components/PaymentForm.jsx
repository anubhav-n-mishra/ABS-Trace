import React, { useState } from 'react';
import { defaultPaymentService } from '../services/payment.js';

export function PaymentForm({ onComplete }) {
  const [upiId, setUpiId] = useState('');
  const [amount, setAmount] = useState(100);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await defaultPaymentService.processUPIPayment(upiId, amount);
    if (onComplete) onComplete(res);
  };

  return (
    <form className="payment-form" onSubmit={handleSubmit}>
      <h2>UPI Payment</h2>
      <input
        type="text"
        placeholder="user@upi"
        value={upiId}
        onChange={(e) => setUpiId(e.target.value)}
      />
      <button type="submit">Pay Now</button>
    </form>
  );
}
