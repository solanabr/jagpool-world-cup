"use client";

import { Reveal } from "@/components/ui/reveal";
import StakeTerminal from "./StakeTerminal";

const JAGSOL_FEATURES: { icon: React.ReactNode; text: string }[] = [
  {
    text: "Required to enter predictions",
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
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    text: "Swap SOL, USDC or any LST",
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
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    ),
  },
];

export default function StakeSection() {
  return (
    <section className="max-w-6xl mx-auto px-4 pb-20">
      <Reveal className="mb-10">
        <p className="text-xs gradient-label uppercase tracking-widest font-semibold mb-1">
          Stake to play
        </p>
        <h2 className="text-2xl sm:text-3xl font-black">
          Get JagSOL, unlock the game
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        <Reveal className="flex flex-col gap-5">
          <p className="text-foreground/50 leading-relaxed">
            JagSOL is JagPool&apos;s liquid staking token. Hold at least 1
            JagSOL to participate in predictions and be eligible for SOL prize
            payouts.
          </p>
          <ul className="flex flex-col gap-2.5">
            {JAGSOL_FEATURES.map(({ icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-2.5 text-sm text-foreground/55"
              >
                <span className="text-[#129D49] shrink-0">{icon}</span>
                {text}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={150}>
          <StakeTerminal />
        </Reveal>
      </div>
    </section>
  );
}
