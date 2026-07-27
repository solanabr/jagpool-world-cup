"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MatchStage } from "@/types/db";

/**
 * Force a stage's prediction window open/closed from /admin/results, regardless
 * of kickoff time. Used to replay past stages (e.g. for a demo recording).
 */
export function StageLockToggle({
  stage,
  open,
}: {
  stage: MatchStage;
  open: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/stage-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, open: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details ?? json.error ?? "Failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span
      className="flex items-center gap-2"
      // The summary row toggles <details>; don't collapse when clicking here.
      onClick={(e) => e.stopPropagation()}
    >
      {error ? <span className="text-[10px] text-red-400">{error}</span> : null}
      <span
        className={`text-[10px] uppercase font-bold tracking-wide ${
          open ? "text-[#129D49]" : "text-foreground/35"
        }`}
      >
        {open ? "Predictions open" : "Locked"}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => toggle(!open)}
        className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border transition-colors ${
          busy
            ? "opacity-50 cursor-wait border-white/10 bg-white/5 text-foreground/40"
            : open
              ? "border-white/15 bg-white/5 text-foreground/70 hover:bg-white/10"
              : "border-[#129D49]/40 bg-[#129D49]/15 text-[#129D49] hover:bg-[#129D49]/25"
        }`}
      >
        {busy ? "…" : open ? "Lock" : "Unlock"}
      </button>
    </span>
  );
}
