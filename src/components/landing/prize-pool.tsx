"use client";

import { Reveal } from "@/components/ui/reveal";

const PRIZES = [
  { rank: "1st",      amount: 8,   icon: "🥇", each: false },
  { rank: "2nd",      amount: 5,   icon: "🥈", each: false },
  { rank: "3rd",      amount: 3,   icon: "🥉", each: false },
  { rank: "4th",      amount: 2,   icon: null,  each: false },
  { rank: "5th",      amount: 1,   icon: null,  each: false },
  { rank: "6th–10th", amount: 0.5, icon: null,  each: true  },
];

const MAX = 8;

function StarIcon({ opacity }: { opacity: string }) {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity }}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function PrizePool() {
  return (
    <div className="flex flex-col gap-3 sm:gap-2.5">
      {PRIZES.map((p, i) => {
        const barBg =
          i === 0
            ? "linear-gradient(to right, rgba(251,191,36,0.8), rgba(251,191,36,0.35))"
            : "linear-gradient(to right, rgba(18,157,73,0.7), rgba(18,157,73,0.2))";

        const iconEl = p.icon ?? (
          i === 3 ? <StarIcon opacity="0.55" /> :
          i === 4 ? <StarIcon opacity="0.35" /> :
                    <StarIcon opacity="0.2"  />
        );

        return (
          <Reveal key={p.rank} delay={i * 60}>
            <div className="flex flex-col gap-1.5 sm:hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 flex items-center justify-center text-base leading-none">{iconEl}</span>
                  <span className="text-sm text-foreground/45 font-medium">{p.rank}</span>
                </div>
                <span className="text-sm font-bold tabular-nums text-foreground/70">
                  {p.amount} jagSOL{p.each ? " ea." : ""}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(p.amount / MAX) * 100}%`, background: barBg }} />
              </div>
            </div>

            <div className="hidden sm:flex sm:items-center sm:gap-4">
              <div className="w-20 flex items-center gap-2 shrink-0">
                <span className="w-5 flex items-center justify-center text-base leading-none">{iconEl}</span>
                <span className="text-xs text-foreground/40 font-medium tabular-nums">{p.rank}</span>
              </div>
              <div className="flex-1 h-10 rounded-xl bg-white/4 overflow-hidden relative">
                <div
                  className="absolute left-0 top-0 h-full rounded-xl"
                  style={{ width: `${(p.amount / MAX) * 100}%`, background: barBg }}
                />
              </div>
              <span className="w-24 text-right text-sm font-bold tabular-nums text-foreground/70 shrink-0">
                {p.amount} jagSOL{p.each ? " ea." : ""}
              </span>
            </div>
          </Reveal>
        );
      })}

      <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-foreground/30">
        Minimum to participate:
        <span className="text-jagpool-accent font-semibold">1 jagSOL</span>
      </div>
    </div>
  );
}
