"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Status = "draft" | "finalized" | "paid";

// Snapshots progress draft → finalized. Payouts happen off-app from the CSV
// export, so there's no in-app "paid" step. Reset-to-draft handles mistakes.
const NEXT_STATUS: Record<Status, Status | null> = {
  draft: "finalized",
  finalized: null,
  paid: null,
};

export function SnapshotStatusButtons({
  snapshotId,
  current,
}: {
  snapshotId: string;
  current: Status;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function update(status: Status) {
    setError(null);
    setBusy(status);
    try {
      const res = await fetch("/api/admin/reward-snapshot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId, status }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.details ?? json.error ?? "Status update failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const next = NEXT_STATUS[current];

  return (
    <div className="flex items-center gap-2">
      {next ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => update(next)}
          disabled={busy !== null}
        >
          {busy === next ? "…" : `Mark ${next}`}
        </Button>
      ) : null}
      {current !== "draft" ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => update("draft")}
          disabled={busy !== null}
        >
          {busy === "draft" ? "…" : "Reset to draft"}
        </Button>
      ) : null}
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </div>
  );
}
