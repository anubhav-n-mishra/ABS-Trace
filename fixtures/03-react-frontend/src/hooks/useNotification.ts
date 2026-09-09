import { useState, useCallback } from 'react';

export function useNotification() {
  const [messages, setMessages] = useState<string[]>([]);

  const notify = useCallback((msg: string) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  return { messages, notify };
}
