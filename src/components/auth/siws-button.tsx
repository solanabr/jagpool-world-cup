"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";

type VerifyErrorBody = {
  error?: string;
  details?: string;
  currentBalance?: string;
  minimumRequired?: string;
};

function friendlyError(body: VerifyErrorBody | null, status: number): string {
  const code = body?.error;
  switch (code) {
    case "insufficient_jagsol":
      return `You need at least ${body?.minimumRequired ?? "?"} JagSOL to sign in. Your balance: ${body?.currentBalance ?? "0"}.`;
    case "invalid_signature":
      return "Signature verification failed. Try signing again.";
    case "challenge_expired":
      return "Challenge expired. Please try again.";
    case "unknown_challenge":
      return "Challenge not recognized. Refresh and try again.";
    case "session_failed":
      if (body?.details?.toLowerCase().includes("wallet_password_pepper")) {
        return "Server is missing WALLET_PASSWORD_PEPPER — set it in .env.local.";
      }
      return `Couldn't create session: ${body?.details ?? "unknown error"}`;
    case "profile_creation_failed":
      return `Couldn't create your profile: ${body?.details ?? "unknown error"}`;
    case "invalid_payload":
    case "invalid_public_key":
      return "Invalid request. Try refreshing the page.";
    default:
      return `Sign-in failed (HTTP ${status}${code ? ` · ${code}` : ""}).`;
  }
}

// Shared across every SiwsButton instance on the page. Sign-in is a global
// operation (one wallet → one session), but this button renders in several
// places at once (header + landing CTAs, one of which is CSS-hidden but still
// mounted). A per-instance ref can't see the others, so each instance's
// auto-sign effect would fire on connect → one signMessage prompt each.
let signInInFlight = false;

export function SiwsButton({
  redirectTo = "/dashboard",
  compact = false,
}: {
  redirectTo?: string;
  compact?: boolean;
}) {
  const { publicKey, signMessage, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const router = useRouter();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const autoSignedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) return;
    if (signInInFlight) return; // one sign-in across ALL button instances — blocks duplicate signMessage prompts
    signInInFlight = true;
    setSigning(true);
    setError(null);

    try {
      const pkStr = publicKey.toBase58();

      const challengeRes = await fetch("/api/auth/siws/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: pkStr }),
      });
      if (!challengeRes.ok) {
        const errJson = (await challengeRes.json().catch(() => null)) as VerifyErrorBody | null;
        throw new Error(friendlyError(errJson, challengeRes.status));
      }
      const challenge = (await challengeRes.json()) as { nonce: string; message: string };

      const encoded = new TextEncoder().encode(challenge.message);
      const signatureBytes = await signMessage(encoded);
      const signature = bs58.encode(signatureBytes);

      const verifyRes = await fetch("/api/auth/siws/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: pkStr, signature, nonce: challenge.nonce }),
      });
      if (!verifyRes.ok) {
        const errJson = (await verifyRes.json().catch(() => null)) as VerifyErrorBody | null;
        throw new Error(friendlyError(errJson, verifyRes.status));
      }
      const verify = (await verifyRes.json()) as {
        accessToken: string;
        refreshToken: string;
      };

      const supabase = createClient();
      const { error: setErr } = await supabase.auth.setSession({
        access_token: verify.accessToken,
        refresh_token: verify.refreshToken,
      });
      if (setErr) throw setErr;

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      await disconnect().catch(() => {});
      autoSignedRef.current = false;
    } finally {
      setSigning(false);
      signInInFlight = false;
    }
  }, [publicKey, signMessage, redirectTo, router, disconnect]);

  // Auto-sign as soon as the wallet connects (single-click UX)
  useEffect(() => {
    if (connected && publicKey && !signing && !autoSignedRef.current) {
      autoSignedRef.current = true;
      void signIn();
    }
  }, [connected, publicKey, signing, signIn]);

  // Clear the shared guard on disconnect so a cancelled/aborted sign prompt
  // (whose promise may never settle) can't wedge sign-in for the whole session.
  useEffect(() => {
    if (!connected) signInInFlight = false;
  }, [connected]);

  const handleClick = useCallback(() => {
    setError(null);
    if (!connected) {
      autoSignedRef.current = false;
      setVisible(true); // open Solana wallet adapter modal
      return;
    }
    autoSignedRef.current = true;
    void signIn();
  }, [connected, setVisible, signIn]);

  if (!mounted) {
    if (compact) {
      return <div className="h-9 w-32 rounded-lg bg-white/5 animate-pulse" />;
    }
    return (
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
        ? compact ? "Sign in" : "Sign in with Solana"
        : compact ? "Connect wallet" : "Connect wallet";

  if (compact) {
    return (
      <>
        <Button onClick={handleClick} disabled={signing || connecting} size="md" className="gradient-btn">
          {label}
        </Button>
        {error ? <Toast message={error} onDismiss={() => setError(null)} /> : null}
      </>
    );
  }

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={signing || connecting}
        size="lg"
        className="min-w-[240px] gradient-btn"
      >
        {label}
      </Button>
      {error ? <Toast message={error} onDismiss={() => setError(null)} /> : null}
    </>
  );
}
