import React from 'react';

export function CheckoutButton({ onCheckout }: { onCheckout: () => void }) {
  return (
    <button className="btn-checkout" onClick={onCheckout}>
      Proceed to Checkout
    </button>
  );
}
