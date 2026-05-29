"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSiws } from "@/components/auth/siws-provider";

// Dumb trigger. All sign-in logic lives in SiwsProvider, so this renders in as
// many places as we like (header + landing CTAs) with no risk of duplicate
// prompts and consistent shared state across every instance.
export function SiwsButton({ compact = false }: { compact?: boolean }) {
  const { signing, connecting, connected, connectOrSignIn } = useSiws();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return compact ? (
      <div className="h-9 w-32 rounded-lg bg-white/5 animate-pulse" />
    ) : (
      <div className="flex flex-col gap-3 items-center min-h-[80px] justify-center">
        <div className="h-12 w-56 rounded-md bg-white/5 animate-pulse" />
      </div>
    );
  }

  const label = signing
    ? "Signing…"
    : connecting
      ? "Connecting…"
      : connected
        ? compact
          ? "Sign in"
          : "Sign in with Solana"
        : "Connect wallet";

  return (
    <Button
      onClick={connectOrSignIn}
      disabled={signing || connecting}
      size={compact ? "md" : "lg"}
      className={compact ? "gradient-btn" : "min-w-[240px] gradient-btn"}
    >
      {label}
    </Button>
  );
}
