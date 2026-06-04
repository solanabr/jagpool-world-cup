"use client";

import { useEffect, useRef, useState } from "react";

type Row = { name: string; pts: number; users: number };

const SNAPSHOTS: Row[][] = [
  [
    { name: "Everstake", pts: 3240, users: 52 },
    { name: "Chorus One", pts: 2780, users: 41 },
    { name: "Figment", pts: 2195, users: 35 },
    { name: "P2P.org", pts: 1820, users: 29 },
  ],
  [
    { name: "Chorus One", pts: 3410, users: 43 },
    { name: "Everstake", pts: 3240, users: 52 },
    { name: "Figment", pts: 2195, users: 35 },
    { name: "P2P.org", pts: 1820, users: 29 },
  ],
  [
    { name: "Chorus One", pts: 3410, users: 43 },
    { name: "Everstake", pts: 3240, users: 52 },
    { name: "P2P.org", pts: 2580, users: 32 },
    { name: "Figment", pts: 2195, users: 35 },
  ],
  [
    { name: "Chorus One", pts: 3410, users: 43 },
    { name: "Figment", pts: 3350, users: 37 },
    { name: "Everstake", pts: 3240, users: 52 },
    { name: "P2P.org", pts: 2580, users: 32 },
  ],
  [
    { name: "Figment", pts: 3680, users: 37 },
    { name: "Chorus One", pts: 3410, users: 43 },
    { name: "Everstake", pts: 3240, users: 52 },
    { name: "P2P.org", pts: 2580, users: 32 },
  ],
  [
    { name: "Figment", pts: 3680, users: 37 },
    { name: "Chorus One", pts: 3410, users: 43 },
    { name: "P2P.org", pts: 3280, users: 35 },
    { name: "Everstake", pts: 3240, users: 52 },
  ],
  [
    { name: "Everstake", pts: 4120, users: 55 },
    { name: "Figment", pts: 3680, users: 37 },
    { name: "Chorus One", pts: 3410, users: 43 },
    { name: "P2P.org", pts: 3280, users: 35 },
  ],
  [
    { name: "Everstake", pts: 4120, users: 55 },
    { name: "Figment", pts: 3680, users: 37 },
    { name: "P2P.org", pts: 3520, users: 36 },
    { name: "Chorus One", pts: 3410, users: 43 },
  ],
];

const ROW_H = 52;
const PAUSE_MS = 2200;
const ANIM_MS = 900;
const GOLD = "rgba(251,191,36,0.04)";
const EASING = "cubic-bezier(0.16,1,0.3,1)";

export function AnimatedLeagueTable() {
  const [snap, setSnap] = useState(0);
  const [prevSnap, setPrevSnap] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [displayPts, setDisplayPts] = useState<Record<string, number>>(() =>
    Object.fromEntries(SNAPSHOTS[0].map((r) => [r.name, r.pts])),
  );
  const ptsRef = useRef<Record<string, number>>(
    Object.fromEntries(SNAPSHOTS[0].map((r) => [r.name, r.pts])),
  );
  const rafRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      const isLast = snap === SNAPSHOTS.length - 1;
      setPrevSnap(snap);
      if (isLast) {
        setAnimate(false);
        setSnap(0);
        setTimeout(() => setAnimate(true), 60);
      } else {
        setAnimate(true);
        setSnap((s) => s + 1);
      }
    }, PAUSE_MS);
    return () => clearTimeout(t);
  }, [snap]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);

    const targets = Object.fromEntries(
      SNAPSHOTS[snap].map((r) => [r.name, r.pts]),
    );

    if (!animate) {
      ptsRef.current = { ...targets };
      setDisplayPts({ ...targets });
      return;
    }

    const starts = { ...ptsRef.current };
    const t0 = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - t0) / ANIM_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next: Record<string, number> = {};
      for (const name in targets) {
        const s = starts[name] ?? targets[name];
        next[name] = Math.round(s + (targets[name] - s) * eased);
      }
      ptsRef.current = next;
      setDisplayPts({ ...next });
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [snap, animate]);

  const current = SNAPSHOTS[snap];
  const prev = SNAPSHOTS[prevSnap];

  return (
    <div className="rounded-2xl overflow-hidden border border-white/8">
      <div className="grid grid-cols-[2.5rem_1fr_3rem_5rem] gap-2 px-4 py-2.5 border-b border-white/8 bg-white/4">
        <span className="text-[10px] text-foreground/30 font-bold uppercase tracking-wider">
          Pos
        </span>
        <span className="text-[10px] text-foreground/30 font-bold uppercase tracking-wider">
          Validator
        </span>
        <span className="text-[10px] text-foreground/30 font-bold uppercase tracking-wider text-right">
          Plrs
        </span>
        <span className="text-[10px] text-foreground/30 font-bold uppercase tracking-wider text-right">
          Pts
        </span>
      </div>

      <div className="relative" style={{ height: SNAPSHOTS[0].length * ROW_H }}>
        {current.map((v, newIdx) => {
          const oldIdx = prev.findIndex((r) => r.name === v.name);
          const delay = animate && oldIdx > newIdx ? 80 : 0;
          const medal =
            newIdx === 0
              ? "🥇"
              : newIdx === 1
                ? "🥈"
                : newIdx === 2
                  ? "🥉"
                  : null;
          return (
            <div
              key={v.name}
              className="absolute w-full grid grid-cols-[2.5rem_1fr_3rem_5rem] gap-2 px-4 items-center border-b border-white/5"
              style={{
                top: newIdx * ROW_H,
                height: ROW_H,
                backgroundColor: newIdx === 0 ? GOLD : "transparent",
                transition: animate
                  ? `top ${ANIM_MS}ms ${EASING} ${delay}ms, background-color ${ANIM_MS}ms ${EASING}`
                  : "none",
              }}
            >
              <span className="text-sm text-center">
                {medal ?? (
                  <span className="text-foreground/30 font-mono text-xs font-bold">
                    {newIdx + 1}
                  </span>
                )}
              </span>
              <span className="font-semibold text-sm truncate">{v.name}</span>
              <span className="text-right text-sm text-foreground/45 tabular-nums font-mono">
                {v.users}
              </span>
              <span className="text-right font-bold text-sm text-[#FFD23F] tabular-nums font-mono">
                {(displayPts[v.name] ?? v.pts).toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/6 px-4 py-2.5 flex items-center justify-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
        <p className="text-xs text-foreground/20">
          Preview · Live standings from Jun 11
        </p>
      </div>
    </div>
  );
}
