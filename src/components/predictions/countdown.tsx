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
      <div className="flex gap-4 items-end">
        <div className="h-12 w-48 bg-white/5 animate-pulse rounded" />
      </div>
    );
  }

  if (diff === 0) {
    return <div className="text-jagpool-primary font-medium">{label ?? "Started"}</div>;
  }

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  return (
    <div className="flex gap-4">
      <Cell value={days} unit="d" />
      <Cell value={hours} unit="h" />
      <Cell value={minutes} unit="m" />
      <Cell value={seconds} unit="s" />
    </div>
  );
}

function Cell({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold tabular-nums text-jagpool-primary">
        {value.toString().padStart(2, "0")}
      </div>
      <div className="text-xs text-foreground/50 uppercase">{unit}</div>
    </div>
  );
}
