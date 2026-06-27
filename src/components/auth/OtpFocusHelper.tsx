'use client';

import { useEffect } from 'react';

export default function OtpFocusHelper() {
  useEffect(() => {
    const selector = 'input[autocomplete="one-time-code"]';

    const existing = document.querySelector<HTMLInputElement>(selector);
    if (existing) {
      existing.focus();
      return;
    }

    const observer = new MutationObserver(() => {
      const input = document.querySelector<HTMLInputElement>(selector);
      if (input) {
        observer.disconnect();
        input.focus();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
