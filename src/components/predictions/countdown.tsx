"use client";

import { useEffect, useState } from "react";

export function Countdown({ target, label }: { target: string; label?: string }) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const targetTime = new Date(target).getTime();
  const diff = Math.max(0, targetTime - now);

  if (!mounted) {
    return (
      <div className="flex gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-14 h-16 bg-white/5 animate-pulse rounded-xl" />
            <div className="h-2.5 w-5 bg-white/5 animate-pulse rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (diff === 0) {
    return <div className="text-[#129D49] font-bold text-lg">{label ?? "Started"}</div>;
  }

  const days    = Math.floor(diff / 86_400_000);
  const hours   = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000)  / 60_000);
  const seconds = Math.floor((diff % 60_000)     / 1000);

  return (
    <div className="flex gap-1.5 sm:gap-2.5">
      <FlipTile value={days}    unit="D" />
      <FlipTile value={hours}   unit="H" />
      <FlipTile value={minutes} unit="M" />
      <FlipTile value={seconds} unit="S" />
    </div>
  );
}

function FlipTile({ value, unit }: { value: number; unit: string }) {
  const formatted = value.toString().padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2">
      <div style={{ perspective: "600px" }} className="w-11 h-12 sm:w-14 sm:h-16">
        <div
          key={formatted}
          className="relative w-full h-full rounded-xl overflow-hidden"
          style={{ animation: "tile-flip 0.32s ease-out" }}
        >
          <div className="absolute inset-0 bg-[#161616] border border-white/10 rounded-xl" />
          <div className="absolute inset-x-0 top-0 h-1/2 bg-white/[0.03] rounded-t-xl" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-black/70 z-10" />
          <div className="relative z-20 flex items-center justify-center h-full">
            <span className="text-2xl sm:text-3xl font-black gradient-text tabular-nums leading-none tracking-tight">
              {formatted}
            </span>
          </div>
        </div>
      </div>
      <span className="text-[9px] sm:text-[10px] font-bold text-foreground/35 uppercase tracking-widest">{unit}</span>
    </div>
  );
}
