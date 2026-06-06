"use client";

import { useEffect, useState } from "react";

interface HeaderMetricsProps {
  outputAmount?: string;
  isCalculatingRewards?: boolean;
}

export function HeaderMetrics({ outputAmount, isCalculatingRewards = false }: HeaderMetricsProps) {
  const [apy, setApy] = useState<number | null>(null);
  const [estRewards, setEstRewards] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const formatRewards = (value: number): string => {
    if (value === 0) return "0";
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    if (value >= 1) return value.toFixed(2);
    return value.toFixed(6);
  };

  useEffect(() => {
    if (apy && outputAmount && parseFloat(outputAmount) > 0) {
      setEstRewards((apy / 100) * parseFloat(outputAmount));
    } else {
      setEstRewards(0);
    }
  }, [apy, outputAmount]);

  useEffect(() => {
    const fetchApy = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/jagsol/apy", {
          cache: "no-store",
          redirect: "manual",
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (data.apy) setApy(data.apy);
      } catch {
      } finally {
        setIsLoading(false);
      }
    };
    fetchApy();
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4 sm:gap-0">
      <div className="flex flex-col sm:w-1/2 sm:border-r sm:border-white/8 sm:pr-6">
        <span className="text-sm text-foreground/40 mb-1">JagSOL APY</span>
        {isLoading ? (
          <div className="animate-pulse bg-white/8 h-7 w-16 rounded" />
        ) : (
          <span className="text-xl font-bold text-[#fbbf24]">
            {apy != null ? `${apy.toFixed(2)}%` : "—"}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:w-1/2 sm:pl-6">
        <span className="text-sm text-foreground/40 mb-1">Est. rewards / year</span>
        {isLoading ? (
          <div className="animate-pulse bg-white/8 h-7 w-20 rounded" />
        ) : isCalculatingRewards && outputAmount && parseFloat(outputAmount) > 0 ? (
          <div className="animate-pulse bg-white/8 h-7 w-20 rounded" />
        ) : (
          <span className="text-xl font-bold text-[#129D49]">
            {formatRewards(estRewards)} JagSOL
          </span>
        )}
      </div>
    </div>
  );
}
