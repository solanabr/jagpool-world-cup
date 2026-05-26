"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Validator } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ValidatorLogo } from "@/components/ui/validator-logo";

type Region = "LATAM" | "APAC" | "ZA" | null;

export function OnboardingForm({ validators }: { validators: Validator[] }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [validatorId, setValidatorId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<Region>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return validators.filter((v) => {
      if (regionFilter && v.region !== regionFilter) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [validators, search, regionFilter]);

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = { LATAM: 0, APAC: 0, ZA: 0 };
    for (const v of validators) {
      if (v.region && counts[v.region] !== undefined) counts[v.region]++;
    }
    return counts;
  }, [validators]);

  async function handleSubmit() {
    setError(null);
    if (!validatorId) {
      setError("Select a validator to continue");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, validatorId }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errJson?.error ?? "Could not save");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedValidator = validators.find((v) => v.id === validatorId);

  return (
    <div className="flex flex-col gap-8">
      <Input
        label="Username"
        name="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="3-20 characters, letters/numbers/_"
      />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-foreground/70">Choose a validator</h3>
          {selectedValidator ? (
            <span className="text-xs text-jagpool-primary">
              ✓ {selectedValidator.name}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or location…"
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-jagpool-primary"
          />
          <div className="flex gap-1.5">
            <RegionTab
              active={regionFilter === null}
              onClick={() => setRegionFilter(null)}
              label="All"
              count={validators.length}
            />
            <RegionTab
              active={regionFilter === "LATAM"}
              onClick={() => setRegionFilter("LATAM")}
              label="LATAM"
              count={regionCounts.LATAM}
            />
            <RegionTab
              active={regionFilter === "APAC"}
              onClick={() => setRegionFilter("APAC")}
              label="APAC"
              count={regionCounts.APAC}
            />
            <RegionTab
              active={regionFilter === "ZA"}
              onClick={() => setRegionFilter("ZA")}
              label="ZA"
              count={regionCounts.ZA}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
          {filtered.map((v) => {
            const selected = validatorId === v.id;
            return (
              <button
                type="button"
                key={v.id}
                onClick={() => setValidatorId(v.id)}
                className={`text-left p-3 rounded-lg border transition flex gap-3 items-center ${
                  selected
                    ? "border-jagpool-primary bg-jagpool-primary/10"
                    : "border-white/10 bg-white/[0.03] hover:border-jagpool-primary/40"
                }`}
              >
                <ValidatorLogo url={v.logo_url} name={v.name} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate mb-0.5">{v.name}</div>
                  <div className="text-xs text-foreground/50 truncate">
                    {v.location ?? "—"}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 ? (
            <div className="col-span-full text-center text-sm text-foreground/50 py-8">
              No validators match your search.
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <Button onClick={handleSubmit} disabled={submitting} size="lg">
        {submitting ? "Saving…" : "Confirm (cannot be changed later)"}
      </Button>
    </div>
  );
}

function RegionTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1.5 rounded-md border transition whitespace-nowrap ${
        active
          ? "bg-jagpool-primary border-jagpool-primary text-white"
          : "bg-white/5 border-white/10 text-foreground/70 hover:border-jagpool-primary/40"
      }`}
    >
      {label} <span className="text-foreground/40">({count})</span>
    </button>
  );
}
