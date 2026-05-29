"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function WalletStatus({
  username,
  avatarUrl,
  walletAddress,
  validatorName,
  isAdmin,
}: {
  username: string | null;
  avatarUrl?: string | null;
  walletAddress: string;
  validatorName?: string | null;
  isAdmin?: boolean;
}) {
  const { disconnect } = useWallet();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSignOut = useCallback(async () => {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    await disconnect();
    router.push("/");
    router.refresh();
  }, [disconnect, router]);

  const displayName = username
    ? `@${username}`
    : `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`;
  const initial = (username ?? walletAddress)[0]?.toUpperCase() ?? "?";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2.5 sm:pl-1.5 sm:pr-3 sm:py-1.5 rounded-full border transition-colors ${
          open
            ? "bg-white/8 border-white/15"
            : "bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/15"
        }`}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="w-8 h-8 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#129D49] relative shrink-0 select-none">
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-black text-white leading-none">
              {initial}
            </span>
          </div>
        )}
        <div className="hidden sm:flex flex-col items-start leading-none">
          <span className="text-sm font-semibold text-foreground/90">
            {displayName}
          </span>
          {validatorName ? (
            <span className="text-[11px] text-foreground/35 mt-0.5">
              {validatorName}
            </span>
          ) : null}
        </div>
        <svg
          className={`text-foreground/35 transition-transform hidden sm:block ${open ? "rotate-180" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-44 bg-[#161616] border border-white/10 rounded-xl shadow-xl shadow-black/40 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-sm font-semibold text-foreground/90 truncate">
              {displayName}
            </p>
            {validatorName ? (
              <p className="text-xs text-foreground/40 truncate mt-0.5">
                {validatorName}
              </p>
            ) : null}
          </div>

          <div className="p-1 lg:hidden">
            {[
              {
                href: "/dashboard",
                label: "Dashboard",
                icon: (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                  </svg>
                ),
              },
              {
                href: "/predictions",
                label: "Predictions",
                icon: (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ),
              },
              {
                href: "/matches",
                label: "Matches",
                icon: (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                ),
              },
              {
                href: "/leaderboard",
                label: "Leaderboard",
                icon: (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                ),
              },
            ].map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-foreground/70 hover:text-foreground/90 hover:bg-white/5 no-underline transition-colors"
              >
                <span className="text-foreground/40">{icon}</span>
                {label}
              </Link>
            ))}
          </div>

          <div className="p-1 lg:hidden border-t border-white/8" />

          <div className="p-1">
            {isAdmin ? (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-[#129D49] hover:bg-[#129D49]/10 no-underline font-medium transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Admin panel
              </Link>
            ) : null}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-foreground/55 hover:text-foreground/90 hover:bg-white/5 transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
