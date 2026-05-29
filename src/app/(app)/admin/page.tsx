import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/dashboard");

  const supabase = await createServiceRoleClient();
  const nowIso = new Date().toISOString();

  const [
    awaitingRes,
    advancersSetRes,
    snapshotRes,
    onboardedRes,
    championRes,
    advancerUsersRes,
  ] = await Promise.all([
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .lte("kickoff_at", nowIso)
      .neq("status", "completed"),
    supabase
      .from("tournament_advancers")
      .select("team_name", { count: "exact", head: true }),
    supabase
      .from("reward_snapshots")
      .select("status")
      .order("snapshotted_at", { ascending: false })
      .limit(1),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .not("validator_locked_at", "is", null),
    supabase
      .from("champion_predictions")
      .select("user_id", { count: "exact", head: true }),
    supabase.from("advancer_predictions").select("user_id"),
  ]);

  const awaitingResults = awaitingRes.count ?? 0;
  const advancersSet = advancersSetRes.count ?? 0;
  const snapshotStatus =
    (snapshotRes.data as { status: string }[] | null)?.[0]?.status ?? "none";
  const onboarded = onboardedRes.count ?? 0;
  const championPicked = championRes.count ?? 0;
  const predictors = new Set(
    ((advancerUsersRes.data as { user_id: string }[]) ?? []).map(
      (r) => r.user_id,
    ),
  ).size;
  const noPicks = Math.max(0, onboarded - predictors);

  const snapshotColor =
    snapshotStatus === "paid"
      ? "text-[#129D49]"
      : snapshotStatus === "finalized"
        ? "text-sky-400"
        : snapshotStatus === "draft"
          ? "text-amber-400"
          : "text-foreground/35";

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#129D49] uppercase tracking-[0.25em] font-semibold mb-1">
            Control panel
          </p>
          <h1 className="text-3xl font-black tracking-tight">Admin</h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/8 bg-white/3">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-foreground/50 font-medium">Live</span>
        </div>
      </div>

      <section>
        <SectionLabel urgent={awaitingResults > 0}>
          Needs attention
        </SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <StatCard
            label="Matches awaiting results"
            value={awaitingResults}
            urgent={awaitingResults > 0}
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />
          <StatCard
            label="Advancers set"
            value={`${advancersSet}/32`}
            sub={
              advancersSet < 32 ? `${32 - advancersSet} missing` : "Complete"
            }
            subColor={
              advancersSet < 32 ? "text-amber-400/70" : "text-[#129D49]/70"
            }
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            }
          />
          <StatCard
            label="Reward snapshot"
            value={snapshotStatus}
            valueClass={snapshotColor}
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            }
          />
        </div>
      </section>

      <section>
        <SectionLabel>Engagement</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <StatCard
            label="Predicted advancers"
            value={`${predictors}/${onboarded}`}
            sub={
              onboarded > 0
                ? `${Math.round((predictors / onboarded) * 100)}% participation`
                : undefined
            }
            icon={
              <svg
                width="16"
                height="16"
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
            }
          />
          <StatCard
            label="Champion picked"
            value={championPicked}
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
            }
          />
          <StatCard
            label="Onboarded, no picks"
            value={noPicks}
            urgent={noPicks > 5}
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
          />
        </div>
      </section>

      <section>
        <SectionLabel>Tools</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          <ToolCard
            href="/admin/results"
            title="Results"
            body="Mark group advancers and finalize knockout matches. Scoring runs on save."
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            }
          />
          <ToolCard
            href="/admin/users"
            title="Users"
            body="Grant or revoke admin access. View all signed-in users."
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
          />
          <ToolCard
            href="/admin/rewards"
            title="Rewards"
            body="Snapshot the final leaderboard and track payout status."
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v12M9 9h4.5a2.5 2.5 0 0 1 0 5H9m0 0h5" />
              </svg>
            }
          />
        </div>
      </section>
    </div>
  );
}

function SectionLabel({
  children,
  urgent,
}: {
  children: ReactNode;
  urgent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${urgent ? "bg-[#129D49] animate-pulse" : "bg-white/20"}`}
      />
      <span className="text-xs font-semibold uppercase tracking-widest text-foreground/40">
        {children}
      </span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

function StatCard({
  label,
  value,
  urgent,
  sub,
  subColor = "text-foreground/35",
  valueClass,
  icon,
}: {
  label: string;
  value: string | number;
  urgent?: boolean;
  sub?: string;
  subColor?: string;
  valueClass?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-2 transition-colors ${
        urgent
          ? "border-[#129D49]/30 bg-[#129D49]/5"
          : "border-white/8 bg-white/3"
      }`}
    >
      {urgent && (
        <span className="absolute top-3.5 right-3.5 w-1.5 h-1.5 rounded-full bg-[#129D49] animate-pulse" />
      )}
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 ${urgent ? "text-[#129D49]/70" : "text-foreground/30"}`}
        >
          {icon}
        </span>
        <p className="text-xs text-foreground/45 leading-snug">{label}</p>
      </div>
      <div className="flex flex-row gap-3 items-center">
        <p
          className={`text-2xl font-black tabular-nums tracking-tight ${valueClass ?? (urgent ? "text-[#129D49]" : "text-foreground/90")}`}
        >
          {value}
        </p>
        {sub && (
          <p className={`text-[11px] font-medium ${subColor}`}>({sub})</p>
        )}
      </div>
    </div>
  );
}

function ToolCard({
  href,
  title,
  body,
  icon,
}: {
  href: string;
  title: string;
  body: string;
  icon: ReactNode;
}) {
  return (
    <Link href={href} className="no-underline group h-full">
      <div className="h-full relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 p-5 flex items-start gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#129D49]/30 hover:bg-[#129D49]/5 hover:shadow-[0_8px_30px_rgba(249,115,22,0.08)]">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-foreground/50 transition-colors group-hover:bg-[#129D49]/10 group-hover:border-[#129D49]/25 group-hover:text-[#129D49]">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm mb-1 text-foreground/85 group-hover:text-[#129D49] transition-colors">
            {title}
          </h3>
          <p className="text-xs text-foreground/45 leading-relaxed">{body}</p>
        </div>
        <svg
          className="shrink-0 mt-0.5 text-foreground/20 transition-all group-hover:text-[#129D49]/60 group-hover:translate-x-0.5"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </div>
    </Link>
  );
}
