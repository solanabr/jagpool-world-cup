"use client";

import { toCsv, type CsvValue } from "@/lib/csv";

type Row = {
  rank: number;
  username: string;
  wallet_address: string;
  total_points: number;
  validator_name: string | null;
};

export function SnapshotCsvButton({
  rows,
  filename,
}: {
  rows: Row[];
  filename: string;
}) {
  function download() {
    const csv = toCsv(
      ["Rank", "Handle", "Wallet", "Points", "Validator"],
      rows.map((r): CsvValue[] => [
        r.rank,
        r.username,
        r.wallet_address,
        r.total_points,
        r.validator_name,
      ]),
    );
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition font-medium"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      CSV
    </button>
  );
}
