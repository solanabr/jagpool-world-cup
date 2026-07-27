"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Fills the 32 known group advancers + the Round-of-32 matchups in one click,
 * so the bracket doesn't have to be rebuilt by hand after a reset.
 */
export function PrefillBracketButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/prefill-bracket", { method: "POST" });
      const json = await res.json();
      if (!res.ok && res.status !== 207) {
        throw new Error(json.details ?? json.error ?? "Failed");
      }
      setMsg(
        `${json.advancersSet ?? 32} advancers · ${json.matchesFilled} R32 matches filled${
          json.warning ? ` · ${json.warning}` : ""
        }`,
      );
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
          busy
            ? "opacity-50 cursor-wait border-white/10 bg-white/5 text-foreground/40"
            : "border-jagpool-accent/40 bg-jagpool-accent/10 text-jagpool-accent hover:bg-jagpool-accent/20"
        }`}
      >
        {busy ? "Filling…" : "Fill known results (32 advancers + R32)"}
      </button>
      {msg ? <span className="text-xs text-[#129D49]">{msg}</span> : null}
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </div>
  );
}
