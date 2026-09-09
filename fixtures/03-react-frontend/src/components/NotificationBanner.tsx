import React from 'react';
import { useNotification } from '../hooks/useNotification.js';

export function NotificationBanner() {
  const { messages } = useNotification();
  if (messages.length === 0) return null;

  return (
    <div className="notifications-container">
      {messages.map((m, i) => (
        <div key={i} className="notification-alert">{m}</div>
      ))}
    </div>
  );
}
