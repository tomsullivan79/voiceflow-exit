// components/RateLimitToast.tsx
"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  message: string;
  onClose: () => void;
  durationMs?: number;
};

export default function RateLimitToast({ open, message, onClose, durationMs = 3000 }: Props) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, onClose, durationMs]);

  if (!open) return null;

  return (
    <div className="wt-toast" role="status" aria-live="polite">
      <div className="wt-toast-inner">
        <strong>Slow down</strong>
        <span className="wt-toast-message">{message}</span>
      </div>
      <style jsx>{`
        .wt-toast {
          position: fixed;
          left: 50%;
          bottom: 20px;
          transform: translateX(-50%);
          z-index: 1000;
        }
        .wt-toast-inner {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 12px;
          background: #111827; /* neutral-900 */
          color: #f9fafb;      /* neutral-50 */
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 6px 24px rgba(0,0,0,0.25);
          font-size: 14px;
        }
        .wt-toast-message { opacity: 0.95; }
        @media (prefers-color-scheme: light) {
          .wt-toast-inner {
            background: #111827;
            color: #f9fafb;
            border-color: rgba(255,255,255,0.12);
          }
        }
      `}</style>
    </div>
  );
}
