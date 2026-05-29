"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Reveal } from "@/components/ui/reveal";
import { TeamFlag } from "@/components/ui/team-flag";

const GROUP_TEAMS = [{ name: "Brazil" }, { name: "Mexico" }];

const CHAMPION_TEAMS = [
  { name: "Argentina" },
  { name: "Brazil" },
  { name: "France" },
  { name: "Germany" },
];

export function PredictShowcase() {
  const [groupPicks, setGroupPicks] = useState<string[]>([]);
  const [knock1, setKnock1] = useState<string | null>("Argentina");
  const [knock2, setKnock2] = useState<string | null>(null);
  const [championIdx, setChampionIdx] = useState(0);
  const [vsPick, setVsPick] = useState<string | null>(null);

  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const snapshot = useRef<Record<string, number>>({});

  const bothKnocks = knock1 !== null && knock2 !== null;
  const singleKnock = !bothKnocks ? (knock1 ?? knock2) : null;

  useEffect(() => { setVsPick(null); }, [knock1, knock2]);

  const sortedGroup = [...GROUP_TEAMS].sort((a, b) => {
    const ia = groupPicks.indexOf(a.name);
    const ib = groupPicks.indexOf(b.name);
    if (ia === -1 && ib === -1) return GROUP_TEAMS.indexOf(a) - GROUP_TEAMS.indexOf(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const handleGroupClick = (name: string) => {
    for (const [n, el] of Object.entries(itemRefs.current)) {
      if (el) snapshot.current[n] = el.getBoundingClientRect().top;
    }
    setGroupPicks((prev) => {
      const other = GROUP_TEAMS.find((t) => t.name !== name)!.name;
      return prev[0] === name ? [] : [name, other];
    });
  };

  useLayoutEffect(() => {
    for (const [name, el] of Object.entries(itemRefs.current)) {
      if (!el || snapshot.current[name] === undefined) continue;
      const delta = snapshot.current[name] - el.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) continue;
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      el.getBoundingClientRect();
      el.style.transition = "transform 260ms cubic-bezier(0.25, 0.46, 0.45, 0.94)";
      el.style.transform = "translateY(0)";
    }
    snapshot.current = {};
  }, [groupPicks]);

  const champion = CHAMPION_TEAMS[championIdx];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

      <Reveal>
      <div className="group relative bg-white/3 border border-white/8 rounded-2xl p-5 flex flex-col gap-4 overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-400/25 h-full">
        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-emerald-400/5 via-transparent to-transparent rounded-2xl" />
        <div className="absolute -bottom-3 -right-3 text-8xl leading-none opacity-5 pointer-events-none select-none grayscale">⚽</div>
        <div className="relative flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/35">Group Stage</span>
          <span className="text-[10px] font-bold text-[#129D49] bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">+5 pts each</span>
        </div>
        <p className="relative text-xs text-foreground/40">Pick who advances from each group</p>
        <div className="relative flex flex-col gap-2 mt-auto">
          {sortedGroup.map(({ name }) => {
            const idx = groupPicks.indexOf(name);
            const selected = idx !== -1;
            const pos = idx === 0 ? "1st" : "2nd";
            return (
              <button
                key={name}
                ref={(el) => { itemRefs.current[name] = el; }}
                onClick={() => handleGroupClick(name)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 w-full text-left transition-opacity ${
                  selected ? "bg-white/5" : "bg-white/5 opacity-35 hover:opacity-60"
                }`}
              >
                <TeamFlag team={name} className="text-base" />
                <span className="text-sm font-medium flex-1">{name}</span>
                {selected && <span className="text-[10px] font-bold text-[#129D49]">{pos} ✓</span>}
              </button>
            );
          })}
        </div>
      </div>
      </Reveal>

      <Reveal delay={150}>
      <div className="group relative bg-white/3 border border-white/8 rounded-2xl p-5 flex flex-col gap-4 overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-sky-400/25 h-full">
        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-sky-400/5 via-transparent to-transparent rounded-2xl" />
        <div className="absolute -bottom-3 -right-3 text-8xl leading-none opacity-5 pointer-events-none select-none grayscale">👑</div>
        <div className="relative flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/35">Knockouts</span>
          <span className="text-[10px] font-bold text-sky-400 bg-sky-400/10 border border-sky-400/20 px-2 py-0.5 rounded-full">+10 pts</span>
        </div>
        <p className="relative text-xs text-foreground/40">Pick the winner of every match</p>
        <div className="relative flex flex-col gap-2 mt-auto">
          <KnockMatch
            a={{ name: "Argentina" }}
            b={{ name: "France" }}
            pick={knock1}
            onPick={(name) => setKnock1(knock1 === name ? null : name)}
          />
          <KnockMatch
            a={{ name: "Spain" }}
            b={{ name: "Germany" }}
            pick={knock2}
            onPick={(name) => setKnock2(knock2 === name ? null : name)}
            dimmed={knock2 === null}
          />
        </div>
      </div>
      </Reveal>

      <Reveal delay={300}>
      <div className="group relative bg-white/3 border border-white/8 rounded-2xl p-5 flex flex-col gap-4 overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-[#FFD23F]/25 h-full">
        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-jagpool-accent/6 via-transparent to-transparent rounded-2xl" />
        <div className="absolute -bottom-3 -right-3 text-8xl leading-none opacity-5 pointer-events-none select-none grayscale">🏆</div>
        <div className="relative flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/35">Champion</span>
          <span className="text-[10px] font-bold text-jagpool-accent bg-jagpool-accent/15 border border-[#FFD23F]/25 px-2 py-0.5 rounded-full">+30 pts</span>
        </div>
        <p className="relative text-xs text-foreground/40">Pick the tournament winner</p>
        <div className="relative flex flex-col gap-2 mt-auto">
          {bothKnocks ? (
            <>
              <div className="flex items-center gap-2">
                {([knock1!, knock2!] as string[]).map((k, i) => {
                  const picked = vsPick === k;
                  const other = vsPick !== null && vsPick !== k;
                  return (
                    <div key={k} className="contents">
                      {i === 1 && <span className="text-foreground/20 text-xs font-bold shrink-0">vs</span>}
                      <button
                        onClick={() => setVsPick(vsPick === k ? null : k)}
                        className={`flex-1 flex items-center gap-2 px-3 py-3 rounded-xl border transition-all ${
                          picked
                            ? "bg-jagpool-accent/10 border-[#FFD23F]/25"
                            : other
                              ? "bg-white/4 border-transparent opacity-50 hover:opacity-70"
                              : "bg-white/4 border-transparent hover:bg-white/6"
                        }`}
                      >
                        <TeamFlag team={k} className="text-2xl" />
                        <span className={`text-sm font-bold truncate ${picked ? "text-jagpool-accent" : ""}`}>{k}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-foreground/25 text-center leading-relaxed">
                One pick · highest-value prediction in the game
              </p>
            </>
          ) : singleKnock ? (
            <>
              <div className="bg-white/5 rounded-xl px-3.5 py-3 flex items-center gap-3">
                <TeamFlag team={singleKnock} className="text-2xl" />
                <p className="flex-1 font-black text-sm">{singleKnock}</p>
                <span className="text-jagpool-accent font-black text-base">+30</span>
              </div>
              <p className="text-[10px] text-foreground/25 text-center leading-relaxed">
                One pick · highest-value prediction in the game
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => setChampionIdx((i) => (i + 1) % CHAMPION_TEAMS.length)}
                className="bg-white/5 rounded-xl px-3.5 py-3 flex items-center gap-3 w-full text-left hover:bg-white/8 transition-colors"
              >
                <TeamFlag team={champion.name} className="text-2xl" />
                <p className="flex-1 font-black text-sm">{champion.name}</p>
                <span className="text-jagpool-accent font-black text-base">+30</span>
              </button>
              <p className="text-[10px] text-foreground/25 text-center leading-relaxed">
                One pick · highest-value prediction in the game
              </p>
            </>
          )}
        </div>
      </div>
      </Reveal>

    </div>
  );
}

function KnockMatch({
  a, b, pick, onPick, dimmed = false, accent = "blue", tall = false,
}: {
  a: { name: string };
  b: { name: string };
  pick: string | null;
  onPick: (name: string) => void;
  dimmed?: boolean;
  accent?: "orange" | "amber" | "blue";
  tall?: boolean;
}) {
  const selectedCls =
    accent === "amber"
      ? "bg-jagpool-accent/10 border-[#FFD23F]/25"
      : accent === "blue"
        ? "bg-sky-400/10 border-sky-400/20"
        : "bg-jagpool-primary/10 border-jagpool-primary/20";
  const selectedTextCls =
    accent === "amber"
      ? "font-semibold text-jagpool-accent"
      : accent === "blue"
        ? "font-semibold text-sky-400"
        : "font-semibold text-jagpool-primary";

  return (
    <div className={`flex items-center gap-2 transition-opacity ${dimmed ? "opacity-35" : ""}`}>
      {[a, b].map((team, i) => {
        const picked = pick === team.name;
        const other = pick !== null && pick !== team.name;
        return (
          <div key={team.name} className="contents">
            {i === 1 && <span className="text-foreground/20 text-xs font-bold shrink-0">vs</span>}
            <button
              onClick={() => onPick(team.name)}
              className={`flex-1 rounded-xl flex items-center gap-2.5 transition-all border ${
                tall ? "px-3.5 py-4 flex-col justify-center" : "px-3 py-2.5"
              } ${
                picked
                  ? selectedCls
                  : other
                    ? "bg-white/4 border-transparent opacity-50 hover:opacity-70"
                    : "bg-white/4 border-transparent hover:bg-white/6"
              }`}
            >
              <TeamFlag team={team.name} className={tall ? "text-2xl" : "text-base"} />
              <span className={`${tall ? "text-sm font-bold" : "text-sm"} ${picked ? selectedTextCls : "font-medium"}`}>
                {team.name}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
