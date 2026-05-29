"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User, Validator } from "@/types/db";
import { Button } from "@/components/ui/button";
import { ValidatorLogo } from "@/components/ui/validator-logo";
import { createClient } from "@/lib/supabase/client";

type Region = "LATAM" | "APAC" | "ZA" | null;

const REGION_COLORS: Record<string, string> = {
  LATAM: "text-region-latam bg-region-latam/10 border-region-latam/25",
  APAC:  "text-region-apac  bg-region-apac/10  border-region-apac/25",
  ZA:    "text-region-za    bg-region-za/10    border-region-za/25",
};

const X_ERRORS: Record<string, string> = {
  denied: "X connection was cancelled — connect to continue.",
  already_linked: "This X account is already linked to another JagPool account.",
  exchange_failed: "Couldn't complete the X connection. Please try again.",
  sync_failed: "Couldn't save your X profile. Please try again.",
  missing_code: "Something went wrong connecting X. Please try again.",
};

const API_ERRORS: Record<string, string> = {
  validator_locked: "You already have a validator selected.",
  invalid_validator: "Select a valid validator to continue.",
  x_not_linked: "Connect your X account first.",
};

const VALIDATOR_KEY = "jagpool_onboarding_validator";

export function OnboardingForm({
  validators,
  profile,
}: {
  validators: Validator[];
  profile: User | null;
}) {
  const router = useRouter();

  const xLinked = !!profile?.x_user_id;
  const xHandle = profile?.username ?? null; // username holds the @handle once linked
  const xAvatar = profile?.x_avatar_url ?? null;
  const validatorLocked = !!profile?.validator_locked_at;
  const lockedValidator = useMemo(
    () => validators.find((v) => v.id === profile?.validator_id) ?? null,
    [validators, profile?.validator_id],
  );

  const [validatorId, setValidatorId] = useState<string | null>(
    profile?.validator_id ?? null,
  );
  const [search, setSearch]             = useState("");
  const [regionFilter, setRegionFilter] = useState<Region>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("x_error");
    if (code) setError(X_ERRORS[code] ?? "Couldn't link X — please try again.");
  }, []);

  // linkIdentity navigates away and wipes state, so a validator picked before
  // connecting X is restored from localStorage on return.
  useEffect(() => {
    if (validatorLocked) return;
    const stored = localStorage.getItem(VALIDATOR_KEY);
    if (stored) setValidatorId((cur) => cur ?? stored);
  }, [validatorLocked]);

  function selectValidator(id: string) {
    setValidatorId((cur) => {
      const next = cur === id ? null : id;
      if (next) localStorage.setItem(VALIDATOR_KEY, next);
      else localStorage.removeItem(VALIDATOR_KEY);
      return next;
    });
  }

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

  async function connectX() {
    setError(null);
    setSubmitting(true);
    const supabase = createClient();
    const { error: linkErr } = await supabase.auth.linkIdentity({
      provider: "x",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    // On success the browser redirects to X; only errors return here.
    if (linkErr) {
      setError(linkErr.message || "Couldn't open X. Please try again.");
      setSubmitting(false);
    }
  }

  async function submitValidator() {
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
        body: JSON.stringify({ validatorId }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as { error?: string } | null;
        const code = errJson?.error ?? "";
        throw new Error(API_ERRORS[code] ?? code ?? "Could not save");
      }
      localStorage.removeItem(VALIDATOR_KEY);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const selected = validators.find((v) => v.id === validatorId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 lg:gap-10 items-start">

      <div className="lg:sticky lg:top-24 flex flex-col gap-5">

        <div className="bg-white/4 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
          <p className="text-xs text-foreground/50 uppercase tracking-wider font-medium">
            Your X account
          </p>
          {xLinked ? (
            <div className="flex items-center gap-3">
              {xAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={xAvatar}
                  alt=""
                  className="w-11 h-11 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-white/10 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">@{xHandle}</p>
                <p className="text-xs text-foreground/50">Connected</p>
              </div>
              <svg className="text-[#129D49] shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          ) : (
            <button
              type="button"
              onClick={connectX}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black font-semibold py-2.5 hover:bg-white/90 transition disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              {submitting ? "Opening X…" : "Connect X"}
            </button>
          )}
        </div>

        <div className={`rounded-2xl border p-5 transition-all ${
          selected
            ? "bg-[#129D49]/5 border-[#129D49]/30"
            : "bg-white/4 border-white/10 border-dashed"
        }`}>
          <p className="text-xs text-foreground/50 uppercase tracking-wider mb-3 font-medium">
            Selected team
          </p>
          {selected ? (
            <div className="flex items-center gap-3">
              <ValidatorLogo url={selected.logo_url} name={selected.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{selected.name}</p>
                {selected.location ? (
                  <p className="text-xs text-foreground/50 truncate mt-0.5">
                    {selected.location}
                  </p>
                ) : null}
                {selected.region ? (
                  <span className={`inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase ${REGION_COLORS[selected.region] ?? "text-foreground/40 border-white/10"}`}>
                    {selected.region}
                  </span>
                ) : null}
              </div>
              <svg className="text-[#129D49] shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-foreground/35">
              <div className="w-11 h-11 rounded-full bg-white/5 border border-white/10 border-dashed flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              </div>
              <p className="text-sm">Pick a validator on the right</p>
            </div>
          )}
        </div>

        <div className="bg-white/4 border border-white/10 rounded-2xl p-5">
          <p className="text-xs text-foreground/50 uppercase tracking-wider mb-3 font-medium">
            How it works
          </p>
          <ul className="flex flex-col gap-2.5">
            {[
              "Your points count toward your validator's team total",
              "The winning validator earns extra SOL delegation",
              "This choice cannot be changed after confirming",
            ].map((text) => (
              <li key={text} className="flex items-start gap-2 text-xs text-foreground/60 leading-relaxed">
                <span className="text-[#129D49] mt-0.5 shrink-0 font-bold">⚡</span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {error ? (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        ) : null}

        {!xLinked ? (
          <Button
            onClick={connectX}
            disabled={submitting}
            size="lg"
            className="w-full rounded-xl font-semibold"
          >
            {submitting ? "Opening X…" : "Connect X to continue →"}
          </Button>
        ) : !validatorLocked ? (
          <Button
            onClick={submitValidator}
            disabled={submitting || !validatorId}
            size="lg"
            className="w-full rounded-xl font-semibold"
          >
            {submitting
              ? "Saving…"
              : selected
                ? `Join ${selected.name} →`
                : "Select a validator first"}
          </Button>
        ) : (
          <Button
            onClick={() => router.push("/dashboard")}
            size="lg"
            className="w-full rounded-xl font-semibold"
          >
            Continue →
          </Button>
        )}

        <p className="text-xs text-foreground/30 text-center -mt-2">
          ⚠️ Permanent — cannot be changed after confirming
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {validatorLocked ? (
          <div className="rounded-2xl border border-[#129D49]/30 bg-[#129D49]/5 p-6 flex items-center gap-4">
            {lockedValidator ? (
              <ValidatorLogo
                url={lockedValidator.logo_url}
                name={lockedValidator.name}
                size={48}
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-xs text-foreground/50 uppercase tracking-wider mb-1">
                Your team — locked
              </p>
              <p className="font-semibold text-lg truncate">
                {lockedValidator?.name ?? "Validator selected"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or location…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm outline-none focus:border-[#129D49] transition-colors"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <RegionTab active={regionFilter === null}   onClick={() => setRegionFilter(null)}   label="All"   count={validators.length}   color={null} />
                <RegionTab active={regionFilter === "LATAM"} onClick={() => setRegionFilter("LATAM")} label="LATAM" count={regionCounts.LATAM} color="LATAM" />
                <RegionTab active={regionFilter === "APAC"}  onClick={() => setRegionFilter("APAC")}  label="APAC"  count={regionCounts.APAC}  color="APAC" />
                <RegionTab active={regionFilter === "ZA"}    onClick={() => setRegionFilter("ZA")}    label="ZA"    count={regionCounts.ZA}    color="ZA" />
              </div>
            </div>

            <p className="text-xs text-foreground/35">
              {filtered.length} validator{filtered.length !== 1 ? "s" : ""}
              {regionFilter || search ? " matching" : " available"}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((v) => {
                const isSelected = validatorId === v.id;
                return (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => selectValidator(v.id)}
                    className={`text-left p-4 rounded-2xl border transition-all flex gap-3 items-start group ${
                      isSelected
                        ? "border-[#129D49] bg-[#129D49]/10 shadow-lg shadow-[#129D49]/10"
                        : "border-white/10 bg-white/4 hover:border-[#129D49]/35 hover:bg-white/6"
                    }`}
                  >
                    <ValidatorLogo url={v.logo_url} name={v.name} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1 mb-0.5">
                        <p className="font-semibold text-sm leading-tight truncate">{v.name}</p>
                        {isSelected ? (
                          <svg className="text-[#129D49] shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : null}
                      </div>
                      {v.location ? (
                        <p className="text-xs text-foreground/45 truncate mb-1.5">
                          {v.location}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {v.region ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase ${REGION_COLORS[v.region] ?? "text-foreground/40 border-white/10"}`}>
                            {v.region}
                          </span>
                        ) : null}
                        {v.total_stake ? (
                          <span className="text-[10px] text-foreground/35 font-mono">
                            {formatStake(v.total_stake)} SOL
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}

              {filtered.length === 0 ? (
                <div className="col-span-full flex flex-col items-center gap-3 py-16 text-center">
                  <div className="text-4xl">🔍</div>
                  <p className="text-sm text-foreground/40">No validators match your search.</p>
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setRegionFilter(null); }}
                    className="text-xs text-[#129D49] hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


function RegionTab({
  active, onClick, label, count, color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color: Region;
}) {
  const activeStyle = color && REGION_COLORS[color]
    ? REGION_COLORS[color]
    : "bg-[#129D49]/15 border-[#129D49]/40 text-[#129D49]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-2 rounded-xl border transition-all whitespace-nowrap font-medium ${
        active
          ? activeStyle
          : "bg-white/5 border-white/10 text-foreground/55 hover:border-white/25 hover:text-foreground/80"
      }`}
    >
      {label}{" "}
      <span className={active ? "opacity-60" : "text-foreground/30"}>
        {count}
      </span>
    </button>
  );
}

function formatStake(raw: string): string {
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return raw;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
