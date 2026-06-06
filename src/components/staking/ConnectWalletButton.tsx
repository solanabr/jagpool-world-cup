"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import toast from "react-hot-toast";
import { getConnection } from "@/lib/solana/connection";
import { swapJagsolFromJupiter } from "@/lib/staking/jupiter";
import { showSwapToast } from "./ShowSwapToast";
import { XCircle, Loader2, Coins, Wallet, Fingerprint } from "lucide-react";
import { Token } from "@/lib/staking/tokens";

interface ConnectWalletButtonProps {
  amount: number;
  selectedToken?: Token | null;
  targetToken?: Token | null;
  blocked?: boolean;
  onStakeComplete?: () => void;
}

export function ConnectWalletButton({
  amount,
  selectedToken,
  targetToken,
  blocked = false,
  onStakeComplete,
}: ConnectWalletButtonProps) {
  const { publicKey, connected, connecting, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const ready = useMemo(() => {
    return (
      !!publicKey &&
      !!connected &&
      !!selectedToken?.address &&
      !!targetToken?.address &&
      amount > 0 &&
      Number.isFinite(amount) &&
      !blocked
    );
  }, [publicKey, connected, selectedToken, targetToken, amount, blocked]);

  const showErrorToast = (message: string) => {
    toast.custom(
      <div className="flex items-center gap-2 bg-[#111] border border-white/10 rounded-xl px-3 py-2 shadow">
        <XCircle className="w-4 h-4 text-red-400" />
        <span className="text-sm text-foreground">{message}</span>
      </div>,
      { duration: 2000 }
    );
  };

  const handleStake = async () => {
    if (!publicKey || !sendTransaction) { showErrorToast("Please connect your wallet."); return; }
    if (!(selectedToken?.address && targetToken?.address)) { showErrorToast("Select both tokens before swapping."); return; }
    if (!(amount > 0 && Number.isFinite(amount))) { showErrorToast("Enter a valid amount."); return; }
    if (blocked) { showErrorToast("Amount too small for swap."); return; }

    try {
      setIsProcessing(true);
      const scale = 10 ** selectedToken.decimals;
      const lamports = Math.round(amount * scale);

      const quoteRes = await fetch(
        `/api/jagsol/quote?inputMint=${selectedToken.address}&outputMint=${targetToken.address}&amount=${lamports}`
      );
      if (!quoteRes.ok) throw new Error("Failed to get quote");
      const quoteResponse = await quoteRes.json();

      const connection = getConnection();
      const sig = await swapJagsolFromJupiter(
        connection,
        quoteResponse,
        publicKey,
        (tx) => sendTransaction(tx, connection)
      );

      showSwapToast(sig);
      onStakeComplete?.();
    } catch (err) {
      console.error(err);
      showErrorToast("Swap failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted) {
    return (
      <button disabled className="w-full py-3 px-4 bg-[#129D49]/50 text-black rounded-xl cursor-not-allowed opacity-50 flex items-center justify-center gap-2">
        Connect Wallet
      </button>
    );
  }

  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        disabled={connecting}
        className="w-full py-3 px-4 bg-[#129D49] hover:bg-[#16b855] text-white font-semibold rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Connect Wallet
        <Fingerprint className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleStake}
      disabled={isProcessing || !ready}
      className={`group w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors font-semibold
        ${isProcessing
          ? "bg-[#129D49]/70 cursor-not-allowed text-white"
          : !ready
          ? "bg-white/8 cursor-not-allowed text-foreground/35"
          : "bg-[#129D49] hover:bg-[#16b855] cursor-pointer text-white"
        }`}
    >
      {isProcessing ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
      ) : !ready ? (
        <><Coins className="w-4 h-4 opacity-80" /> Enter amount</>
      ) : (
        <><Wallet className="w-4 h-4 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" /> Stake</>
      )}
    </button>
  );
}
