"use client";

import { CheckCircle2, Copy, ExternalLink, X } from "lucide-react";
import toast from "react-hot-toast";

function SwapToast({ sig }: { sig: string }) {
  const copy = () => {
    navigator.clipboard.writeText(sig);
    toast.custom(
      <div className="flex items-center gap-2 bg-[#111] border border-white/10 rounded-xl px-3 py-2 shadow">
        <CheckCircle2 className="w-4 h-4 text-[#129D49]" />
        <span className="text-sm text-foreground">Signature copied!</span>
      </div>,
      { duration: 1500 }
    );
  };

  return (
    <div className="rounded-xl shadow-lg bg-[#111] border border-white/10 w-full max-w-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#129D49]" />
          <div className="flex flex-col">
            <span className="font-semibold text-foreground text-sm">Swapped!</span>
            <span className="text-xs text-foreground/40">Transaction completed</span>
          </div>
        </div>
        <button onClick={() => toast.dismiss()} className="text-foreground/40 hover:text-foreground/70 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3">
        <span className="text-xs text-foreground/40 block mb-1">Transaction Hash</span>
        <div className="flex items-center justify-between bg-white/5 rounded-lg py-2 px-3">
          <span className="text-xs font-mono truncate max-w-44 text-foreground/60">
            {sig.slice(0, 10)}...{sig.slice(-10)}
          </span>
          <button onClick={copy} className="p-1 hover:bg-white/8 rounded transition-colors">
            <Copy className="w-4 h-4 text-foreground/40" />
          </button>
        </div>
      </div>

      <div className="flex border-t border-white/8 divide-x divide-white/8">
        <button
          onClick={copy}
          className="flex justify-center items-center gap-2 flex-1 px-3 py-2 hover:bg-white/5 text-xs text-foreground/50 transition-colors"
        >
          <Copy className="w-4 h-4" />
          Copy Signature
        </button>
        <a
          href={`https://solscan.io/tx/${sig}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 justify-center flex-1 px-3 py-2 hover:bg-white/5 text-xs text-foreground/50 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          SolScan
        </a>
      </div>
    </div>
  );
}

export function showSwapToast(sig: string) {
  toast.custom(<SwapToast sig={sig} />, { duration: Infinity });
}
