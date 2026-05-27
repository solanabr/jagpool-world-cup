import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UserRow } from "@/components/admin/user-row";

export const dynamic = "force-dynamic";

type AdminUser = {
  id: string;
  username: string;
  wallet_address: string;
  validator_id: string | null;
  validator_name: string | null;
  validator_locked_at: string | null;
  jagsol_balance: string | null;
  is_admin: boolean;
  created_at: string;
};

export default async function AdminUsersPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_users_admin", {
    p_limit: 200,
    p_offset: 0,
    p_search: null,
  });

  if (error) {
    return (
      <p className="text-red-400">
        Failed to load users: {error.message}
      </p>
    );
  }

  const users = (data as AdminUser[]) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">Users ({users.length})</h1>
        <p className="text-sm text-foreground/60">
          Grant or revoke admin privileges. You cannot revoke your own admin.
        </p>
      </div>
      <ul className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
        {users.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-foreground/50">
            No users yet.
          </li>
        ) : (
          users.map((u) => (
            <UserRow key={u.id} user={u} selfId={auth.state.userId} />
          ))
        )}
      </ul>
    </div>
  );
}
