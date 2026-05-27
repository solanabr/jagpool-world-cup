import { requireOnboardedUser } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ValidatorLogo } from "@/components/ui/validator-logo";
import { Card } from "@/components/ui/card";
import { shortAddress } from "@/lib/format";
import type {
  UserLeaderboardRow,
  ValidatorLeaderboardRow,
} from "@/types/db";

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

export default async function LeaderboardPage() {
  const state = await requireOnboardedUser();
  const supabase = await createServerSupabaseClient();

  // Find the latest finalized/paid snapshot. If one exists, we're in
  // snapshot mode and use frozen reward tables. Otherwise, live RPCs.
  const { data: snapshots, error: snapshotsError } = await supabase
    .from("reward_snapshots")
    .select("*")
    .in("status", ["finalized", "paid"])
    .order("snapshotted_at", { ascending: false })
    .limit(1);
  if (snapshotsError) {
    console.error("[leaderboard] snapshots fetch failed", snapshotsError);
  }
  const snapshot = (snapshots as Snapshot[] | null)?.[0] ?? null;

  if (snapshot) {
    return renderSnapshotMode(supabase, state.userId, snapshot);
  }
  return renderLiveMode(supabase, state.userId);
}

async function renderLiveMode(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) {
  // p_limit large enough that the current user is almost certainly in the
  // result set — we slice top 50 for display and search the rest for "you".
  const [usersRes, validatorsRes] = await Promise.all([
    supabase.rpc("get_user_leaderboard", { p_limit: 1000 }),
    supabase.rpc("get_validator_leaderboard"),
  ]);
  if (usersRes.error) {
    console.error("[leaderboard] users RPC failed", usersRes.error);
  }
  if (validatorsRes.error) {
    console.error("[leaderboard] validators RPC failed", validatorsRes.error);
  }

  const allUsers = (usersRes.data as UserLeaderboardRow[]) ?? [];
  const topUsers = allUsers.slice(0, 50);
  const myIndex = allUsers.findIndex((u) => u.user_id === userId);
  const myRow = myIndex >= 0 ? allUsers[myIndex] : null;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const validators = (validatorsRes.data as ValidatorLeaderboardRow[]) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">Leaderboard</h1>
        <p className="text-sm text-foreground/60">
          Live standings. Rewards will be finalized after the tournament ends
          on <strong>July 19, 2026</strong>.
        </p>
      </div>

      <YourStatusLive myRow={myRow} myRank={myRank} />

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold">Top 50 users</h2>
          <span className="text-xs text-foreground/50">
            {topUsers.length} ranked
          </span>
        </div>
        <ul className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
          {topUsers.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-foreground/50">
              No ranked users yet.
            </li>
          ) : (
            topUsers.map((u, i) => {
              const isMe = u.user_id === userId;
              return (
                <li
                  key={u.user_id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    isMe ? "bg-jagpool-primary/10" : ""
                  }`}
                >
                  <span className="text-sm w-6 text-foreground/40 tabular-nums">
                    {i + 1}
                  </span>
                  <ValidatorLogo
                    url={u.validator_logo_url}
                    name={u.validator_name ?? "?"}
                    size={32}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {u.username}{" "}
                      {isMe ? (
                        <span className="text-xs text-jagpool-primary">
                          (you)
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-foreground/50 truncate">
                      {u.validator_name ?? "—"} · {shortAddress(u.wallet_address)}
                    </div>
                  </div>
                  <span className="font-mono tabular-nums">
                    {u.total_points}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold">Validators</h2>
          <span className="text-xs text-foreground/50">
            {validators.length} active
          </span>
        </div>
        <ul className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
          {validators.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-foreground/50">
              No active validators.
            </li>
          ) : (
            validators.map((v, i) => (
              <li
                key={v.validator_id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="text-sm w-6 text-foreground/40 tabular-nums">
                  {i + 1}
                </span>
                <ValidatorLogo url={v.logo_url} name={v.name} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{v.name}</div>
                  <div className="text-xs text-foreground/50">
                    {v.user_count} {v.user_count === 1 ? "user" : "users"}
                  </div>
                </div>
                <span className="font-mono tabular-nums">{v.total_points}</span>
              </li>
            ))
          )}
        </ul>
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
  if (usersRes.error) {
    console.error("[leaderboard] reward_users fetch failed", usersRes.error);
  }
  if (validatorsRes.error) {
    console.error("[leaderboard] reward_validators fetch failed", validatorsRes.error);
  }
  if (myRowRes.error) {
    console.error("[leaderboard] my-row fetch failed", myRowRes.error);
  }

  const users = (usersRes.data as RewardUserRow[]) ?? [];
  const validators = (validatorsRes.data as RewardValidatorRow[]) ?? [];
  const winningValidator = validators[0];
  const myReward = (myRowRes.data as RewardUserRow | null) ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold mb-1">Leaderboard</h1>
          <p className="text-sm text-foreground/60">
            Tournament finalized · snapshot from{" "}
            {new Date(snapshot.snapshotted_at).toLocaleDateString()}
          </p>
        </div>
        <SnapshotBadge status={snapshot.status} />
      </div>

      <YourStatusSnapshot myReward={myReward} />

      {winningValidator ? (
        <section>
          <h2 className="text-sm uppercase text-foreground/60 mb-3">
            Winning validator
          </h2>
          <div className="bg-jagpool-primary/10 border border-jagpool-primary/40 rounded-xl p-4 flex items-center gap-4">
            <ValidatorLogo url={null} name={winningValidator.validator_name} size={48} />
            <div className="flex-1 min-w-0">
              <div className="text-xl font-bold">
                {winningValidator.validator_name}
              </div>
              <div className="text-sm text-foreground/60">
                {winningValidator.user_count} users ·{" "}
                {winningValidator.total_points} pts
              </div>
              <div className="text-xs text-foreground/40 mt-1">
                Vote: {shortAddress(winningValidator.vote_account)}
              </div>
            </div>
            {winningValidator.delegation_amount_sol ? (
              <div className="text-right">
                <div className="text-xs text-foreground/60 uppercase">
                  Delegation
                </div>
                <div className="font-mono">
                  {winningValidator.delegation_amount_sol} SOL
                </div>
                <PayoutBadge status={winningValidator.delegation_status} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm uppercase text-foreground/60 mb-3">Users</h2>
        <ul className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
          {users.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-foreground/50">
              No ranked users in this snapshot.
            </li>
          ) : (
            users.map((u) => {
              const isMe = u.user_id === userId;
              return (
                <li
                  key={u.user_id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    isMe ? "bg-jagpool-primary/10" : ""
                  }`}
                >
                  <span className="text-sm w-6 text-foreground/40 tabular-nums">
                    {u.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {u.username}{" "}
                      {isMe ? (
                        <span className="text-xs text-jagpool-primary">
                          (you)
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-foreground/50 truncate">
                      {u.validator_name ?? "—"} ·{" "}
                      {shortAddress(u.wallet_address)}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    {u.payout_amount ? (
                      <>
                        <div className="font-mono">{u.payout_amount}</div>
                        <PayoutBadge status={u.payout_status} />
                      </>
                    ) : (
                      <span className="text-foreground/40">no payout</span>
                    )}
                  </div>
                  <span className="font-mono tabular-nums w-12 text-right">
                    {u.total_points}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {snapshot.notes ? (
        <p className="text-xs text-foreground/50">{snapshot.notes}</p>
      ) : null}
    </div>
  );
}

function YourStatusLive({
  myRow,
  myRank,
}: {
  myRow: UserLeaderboardRow | null;
  myRank: number | null;
}) {
  if (!myRow || myRank === null) {
    return (
      <Card>
        <h2 className="font-semibold mb-1">Your status</h2>
        <p className="text-sm text-foreground/60">
          You don&apos;t have any points yet. Lock in your group + champion picks
          to start earning.
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <h2 className="font-semibold mb-3">Your status</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Current rank" value={`#${myRank}`} />
        <Stat label="Total points" value={String(myRow.total_points)} />
        <Stat label="Validator" value={myRow.validator_name ?? "—"} />
      </div>
    </Card>
  );
}

function YourStatusSnapshot({
  myReward,
}: {
  myReward: RewardUserRow | null;
}) {
  if (!myReward) {
    return (
      <Card>
        <h2 className="font-semibold mb-1">Your status</h2>
        <p className="text-sm text-foreground/60">
          You aren&apos;t ranked in this snapshot. Better luck next tournament!
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-semibold">Your status</h2>
        <PayoutBadge status={myReward.payout_status} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Final rank" value={`#${myReward.rank}`} />
        <Stat label="Total points" value={String(myReward.total_points)} />
        <Stat
          label="Payout"
          value={
            myReward.payout_amount ? (
              <span className="font-mono">{myReward.payout_amount}</span>
            ) : (
              <span className="text-foreground/50 text-base">not assigned</span>
            )
          }
        />
        <Stat
          label="Transaction"
          value={
            myReward.payout_tx_signature ? (
              <a
                href={`https://solscan.io/tx/${myReward.payout_tx_signature}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm"
              >
                {shortAddress(myReward.payout_tx_signature, 6, 6)}
              </a>
            ) : (
              <span className="text-foreground/50 text-base">pending</span>
            )
          }
        />
      </div>
      <p className="text-xs text-foreground/50 mt-3">
        Payouts are processed manually by JagPool. This row updates when the
        on-chain transaction is recorded.
      </p>
    </Card>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-foreground/60 uppercase mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function SnapshotBadge({ status }: { status: Snapshot["status"] }) {
  const styles = {
    draft: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    finalized: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    paid: "bg-jagpool-primary/20 text-jagpool-primary border-jagpool-primary/40",
  };
  return (
    <span
      className={`text-[10px] uppercase px-2 py-1 rounded border ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function PayoutBadge({ status }: { status: PayoutStatus }) {
  const styles = {
    pending: "text-foreground/50",
    sent: "text-amber-400",
    confirmed: "text-emerald-400",
    failed: "text-red-400",
  };
  return (
    <span className={`text-[10px] uppercase ${styles[status]}`}>{status}</span>
  );
}
