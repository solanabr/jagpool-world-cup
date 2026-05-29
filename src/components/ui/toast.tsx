"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Toast({
  message,
  onDismiss,
  duration = 4000,
  variant = "error",
}: {
  message: string;
  onDismiss: () => void;
  duration?: number;
  variant?: "error" | "success";
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  if (!mounted) return null;

  const cls =
    variant === "error"
      ? "border-red-500/25 bg-red-500/10 text-red-300"
      : "border-emerald-500/25 bg-emerald-500/10 text-[#129D49]";

  return createPortal(
    <div
      role="alert"
      className={`fixed top-5 right-5 z-9999 flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-2xl shadow-black/40 max-w-sm w-[calc(100vw-2.5rem)] sm:w-auto animate-slide-up ${cls}`}
    >
      <span className="text-sm leading-snug flex-1">{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
