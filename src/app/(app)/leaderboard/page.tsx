import { requireOnboardedUser } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ValidatorLogo } from "@/components/ui/validator-logo";
import { shortAddress } from "@/lib/format";
import type {
  UserLeaderboardRow,
  ValidatorLeaderboardRow,
} from "@/types/db";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const state = await requireOnboardedUser();
  const supabase = await createServerSupabaseClient();

  const [usersRes, validatorsRes] = await Promise.all([
    supabase
      .from("user_leaderboard")
      .select("*")
      .order("total_points", { ascending: false })
      .limit(50),
    supabase
      .from("validator_leaderboard")
      .select("*")
      .order("total_points", { ascending: false }),
  ]);

  const users = (usersRes.data as UserLeaderboardRow[]) ?? [];
  const validators = (validatorsRes.data as ValidatorLeaderboardRow[]) ?? [];

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-bold">Top 50 users</h2>
          <span className="text-xs text-foreground/50">
            {users.length} {users.length === 1 ? "ranked" : "ranked"}
          </span>
        </div>

        <ul className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
          {users.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-foreground/50">
              No ranked users yet.
            </li>
          ) : (
            users.map((u, i) => {
              const isMe = u.user_id === state.userId;
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
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-bold">Validators</h2>
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
