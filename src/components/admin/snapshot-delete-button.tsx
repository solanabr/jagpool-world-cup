"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SnapshotDeleteButton({
  snapshotId,
  status,
}: {
  snapshotId: string;
  status: "draft" | "finalized" | "paid";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A paid snapshot is a real payout record — not deletable.
  if (status === "paid") return null;

  async function del() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reward-snapshot", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "delete_failed");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs px-2 py-1 rounded-lg border border-red-500/30 text-red-300/80 hover:bg-red-500/10 transition"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        onClick={del}
        disabled={busy}
        className="text-xs px-2 py-1 rounded-lg border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25 transition disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Confirm"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-xs px-2 py-1 rounded-lg border border-white/15 text-foreground/60 hover:bg-white/5 transition"
      >
        Cancel
      </button>
      {error ? <span className="text-[10px] text-red-400">{error}</span> : null}
    </span>
  );
}
