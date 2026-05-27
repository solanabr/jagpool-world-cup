"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/format";

type AdminUserRow = {
  id: string;
  username: string;
  wallet_address: string;
  validator_name: string | null;
  validator_locked_at: string | null;
  is_admin: boolean;
};

export function UserRow({
  user,
  selfId,
}: {
  user: AdminUserRow;
  selfId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = user.id === selfId;

  async function toggleAdmin() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: !user.is_admin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details ?? json.error ?? "Update failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {user.username}
          {isSelf ? (
            <span className="ml-2 text-xs text-jagpool-primary">(you)</span>
          ) : null}
          {user.is_admin ? (
            <span className="ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded border border-jagpool-primary/40 bg-jagpool-primary/10 text-jagpool-primary">
              admin
            </span>
          ) : null}
        </div>
        <div className="text-xs text-foreground/50">
          {shortAddress(user.wallet_address)} · {user.validator_name ?? "no validator"}
          {!user.validator_locked_at ? " · pre-onboarding" : null}
        </div>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={toggleAdmin}
        disabled={busy || isSelf}
      >
        {busy ? "…" : user.is_admin ? "Revoke admin" : "Grant admin"}
      </Button>
      {error ? <p className="text-xs text-red-400 ml-2">{error}</p> : null}
    </li>
  );
}
