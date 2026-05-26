import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveAuthenticatedUserState } from "@/lib/user-state";
import { Header } from "@/components/layout/header";
import { SiwsButton } from "@/components/auth/siws-button";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ go?: string }>;
}) {
  const state = await resolveAuthenticatedUserState();
  const { go } = await searchParams;

  if (state && go !== "stay") {
    redirect(state.redirectPath);
  }

  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-16">
        <section className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold mb-6">
            JagPool <span className="text-jagpool-primary">World Cup 2026</span>
          </h1>
          <p className="text-xl text-foreground/70 mb-8">
            Make your predictions, choose a validator, and help your team earn
            extra stake from JagPool.
          </p>

          {state ? (
            <Link href={state.redirectPath}>
              <Button size="lg">Go to my dashboard</Button>
            </Link>
          ) : (
            <div className="flex justify-center">
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 w-full max-w-md">
                <SiwsButton />
              </div>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="font-semibold mb-2">1. Sign in with Solana</h3>
            <p className="text-sm text-foreground/70">
              Connect your wallet and verify your JagSOL balance.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="font-semibold mb-2">2. Pick your validator</h3>
            <p className="text-sm text-foreground/70">
              Your choice is final — your points count toward that team.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="font-semibold mb-2">3. Predict and score</h3>
            <p className="text-sm text-foreground/70">
              Nail outcomes to climb the global ranking. Top 10 win SPL prizes.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
