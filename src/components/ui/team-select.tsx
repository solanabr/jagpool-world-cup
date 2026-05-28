"use client";

import { useEffect, useRef, useState } from "react";
import { flagFor } from "@/lib/wc2026/flags";

interface Option {
  value: string;
  label: string;
  flag?: string;
}

interface TeamSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
}

export function TeamSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
}: TeamSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    if (!open) { setQuery(""); return; }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setQuery((q) => q.slice(0, -1));
      } else if (e.key === "Enter") {
        if (filtered.length > 0) {
          onChange(filtered[0].value);
          setOpen(false);
          setQuery("");
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setQuery((q) => q + e.key);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtered]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all text-left ${
          disabled
            ? "bg-white/3 border-white/8 text-foreground/30 cursor-not-allowed"
            : open
              ? "bg-[#1f1f1f] border-jagpool-primary/50 shadow-sm shadow-jagpool-primary/10"
              : "bg-[#1a1a1a] border-white/20 hover:border-white/35 hover:bg-[#1f1f1f]"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {open && query ? (
            <span className="text-foreground/70 font-mono tracking-wide">
              {query}<span className="animate-pulse">_</span>
            </span>
          ) : selected ? (
            <span className="flex items-center gap-2 text-white">
              {selected.flag ?? flagFor(selected.label)}
              <span className="truncate">{selected.label}</span>
            </span>
          ) : (
            <span className="text-white/70">{placeholder}</span>
          )}
        </span>
        <svg
          className={`shrink-0 text-foreground/25 transition-transform ${open ? "rotate-180" : ""}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-[#141414] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
          <ul
            className="max-h-56 overflow-y-auto p-1
              [&::-webkit-scrollbar]:w-1
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-white/10
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-thumb:hover]:bg-white/20"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-center text-foreground/30">
                No teams found
              </li>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => { onChange(opt.value); setOpen(false); setQuery(""); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                        isSelected
                          ? "bg-jagpool-primary/12 text-jagpool-primary font-medium"
                          : "text-foreground/70 hover:bg-white/6 hover:text-foreground"
                      }`}
                    >
                      <span className="text-base leading-none shrink-0">
                        {opt.flag ?? flagFor(opt.label)}
                      </span>
                      <span className="flex-1 truncate">{opt.label}</span>
                      {isSelected ? (
                        <svg className="shrink-0 text-jagpool-primary" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
