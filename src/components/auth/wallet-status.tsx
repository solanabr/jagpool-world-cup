"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function WalletStatus({
  username,
  walletAddress,
  validatorName,
}: {
  username: string | null;
  walletAddress: string;
  validatorName?: string | null;
}) {
  const { disconnect } = useWallet();
  const router = useRouter();

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    await disconnect();
    router.push("/");
    router.refresh();
  }, [disconnect, router]);

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex flex-col text-right">
        <span className="text-foreground">
          {username ?? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`}
        </span>
        {validatorName ? (
          <span className="text-foreground/50 text-xs">{validatorName}</span>
        ) : null}
      </div>
      <Button onClick={handleSignOut} variant="ghost" size="sm">
        Sign out
      </Button>
    </div>
  );
}
