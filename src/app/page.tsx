import React from "react";
import { Header } from "@/components/layout/header";
import { Countdown } from "@/components/predictions/countdown";
import { PredictShowcase } from "@/components/landing/predict-showcase";
import { SiwsButton } from "@/components/auth/siws-button";
import { Reveal } from "@/components/ui/reveal";
import { AnimatedLeagueTable } from "@/components/landing/animated-league-table";
import { PrizePool } from "@/components/landing/prize-pool";

const TOURNAMENT_START = "2026-06-11T16:00:00Z";

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-[#129D49]/7 blur-[120px] rounded-full" />
        <div className="absolute top-2/5 -right-48 w-[400px] h-[400px] bg-jagpool-accent/5 blur-3xl rounded-full animate-float-slow" />
      </div>

      <Header transparent staticMode />

      <main>
        <section className="relative text-center max-w-5xl mx-auto px-4 pt-20 pb-20">
          <div className="relative flex flex-col items-center gap-7 animate-fade-up">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-foreground/45 text-sm font-medium">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl">🇺🇸</span>
                <span className="text-2xl">🇨🇦</span>
                <span className="text-2xl">🇲🇽</span>
              </div>
              <span className="hidden sm:inline mx-2 text-white/15">·</span>
              <span>USA · Canada · Mexico · 2026</span>
            </div>

            <div>
              <p className="text-sm font-bold gradient-label uppercase tracking-[0.3em] mb-4">
                Prediction Game
              </p>
              <h1 className="text-[clamp(3rem,11vw,7.5rem)] font-black leading-[0.88] tracking-tight">
                FIFA
                <br />
                World Cup
                <br />
                <span className="gradient-text">2026</span>
              </h1>
            </div>

            <p className="text-lg text-foreground/55 max-w-md leading-relaxed">
              The biggest on-chain football prediction game on Solana. Pick
              winners, score points, and{" "}
              <span className="text-white font-semibold">win SOL</span>.
            </p>

            <div className="sm:hidden">
              <SiwsButton />
            </div>

            <div className="flex flex-col items-center gap-2.5">
              <Countdown
                target={TOURNAMENT_START}
                label="🏆 Tournament is live!"
              />
              <p className="text-xs text-foreground/25">
                48 nations · 104 matches · Jun 11 – Jul 19
              </p>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 pb-20">
          <Reveal className="mb-10">
            <p className="text-xs gradient-label uppercase tracking-widest font-semibold mb-1">
              What you predict
            </p>
            <h2 className="text-2xl sm:text-3xl font-black">
              Every stage, every match
            </h2>
          </Reveal>

          <PredictShowcase />
        </section>

        <section className="max-w-6xl mx-auto px-4 pb-20">
          <Reveal className="mb-10">
            <p className="text-xs gradient-label uppercase tracking-widest font-semibold mb-1">
              How it works
            </p>
            <h2 className="text-2xl sm:text-3xl font-black">
              Match day in three steps
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 120}>
                <div className="relative bg-white/3 border border-white/8 rounded-2xl p-7 overflow-hidden group hover:bg-white/5 hover:border-white/15 transition-all h-full">
                  <span className="absolute -top-1 -right-2 text-[5.5rem] font-black leading-none text-white/4 select-none pointer-events-none tabular-nums group-hover:text-[#129D49]/8 transition-colors">
                    {step.n}
                  </span>
                  <div className="relative flex flex-col gap-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#129D49]/70">
                        {step.phase}
                      </span>
                      <span className="text-foreground/40">{step.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-black text-base mb-2">{step.title}</h3>
                      <p className="text-sm text-foreground/45 leading-relaxed">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 pb-20">
          <Reveal className="mb-10">
            <p className="text-xs gradient-label uppercase tracking-widest font-semibold mb-1">
              Rewards
            </p>
            <h2 className="text-2xl sm:text-3xl font-black">Prize pool</h2>
          </Reveal>

          <PrizePool />
        </section>

        <section className="max-w-6xl mx-auto px-4 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-end">
            <Reveal className="flex flex-col gap-5">
              <div>
                <p className="text-xs gradient-label uppercase tracking-widest font-semibold mb-1">
                  Team competition
                </p>
                <h2 className="text-2xl sm:text-3xl font-black leading-tight">
                  Your validator
                  <br />
                  is your team
                </h2>
              </div>
              <p className="text-foreground/50 leading-relaxed">
                Choose a Solana validator when you sign up. Every prediction you
                make adds to their league points. The winning validator earns
                extra SOL stake delegation from JagPool.
              </p>
              <div className="grid-cols-2 gap-3 hidden sm:grid">
                {VALIDATOR_FEATURES.map(({ icon, text }) => (
                  <div
                    key={text}
                    className="group flex items-center gap-2.5 bg-white/3 border border-white/8 rounded-xl px-3.5 py-2.5 cursor-default transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/6 hover:border-[#129D49]/30 hover:shadow-[0_4px_20px_rgba(249,115,22,0.08)]"
                  >
                    <span className="text-foreground/45 shrink-0 transition-colors duration-200 group-hover:text-[#129D49]/80">{icon}</span>
                    <span className="text-sm text-foreground/60 font-medium transition-colors duration-200 group-hover:text-foreground/85">
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={150}>
              <AnimatedLeagueTable />
            </Reveal>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 pb-24">
          <Reveal>
          <div className="relative rounded-3xl border border-white/8 bg-white/2 overflow-hidden px-8 py-14 flex flex-col items-center text-center gap-8">
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-50 bg-[#129D49]/8 blur-[80px] rounded-full" />
            </div>

            <div className="relative flex flex-col items-center gap-4">
              <p className="text-xs gradient-label uppercase tracking-[0.3em] font-semibold">
                Ready to play
              </p>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">
                Your picks won&apos;t make
                <br />
                <span className="gradient-text">themselves</span>
              </h2>
              <p className="text-foreground/50 max-w-sm leading-relaxed">
                Tournament kicks off June 11. Connect your wallet, join a
                validator, and lock in your predictions before the whistle.
              </p>
            </div>

            <div className="relative flex flex-col items-center gap-3">
              <SiwsButton />
              <p className="text-[11px] text-foreground/25">
                JagSOL required in your wallet to play
              </p>
            </div>
          </div>
          </Reveal>
        </section>

        <footer className="border-t border-white/6">
          <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-foreground/25">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/jgst.svg" alt="JagPool × Superteam Brazil" className="w-full h-full" />
              </div>
              <div className="flex flex-col leading-none gap-0.75">
                <span className="font-black text-sm text-white/70">
                  JagPool <span className="gradient-text">WC 2026</span>
                </span>
                <span className="text-[9px] font-semibold text-white/25 tracking-[0.18em] uppercase">
                  × Superteam Brazil
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span>Built on Solana</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

const STEPS: {
  phase: string;
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}[] = [
  {
    phase: "Pre-match",
    n: "01",
    title: "Get your ticket",
    body: "Connect your Solana wallet and verify your JagSOL balance. It's your pass to play.",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    phase: "Kick-off",
    n: "02",
    title: "Join a team",
    body: "Choose a Solana validator to represent. Your points count toward their collective league position.",
    icon: (
      <svg
        width="18"
        height="18"
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
    ),
  },
  {
    phase: "Full time",
    n: "03",
    title: "Make your calls",
    body: "Predict group advancers, knockout winners, late-stage scores, and the champion.",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
];

const VALIDATOR_FEATURES: { icon: React.ReactNode; text: string }[] = [
  {
    text: "Pick once, permanent",
    icon: (
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
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    text: "Live league table",
    icon: (
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
    ),
  },
  {
    text: "SOL stake prize",
    icon: (
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
        <path d="M12 6v12M9 9h4.5a2.5 2.5 0 0 1 0 5H9m0 0h5" />
      </svg>
    ),
  },
  {
    text: "Validators worldwide",
    icon: (
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
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
];


