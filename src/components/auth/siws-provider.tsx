"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toast } from "@/components/ui/toast";

const POST_SIGNIN_REDIRECT = "/dashboard";

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

type SiwsContextValue = {
  signing: boolean;
  connecting: boolean;
  connected: boolean;
  error: string | null;
  clearError: () => void;
  connectOrSignIn: () => void;
};

const SiwsContext = createContext<SiwsContextValue | null>(null);

export function useSiws(): SiwsContextValue {
  const ctx = useContext(SiwsContext);
  if (!ctx) throw new Error("useSiws must be used within <SiwsProvider>");
  return ctx;
}

// Single sign-in orchestrator. Mounted once inside the wallet provider, it owns
// the whole SIWS flow (challenge → sign → verify → session → redirect) plus the
// auto-sign-on-connect effect. The buttons are dumb triggers — with exactly one
// flow there is nothing to dedupe, so duplicate signMessage prompts are
// impossible by construction.
export function SiwsProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, connected, connecting, disconnect } =
    useWallet();
  const { setVisible } = useWalletModal();
  const router = useRouter();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSignedRef = useRef(false);
  const inFlightRef = useRef(false);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage || inFlightRef.current) return;
    inFlightRef.current = true;
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
      const challenge = (await challengeRes.json()) as {
        nonce: string;
        message: string;
      };

      const signatureBytes = await signMessage(
        new TextEncoder().encode(challenge.message),
      );
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

      const { error: setErr } = await createClient().auth.setSession({
        access_token: verify.accessToken,
        refresh_token: verify.refreshToken,
      });
      if (setErr) throw setErr;

      router.push(POST_SIGNIN_REDIRECT);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      await disconnect().catch(() => {});
      autoSignedRef.current = false;
    } finally {
      setSigning(false);
      inFlightRef.current = false;
    }
  }, [publicKey, signMessage, router, disconnect]);

  // Auto-sign once the wallet connects — but only when there's no Supabase
  // session yet, so an already-authenticated user's wallet reconnecting (e.g.
  // autoConnect on load) never triggers an unsolicited sign prompt.
  useEffect(() => {
    if (!connected || !publicKey || signing || autoSignedRef.current) return;
    autoSignedRef.current = true;
    void (async () => {
      try {
        const { data } = await createClient().auth.getSession();
        if (!data.session) await signIn();
      } catch (err) {
        console.error("[siws] auto-sign session check failed", err);
      }
    })();
  }, [connected, publicKey, signing, signIn]);

  // Let the auto-sign effect re-fire after a reconnect. inFlightRef is owned by
  // signIn's finally and intentionally NOT reset here: clearing it on a spurious
  // disconnect mid-flight would let a reconnect launch a second signIn.
  useEffect(() => {
    if (!connected) autoSignedRef.current = false;
  }, [connected]);

  const connectOrSignIn = useCallback(async () => {
    setError(null);
    if (!connected) {
      setVisible(true); // open the wallet-adapter modal; auto-sign fires on connect
      return;
    }
    // Already connected: an authed user just goes to the app; otherwise sign in.
    try {
      const { data } = await createClient().auth.getSession();
      if (data.session) {
        router.push(POST_SIGNIN_REDIRECT);
        return;
      }
    } catch {
      // couldn't read the session — fall through and let them sign in
    }
    void signIn();
  }, [connected, setVisible, signIn, router]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <SiwsContext.Provider
      value={{ signing, connecting, connected, error, clearError, connectOrSignIn }}
    >
      {children}
      {error ? <Toast message={error} onDismiss={clearError} /> : null}
    </SiwsContext.Provider>
  );
}
