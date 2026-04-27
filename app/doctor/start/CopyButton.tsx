'use client';

import { useState } from 'react';

export default function CopyButton({ text, label = 'Copy Link' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that deny clipboard access
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="text-xs font-semibold text-teal-600 hover:text-teal-700 border border-teal-200 bg-teal-50 rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors"
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}
