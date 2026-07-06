import { requireOnboardedUser } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ValidatorLogo } from "@/components/ui/validator-logo";
import { shortAddress } from "@/lib/format";
import type { UserLeaderboardRow, ValidatorLeaderboardRow } from "@/types/db";

export const dynamic = "force-dynamic";

// One page, two modes:
//   1. Live mode — no finalized snapshot yet. Pull live leaderboard RPCs.
//   2. Snapshot mode — finalized/paid snapshot exists. Pull frozen tables.
// Personal "your status" card adapts to either mode.
type PayoutStatus = "pending" | "sent" | "confirmed" | "failed";

type Snapshot = {
  id: string;
  snapshotted_at: string;
  status: "draft" | "finalized" | "paid";
  notes: string | null;
};

type RewardUserRow = {
  rank: number;
  user_id: string;
  wallet_address: string;
  username: string;
  validator_id: string | null;
  validator_name: string | null;
  total_points: number;
  payout_amount: string | null;
  payout_token_mint: string | null;
  payout_tx_signature: string | null;
  payout_status: PayoutStatus;
};

type RewardValidatorRow = {
  rank: number;
  validator_id: string;
  vote_account: string;
  validator_name: string;
  total_points: number;
  user_count: number;
  delegation_amount_sol: string | null;
  delegation_tx_signature: string | null;
  delegation_status: PayoutStatus;
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ vt?: string }>;
}) {
  const state = await requireOnboardedUser();
  const supabase = await createServerSupabaseClient();
  const { vt } = await searchParams;
  const validatorView: "qualified" | "total" =
    vt === "total" ? "total" : "qualified";

  // Find the latest finalized/paid snapshot. If one exists, we're in
  // snapshot mode and use frozen reward tables. Otherwise, live RPCs.
  const { data: snapshots } = await supabase
    .from("reward_snapshots")
    .select("*")
    .in("status", ["finalized", "paid"])
    .order("snapshotted_at", { ascending: false })
    .limit(1);

  const snapshot = (snapshots as Snapshot[] | null)?.[0] ?? null;
  if (snapshot) return renderSnapshotMode(supabase, state.userId, snapshot);
  return renderLiveMode(supabase, state.userId, validatorView);
}

async function renderLiveMode(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  validatorView: "qualified" | "total",
) {
  // p_limit large enough that the current user is almost certainly in the
  // result set — we slice top 50 for display and search the rest for "you".
  const [usersRes, validatorsRes] = await Promise.all([
    supabase.rpc("get_user_leaderboard", { p_limit: 1000 }),
    supabase.rpc("get_validator_leaderboard"),
  ]);

  const allUsers = (usersRes.data as UserLeaderboardRow[]) ?? [];
  const topUsers = allUsers.slice(0, 50);
  const myIndex = allUsers.findIndex((u) => u.user_id === userId);
  const myRow = myIndex >= 0 ? allUsers[myIndex] : null;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const validatorsRaw = (validatorsRes.data as ValidatorLeaderboardRow[]) ?? [];
  const validators = [...validatorsRaw].sort((a, b) =>
    validatorView === "total"
      ? b.total_points - a.total_points || b.user_count - a.user_count
      : Number(b.qualified_points) - Number(a.qualified_points) ||
        b.total_points - a.total_points ||
        b.user_count - a.user_count,
  );
  const top3 = topUsers.slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black mb-1">Leaderboard</h1>
          <p className="text-sm text-foreground/50">
            Live standings · Rewards after{" "}
            <span className="text-foreground/75 font-semibold">
              July 19, 2026
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {myRank ? (
            <div className="sm:text-right">
              <p className="text-[10px] text-foreground/35 uppercase tracking-wider mb-1">
                Your rank
              </p>
              <div className="flex items-center gap-2 sm:justify-end">
                <p className="text-2xl font-black text-[#129D49] leading-none">
                  #{myRank}
                </p>
                <span className="text-[10px] font-bold text-[#129D49] bg-[#129D49]/12 border border-[#129D49]/25 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  Live
                </span>
              </div>
              <p className="text-[11px] text-foreground/35 mt-0.5">
                {myRow?.total_points ?? 0} pts · out of {allUsers.length}{" "}
                players
              </p>
            </div>
          ) : (
            <span className="text-[10px] font-bold text-[#129D49] bg-[#129D49]/12 border border-[#129D49]/25 px-2.5 py-1 rounded-full uppercase tracking-widest">
              Live
            </span>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-black">Players</h2>
          <span className="text-xs text-foreground/35">
            {topUsers.length} ranked
          </span>
        </div>

        {topUsers.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/3 px-5 py-12 text-center text-sm text-foreground/40">
            No ranked players yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {topUsers.length >= 1 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {topUsers.slice(0, 3).map((u, i) => {
                  const isMe = u.user_id === userId;
                  const medals = ["🥇", "🥈", "🥉"];
                  const styles = [
                    "border-[#FFD23F]/30 bg-linear-to-r from-jagpool-accent/8 to-transparent",
                    isMe
                      ? "border-[#129D49]/25 bg-[#129D49]/6"
                      : "border-white/10 bg-white/4",
                    isMe
                      ? "border-[#129D49]/25 bg-[#129D49]/6"
                      : "border-white/8 bg-white/3",
                  ];
                  return (
                    <div
                      key={u.user_id}
                      className={`rounded-2xl border px-4 py-3.5 flex items-center gap-3 ${styles[i]}`}
                    >
                      <span className="text-xl -ml-2 shrink-0">
                        {medals[i]}
                      </span>
                      {u.x_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.x_avatar_url}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <ValidatorLogo
                          url={u.validator_logo_url}
                          name={u.validator_name ?? "?"}
                          size={36}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-bold text-sm truncate ${i === 0 ? "text-jagpool-accent" : isMe ? "text-[#129D49]" : ""}`}
                        >
                          @{u.username}
                          {isMe ? (
                            <span className="ml-1 text-[8px] bg-[#129D49]/15 text-[#129D49] px-1 py-0.5 rounded">
                              you
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-foreground/35 truncate">
                          {u.validator_name ?? "—"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black tabular-nums">
                          {u.total_points}
                        </p>
                        <p className="text-[10px] text-foreground/30">pts</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {topUsers.length > 3 ? (
              <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
                <ul className="divide-y divide-white/5">
                  {topUsers.slice(3).map((u, i) => {
                    const rank = i + 4;
                    const isMe = u.user_id === userId;
                    return (
                      <li
                        key={u.user_id}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${isMe ? "bg-[#129D49]/8 border-l-2 border-l-[#129D49]" : "hover:bg-white/3"}`}
                      >
                        <span className="text-sm w-7 text-center text-foreground/25 tabular-nums shrink-0">
                          {rank}
                        </span>
                        {u.x_avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.x_avatar_url}
                            alt=""
                            className="w-[30px] h-[30px] rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <ValidatorLogo
                            url={u.validator_logo_url}
                            name={u.validator_name ?? "?"}
                            size={30}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-semibold">
                            @{u.username}
                            {isMe ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#129D49]/15 text-[#129D49] font-bold">
                                you
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-foreground/35 truncate">
                            {u.validator_name ?? "—"} ·{" "}
                            {shortAddress(u.wallet_address)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black tabular-nums text-sm">
                            {u.total_points}
                          </p>
                          <p className="text-[10px] text-foreground/30">pts</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-black">Validator teams</h2>
            <span className="text-xs text-foreground/35">
              {validators.length} active
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/4 p-0.5 text-[11px] font-bold">
            <a
              href="?vt=qualified"
              className={`px-3 py-1 rounded-full transition-colors ${validatorView === "qualified" ? "bg-[#129D49]/20 text-[#129D49]" : "text-foreground/50 hover:text-foreground/80"}`}
            >
              Qualified
            </a>
            <a
              href="?vt=total"
              className={`px-3 py-1 rounded-full transition-colors ${validatorView === "total" ? "bg-[#129D49]/20 text-[#129D49]" : "text-foreground/50 hover:text-foreground/80"}`}
            >
              Total points
            </a>
          </div>
        </div>
        <p className="-mt-2 text-xs text-foreground/40">
          {validatorView === "qualified"
            ? "jagSOL prizes won by each team's players in the global top 10 — 1st 8, 2nd 5, 3rd 3, 4th 2, 5th 1, 6th–10th 0.5."
            : "Combined points of every player on the team."}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {validators.map((v, i) => {
            const rank = i + 1;
            const isFirst = rank === 1;
            const qualified = Number(v.qualified_points);
            const primary =
              validatorView === "qualified"
                ? qualified % 1 === 0
                  ? String(qualified)
                  : qualified.toFixed(1)
                : String(v.total_points);
            return (
              <div
                key={v.validator_id}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${isFirst ? "border-[#FFD23F]/30 bg-jagpool-accent/5" : "border-white/8 bg-white/3"}`}
              >
                <RankNum rank={rank} />
                <ValidatorLogo url={v.logo_url} name={v.name} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm truncate">{v.name}</p>
                    {isFirst ? (
                      <span className="text-[9px] font-bold text-jagpool-accent bg-jagpool-accent/12 border border-[#FFD23F]/20 px-1.5 py-0.5 rounded uppercase tracking-wide">
                        Leading
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-foreground/35 mt-0.5">
                    {v.user_count} {v.user_count === 1 ? "player" : "players"}
                    {validatorView === "qualified" && v.qualified_count > 0
                      ? ` · ${v.qualified_count} in top 10`
                      : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black tabular-nums text-lg">{primary}</p>
                  <p className="text-[10px] text-foreground/30">
                    {validatorView === "qualified" ? "jagSOL" : "pts"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

async function renderSnapshotMode(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  snapshot: Snapshot,
) {
  const [usersRes, validatorsRes, myRowRes] = await Promise.all([
    supabase
      .from("reward_users")
      .select("*")
      .eq("snapshot_id", snapshot.id)
      .order("rank", { ascending: true }),
    supabase
      .from("reward_validators")
      .select("*")
      .eq("snapshot_id", snapshot.id)
      .order("rank", { ascending: true }),
    supabase
      .from("reward_users")
      .select("*")
      .eq("snapshot_id", snapshot.id)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const users = (usersRes.data as RewardUserRow[]) ?? [];
  const validators = (validatorsRes.data as RewardValidatorRow[]) ?? [];
  const winnerV = validators[0];
  const myReward = (myRowRes.data as RewardUserRow | null) ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black mb-1">Leaderboard</h1>
          <p className="text-sm text-foreground/50">
            Tournament finalized · snapshot{" "}
            {new Date(snapshot.snapshotted_at).toLocaleDateString()}
          </p>
        </div>
        <SnapshotBadge status={snapshot.status} />
      </div>

      {myReward ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#129D49]/25 bg-[#129D49]/5 px-6 py-5">
          <div className="absolute inset-0 bg-linear-to-r from-[#129D49]/8 to-transparent pointer-events-none" />
          <p className="text-xs text-foreground/40 uppercase tracking-widest font-medium mb-4">
            Your result
          </p>
          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-6">
            <Kpi label="Final rank" value={`#${myReward.rank}`} big />
            <Kpi label="Points" value={String(myReward.total_points)} big />
            <Kpi label="Payout" value={myReward.payout_amount ?? "—"} mono />
            <div>
              <p className="text-[10px] text-foreground/35 uppercase tracking-wider mb-1">
                Tx
              </p>
              {myReward.payout_tx_signature ? (
                <a
                  href={`https://solscan.io/tx/${myReward.payout_tx_signature}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm text-[#129D49]"
                >
                  {shortAddress(myReward.payout_tx_signature, 6, 6)}
                </a>
              ) : (
                <p className="text-foreground/30 text-sm">—</p>
              )}
              <PayoutBadge status={myReward.payout_status} />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-white/3 px-6 py-5">
          <p className="text-sm text-foreground/50">
            You aren&apos;t in this snapshot.
          </p>
        </div>
      )}

      {winnerV ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#FFD23F]/30 bg-jagpool-accent/5 px-6 py-5">
          <div className="absolute inset-0 bg-linear-to-r from-jagpool-accent/5 to-transparent pointer-events-none" />
          <p className="text-xs text-foreground/40 uppercase tracking-widest font-medium mb-3">
            Winning validator 🏆
          </p>
          <div className="relative flex items-center gap-4">
            <ValidatorLogo url={null} name={winnerV.validator_name} size={48} />
            <div className="flex-1 min-w-0">
              <p className="text-xl font-black">{winnerV.validator_name}</p>
              <p className="text-sm text-foreground/50">
                {winnerV.user_count} players · {winnerV.total_points} pts
              </p>
            </div>
            {winnerV.delegation_amount_sol ? (
              <div className="text-right shrink-0">
                <p className="text-xs text-foreground/40 mb-0.5">Delegation</p>
                <p className="font-mono font-black text-lg">
                  {winnerV.delegation_amount_sol} SOL
                </p>
                <PayoutBadge status={winnerV.delegation_status} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-black">Final rankings</h2>
        <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
          {users.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-foreground/40">
              No ranked users.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {users.map((u) => {
                const isMe = u.user_id === userId;
                return (
                  <li
                    key={u.user_id}
                    className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-[#129D49]/8 border-l-2 border-l-[#129D49]" : "hover:bg-white/3"}`}
                  >
                    <RankNum rank={u.rank} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        @{u.username}
                        {isMe ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#129D49]/15 text-[#129D49] font-bold">
                            you
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-foreground/35 truncate">
                        {u.validator_name ?? "—"} ·{" "}
                        {shortAddress(u.wallet_address)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 text-xs">
                      {u.payout_amount ? (
                        <div>
                          <p className="font-mono font-semibold text-sm">
                            {u.payout_amount}
                          </p>
                          <PayoutBadge status={u.payout_status} />
                        </div>
                      ) : (
                        <span className="text-foreground/25">—</span>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-1">
                      <p className="font-black tabular-nums text-sm">
                        {u.total_points}
                      </p>
                      <p className="text-[10px] text-foreground/30">pts</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {snapshot.notes ? (
        <p className="text-xs text-foreground/30">{snapshot.notes}</p>
      ) : null}
    </div>
  );
}

function RankNum({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="text-xl w-8 -ml-2 text-center shrink-0 select-none">
        🥇
      </span>
    );
  if (rank === 2)
    return (
      <span className="text-xl w-8 -ml-2 text-center shrink-0 select-none">
        🥈
      </span>
    );
  if (rank === 3)
    return (
      <span className="text-xl w-8 -ml-2 text-center shrink-0 select-none">
        🥉
      </span>
    );
  return (
    <span className="text-sm w-5 text-left text-foreground/25 tabular-nums shrink-0">
      {rank}
    </span>
  );
}

function Kpi({
  label,
  value,
  big,
  mono,
}: {
  label: string;
  value: string;
  big?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-foreground/35 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className={`font-black leading-none ${big ? "text-3xl" : "text-xl"} ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function SnapshotBadge({ status }: { status: Snapshot["status"] }) {
  const s = {
    draft: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    finalized: "bg-emerald-500/15 text-[#129D49] border-emerald-500/30",
    paid: "bg-[#129D49]/15 text-[#129D49] border-[#129D49]/30",
  };
  return (
    <span
      className={`text-[10px] uppercase px-2.5 py-1 rounded-full border font-bold ${s[status]}`}
    >
      {status}
    </span>
  );
}

function PayoutBadge({ status }: { status: PayoutStatus }) {
  const s: Record<PayoutStatus, string> = {
    pending: "text-foreground/35",
    sent: "text-amber-400",
    confirmed: "text-[#129D49]",
    failed: "text-red-400",
  };
  return (
    <span className={`text-[10px] uppercase font-semibold ${s[status]}`}>
      {status}
    </span>
  );
}
